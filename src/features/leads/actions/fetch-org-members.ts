'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface OrgMemberOption {
  userId: string;
  email: string;
}

export async function fetchOrgMembersAuth(): Promise<ActionResult<OrgMemberOption[]>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: currentMember } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!currentMember) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const { data: members } = (await supabase
    .from('organization_members')
    .select('user_id')
    .eq('org_id', currentMember.org_id)
    .eq('status', 'active')) as { data: Array<{ user_id: string }> | null };

  if (!members || members.length === 0) {
    return { success: true, data: [] };
  }

  // Get emails via admin client (same pattern as get-daily-goals.ts)
  const emailMap = new Map<string, string>();
  try {
    const adminClient = createAdminSupabaseClient();
    const memberIds = new Set(members.map((m) => m.user_id));
    const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 100 });
    if (usersData?.users) {
      for (const u of usersData.users) {
        if (memberIds.has(u.id)) {
          emailMap.set(u.id, u.email ?? u.id.slice(0, 8));
        }
      }
    }
  } catch {
    // Fallback: if service_role key is missing, truncated user_id used below
  }

  const result: OrgMemberOption[] = members.map((m) => ({
    userId: m.user_id,
    email: emailMap.get(m.user_id) ?? m.user_id.slice(0, 8),
  }));

  return { success: true, data: result };
}
