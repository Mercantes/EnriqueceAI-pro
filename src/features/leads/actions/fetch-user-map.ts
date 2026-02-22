'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * Resolves user UUIDs to display names (email username before @).
 * Uses admin client to access auth.users emails.
 */
export async function fetchUserMap(
  userIds: string[],
): Promise<ActionResult<Record<string, string>>> {
  if (userIds.length === 0) {
    return { success: true, data: {} };
  }

  await requireAuth();

  const result: Record<string, string> = {};

  try {
    const adminClient = createAdminSupabaseClient();
    const targetIds = new Set(userIds);
    const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 100 });
    if (usersData?.users) {
      for (const u of usersData.users) {
        if (targetIds.has(u.id)) {
          const email = u.email ?? '';
          result[u.id] = email.split('@')[0] || u.id.slice(0, 8);
        }
      }
    }
  } catch {
    for (const id of userIds) {
      result[id] = id.slice(0, 8);
    }
  }

  return { success: true, data: result };
}
