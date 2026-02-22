'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { CallRow } from '../types';
import { createCallSchema } from '../schemas/call.schemas';

export async function createCall(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<CallRow>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const parsed = createCallSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' };
  }

  // Get user's org
  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const { data, error } = (await supabase
    .from('calls')
    .insert({
      ...parsed.data,
      org_id: member.org_id,
      user_id: user.id,
    })
    .select()
    .single()) as { data: CallRow | null; error: { message: string } | null };

  if (error || !data) {
    return { success: false, error: 'Erro ao registrar ligação' };
  }

  return { success: true, data };
}
