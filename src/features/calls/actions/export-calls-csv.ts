'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { CallRow } from '../types';
import { callFiltersSchema } from '../schemas/call.schemas';

const statusLabels: Record<string, string> = {
  significant: 'Significativa',
  not_significant: 'Não Significativa',
  no_contact: 'Sem Contato',
  busy: 'Ocupado',
  not_connected: 'Não Conectada',
};

const typeLabels: Record<string, string> = {
  inbound: 'Recebida',
  outbound: 'Realizada',
  manual: 'Manual',
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function exportCallsCsv(
  rawFilters: Record<string, unknown>,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const parsed = callFiltersSchema.safeParse(rawFilters);
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

  let query = supabase.from('calls')
    .select('*')
    .eq('org_id', member.org_id);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.important_only) {
    query = query.eq('is_important', true);
  }

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

  if (filters.search) {
    const term = filters.search.replace(/[%_]/g, '');
    query = query.or(
      `origin.ilike.%${term}%,destination.ilike.%${term}%,notes.ilike.%${term}%`,
    );
  }

  query = query.order('started_at', { ascending: false }).limit(5000);

  const { data, error } = (await query) as {
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  };

  if (error) {
    return { success: false, error: 'Erro ao exportar ligações' };
  }

  const calls = (data ?? []) as unknown as CallRow[];

  const header = ['Status', 'Tipo', 'Origem', 'Destino', 'Data', 'Duração', 'Custo', 'Importante', 'Notas'];
  const rows = calls.map((c) => [
    escapeCsvField(statusLabels[c.status] ?? c.status),
    escapeCsvField(typeLabels[c.type] ?? c.type),
    escapeCsvField(c.origin),
    escapeCsvField(c.destination),
    new Date(c.started_at).toLocaleString('pt-BR'),
    formatDuration(c.duration_seconds),
    c.cost != null ? c.cost.toFixed(2) : '',
    c.is_important ? 'Sim' : 'Não',
    escapeCsvField(c.notes ?? ''),
  ]);

  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const date = new Date().toISOString().slice(0, 10);
  const filename = `ligacoes-${date}.csv`;

  return { success: true, data: { csv, filename } };
}
