'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export interface VendorVariables {
  nome_vendedor: string | null;
  email_vendedor: string | null;
}

export async function fetchVendorVariables(): Promise<ActionResult<VendorVariables>> {
  const user = await requireAuth();

  try {
    const adminClient = createAdminSupabaseClient();
    const { data: vendorUser } = await adminClient.auth.admin.getUserById(user.id);
    if (vendorUser?.user) {
      const meta = vendorUser.user.user_metadata as { full_name?: string } | undefined;
      return {
        success: true,
        data: {
          nome_vendedor: meta?.full_name ?? null,
          email_vendedor: vendorUser.user.email ?? null,
        },
      };
    }
  } catch {
    // Fallback
  }

  return {
    success: true,
    data: { nome_vendedor: null, email_vendedor: null },
  };
}
