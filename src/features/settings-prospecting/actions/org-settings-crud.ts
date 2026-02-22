'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireManager } from '@/lib/auth/require-manager';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface OrgSettings {
  abm_enabled: boolean;
  abm_group_field: string;
  lead_visibility_mode: 'all' | 'own' | 'team';
}

async function getOrgId() {
  const user = await requireManager();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  return { orgId: member?.org_id ?? null, supabase };
}

export async function getOrgSettings(): Promise<ActionResult<OrgSettings>> {
  const { orgId, supabase } = await getOrgId();
  if (!orgId) return { success: false, error: 'Organização não encontrada' };

  const { data, error } = (await supabase
    .from('organizations')
    .select('abm_enabled, abm_group_field, lead_visibility_mode')
    .eq('id', orgId)
    .single()) as { data: OrgSettings | null; error: unknown };

  if (error || !data) return { success: false, error: 'Erro ao carregar configurações' };
  return { success: true, data };
}

export async function saveAbmSettings(
  enabled: boolean,
  groupField: string,
): Promise<ActionResult<{ saved: true }>> {
  const { orgId, supabase } = await getOrgId();
  if (!orgId) return { success: false, error: 'Organização não encontrada' };

  const trimmed = groupField.trim();
  if (!trimmed) return { success: false, error: 'Campo de agrupamento é obrigatório' };

  const { error } = await supabase
    .from('organizations')
    .update({ abm_enabled: enabled, abm_group_field: trimmed } as never)
    .eq('id', orgId);

  if (error) return { success: false, error: 'Erro ao salvar configuração ABM' };
  return { success: true, data: { saved: true } };
}

export async function saveLeadVisibility(
  mode: 'all' | 'own' | 'team',
): Promise<ActionResult<{ saved: true }>> {
  const { orgId, supabase } = await getOrgId();
  if (!orgId) return { success: false, error: 'Organização não encontrada' };

  const validModes = ['all', 'own', 'team'];
  if (!validModes.includes(mode)) return { success: false, error: 'Modo de visibilidade inválido' };

  const { error } = await supabase
    .from('organizations')
    .update({ lead_visibility_mode: mode } as never)
    .eq('id', orgId);

  if (error) return { success: false, error: 'Erro ao salvar modo de acesso' };
  return { success: true, data: { saved: true } };
}
