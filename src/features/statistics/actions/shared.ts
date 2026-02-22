'use server';

import { requireManager } from '@/lib/auth/require-manager';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { OrgMember } from '../types/shared';

export async function fetchOrgMembers(): Promise<OrgMember[]> {
  const user = await requireManager();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) return [];

  const { data: members } = (await supabase
    .from('organization_members')
    .select('user_id, user_email')
    .eq('org_id', member.org_id)
    .eq('status', 'active')) as { data: { user_id: string; user_email: string }[] | null };

  return (members ?? []).map((m) => ({ userId: m.user_id, email: m.user_email }));
}
