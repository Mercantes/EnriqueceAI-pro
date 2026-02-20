'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { ActionResult } from '@/lib/actions/action-result';

export async function signOut(): Promise<ActionResult<void>> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message, code: error.code };
  }

  return { success: true, data: undefined };
}
