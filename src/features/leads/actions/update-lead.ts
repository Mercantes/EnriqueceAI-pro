'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { LossReasonRow } from '@/features/settings-prospecting/actions/loss-reasons-crud';

import { recalcFitScoreForLead } from './recalc-fit-scores';

export async function archiveLead(
  leadId: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const { error } = await (supabase.from('leads') as ReturnType<typeof supabase.from>)
    .update({ status: 'archived' } as Record<string, unknown>)
    .eq('id', leadId)
    .eq('org_id', member.org_id);

  if (error) {
    return { success: false, error: 'Erro ao arquivar lead' };
  }

  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);

  return { success: true, data: undefined };
}

export async function updateLead(
  leadId: string,
  updates: Record<string, unknown>,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  // Only allow safe fields
  const safeFields = ['razao_social', 'nome_fantasia', 'email', 'telefone', 'status', 'notes', 'socios', 'instagram', 'linkedin', 'website', 'first_name', 'last_name', 'job_title', 'lead_source', 'is_inbound'];
  const safeUpdates: Record<string, unknown> = {};
  for (const key of safeFields) {
    if (key in updates) {
      safeUpdates[key] = updates[key];
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return { success: false, error: 'Nenhum campo válido para atualizar' };
  }

  const { error } = await (supabase.from('leads') as ReturnType<typeof supabase.from>)
    .update(safeUpdates as Record<string, unknown>)
    .eq('id', leadId)
    .eq('org_id', member.org_id);

  if (error) {
    return { success: false, error: 'Erro ao atualizar lead' };
  }

  // Recalc fit score if relevant fields changed
  const fitScoreFields = ['razao_social', 'nome_fantasia', 'email', 'telefone', 'notes'];
  const hasRelevantChange = fitScoreFields.some((f) => f in safeUpdates);
  if (hasRelevantChange) {
    recalcFitScoreForLead(supabase, leadId, member.org_id).catch(() => {
      // Fire-and-forget: don't block the update response
    });
  }

  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);

  return { success: true, data: undefined };
}

export async function fetchLossReasons(): Promise<ActionResult<LossReasonRow[]>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const { data, error } = (await supabase
    .from('loss_reasons')
    .select('*')
    .eq('org_id', member.org_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })) as { data: LossReasonRow[] | null; error: unknown };

  if (error) return { success: false, error: 'Erro ao listar motivos de perda' };
  return { success: true, data: data ?? [] };
}

export async function markLeadAsLost(
  leadId: string,
  lossReasonId: string,
  lossNotes?: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  // 1. Update lead status to unqualified
  const { error: leadError } = await (supabase.from('leads') as ReturnType<typeof supabase.from>)
    .update({ status: 'unqualified' } as Record<string, unknown>)
    .eq('id', leadId)
    .eq('org_id', member.org_id);

  if (leadError) {
    return { success: false, error: 'Erro ao marcar lead como perdido' };
  }

  // 2. Complete active/paused enrollments with loss reason
  const enrollmentUpdate: Record<string, unknown> = {
    status: 'completed',
    loss_reason_id: lossReasonId,
    completed_at: new Date().toISOString(),
  };
  if (lossNotes) {
    enrollmentUpdate.loss_notes = lossNotes;
  }
  await (supabase.from('cadence_enrollments') as ReturnType<typeof supabase.from>)
    .update(enrollmentUpdate)
    .eq('lead_id', leadId)
    .eq('org_id', member.org_id)
    .in('status', ['active', 'paused']);

  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);

  return { success: true, data: undefined };
}
