'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { ActionResult } from '@/lib/actions/action-result';

import { forgotPasswordSchema } from '../schemas/auth.schemas';

export async function resetPassword(formData: FormData): Promise<ActionResult<void>> {
  const raw = { email: formData.get('email') };

  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  });

  if (error) {
    return { success: false, error: error.message, code: error.code };
  }

  return { success: true, data: undefined };
}
