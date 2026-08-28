import { describe, expect, it } from 'vitest';

import {
  isInboundLeadSource,
  isRecoverableLossReason,
  pickLeastLoadedSdr,
  type InboundRecoveryRule,
} from './inbound-recovery.service';

const rule: InboundRecoveryRule = {
  cadenceId: 'cad-1',
  sdrs: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ],
  delayDays: 10,
  reasonNames: ['Nunca respondeu', 'Sem interesse', 'Sem timing'],
};

describe('isRecoverableLossReason', () => {
  it('aceita os motivos configurados independente de caixa e espaços', () => {
    expect(isRecoverableLossReason('Nunca respondeu', rule)).toBe(true);
    expect(isRecoverableLossReason('sem interesse', rule)).toBe(true);
    expect(isRecoverableLossReason('  SEM TIMING ', rule)).toBe(true);
  });

  it('rejeita outros motivos e valores vazios', () => {
    expect(isRecoverableLossReason('Sem budget', rule)).toBe(false);
    expect(isRecoverableLossReason('Deixou de responder', rule)).toBe(false);
    expect(isRecoverableLossReason(null, rule)).toBe(false);
    expect(isRecoverableLossReason(undefined, rule)).toBe(false);
    expect(isRecoverableLossReason('', rule)).toBe(false);
  });
});

describe('isInboundLeadSource', () => {
  it('só Blackbox e Leadbroker são inbound', () => {
    expect(isInboundLeadSource('Blackbox')).toBe(true);
    expect(isInboundLeadSource('Leadbroker')).toBe(true);
    expect(isInboundLeadSource('Outbound')).toBe(false);
    expect(isInboundLeadSource(null)).toBe(false);
    expect(isInboundLeadSource(undefined)).toBe(false);
  });
});

describe('pickLeastLoadedSdr', () => {
  it('escolhe o SDR com menor carga', () => {
    expect(pickLeastLoadedSdr(['a', 'b', 'c'], { a: 3, b: 1, c: 2 })).toBe('b');
  });

  it('empate resolve pela ordem da lista', () => {
    expect(pickLeastLoadedSdr(['a', 'b', 'c'], { a: 1, b: 1, c: 1 })).toBe('a');
    expect(pickLeastLoadedSdr(['a', 'b', 'c'], { a: 2, b: 1, c: 1 })).toBe('b');
  });

  it('SDR sem contagem conta como zero', () => {
    expect(pickLeastLoadedSdr(['a', 'b'], { a: 1 })).toBe('b');
  });

  it('lista vazia retorna null', () => {
    expect(pickLeastLoadedSdr([], {})).toBeNull();
  });

  it('distribui um lote em round-robin quando o chamador incrementa', () => {
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    const picks: string[] = [];
    for (let i = 0; i < 6; i++) {
      const sdr = pickLeastLoadedSdr(['a', 'b', 'c'], counts);
      if (!sdr) break;
      counts[sdr] = (counts[sdr] ?? 0) + 1;
      picks.push(sdr);
    }
    expect(picks).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
  });
});
