'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getManagerOrgId } from '@/features/statistics/actions/shared';
import { getPeriodDates } from '@/features/statistics/types/shared';

import { fetchExtratoData } from '../services/extrato.service';
import type { ExtratoData } from '../types/extrato';

export async function fetchExtrato(
  period: string,
  userIds?: string[],
): Promise<ActionResult<ExtratoData>> {
  try {
    const { orgId } = await getManagerOrgId();
    const supabase = await createServerSupabaseClient();
    const { start, end } = getPeriodDates(period);

    const data = await fetchExtratoData(supabase, orgId, start, end, userIds);
    return { success: true, data };
  } catch {
    return { success: false, error: 'Erro ao carregar extrato de ligações' };
  }
}
