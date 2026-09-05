/**
 * Motivos de 1 clique para "Pular este passo" e "Trocar cadência".
 *
 * São poucos, fixos e servem para AGRUPAR no contador do gestor — por isso
 * vivem em código, não numa tabela (motivos de PERDA continuam em
 * `loss_reasons`, que o gestor edita).
 */
export const SKIP_REASONS = [
  { value: 'no_phone_or_whatsapp', label: 'Sem telefone / WhatsApp' },
  { value: 'invalid_contact', label: 'Número ou e-mail inválido' },
  { value: 'contacted_other_channel', label: 'Já contatei por outro canal' },
  { value: 'other', label: 'Outro' },
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number]['value'];

export const SKIP_REASON_VALUES = SKIP_REASONS.map((r) => r.value) as [SkipReason, ...SkipReason[]];

/** "Trocar cadência" usa os mesmos motivos + "cadência errada". */
export const SWITCH_REASONS = [
  { value: 'wrong_cadence', label: 'Cadência errada para esse lead' },
  ...SKIP_REASONS,
] as const;

export type SwitchReason = (typeof SWITCH_REASONS)[number]['value'];

export const SWITCH_REASON_VALUES = SWITCH_REASONS.map((r) => r.value) as [SwitchReason, ...SwitchReason[]];

/** Rótulo legível para um motivo (pulo ou troca). Desconhecido → o próprio valor. */
export function reasonLabel(value: string): string {
  return SWITCH_REASONS.find((r) => r.value === value)?.label ?? value;
}

/** Tamanho máximo da observação livre que acompanha "Outro". */
export const SKIP_NOTE_MAX = 140;

/** Adiamentos ("Adiar p/ amanhã") permitidos por passo antes de exigir uma saída. */
export const SNOOZE_LIMIT = 2;

/** `code` do ActionResult quando o limite de adiamentos foi atingido. */
export const SNOOZE_LIMIT_CODE = 'SNOOZE_LIMIT';

/** Texto do botão de adiar nos painéis de execução (antes era "Pular"). */
export const SNOOZE_BUTTON_LABEL = 'Adiar p/ amanhã';

/** Rótulo do botão com o restante: "Adiar p/ amanhã (1 restante)". */
export function snoozeButtonLabel(snoozesLeft: number | undefined): string {
  if (snoozesLeft === undefined) return SNOOZE_BUTTON_LABEL;
  if (snoozesLeft <= 0) return `${SNOOZE_BUTTON_LABEL} (limite atingido)`;
  return `${SNOOZE_BUTTON_LABEL} (${snoozesLeft} restante${snoozesLeft > 1 ? 's' : ''})`;
}
