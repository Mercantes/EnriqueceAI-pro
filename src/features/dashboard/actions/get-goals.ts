'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { GoalsData } from '../types';

export async function getGoals(month: string): Promise<ActionResult<GoalsData>> {
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

  const monthDate = `${month}-01`;

  // Compute previous month
  const [y, m] = month.split('-').map(Number) as [number, number];
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-01`;

  // Fetch org-level goal for the selected month
  const { data: orgGoal } = (await (supabase
    .from('goals' as never) as ReturnType<typeof supabase.from>)
    .select('opportunity_target, conversion_target')
    .eq('org_id', member.org_id)
    .eq('month', monthDate)
    .maybeSingle()) as { data: { opportunity_target: number; conversion_target: number } | null };

  // Fetch SDRs in the org
  const { data: sdrs } = (await supabase
    .from('organization_members')
    .select('user_id, users:user_id(email)')
    .eq('org_id', member.org_id)
    .eq('status', 'active')) as { data: { user_id: string; users: { email: string } }[] | null };

  if (!sdrs) {
    return { success: false, error: 'Erro ao buscar membros' };
  }

  // Fetch user goals for current month
  const { data: currentUserGoals } = (await (supabase
    .from('goals_per_user' as never) as ReturnType<typeof supabase.from>)
    .select('user_id, opportunity_target')
    .eq('org_id', member.org_id)
    .eq('month', monthDate)) as { data: { user_id: string; opportunity_target: number }[] | null };

  // Fetch user goals for previous month (reference)
  const { data: prevUserGoals } = (await (supabase
    .from('goals_per_user' as never) as ReturnType<typeof supabase.from>)
    .select('user_id, opportunity_target')
    .eq('org_id', member.org_id)
    .eq('month', prevMonth)) as { data: { user_id: string; opportunity_target: number }[] | null };

  const currentMap = new Map(currentUserGoals?.map((g) => [g.user_id, g.opportunity_target]) ?? []);
  const prevMap = new Map(prevUserGoals?.map((g) => [g.user_id, g.opportunity_target]) ?? []);

  return {
    success: true,
    data: {
      month,
      opportunityTarget: orgGoal?.opportunity_target ?? 0,
      conversionTarget: orgGoal?.conversion_target ?? 0,
      userGoals: sdrs.map((sdr) => ({
        userId: sdr.user_id,
        userName: sdr.users?.email?.split('@')[0] ?? sdr.user_id.slice(0, 8),
        opportunityTarget: currentMap.get(sdr.user_id) ?? 0,
        previousTarget: prevMap.get(sdr.user_id) ?? null,
      })),
    },
  };
}
