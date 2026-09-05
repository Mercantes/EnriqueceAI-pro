import { describe, expect, it } from 'vitest';

import { SNOOZE_LIMIT, snoozeButtonLabel } from '../constants/skip-reasons';

import { summarizeGuardrails } from './daily-guardrails';

describe('summarizeGuardrails', () => {
  it('conta adiadas / puladas / trocadas / perdidos e ignora outros eventos', () => {
    const out = summarizeGuardrails([
      { metadata: { system_event: 'activity_skipped' } },
      { metadata: { system_event: 'activity_skipped' } },
      { metadata: { system_event: 'step_skipped_manual', skip_reason: 'other' } },
      { metadata: { system_event: 'cadence_switched', switch_reason: 'wrong_cadence' } },
      { metadata: { system_event: 'lead_lost', loss_reason_name: 'Sem fit' } },
      { metadata: { system_event: 'cadence_enrolled' } },
      { metadata: null },
      { metadata: undefined },
    ]);

    expect(out).toMatchObject({ snoozed: 2, skipped: 1, switched: 1, lost: 1 });
  });

  it('agrupa motivos com rótulo legível, ordenados por contagem (top 5)', () => {
    const out = summarizeGuardrails([
      { metadata: { system_event: 'step_skipped_manual', skip_reason: 'no_phone_or_whatsapp' } },
      { metadata: { system_event: 'step_skipped_manual', skip_reason: 'no_phone_or_whatsapp' } },
      { metadata: { system_event: 'cadence_switched', switch_reason: 'no_phone_or_whatsapp' } },
      { metadata: { system_event: 'step_skipped_manual', skip_reason: 'invalid_contact' } },
      { metadata: { system_event: 'lead_lost', loss_reason_name: 'Sem orçamento' } },
    ]);

    expect(out.topReasons[0]).toEqual({ label: 'Sem telefone / WhatsApp', count: 3 });
    expect(out.topReasons).toContainEqual({ label: 'Número ou e-mail inválido', count: 1 });
    // Motivo de perda vem do nome cadastrado (não tem tradução na lista fixa).
    expect(out.topReasons).toContainEqual({ label: 'Sem orçamento', count: 1 });
  });

  it('linhas vazias → tudo zero', () => {
    expect(summarizeGuardrails([])).toEqual({ snoozed: 0, skipped: 0, switched: 0, lost: 0, topReasons: [] });
  });
});

describe('snoozeButtonLabel', () => {
  it('sem informação → rótulo base', () => {
    expect(snoozeButtonLabel(undefined)).toBe('Adiar p/ amanhã');
  });

  it('mostra o restante no singular/plural', () => {
    expect(snoozeButtonLabel(SNOOZE_LIMIT)).toBe(`Adiar p/ amanhã (${SNOOZE_LIMIT} restantes)`);
    expect(snoozeButtonLabel(1)).toBe('Adiar p/ amanhã (1 restante)');
  });

  it('zero → limite atingido', () => {
    expect(snoozeButtonLabel(0)).toBe('Adiar p/ amanhã (limite atingido)');
  });
});
