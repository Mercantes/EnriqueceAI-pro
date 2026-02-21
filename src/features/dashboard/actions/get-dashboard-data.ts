'use server';

import { z } from 'zod';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import {
  fetchAvailableCadences,
  fetchOpportunityKpi,
} from '../services/dashboard-metrics.service';
import type { DashboardData, DashboardFilters } from '../types';

const filtersSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM format'),
  cadenceIds: z.array(z.string().uuid()).default([]),
  userIds: z.array(z.string().uuid()).default([]),
});

export async function getDashboardData(
  rawFilters: DashboardFilters,
): Promise<ActionResult<DashboardData>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  // Validate filters
  const parsed = filtersSchema.safeParse(rawFilters);
  if (!parsed.success) {
    return { success: false, error: 'Filtros inválidos' };
  }

  const filters = parsed.data;

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

  try {
    const [kpi, availableCadences] = await Promise.all([
      fetchOpportunityKpi(supabase, member.org_id, filters),
      fetchAvailableCadences(supabase, member.org_id),
    ]);

    return {
      success: true,
      data: { kpi, availableCadences },
    };
  } catch {
    return { success: false, error: 'Erro ao buscar dados do dashboard' };
  }
}
