'use server';

import { z } from 'zod';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { fetchInsightsData } from '../services/insights-metrics.service';
import type { DashboardFilters, InsightsData } from '../types';

const filtersSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM format'),
  cadenceIds: z.array(z.string().uuid()).default([]),
  userIds: z.array(z.string().uuid()).default([]),
});

export async function getInsightsData(
  rawFilters: DashboardFilters,
): Promise<ActionResult<InsightsData>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const parsed = filtersSchema.safeParse(rawFilters);
  if (!parsed.success) {
    return { success: false, error: 'Filtros inválidos' };
  }

  const filters = parsed.data;

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  try {
    const insights = await fetchInsightsData(supabase, member.org_id, filters);
    return { success: true, data: insights };
  } catch {
    return { success: false, error: 'Erro ao buscar dados de insights' };
  }
}
