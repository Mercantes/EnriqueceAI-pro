'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ActionResult } from '@/lib/actions/action-result';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

import { AIService } from '@/features/ai/services/ai.service';
import type { LeadContext } from '@/features/ai/types';
import { EmailService } from '@/features/integrations/services/email.service';
import { WhatsAppCreditService } from '@/features/integrations/services/whatsapp-credit.service';
import { WhatsAppService, validateBrazilianPhone } from '@/features/integrations/services/whatsapp.service';

import { cleanCompanyName } from '../utils/clean-company-name';
import { renderTemplate } from '../utils/render-template';
import type { CadenceStepRow, InteractionRow, MessageTemplateRow } from '../types';

const BATCH_SIZE = 50;

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
    socios: Array<{ nome: string; qualificacao?: string }> | null;
  };
}

export interface ExecutionResult {
  processed: number;
  sent: number;
  failed: number;
  completed: number;
  skipped: number;
  errors: string[];
}

/**
 * Core execution logic — processes pending cadence enrollments.
 * Accepts any Supabase client (cookie-based or service-role).
 */
async function executeStepsCore(supabase: SupabaseClient): Promise<ActionResult<ExecutionResult>> {
  const startTime = Date.now();

  const { data: enrollments, error: enrollError } = (await (supabase
    .from('cadence_enrollments') as ReturnType<typeof supabase.from>)
    .select('*, lead:leads(*)')
    .eq('status', 'active')
    .lte('next_step_due', new Date().toISOString())
    .limit(BATCH_SIZE)) as { data: EnrollmentWithLead[] | null; error: { message: string } | null };

  if (enrollError) {
    console.error('[cadence-engine] Failed to fetch enrollments:', enrollError.message);
    return { success: false, error: 'Erro ao buscar enrollments pendentes' };
  }

  const result: ExecutionResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    completed: 0,
    skipped: 0,
    errors: [],
  };

  console.warn(`[cadence-engine] Found ${enrollments?.length ?? 0} due enrollments`);

  for (const enrollment of enrollments ?? []) {
    const stepStart = Date.now();
    result.processed++;

    try {
      // Fetch current step
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
        console.warn(`[cadence-engine] enrollment=${enrollment.id} status=completed reason=no_step duration_ms=${Date.now() - stepStart}`);
        continue;
      }

      // Idempotency check: skip if interaction already exists for this enrollment + step
      const { data: existingInteraction } = (await (supabase
        .from('interactions') as ReturnType<typeof supabase.from>)
        .select('id')
        .eq('cadence_id', enrollment.cadence_id)
        .eq('step_id', step.id)
        .eq('lead_id', enrollment.lead_id)
        .limit(1)
        .maybeSingle()) as { data: { id: string } | null };

      if (existingInteraction) {
        result.skipped++;
        console.warn(`[cadence-engine] enrollment=${enrollment.id} step=${step.step_order} status=skipped reason=idempotent duration_ms=${Date.now() - stepStart}`);
        continue;
      }

      // Auto-stop: check if lead already replied to this cadence
      const { data: replyInteraction } = (await (supabase
        .from('interactions') as ReturnType<typeof supabase.from>)
        .select('id')
        .eq('cadence_id', enrollment.cadence_id)
        .eq('lead_id', enrollment.lead_id)
        .eq('type', 'replied')
        .limit(1)
        .maybeSingle()) as { data: { id: string } | null };

      if (replyInteraction) {
        await (supabase.from('cadence_enrollments') as ReturnType<typeof supabase.from>)
          .update({ status: 'replied' } as Record<string, unknown>)
          .eq('id', enrollment.id);
        result.skipped++;
        console.warn(`[cadence-engine] enrollment=${enrollment.id} status=replied reason=auto_stop duration_ms=${Date.now() - stepStart}`);
        continue;
      }

      let messageContent = '';
      let subject: string | null = null;
      let aiGenerated = false;

      if (step.template_id) {
        const { data: template } = (await (supabase
          .from('message_templates') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('id', step.template_id)
          .single()) as { data: MessageTemplateRow | null };

        if (template) {
          // Build variables: lead data + vendor data
          const primarySocioNome = enrollment.lead.socios?.[0]?.nome ?? null;
          const variables: Record<string, string | null> = {
            primeiro_nome: primarySocioNome ? primarySocioNome.trim().split(/\s+/)[0] ?? null : null,
            empresa: cleanCompanyName(enrollment.lead.nome_fantasia ?? enrollment.lead.razao_social),
            nome_fantasia: enrollment.lead.nome_fantasia,
            razao_social: enrollment.lead.razao_social,
            cnpj: enrollment.lead.cnpj,
            email: enrollment.lead.email,
            telefone: enrollment.lead.telefone,
            municipio: enrollment.lead.municipio,
            uf: enrollment.lead.uf,
            porte: enrollment.lead.porte,
            nome_vendedor: null,
            email_vendedor: null,
          };

          // Fetch vendor (cadence creator) data for template variables
          try {
            const { data: cadenceForVendor } = (await (supabase
              .from('cadences') as ReturnType<typeof supabase.from>)
              .select('created_by')
              .eq('id', enrollment.cadence_id)
              .single()) as { data: { created_by: string | null } | null };

            if (cadenceForVendor?.created_by) {
              const adminClient = createAdminSupabaseClient();
              const { data: vendorUser } = await adminClient.auth.admin.getUserById(cadenceForVendor.created_by);
              if (vendorUser?.user) {
                const meta = vendorUser.user.user_metadata as { full_name?: string } | undefined;
                variables.nome_vendedor = meta?.full_name ?? null;
                variables.email_vendedor = vendorUser.user.email ?? null;
              }
            }
          } catch (vendorErr) {
            console.error(`[cadence-engine] enrollment=${enrollment.id} failed to fetch vendor data:`, vendorErr);
          }

          messageContent = renderTemplate(template.body, variables);
          if (template.subject) {
            subject = renderTemplate(template.subject, variables);
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
              console.error(`[cadence-engine] enrollment=${enrollment.id} AI personalization failed, using template fallback:`, aiError);
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
          metadata: subject ? { subject } : null,
          ai_generated: aiGenerated,
        } as Record<string, unknown>)
        .select('id')
        .single()) as { data: Pick<InteractionRow, 'id'> | null };

      if (!interaction) {
        result.failed++;
        result.errors.push(`Falha ao registrar interação para lead ${enrollment.lead_id}`);
        console.error(`[cadence-engine] enrollment=${enrollment.id} step=${step.step_order} channel=${step.channel} status=failed reason=insert_error duration_ms=${Date.now() - stepStart}`);
        continue;
      }

      // Send email via Gmail API if channel is email
      if (step.channel === 'email') {
        if (!enrollment.lead.email) {
          result.failed++;
          result.errors.push(`Lead ${enrollment.lead_id} sem email — não é possível enviar`);
          console.error(`[cadence-engine] enrollment=${enrollment.id} step=${step.step_order} status=failed reason=no_lead_email duration_ms=${Date.now() - stepStart}`);
          continue;
        }

        // Fetch cadence.created_by to know which user's Gmail to use
        const { data: cadence } = (await (supabase
          .from('cadences') as ReturnType<typeof supabase.from>)
          .select('created_by')
          .eq('id', enrollment.cadence_id)
          .single()) as { data: { created_by: string | null } | null };

        if (!cadence?.created_by) {
          console.error(`[cadence-engine] enrollment=${enrollment.id} no created_by on cadence — skipping email send`);
        } else {
          const emailResult = await EmailService.sendEmail(
            cadence.created_by,
            enrollment.lead.org_id,
            {
              to: enrollment.lead.email,
              subject: subject ?? '',
              htmlBody: messageContent,
            },
            interaction.id,
            supabase,
          );

          if (emailResult.success && emailResult.messageId) {
            await (supabase.from('interactions') as ReturnType<typeof supabase.from>)
              .update({ external_id: emailResult.messageId } as Record<string, unknown>)
              .eq('id', interaction.id);
            console.warn(`[cadence-engine] enrollment=${enrollment.id} email sent messageId=${emailResult.messageId}`);
          } else {
            console.error(`[cadence-engine] enrollment=${enrollment.id} email send failed: ${emailResult.error}`);
          }
        }
      } else if (step.channel === 'whatsapp') {
        const phone = enrollment.lead.telefone;
        if (!phone || !validateBrazilianPhone(phone)) {
          result.failed++;
          result.errors.push(`Lead ${enrollment.lead_id} sem telefone válido — não é possível enviar WhatsApp`);
          console.error(`[cadence-engine] enrollment=${enrollment.id} step=${step.step_order} status=failed reason=invalid_phone duration_ms=${Date.now() - stepStart}`);
          continue;
        }

        // Check and deduct WhatsApp credit
        const creditResult = await WhatsAppCreditService.checkAndDeductCredit(enrollment.lead.org_id, supabase);
        if (!creditResult.allowed) {
          result.failed++;
          result.errors.push(`Org ${enrollment.lead.org_id} sem créditos WhatsApp: ${creditResult.error}`);
          console.error(`[cadence-engine] enrollment=${enrollment.id} status=failed reason=no_credits duration_ms=${Date.now() - stepStart}`);
          continue;
        }

        if (creditResult.isOverage) {
          console.warn(`[cadence-engine] enrollment=${enrollment.id} whatsapp overage: used=${creditResult.used} limit=${creditResult.limit}`);
        }

        const waResult = await WhatsAppService.sendMessage(
          enrollment.lead.org_id,
          { to: phone, body: messageContent },
          supabase,
        );

        if (waResult.success && waResult.messageId) {
          await (supabase.from('interactions') as ReturnType<typeof supabase.from>)
            .update({ external_id: waResult.messageId } as Record<string, unknown>)
            .eq('id', interaction.id);
          console.warn(`[cadence-engine] enrollment=${enrollment.id} whatsapp sent messageId=${waResult.messageId}`);
        } else {
          console.error(`[cadence-engine] enrollment=${enrollment.id} whatsapp send failed: ${waResult.error}`);
        }
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
      console.warn(`[cadence-engine] enrollment=${enrollment.id} step=${step.step_order} channel=${step.channel} status=sent ai=${aiGenerated} duration_ms=${Date.now() - stepStart}`);
    } catch (err) {
      result.failed++;
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`enrollment=${enrollment.id}: ${message}`);
      console.error(`[cadence-engine] enrollment=${enrollment.id} status=error error="${message}" duration_ms=${Date.now() - stepStart}`);
    }
  }

  console.warn(`[cadence-engine] Batch complete: processed=${result.processed} sent=${result.sent} failed=${result.failed} completed=${result.completed} skipped=${result.skipped} total_ms=${Date.now() - startTime}`);

  return { success: true, data: result };
}

/**
 * Executes pending cadence steps using cookie-based auth.
 * For manual invocation from the UI (Server Action).
 */
export async function executePendingSteps(): Promise<ActionResult<ExecutionResult>> {
  const supabase = await createServerSupabaseClient();
  return executeStepsCore(supabase);
}

/**
 * Executes pending cadence steps using service role (bypasses RLS).
 * For cron/API route invocation — no cookies needed.
 */
export async function executePendingStepsCron(): Promise<ActionResult<ExecutionResult>> {
  const supabase = createServiceRoleClient();
  return executeStepsCore(supabase);
}
