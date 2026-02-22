'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { CallRow } from '../types';
import { callFiltersSchema, type CallFilters } from '../schemas/call.schemas';

export interface CallListResult {
  data: CallRow[];
  total: number;
  page: number;
  per_page: number;
}

export async function getCalls(
  rawFilters: Record<string, unknown>,
): Promise<ActionResult<CallListResult>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const parsed = callFiltersSchema.safeParse(rawFilters);
  if (!parsed.success) {
    return { success: false, error: 'Filtros inválidos' };
  }
  const filters: CallFilters = parsed.data;

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

  const from = (filters.page - 1) * filters.per_page;
  const to = from + filters.per_page - 1;

  let query = supabase.from('calls')
    .select('*', { count: 'exact' })
    .eq('org_id', member.org_id);

  // Status filter
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  // User filter
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }

  // Favorites / important
  if (filters.important_only) {
    query = query.eq('is_important', true);
  }

  // Period filter
  const now = new Date();
  if (filters.period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    query = query.gte('started_at', start);
  } else if (filters.period === 'week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    query = query.gte('started_at', start.toISOString());
  } else if (filters.period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    query = query.gte('started_at', start);
  }

  // Search
  if (filters.search) {
    const term = filters.search.replace(/[%_]/g, '');
    query = query.or(
      `origin.ilike.%${term}%,destination.ilike.%${term}%,notes.ilike.%${term}%`,
    );
  }

  // Order and paginate
  query = query
    .order('started_at', { ascending: false })
    .range(from, to);

  const { data, count, error } = (await query) as {
    data: Record<string, unknown>[] | null;
    count: number | null;
    error: { message: string } | null;
  };

  if (error) {
    return { success: false, error: 'Erro ao buscar ligações' };
  }

  return {
    success: true,
    data: {
      data: (data ?? []) as unknown as CallRow[],
      total: count ?? 0,
      page: filters.page,
      per_page: filters.per_page,
    },
  };
}
