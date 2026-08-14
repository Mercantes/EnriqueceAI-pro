import { afterEach, describe, expect, it, vi } from 'vitest';

import { brtDayEndIso, brtDayStartIso, brtTodayIso, parseBrtDateTime } from './brt-date';

describe('brtTodayIso', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa o dia BRT, não o UTC, perto da meia-noite', () => {
    vi.useFakeTimers();
    // 2026-08-14 01:00 UTC = 2026-08-13 22:00 BRT → o "hoje" BRT ainda é dia 13.
    vi.setSystemTime(new Date('2026-08-14T01:00:00.000Z'));
    expect(brtTodayIso()).toBe('2026-08-13');
  });

  it('coincide com o dia UTC quando já passou das 03:00 UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T12:00:00.000Z')); // 09:00 BRT
    expect(brtTodayIso()).toBe('2026-08-14');
  });
});

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
