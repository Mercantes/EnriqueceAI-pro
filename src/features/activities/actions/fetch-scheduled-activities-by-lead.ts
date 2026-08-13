'use server';

import { z } from 'zod';

import type { ActionResult } from '@/lib/actions/action-result';
import { handleQueryError } from '@/lib/actions/handle-error';
import { getAuthOrgIdResult } from '@/lib/auth/get-org-id';
import { from } from '@/lib/supabase/from';

export type ScheduledActivityStatus = 'pending' | 'completed' | 'cancelled';

export interface LeadScheduledActivity {
  id: string;
  channel: string;
  callProvider: string | null;
  scheduledAt: string;
  notes: string | null;
  status: ScheduledActivityStatus;
  completedAt: string | null;
}

/**
 * Retorna o HISTÓRICO completo de atividades agendadas de um único lead
 * (pendentes + concluídas + canceladas), para exibição na aba "Agendar
 * atividade" da tela do lead. Ordenado por data agendada (mais recente
 * primeiro) — a pendente vigente (data futura) fica no topo.
 */
export async function fetchScheduledActivitiesByLead(
  leadId: string,
): Promise<ActionResult<LeadScheduledActivity[]>> {
  if (!z.string().uuid().safeParse(leadId).success) {
    return { success: false, error: 'ID de lead inválido' };
  }

  const auth = await getAuthOrgIdResult();
  if (!auth.success) return auth;
  const { supabase } = auth.data;

  const { data, error } = (await from(supabase, 'scheduled_activities')
    .select('id, channel, call_provider, scheduled_at, notes, status, completed_at')
    .eq('lead_id', leadId)
    .order('scheduled_at', { ascending: false })) as {
    data: Array<{
      id: string;
      channel: string;
      call_provider: string | null;
      scheduled_at: string;
      notes: string | null;
      status: ScheduledActivityStatus;
      completed_at: string | null;
    }> | null;
    error: { message: string } | null;
  };

  const qErr = handleQueryError(error, 'Erro ao buscar atividades agendadas', 'activities');
  if (qErr) return qErr;

  return {
    success: true,
    data: (data ?? []).map((r) => ({
      id: r.id,
      channel: r.channel,
      callProvider: r.call_provider,
      scheduledAt: r.scheduled_at,
      notes: r.notes,
      status: r.status,
      completedAt: r.completed_at,
    })),
  };
}
