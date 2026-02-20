'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { ActionResult } from '@/lib/actions/action-result';

import { signInSchema } from '../schemas/auth.schemas';

export async function signIn(formData: FormData): Promise<ActionResult<void>> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { success: false, error: error.message, code: error.code };
  }

  return { success: true, data: undefined };
}
