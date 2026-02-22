'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { fetchConversionAnalyticsData } from '../services/conversion-analytics.service';
import type { ConversionAnalyticsData } from '../types/conversion-analytics.types';
import { getPeriodDates } from '../types/shared';
import { getManagerOrgId } from './shared';

export async function fetchConversionAnalytics(
  period: string = '30d',
  userIds?: string[],
  cadenceId?: string,
): Promise<ActionResult<ConversionAnalyticsData>> {
  try {
    const { orgId } = await getManagerOrgId();
    const supabase = await createServerSupabaseClient();
    const { start, end } = getPeriodDates(period);

    const data = await fetchConversionAnalyticsData(
      supabase,
      orgId,
      start,
      end,
      userIds && userIds.length > 0 ? userIds : undefined,
      cadenceId || undefined,
    );

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
