'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { nextBusinessDayAt9hBRT } from '@/app/api/cron/meeting-outcome-check/route';
import type { ActionResult } from '@/lib/actions/action-result';
import { handleQueryError } from '@/lib/actions/handle-error';
import { getAuthOrgIdResult } from '@/lib/auth/get-org-id';
import { from } from '@/lib/supabase/from';

import { logLeadEvent } from '@/features/leads/actions/log-lead-event';

import { SNOOZE_LIMIT, SNOOZE_LIMIT_CODE } from '../constants/skip-reasons';

const enrollmentIdSchema = z.string().uuid('ID inválido');

export interface SkipActivityResult {
  nextStepDue: string;
  /** Adiamentos já usados neste passo (depois deste). */
  snoozeCount: number;
  /** Quantos ainda restam neste passo. */
  snoozesLeft: number;
}

/**
 * "Adiar p/ amanhã": empurra o PASSO ATUAL para 09:00 BRT do próximo dia útil
 * sem avançar a cadência. Limite de `SNOOZE_LIMIT` adiamentos por passo — no
 * seguinte o servidor recusa com `SNOOZE_LIMIT_CODE` e a UI obriga uma saída
 * (executar / perdido / trocar cadência).
 *
 * Antes era um snooze de 2h (ou o delay do passo), que virou "depois eu vejo":
 * a tarefa voltava à tarde e ficava vermelha. Matheus e Giovanni tinham ~50
 * adiamentos/dia e metade das "atrasadas" com esse evento como último.
 *
 * O incremento de `snooze_count` é atômico via optimistic lock: o UPDATE só
 * aplica se `snooze_count` ainda for o valor lido. Duplo clique / duas abas
 * não consomem 2 adiamentos nem furam o limite.
 */
export async function skipActivity(
  enrollmentId: string,
): Promise<ActionResult<SkipActivityResult>> {
  const parsed = enrollmentIdSchema.safeParse(enrollmentId);
  if (!parsed.success) return { success: false, error: 'ID inválido' };

  const auth = await getAuthOrgIdResult();
  if (!auth.success) return auth;
  const { orgId, userId, supabase } = auth.data;

  const { data: enrollment } = (await from(supabase, 'cadence_enrollments')
    .select('cadence_id, current_step, lead_id, status, snooze_count')
    .eq('id', enrollmentId)
    .single()) as {
    data: {
      cadence_id: string;
      current_step: number;
      lead_id: string;
      status: string;
      snooze_count: number | null;
    } | null;
  };

  if (!enrollment) return { success: false, error: 'Inscrição não encontrada' };
  if (enrollment.status !== 'active') {
    return { success: false, error: 'A cadência não está ativa' };
  }

  const current = enrollment.snooze_count ?? 0;
  if (current >= SNOOZE_LIMIT) {
    return {
      success: false,
      error: `Esse lead já foi adiado ${SNOOZE_LIMIT} vezes neste passo. Execute, marque como perdido ou troque de cadência.`,
      code: SNOOZE_LIMIT_CODE,
    };
  }

  const nextStepDue = nextBusinessDayAt9hBRT(new Date());
  const nextCount = current + 1;

  // Optimistic lock: só grava se ninguém incrementou no meio-tempo.
  const { data: updated, error } = (await from(supabase, 'cadence_enrollments')
    .update({ next_step_due: nextStepDue, snooze_count: nextCount } as Record<string, unknown>)
    .eq('id', enrollmentId)
    .eq('snooze_count', current)
    .select('id')
    .maybeSingle()) as { data: { id: string } | null; error: { message: string } | null };

  const qErr = handleQueryError(error, 'Erro ao adiar atividade', 'activities');
  if (qErr) return qErr;

  if (!updated) {
    // Outra aba/clique já adiou este passo. Não consome mais um: devolve o
    // estado atual e deixa a UI recarregar.
    return {
      success: false,
      error: 'Esta atividade acabou de ser adiada em outra aba. Atualize a fila.',
      code: 'SNOOZE_CONFLICT',
    };
  }

  await logLeadEvent(supabase, {
    orgId,
    leadId: enrollment.lead_id,
    userId,
    event: 'activity_skipped',
    message: `Adiada para amanhã 9h (${nextCount}/${SNOOZE_LIMIT})`,
    metadata: {
      cadence_id: enrollment.cadence_id,
      next_step_due: nextStepDue,
      snooze_count: nextCount,
      step_order: enrollment.current_step,
    },
  });

  revalidatePath('/atividades');

  return {
    success: true,
    data: { nextStepDue, snoozeCount: nextCount, snoozesLeft: SNOOZE_LIMIT - nextCount },
  };
}
