import crypto from 'crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => mockSupabase,
}));

vi.mock('@/lib/supabase/from', () => ({
  from: (client: { from: (t: string) => unknown }, table: string) => client.from(table),
}));

const mockIsEventProcessed = vi.fn();
const mockMarkEventProcessed = vi.fn();

vi.mock('@/lib/webhooks', () => ({
  isEventProcessed: (...args: unknown[]) => mockIsEventProcessed(...args),
  markEventProcessed: (...args: unknown[]) => mockMarkEventProcessed(...args),
}));

import { POST } from './route';

const SECRET = 'apollo-secret';
const ORG_ID = 'org-1';

function chain(maybeSingleResult: unknown) {
  const c: Record<string, unknown> = {};
  c.select = vi.fn().mockReturnValue(c);
  c.eq = vi.fn().mockReturnValue(c);
  c.is = vi.fn().mockReturnValue(c);
  c.order = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.update = vi.fn().mockReturnValue(c);
  c.maybeSingle = vi.fn().mockResolvedValue({ data: maybeSingleResult });
  return c;
}

function req(body: unknown, { orgId = ORG_ID, token }: { orgId?: string; token?: string } = {}) {
  const validToken = crypto.createHmac('sha256', SECRET).update(orgId).digest('hex');
  const url = `https://example.com/api/webhooks/apollo?org_id=${orgId}&token=${token ?? validToken}`;
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const person = {
  id: 'person-1',
  phone_numbers: [
    { raw_number: '+55 11 99999-0001', type_cd: 'mobile_phone' },
    { raw_number: '+55 11 4000-0002', type_cd: 'work_hq' },
  ],
};

describe('apollo phone reveal webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APOLLO_WEBHOOK_SECRET = SECRET;
    mockIsEventProcessed.mockResolvedValue(false);
    mockMarkEventProcessed.mockResolvedValue(undefined);
  });
  afterEach(() => {
    delete process.env.APOLLO_WEBHOOK_SECRET;
  });

  it('returns 401 on an invalid token', async () => {
    const res = await POST(req({ people: [person] }, { token: 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('writes phones to the primary contact (not the lead) when one exists', async () => {
    const leadsChain = chain({ id: 'lead-1', telefone: null, phones: [] });
    const contactChain = chain({
      id: 'contact-1',
      phones: [{ tipo: 'celular', numero: '+55 11 99999-0001' }],
    });
    mockFrom.mockImplementation((table: string) =>
      table === 'lead_contacts' ? contactChain : leadsChain,
    );

    const res = await POST(req({ people: [person] }));
    const json = (await res.json()) as { updated?: number };

    expect(res.status).toBe(200);
    expect(json.updated).toBe(1);
    // Merge dedupes the number already on the contact and maps type_cd:
    // mobile_phone -> celular, anything else -> fixo.
    expect(contactChain.update).toHaveBeenCalledWith({
      phones: [
        { tipo: 'celular', numero: '+55 11 99999-0001' },
        { tipo: 'fixo', numero: '+55 11 4000-0002' },
      ],
    });
    expect(leadsChain.update).not.toHaveBeenCalled();
  });

  it('falls back to updating the lead when there is no primary contact, preserving telefone', async () => {
    const leadsChain = chain({
      id: 'lead-1',
      telefone: '11 5555-0000',
      phones: [{ tipo: 'fixo', numero: '11 5555-0000' }],
    });
    const contactChain = chain(null);
    mockFrom.mockImplementation((table: string) =>
      table === 'lead_contacts' ? contactChain : leadsChain,
    );

    const res = await POST(req({ people: [person] }));

    expect(res.status).toBe(200);
    expect(leadsChain.update).toHaveBeenCalledWith({
      telefone: '11 5555-0000',
      phones: [
        { tipo: 'fixo', numero: '11 5555-0000' },
        { tipo: 'celular', numero: '+55 11 99999-0001' },
        { tipo: 'fixo', numero: '+55 11 4000-0002' },
      ],
    });
  });

  it('matches the email fallback by canal=Apollo', async () => {
    const leadsChain = chain(null);
    // ilike só existe no caminho do fallback por e-mail.
    (leadsChain as { ilike?: unknown }).ilike = vi.fn().mockReturnValue(leadsChain);
    const contactChain = chain(null);
    mockFrom.mockImplementation((table: string) =>
      table === 'lead_contacts' ? contactChain : leadsChain,
    );

    await POST(req({ people: [{ ...person, email: 'x@y.com' }] }));

    expect(leadsChain.eq).toHaveBeenCalledWith('canal', 'Apollo');
  });

  it('scopes idempotency per org and records the org on the event', async () => {
    const leadsChain = chain({ id: 'lead-1', telefone: null, phones: [] });
    const contactChain = chain({ id: 'contact-1', phones: [] });
    mockFrom.mockImplementation((table: string) =>
      table === 'lead_contacts' ? contactChain : leadsChain,
    );

    await POST(req({ people: [person] }));

    expect(mockIsEventProcessed).toHaveBeenCalledWith(mockSupabase, 'apollo', `phone_${ORG_ID}_person-1`);
    expect(mockMarkEventProcessed).toHaveBeenCalledWith(
      mockSupabase,
      'apollo',
      `phone_${ORG_ID}_person-1`,
      'phone_reveal',
      undefined,
      ORG_ID,
    );
  });

  it('skips a person already processed without touching the database', async () => {
    mockIsEventProcessed.mockResolvedValue(true);

    const res = await POST(req({ people: [person] }));
    const json = (await res.json()) as { updated?: number };

    expect(json.updated).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
