'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { AIService } from '@/features/ai/services/ai.service';
import type { LeadContext } from '@/features/ai/types';

import { renderTemplate } from '../utils/render-template';
import type { CadenceStepRow, InteractionRow, MessageTemplateRow } from '../types';

interface EnrollmentWithLead {
  id: string;
  cadence_id: string;
  lead_id: string;
  current_step: number;
  status: string;
  next_step_due: string | null;
  lead: {
    id: string;
    org_id: string;
    nome_fantasia: string | null;
    razao_social: string | null;
    cnpj: string;
    email: string | null;
    telefone: string | null;
    municipio: string | null;
    uf: string | null;
    porte: string | null;
  };
}

interface ExecutionResult {
  processed: number;
  sent: number;
  failed: number;
  completed: number;
  errors: string[];
}

/**
 * Executes pending cadence steps.
 * Called by pg_cron every 15 minutes or manually.
 */
export async function executePendingSteps(): Promise<ActionResult<ExecutionResult>> {
  const supabase = await createServerSupabaseClient();

  const { data: enrollments, error: enrollError } = (await (supabase
    .from('cadence_enrollments') as ReturnType<typeof supabase.from>)
    .select('*, lead:leads(*)')
    .eq('status', 'active')
    .lte('next_step_due', new Date().toISOString())
    .limit(100)) as { data: EnrollmentWithLead[] | null; error: { message: string } | null };

  if (enrollError) {
    return { success: false, error: 'Erro ao buscar enrollments pendentes' };
  }

  const result: ExecutionResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    completed: 0,
    errors: [],
  };

  for (const enrollment of enrollments ?? []) {
    result.processed++;

    const { data: step } = (await (supabase
      .from('cadence_steps') as ReturnType<typeof supabase.from>)
      .select('*')
      .eq('cadence_id', enrollment.cadence_id)
      .eq('step_order', enrollment.current_step)
      .single()) as { data: CadenceStepRow | null };

    if (!step) {
      await (supabase.from('cadence_enrollments') as ReturnType<typeof supabase.from>)
        .update({ status: 'completed', completed_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', enrollment.id);
      result.completed++;
      continue;
    }

    let messageContent = '';
    let _subject: string | null = null;
    let aiGenerated = false;

    if (step.template_id) {
      const { data: template } = (await (supabase
        .from('message_templates') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', step.template_id)
        .single()) as { data: MessageTemplateRow | null };

      if (template) {
        const variables: Record<string, string | null> = {
          nome_fantasia: enrollment.lead.nome_fantasia,
          razao_social: enrollment.lead.razao_social,
          cnpj: enrollment.lead.cnpj,
          email: enrollment.lead.email,
          telefone: enrollment.lead.telefone,
          municipio: enrollment.lead.municipio,
          uf: enrollment.lead.uf,
          porte: enrollment.lead.porte,
        };
        messageContent = renderTemplate(template.body, variables);
        if (template.subject) {
          _subject = renderTemplate(template.subject, variables);
        }

        // AI personalization when enabled
        if (step.ai_personalization && messageContent) {
          try {
            const leadContext: LeadContext = {
              nome_fantasia: enrollment.lead.nome_fantasia,
              razao_social: enrollment.lead.razao_social,
              cnpj: enrollment.lead.cnpj,
              email: enrollment.lead.email,
              telefone: enrollment.lead.telefone,
              porte: enrollment.lead.porte,
              cnae: null,
              situacao_cadastral: null,
              faturamento_estimado: null,
              endereco: enrollment.lead.municipio
                ? { cidade: enrollment.lead.municipio, uf: enrollment.lead.uf ?? undefined }
                : null,
            };
            const aiResult = await AIService.personalizeMessage(
              step.channel as 'email' | 'whatsapp',
              messageContent,
              leadContext,
              enrollment.lead.org_id,
            );
            messageContent = aiResult.body;
            aiGenerated = true;
          } catch (aiError) {
            console.error('AI personalization failed, using template fallback:', aiError);
          }
        }
      }
    }

    // Record interaction
    const { data: interaction } = (await (supabase
      .from('interactions') as ReturnType<typeof supabase.from>)
      .insert({
        org_id: enrollment.lead.org_id,
        lead_id: enrollment.lead_id,
        cadence_id: enrollment.cadence_id,
        step_id: step.id,
        channel: step.channel,
        type: 'sent',
        message_content: messageContent || null,
        ai_generated: aiGenerated,
      } as Record<string, unknown>)
      .select('id')
      .single()) as { data: Pick<InteractionRow, 'id'> | null };

    if (!interaction) {
      result.failed++;
      result.errors.push(`Falha ao registrar interação para lead ${enrollment.lead_id}`);
      continue;
    }

    // Check if there's a next step
    const { data: nextStep } = (await (supabase
      .from('cadence_steps') as ReturnType<typeof supabase.from>)
      .select('step_order')
      .eq('cadence_id', enrollment.cadence_id)
      .eq('step_order', enrollment.current_step + 1)
      .maybeSingle()) as { data: { step_order: number } | null };

    if (nextStep) {
      await (supabase.from('cadence_enrollments') as ReturnType<typeof supabase.from>)
        .update({ current_step: enrollment.current_step + 1 } as Record<string, unknown>)
        .eq('id', enrollment.id);
    } else {
      await (supabase.from('cadence_enrollments') as ReturnType<typeof supabase.from>)
        .update({ status: 'completed', completed_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', enrollment.id);
      result.completed++;
    }

    result.sent++;
  }

  return { success: true, data: result };
}
