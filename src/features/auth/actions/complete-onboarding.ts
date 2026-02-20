'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface OnboardingInput {
  orgName: string;
  orgSlug?: string;
}

export async function completeOnboarding(
  input: OnboardingInput,
): Promise<ActionResult<{ orgId: string }>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const orgName = input.orgName.trim();
  if (!orgName || orgName.length < 2) {
    return { success: false, error: 'Nome da empresa deve ter pelo menos 2 caracteres' };
  }

  // Fetch current org
  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string; role: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  if (member.role !== 'manager') {
    return { success: false, error: 'Sem permissão para configurar a organização' };
  }

  // Generate slug from name
  const baseSlug = orgName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const slug = input.orgSlug?.trim() || `${baseSlug}-${Date.now().toString(36)}`;

  // Update organization
  const { error: updateError } = await supabase
    .from('organizations')
    .update({ name: orgName, slug } as Record<string, unknown>)
    .eq('id', member.org_id);

  if (updateError) {
    return { success: false, error: 'Falha ao atualizar organização' };
  }

  return { success: true, data: { orgId: member.org_id } };
}

/**
 * Checks if the current user's org needs onboarding.
 * Heuristic: org name still looks like an auto-generated domain name.
 */
export async function checkNeedsOnboarding(): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: member } = (await supabase
    .from('organization_members')
    .select('organization:organizations(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { organization: { name: string } } | null };

  if (!member?.organization) return false;

  const name = member.organization.name;
  // Auto-generated names look like domain names (e.g., "gmail.com", "empresa.com.br")
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(name);
}
