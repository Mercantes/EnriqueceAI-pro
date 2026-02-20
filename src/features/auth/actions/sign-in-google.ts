'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { ActionResult } from '@/lib/actions/action-result';

export async function signInWithGoogle(): Promise<ActionResult<{ url: string }>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
    },
  });

  if (error) {
    return { success: false, error: error.message, code: error.code };
  }

  return { success: true, data: { url: data.url } };
}
