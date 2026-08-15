import { describe, expect, it } from 'vitest';

import { CONNECTED_MIN_DURATION_SECONDS, isConnectedCall, isSignificantCall } from './connection';

describe('isConnectedCall', () => {
  it('conta como conectada: atendida (answered_at) E duração >= piso de 50s', () => {
    expect(
      isConnectedCall({ status: 'significant', duration_seconds: 120, answered_at: '2026-08-14T12:00:00Z' }),
    ).toBe(true);
  });

  it('conta no piso exato de 50s', () => {
    expect(
      isConnectedCall({
        status: 'not_significant',
        duration_seconds: CONNECTED_MIN_DURATION_SECONDS,
        answered_at: '2026-08-14T12:00:00Z',
      }),
    ).toBe(true);
  });

  it('NÃO conta atendimento curto (< 50s) — caixa postal/secretária/"alô"+desligou', () => {
    // O cerne da regra dos 50s: a API4COM dispara answered_at quando a MÁQUINA
    // atende. Um atendimento de poucos segundos é caixa postal, não conversa.
    for (const dur of [1, 4, 9, 20, 39, 49]) {
      expect(
        isConnectedCall({ status: 'not_significant', duration_seconds: dur, answered_at: '2026-08-14T12:00:00Z' }),
      ).toBe(false);
    }
  });

  it('NÃO conta sem answered_at, mesmo com duração alta (gravação de aviso da operadora)', () => {
    // NUMBER_CHANGED etc.: a operadora deixa o aviso tocando 30-500s, sem answer.
    expect(
      isConnectedCall({
        status: 'not_connected',
        duration_seconds: 182,
        answered_at: null,
        hangup_cause: 'NUMBER_CHANGED',
        recording_url: 'https://rec/aviso.mp3',
      }),
    ).toBe(false);
    // Mesmo NORMAL_CLEARING longo sem answered_at não conta (regra exige answer).
    expect(
      isConnectedCall({
        status: 'not_connected',
        duration_seconds: 200,
        answered_at: null,
        hangup_cause: 'NORMAL_CLEARING',
        recording_url: 'https://rec/1.mp3',
      }),
    ).toBe(false);
  });

  it('trata answered_at ausente como não informado', () => {
    expect(isConnectedCall({ status: 'no_contact', duration_seconds: 0 })).toBe(false);
  });

  it('NÃO conta caixa postal confirmada pelo SDR, mesmo com answered_at + duração alta', () => {
    expect(
      isConnectedCall({
        status: 'significant',
        duration_seconds: 120,
        answered_at: '2026-08-14T12:00:00Z',
        sdr_disposition: 'voicemail',
      }),
    ).toBe(false);
  });

  it('voicemail não afeta ligações que não foram marcadas assim', () => {
    expect(
      isConnectedCall({
        status: 'significant',
        duration_seconds: 120,
        answered_at: '2026-08-14T12:00:00Z',
        sdr_disposition: 'relevant_conversation',
      }),
    ).toBe(true);
  });
});

describe('isSignificantCall', () => {
  it('só aceita o bucket significant', () => {
    expect(isSignificantCall({ status: 'significant' })).toBe(true);
    for (const status of ['not_significant', 'no_contact', 'busy', 'not_connected'] as const) {
      expect(isSignificantCall({ status })).toBe(false);
    }
  });

  it('significant de 30-49s NÃO é mais garantidamente conectada (piso de conexão em 50s)', () => {
    // Com o piso de 50s, "conectada" é mais estrita que "significativa": uma
    // conversa relevante de 40s é significant mas não conta como conexão.
    const call = {
      status: 'significant' as const,
      duration_seconds: 40,
      answered_at: '2026-08-14T12:00:00Z',
    };
    expect(isSignificantCall(call)).toBe(true);
    expect(isConnectedCall(call)).toBe(false);
  });
});
