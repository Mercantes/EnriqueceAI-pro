import { describe, expect, it } from 'vitest';

import { brtDayEndIso, brtDayStartIso, parseBrtDateTime } from './brt-date';

describe('brtDayStartIso / brtDayEndIso', () => {
  it('início do dia BRT = 03:00 UTC', () => {
    expect(brtDayStartIso('2026-05-01')).toBe('2026-05-01T03:00:00.000Z');
  });

  it('fim do dia BRT = 02:59:59.999 UTC do dia seguinte', () => {
    expect(brtDayEndIso('2026-05-01')).toBe('2026-05-02T02:59:59.999Z');
  });
});

describe('parseBrtDateTime', () => {
  it('ancora hora de parede BRT em UTC-3 (14:00 BRT = 17:00 UTC)', () => {
    // Regressão do lembrete de reunião: 14:00 "de parede" não pode virar 14:00 UTC.
    expect(parseBrtDateTime('2026-08-03T14:00:00')?.toISOString()).toBe('2026-08-03T17:00:00.000Z');
  });

  it('aceita string sem segundos', () => {
    expect(parseBrtDateTime('2026-08-03T09:30')?.toISOString()).toBe('2026-08-03T12:30:00.000Z');
  });

  it('não é afetado pelo fuso do processo (sempre BRT)', () => {
    // O bug era new Date() naive assumir o fuso do servidor; aqui o resultado é fixo.
    expect(parseBrtDateTime('2026-01-15T00:00:00')?.toISOString()).toBe('2026-01-15T03:00:00.000Z');
  });

  it('retorna null para entrada inválida', () => {
    expect(parseBrtDateTime('não é data')).toBeNull();
    expect(parseBrtDateTime('03/08/2026 14:00')).toBeNull();
  });
});
