'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { CallDetail, CallFeedbackRow, CallRow } from '../types';

export async function getCallDetail(callId: string): Promise<ActionResult<CallDetail>> {
  await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: call, error } = (await supabase
    .from('calls')
    .select('*')
    .eq('id', callId)
    .single()) as { data: CallRow | null; error: { message: string } | null };

  if (error || !call) {
    return { success: false, error: 'Ligação não encontrada' };
  }

  const { data: feedback } = (await supabase
    .from('call_feedback')
    .select('*')
    .eq('call_id', callId)
    .order('created_at', { ascending: true })) as { data: CallFeedbackRow[] | null };

  return {
    success: true,
    data: {
      ...call,
      feedback: feedback ?? [],
    },
  };
}
