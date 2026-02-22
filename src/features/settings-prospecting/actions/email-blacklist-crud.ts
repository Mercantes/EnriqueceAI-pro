'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireManager } from '@/lib/auth/require-manager';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface EmailBlacklistRow {
  id: string;
  org_id: string;
  domain: string;
  created_at: string;
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

function blacklistFrom(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  return supabase.from('email_blacklist' as never) as ReturnType<typeof supabase.from>;
}

export async function listBlacklistDomains(): Promise<ActionResult<EmailBlacklistRow[]>> {
  const { orgId, supabase } = await getOrgId();
  if (!orgId) return { success: false, error: 'Organização não encontrada' };

  const { data, error } = (await blacklistFrom(supabase)
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })) as { data: EmailBlacklistRow[] | null; error: unknown };

  if (error) return { success: false, error: 'Erro ao listar domínios bloqueados' };
  return { success: true, data: data ?? [] };
}

export async function addBlacklistDomain(domain: string): Promise<ActionResult<EmailBlacklistRow>> {
  const { orgId, supabase } = await getOrgId();
  if (!orgId) return { success: false, error: 'Organização não encontrada' };

  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) return { success: false, error: 'Domínio é obrigatório' };

  // Basic domain format validation
  if (!trimmed.includes('.') || trimmed.includes(' ')) {
    return { success: false, error: 'Formato de domínio inválido' };
  }

  const { data, error } = (await blacklistFrom(supabase)
    .insert({ org_id: orgId, domain: trimmed })
    .select()
    .single()) as { data: EmailBlacklistRow | null; error: unknown };

  if (error || !data) return { success: false, error: 'Erro ao adicionar domínio (pode já estar na lista)' };
  return { success: true, data };
}

export async function deleteBlacklistDomain(id: string): Promise<ActionResult<{ deleted: true }>> {
  const { orgId, supabase } = await getOrgId();
  if (!orgId) return { success: false, error: 'Organização não encontrada' };

  const { error } = await blacklistFrom(supabase)
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return { success: false, error: 'Erro ao remover domínio' };
  return { success: true, data: { deleted: true } };
}
