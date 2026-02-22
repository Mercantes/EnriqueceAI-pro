'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DailyProgress {
  completed: number;
  pending: number;
  total: number;
  target: number;
}

export async function fetchDailyProgress(): Promise<ActionResult<DailyProgress>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

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

  // Count today's completed activities (interactions created today by this user)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: completed } = (await (supabase
    .from('interactions') as ReturnType<typeof supabase.from>)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', member.org_id)
    .eq('performed_by', user.id)
    .gte('created_at', todayStart.toISOString())) as { count: number | null };

  // Count pending activities (active enrollments with next_step_due <= now)
  const { count: pending } = (await (supabase
    .from('cadence_enrollments') as ReturnType<typeof supabase.from>)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .lte('next_step_due', new Date().toISOString())) as { count: number | null };

  // Get daily goal: user-specific first, fallback to org default (user_id IS NULL)
  const { data: userGoal } = (await supabase
    .from('daily_activity_goals')
    .select('target')
    .eq('org_id', member.org_id)
    .eq('user_id', user.id)
    .single()) as { data: { target: number } | null };

  let target = userGoal?.target ?? null;

  if (target === null) {
    const { data: orgGoal } = (await supabase
      .from('daily_activity_goals')
      .select('target')
      .eq('org_id', member.org_id)
      .is('user_id', null)
      .single()) as { data: { target: number } | null };

    target = orgGoal?.target ?? 20; // default 20
  }

  const comp = completed ?? 0;
  const pend = pending ?? 0;

  return {
    success: true,
    data: {
      completed: comp,
      pending: pend,
      total: comp + pend,
      target,
    },
  };
}
