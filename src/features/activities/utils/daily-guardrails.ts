import { reasonLabel } from '../constants/skip-reasons';

/**
 * Válvulas de escape usadas HOJE pelo SDR (story activity-skip-guardrails):
 * quantas tarefas ele adiou, pulou, moveu de cadência ou marcou como perdido,
 * em vez de executar. Fonte: eventos `system` gravados com `performed_by` = SDR.
 */
export interface DailyGuardrails {
  snoozed: number;
  skipped: number;
  switched: number;
  lost: number;
  /** Motivos mais usados hoje (pulo + troca + perda), rótulo legível, desc por contagem. */
  topReasons: Array<{ label: string; count: number }>;
}

export const GUARDRAIL_EVENTS = ['activity_skipped', 'step_skipped_manual', 'cadence_switched', 'lead_lost'] as const;

export const EMPTY_GUARDRAILS: DailyGuardrails = { snoozed: 0, skipped: 0, switched: 0, lost: 0, topReasons: [] };

/** Agrega os eventos de escape do dia. Puro — testado direto. */
export function summarizeGuardrails(
  rows: Array<{ metadata: Record<string, unknown> | null | undefined }>,
): DailyGuardrails {
  const out: DailyGuardrails = { ...EMPTY_GUARDRAILS, topReasons: [] };
  const reasons = new Map<string, number>();

  for (const row of rows) {
    const meta = row.metadata ?? {};
    const event = meta.system_event;
    if (event === 'activity_skipped') out.snoozed++;
    else if (event === 'step_skipped_manual') out.skipped++;
    else if (event === 'cadence_switched') out.switched++;
    else if (event === 'lead_lost') out.lost++;
    else continue;

    const reason = meta.skip_reason ?? meta.switch_reason ?? meta.loss_reason_name;
    if (typeof reason === 'string' && reason) {
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }

  out.topReasons = [...reasons.entries()]
    .map(([value, count]) => ({ label: reasonLabel(value), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return out;
}
