'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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
  const safeFields = ['razao_social', 'nome_fantasia', 'email', 'telefone', 'status'];
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

  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);

  return { success: true, data: undefined };
}
