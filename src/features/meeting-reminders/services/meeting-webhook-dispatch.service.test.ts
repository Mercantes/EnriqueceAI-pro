import { describe, expect, it } from 'vitest';

import {
  buildNome,
  buildWebhookPayload,
  computeDueMomentos,
  toNationalPhone,
  type MeetingWebhookCandidate,
} from './meeting-webhook-dispatch.service';

const baseCandidate: MeetingWebhookCandidate = {
  org_id: 'org-1',
  lead_id: 'lead-1',
  first_name: 'João',
  last_name: 'da Silva',
  razao_social: 'Silva ME',
  nome_fantasia: 'Silva Store',
  meeting_starts_at: '2026-08-11T20:00:00.000Z',
  meeting_scheduled_at: '2026-08-09T12:00:00.000Z',
  meet_link: 'https://meet.google.com/xck-jbus-trw',
  calendar_event_id: 'evt-123',
  whatsapp_phone: '5511988887777',
  responsavel_email: 'pedro@v4company.com',
  responsavel: 'Pedro Neves',
  sdr_user_id: 'sdr-user-1',
};

// Reunião: 2026-08-11 20:00 UTC = 17:00 BRT (dia 11/08 em Brasília).
const ACTIVE = ['d1', 'dia'] as const;

describe('computeDueMomentos', () => {
  it('não dispara antes das 8h BRT', () => {
    // 2026-08-11 09:00 UTC = 06:00 BRT (mesmo dia da reunião, mas antes das 8h)
    const now = new Date('2026-08-11T09:00:00.000Z');
    expect(computeDueMomentos(baseCandidate.meeting_starts_at, now, [...ACTIVE])).toEqual([]);
  });

  it("dispara 'dia' na manhã do dia da reunião", () => {
    // 2026-08-11 12:00 UTC = 09:00 BRT (dia da reunião, depois das 8h)
    const now = new Date('2026-08-11T12:00:00.000Z');
    expect(computeDueMomentos(baseCandidate.meeting_starts_at, now, [...ACTIVE])).toEqual(['dia']);
  });

  it("dispara 'd1' na manhã da véspera", () => {
    // 2026-08-10 12:00 UTC = 09:00 BRT (véspera, depois das 8h)
    const now = new Date('2026-08-10T12:00:00.000Z');
    expect(computeDueMomentos(baseCandidate.meeting_starts_at, now, [...ACTIVE])).toEqual(['d1']);
  });

  it('não dispara nada dois dias antes', () => {
    const now = new Date('2026-08-09T12:00:00.000Z');
    expect(computeDueMomentos(baseCandidate.meeting_starts_at, now, [...ACTIVE])).toEqual([]);
  });

  it('respeita a lista de momentos ativos (só dia)', () => {
    const now = new Date('2026-08-10T12:00:00.000Z'); // seria 'd1'
    expect(computeDueMomentos(baseCandidate.meeting_starts_at, now, ['dia'])).toEqual([]);
  });
});

describe('buildNome', () => {
  it('usa nome + sobrenome', () => {
    expect(buildNome(baseCandidate)).toBe('João da Silva');
  });

  it('cai para razão social quando não há nome de pessoa', () => {
    expect(buildNome({ ...baseCandidate, first_name: null, last_name: null })).toBe('Silva ME');
  });
});

describe('toNationalPhone', () => {
  it('remove o 55 do formato normalizado', () => {
    expect(toNationalPhone('5511988887777')).toBe('11988887777');
  });

  it('mantém quando já é nacional', () => {
    expect(toNationalPhone('11988887777')).toBe('11988887777');
  });

  it('null quando não há telefone', () => {
    expect(toNationalPhone(null)).toBeNull();
  });
});

describe('buildWebhookPayload', () => {
  it('monta o payload no formato esperado pelo n8n (com sdr e responsavel)', () => {
    expect(buildWebhookPayload(baseCandidate, 'd1', 'Guilherme Marques')).toEqual({
      lead_id: 'lead-1',
      nome: 'João da Silva',
      telefone: '11988887777',
      inicio: '2026-08-11T20:00:00.000Z',
      link: 'https://meet.google.com/xck-jbus-trw',
      event_id: 'evt-123',
      responsavel_email: 'pedro@v4company.com',
      sdr: 'Guilherme Marques',
      responsavel: 'Pedro Neves',
      momento: 'd1',
    });
  });

  it('sdr = quem marcou e responsavel = closer são papéis distintos', () => {
    const payload = buildWebhookPayload(baseCandidate, 'dia', 'Guilherme Marques');
    expect(payload.sdr).toBe('Guilherme Marques');
    expect(payload.responsavel).toBe('Pedro Neves');
    expect(payload.sdr).not.toBe(payload.responsavel);
  });

  it('sdr = null quando não há SDR (inbound self-scheduled), sem omitir a chave', () => {
    const payload = buildWebhookPayload({ ...baseCandidate, sdr_user_id: null }, 'dia', null);
    expect(payload.sdr).toBeNull();
    expect('sdr' in payload).toBe(true);
    // responsavel segue vindo do closer.
    expect(payload.responsavel).toBe('Pedro Neves');
  });

  it('responsavel = null quando o lead não tem closer', () => {
    const payload = buildWebhookPayload(
      { ...baseCandidate, responsavel: null, responsavel_email: null },
      'dia',
      'Guilherme Marques',
    );
    expect(payload.responsavel).toBeNull();
    expect(payload.responsavel_email).toBeNull();
  });

  it('link e event_id viram null quando ausentes', () => {
    const payload = buildWebhookPayload(
      { ...baseCandidate, meet_link: null, calendar_event_id: null },
      'dia',
      'Guilherme Marques',
    );
    expect(payload.link).toBeNull();
    expect(payload.event_id).toBeNull();
  });
});
