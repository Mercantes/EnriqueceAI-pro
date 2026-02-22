'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { fetchCallStatisticsData } from '../services/call-statistics.service';
import type { CallStatisticsData } from '../types/call-statistics.types';
import { getPeriodDates } from '../types/shared';
import { getManagerOrgId } from './shared';

export async function fetchCallStatistics(
  period: string = '30d',
  userIds?: string[],
): Promise<ActionResult<CallStatisticsData>> {
  try {
    const { orgId } = await getManagerOrgId();
    const supabase = await createServerSupabaseClient();
    const { start, end } = getPeriodDates(period);

    const data = await fetchCallStatisticsData(
      supabase,
      orgId,
      start,
      end,
      userIds && userIds.length > 0 ? userIds : undefined,
    );

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
