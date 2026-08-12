'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import type { ActionResult } from '@/lib/actions/action-result';
import { getAuthOrgIdResult } from '@/lib/auth/get-org-id';
import { from } from '@/lib/supabase/from';

import { createNotification } from '@/features/notifications/services/notification.service';

const skipStepSchema = z.object({
  enrollmentId: z.string().uuid('ID inválido'),
  stepId: z.string().uuid('ID inválido'),
});

/**
 * "Pular esta atividade" — avança o enrollment para o PRÓXIMO step sem encerrar
 * a cadência. É o meio-termo que faltava entre "adiar o mesmo step"
 * (`skipActivity`, só empurra `next_step_due`) e "encerrar tudo" (o antigo botão
 * "Encerrar cadência" → `ignoreActivity`, que marcava o enrollment inteiro como
 * `completed` e jogava o lead no limbo de cadência: `contacted` sem cadência
 * ativa nem atividade pendente).
 *
 * Reusa a RPC atômica `advance_enrollment_after_step` (a mesma do fluxo de
 * execução em `execute-activity.ts`), passando o step atual como executado —
 * row-locked e idempotente, então duplo clique / retry não regride nem duplica.
 */
export async function skipStep(
  input: z.infer<typeof skipStepSchema>,
): Promise<ActionResult<void>> {
  const parsed = skipStepSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Dados inválidos' };
  const { enrollmentId, stepId } = parsed.data;

  const auth = await getAuthOrgIdResult();
  if (!auth.success) return auth;
  const { supabase, userId } = auth.data;

  // Contexto do enrollment para carimbar a timeline antes de avançar — sem esse
  // rastro o SDR não sabe por que o passo foi pulado.
  const { data: enrollment } = (await from(supabase, 'cadence_enrollments')
    .select('lead_id, cadence_id, org_id, current_step')
    .eq('id', enrollmentId)
    .maybeSingle()) as {
      data: { lead_id: string; cadence_id: string; org_id: string; current_step: number } | null;
    };

  if (!enrollment) return { success: false, error: 'Inscrição não encontrada' };

  await from(supabase, 'interactions').insert({
    org_id: enrollment.org_id,
    lead_id: enrollment.lead_id,
    cadence_id: enrollment.cadence_id,
    channel: 'system',
    type: 'sent',
    message_content: 'Atividade pulada pelo SDR — cadência avançou para o próximo passo',
    performed_by: userId,
    metadata: {
      system_event: 'step_skipped_manual',
      step_at_skip: enrollment.current_step,
    },
  } as Record<string, unknown>);

  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: Array<{ advanced: boolean; completed: boolean; new_step: number | null }> | null;
    error: { message: string } | null;
  }>)('advance_enrollment_after_step', {
    p_enrollment_id: enrollmentId,
    p_executed_step_id: stepId,
    p_performed_by: userId,
  });

  if (error) {
    console.error('[skip-step] advance_enrollment_after_step falhou:', error.message);
    return { success: false, error: 'Erro ao pular atividade' };
  }

  // Se pular o último step conclui a cadência, avisa o SDR (paridade com o
  // fluxo de execução — evita "sumiço" silencioso ao concluir).
  if (data?.[0]?.completed) {
    createNotification({
      org_id: enrollment.org_id,
      user_id: userId,
      type: 'cadence_completed',
      title: 'Cadência concluída',
      body: `Todos os steps foram executados para ${enrollment.lead_id.slice(0, 8)}`,
      resource_type: 'lead',
      resource_id: enrollment.lead_id,
    }).catch((err) => console.error('[skip-step] cadence_completed notification failed:', err));
  }

  revalidatePath('/atividades');
  return { success: true, data: undefined };
}
