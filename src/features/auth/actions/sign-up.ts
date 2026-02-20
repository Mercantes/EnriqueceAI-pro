'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { ActionResult } from '@/lib/actions/action-result';

import { signUpSchema } from '../schemas/auth.schemas';

export async function signUp(formData: FormData): Promise<ActionResult<{ userId: string }>> {
  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
    },
  });

  if (error) {
    return { success: false, error: error.message, code: error.code };
  }

  return { success: true, data: { userId: data.user?.id ?? '' } };
}
