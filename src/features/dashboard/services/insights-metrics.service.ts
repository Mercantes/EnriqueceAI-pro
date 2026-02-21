import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ConversionByOriginEntry,
  DashboardFilters,
  InsightsData,
  LossReasonEntry,
} from '../types';

function getMonthRange(month: string): { start: string; end: string } {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Chart 1: Loss reasons — horizontal bar chart
 * Counts enrollments with a loss_reason_id, grouped by reason name
 */
export async function fetchLossReasons(
  supabase: SupabaseClient,
  orgId: string,
  filters: DashboardFilters,
): Promise<LossReasonEntry[]> {
  const { start, end } = getMonthRange(filters.month);

  // Get enrollments with loss reasons in the period
  let query = supabase
    .from('cadence_enrollments')
    .select('loss_reason_id, cadence_id, enrolled_by')
    .not('loss_reason_id', 'is', null)
    .gte('updated_at', start)
    .lt('updated_at', end);

  if (filters.cadenceIds.length > 0) {
    query = query.in('cadence_id', filters.cadenceIds);
  }
  if (filters.userIds.length > 0) {
    query = query.in('enrolled_by', filters.userIds);
  }

  const { data: enrollments } = (await query) as {
    data: Array<{ loss_reason_id: string }> | null;
  };

  const rows = enrollments ?? [];

  if (rows.length === 0) return [];

  // Count by loss_reason_id
  const reasonCounts = new Map<string, number>();
  for (const e of rows) {
    reasonCounts.set(e.loss_reason_id, (reasonCounts.get(e.loss_reason_id) ?? 0) + 1);
  }

  // Fetch reason names
  const reasonIds = [...reasonCounts.keys()];
  const { data: reasons } = (await supabase
    .from('loss_reasons')
    .select('id, name')
    .in('id', reasonIds)) as {
    data: Array<{ id: string; name: string }> | null;
  };

  const reasonMap = new Map<string, string>();
  for (const r of reasons ?? []) {
    reasonMap.set(r.id, r.name);
  }

  // Build entries with percentages
  const total = rows.length;
  const entries: LossReasonEntry[] = [];

  for (const [reasonId, count] of reasonCounts) {
    entries.push({
      reason: reasonMap.get(reasonId) ?? 'Desconhecido',
      count,
      percent: Math.round((count / total) * 100),
    });
  }

  return entries.sort((a, b) => b.count - a.count);
}

/**
 * Chart 2: Conversion by origin (cadence) — stacked bar chart
 * Groups leads by the cadence they were enrolled in, counts converted vs lost
 */
export async function fetchConversionByOrigin(
  supabase: SupabaseClient,
  orgId: string,
  filters: DashboardFilters,
): Promise<ConversionByOriginEntry[]> {
  const { start, end } = getMonthRange(filters.month);

  // Get enrollments with lead status in the period
  let enrollmentQuery = supabase
    .from('cadence_enrollments')
    .select('lead_id, cadence_id')
    .gte('updated_at', start)
    .lt('updated_at', end);

  if (filters.cadenceIds.length > 0) {
    enrollmentQuery = enrollmentQuery.in('cadence_id', filters.cadenceIds);
  }
  if (filters.userIds.length > 0) {
    enrollmentQuery = enrollmentQuery.in('enrolled_by', filters.userIds);
  }

  const { data: enrollments } = (await enrollmentQuery) as {
    data: Array<{ lead_id: string; cadence_id: string }> | null;
  };

  const rows = enrollments ?? [];

  if (rows.length === 0) return [];

  // Get unique lead IDs and their statuses
  const leadIds = [...new Set(rows.map((e) => e.lead_id))];

  const { data: leads } = (await supabase
    .from('leads')
    .select('id, status')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .in('id', leadIds)) as {
    data: Array<{ id: string; status: string }> | null;
  };

  const leadStatusMap = new Map<string, string>();
  for (const l of leads ?? []) {
    leadStatusMap.set(l.id, l.status);
  }

  // Get cadence names
  const cadenceIds = [...new Set(rows.map((e) => e.cadence_id))];

  const { data: cadences } = (await supabase
    .from('cadences')
    .select('id, name')
    .in('id', cadenceIds)) as {
    data: Array<{ id: string; name: string }> | null;
  };

  const cadenceNameMap = new Map<string, string>();
  for (const c of cadences ?? []) {
    cadenceNameMap.set(c.id, c.name);
  }

  // Group by cadence: count converted (qualified) vs lost (unqualified/archived)
  const cadenceStats = new Map<string, { converted: number; lost: number }>();

  for (const enrollment of rows) {
    const status = leadStatusMap.get(enrollment.lead_id);
    if (!status) continue;

    const stats = cadenceStats.get(enrollment.cadence_id) ?? { converted: 0, lost: 0 };

    if (status === 'qualified') {
      stats.converted++;
    } else if (status === 'unqualified' || status === 'archived') {
      stats.lost++;
    }

    cadenceStats.set(enrollment.cadence_id, stats);
  }

  const entries: ConversionByOriginEntry[] = [];
  for (const [cadenceId, stats] of cadenceStats) {
    if (stats.converted === 0 && stats.lost === 0) continue;
    entries.push({
      origin: cadenceNameMap.get(cadenceId) ?? 'Desconhecida',
      converted: stats.converted,
      lost: stats.lost,
    });
  }

  return entries.sort((a, b) => (b.converted + b.lost) - (a.converted + a.lost));
}

/**
 * Fetch all insights data in parallel
 */
export async function fetchInsightsData(
  supabase: SupabaseClient,
  orgId: string,
  filters: DashboardFilters,
): Promise<InsightsData> {
  const [lossReasons, conversionByOrigin] = await Promise.all([
    fetchLossReasons(supabase, orgId, filters),
    fetchConversionByOrigin(supabase, orgId, filters),
  ]);

  return { lossReasons, conversionByOrigin };
}
