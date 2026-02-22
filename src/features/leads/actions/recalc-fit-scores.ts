'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { calculateFitScore, type FitScoreRule } from '../services/fit-score.service';

const CHUNK_SIZE = 100;

/**
 * Fetch fit score rules for an org.
 */
async function fetchRules(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  orgId: string,
): Promise<FitScoreRule[]> {
  const { data } = (await (supabase.from('fit_score_rules' as never) as ReturnType<typeof supabase.from>)
    .select('points, field, operator, value')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true })) as {
    data: FitScoreRule[] | null;
  };
  return data ?? [];
}

/**
 * Recalculate fit_score for a single lead.
 */
export async function recalcFitScoreForLead(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  leadId: string,
  orgId: string,
): Promise<void> {
  const rules = await fetchRules(supabase, orgId);

  const { data: lead } = (await (supabase.from('leads') as ReturnType<typeof supabase.from>)
    .select('email, telefone, razao_social, nome_fantasia, porte, cnae, situacao_cadastral, faturamento_estimado, notes')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .single()) as { data: Record<string, string | number | null> | null };

  if (!lead) return;

  // UF comes from endereco JSONB
  const { data: addressRow } = (await (supabase.from('leads') as ReturnType<typeof supabase.from>)
    .select('endereco')
    .eq('id', leadId)
    .single()) as { data: { endereco: { uf?: string } | null } | null };

  const leadData = {
    ...lead,
    uf: addressRow?.endereco?.uf ?? null,
  };

  const score = calculateFitScore(leadData, rules);

  await (supabase.from('leads') as ReturnType<typeof supabase.from>)
    .update({ fit_score: score } as Record<string, unknown>)
    .eq('id', leadId)
    .eq('org_id', orgId);
}

/**
 * Batch recalculate fit_score for ALL leads in an org.
 * Processes in chunks to avoid overwhelming the database.
 */
export async function recalcFitScoresForOrg(
  orgId: string,
): Promise<ActionResult<{ updated: number }>> {
  const supabase = await createServerSupabaseClient();

  const rules = await fetchRules(supabase, orgId);

  // Fetch all leads for org
  const { data: leads, error } = (await (supabase.from('leads') as ReturnType<typeof supabase.from>)
    .select('id, email, telefone, razao_social, nome_fantasia, porte, cnae, situacao_cadastral, faturamento_estimado, notes, endereco')
    .eq('org_id', orgId)
    .is('deleted_at', null)) as {
    data: Array<Record<string, unknown>> | null;
    error: unknown;
  };

  if (error || !leads) {
    return { success: false, error: 'Erro ao buscar leads para recálculo' };
  }

  // Process in chunks
  let updated = 0;
  for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
    const chunk = leads.slice(i, i + CHUNK_SIZE);

    const updates = chunk.map((lead) => {
      const endereco = lead.endereco as { uf?: string } | null;
      const leadData = {
        email: lead.email as string | null,
        telefone: lead.telefone as string | null,
        razao_social: lead.razao_social as string | null,
        nome_fantasia: lead.nome_fantasia as string | null,
        porte: lead.porte as string | null,
        cnae: lead.cnae as string | null,
        situacao_cadastral: lead.situacao_cadastral as string | null,
        faturamento_estimado: lead.faturamento_estimado as number | null,
        notes: lead.notes as string | null,
        uf: endereco?.uf ?? null,
      };

      return {
        id: lead.id as string,
        fit_score: calculateFitScore(leadData, rules),
      };
    });

    // Update each lead in the chunk
    for (const { id, fit_score } of updates) {
      await (supabase.from('leads') as ReturnType<typeof supabase.from>)
        .update({ fit_score } as Record<string, unknown>)
        .eq('id', id)
        .eq('org_id', orgId);
      updated++;
    }
  }

  return { success: true, data: { updated } };
}
