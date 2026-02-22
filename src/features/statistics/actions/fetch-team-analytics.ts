'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { fetchTeamAnalyticsData } from '../services/team-analytics.service';
import type { TeamAnalyticsData } from '../types/team-analytics.types';
import { getPeriodDates } from '../types/shared';
import { getManagerOrgId } from './shared';

export async function fetchTeamAnalytics(
  period: string = '30d',
): Promise<ActionResult<TeamAnalyticsData>> {
  try {
    const { orgId } = await getManagerOrgId();
    const supabase = await createServerSupabaseClient();
    const { start, end } = getPeriodDates(period);

    const data = await fetchTeamAnalyticsData(supabase, orgId, start, end);

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
