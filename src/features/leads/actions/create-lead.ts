'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { enrollLeads } from '@/features/cadences/actions/manage-cadences';

import { createLeadSchema } from '../schemas/lead.schemas';
import { enrichLeadAction } from './enrich-lead';

export async function createLead(
  rawData: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const parsed = createLeadSchema.safeParse(rawData);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return { success: false, error: firstError?.message ?? 'Dados inválidos' };
  }

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  // Validate assigned_to belongs to same org
  const { data: assignee } = (await supabase
    .from('organization_members')
    .select('user_id')
    .eq('user_id', parsed.data.assigned_to)
    .eq('org_id', member.org_id)
    .eq('status', 'active')
    .single()) as { data: { user_id: string } | null };

  if (!assignee) {
    return { success: false, error: 'Responsável não pertence à organização' };
  }

  // Check for duplicate CNPJ
  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('org_id', member.org_id)
    .eq('cnpj', parsed.data.cnpj)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    return { success: false, error: 'Já existe um lead com este CNPJ', code: 'DUPLICATE_CNPJ' };
  }

  // 1. Create the lead
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      org_id: member.org_id,
      cnpj: parsed.data.cnpj,
      razao_social: parsed.data.razao_social ?? null,
      nome_fantasia: parsed.data.nome_fantasia ?? null,
      email: parsed.data.email || null,
      telefone: parsed.data.telefone || null,
      assigned_to: parsed.data.assigned_to,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !lead) {
    return { success: false, error: 'Erro ao criar lead' };
  }

  const leadId = (lead as { id: string }).id;

  // 2. Enroll in cadence if selected (non-blocking for lead creation)
  const cadenceId = parsed.data.cadence_id;
  if (cadenceId) {
    const enrollStatus = parsed.data.enrollment_mode === 'paused' ? 'paused' : 'active';
    await enrollLeads(cadenceId, [leadId], enrollStatus).catch(() => {
      // Enrollment failure should not fail lead creation
    });
  }

  // 3. Trigger enrichment (awaited to avoid runtime cutoff, but errors swallowed)
  await enrichLeadAction(leadId).catch(() => {
    // Enrichment failure should not fail lead creation
  });

  revalidatePath('/leads');

  return { success: true, data: { id: leadId } };
}
