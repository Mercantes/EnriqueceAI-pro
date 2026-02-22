'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { fetchCallDashboardData } from '../services/call-dashboard.service';
import type { CallDashboardData } from '../types/call-dashboard.types';
import { getPeriodDates } from '../types/shared';
import { getManagerOrgId } from './shared';

export async function fetchCallDashboard(
  period: string = '30d',
  userIds?: string[],
): Promise<ActionResult<CallDashboardData>> {
  try {
    const { orgId } = await getManagerOrgId();
    const supabase = await createServerSupabaseClient();
    const { start, end } = getPeriodDates(period);

    const data = await fetchCallDashboardData(
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
