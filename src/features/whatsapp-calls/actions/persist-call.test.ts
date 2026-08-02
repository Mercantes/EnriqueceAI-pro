import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'u1', email: 'sdr@test.com' }),
}));

let queues: Record<string, unknown[]>;
let inserts: Record<string, unknown[]>;
// Resultado que um `insert` awaited (sem .select) resolve — permite simular
// erros como a colisão 23505 do índice único de interações. Default: sucesso.
let insertResults: Record<string, unknown[]>;

function makeChain(table: string) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'update', 'contains', 'limit']) chain[m] = vi.fn(() => chain);
  chain.insert = vi.fn((payload: unknown) => {
    (inserts[table] ??= []).push(payload);
    chain.__insertResult = insertResults[table]?.shift() ?? { error: null };
    return chain;
  });
  const shift = () => (queues[table]?.shift() ?? { data: null, error: null });
  chain.single = vi.fn(() => Promise.resolve(shift()));
  chain.maybeSingle = vi.fn(() => Promise.resolve(shift()));
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(chain.__insertResult ?? { error: null }).then(resolve);
  return chain;
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() =>
    Promise.resolve({ from: (table: string) => makeChain(table) }),
  ),
}));

// O buffer de gravações tem RLS sem policies — a leitura usa service role.
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(() => ({ from: (table: string) => makeChain(table) })),
}));

import { persistWhatsAppCall, type PersistWhatsAppCallInput } from './persist-call';

const baseInput: PersistWhatsAppCallInput = {
  stepId: '11111111-1111-1111-1111-111111111111',
  cadenceId: '22222222-2222-2222-2222-222222222222',
  leadId: '33333333-3333-3333-3333-333333333333',
  sid: 'sess-1',
  callId: 'call-svc-1',
  destination: '5511999990000',
  disposition: 'significant',
  connected: true,
  durationSeconds: 42,
  startedAt: new Date(Date.now() - 60_000).toISOString(),
  answeredAt: new Date(Date.now() - 50_000).toISOString(),
};

describe('persistWhatsAppCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queues = {};
    inserts = {};
    insertResults = {};
  });

  it('inserts the call + interaction and returns the call id', async () => {
    queues.organization_members = [{ data: { org_id: 'org-1' } }];
    queues.calls = [
      { data: null }, // dedup: no existing call
      { data: { id: 'call-1' }, error: null }, // insert ... select single
    ];

    const result = await persistWhatsAppCall({ ...baseInput, recordingUrl: 'https://voice.example/rec/1.mp3' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.callId).toBe('call-1');

    const callRow = inserts.calls?.[0] as Record<string, unknown>;
    expect(callRow.type).toBe('outbound');
    expect(callRow.recording_url).toBe('https://voice.example/rec/1.mp3');
    expect((callRow.metadata as Record<string, unknown>).provider).toBe('whatsapp');
  });

  it('consumes a buffered recording via service role when no recordingUrl is passed', async () => {
    queues.organization_members = [{ data: { org_id: 'org-1' } }];
    queues.calls = [
      { data: null }, // dedup: no existing call
      { data: { id: 'call-2' }, error: null }, // insert ... select single
    ];
    // The AstraCalls webhook buffered the recording before the call existed.
    queues.whatsapp_pending_recordings = [
      { data: { recording_url: 'https://voice.example/rec/buffered.mp3' } },
    ];

    const result = await persistWhatsAppCall(baseInput); // no recordingUrl in input
    expect(result.success).toBe(true);

    const callRow = inserts.calls?.[0] as Record<string, unknown>;
    expect(callRow.recording_url).toBe('https://voice.example/rec/buffered.mp3');
  });

  it('persists a standalone call (no cadence) with null step/cadence in the interaction', async () => {
    queues.organization_members = [{ data: { org_id: 'org-1' } }];
    queues.calls = [
      { data: null }, // dedup: no existing call
      { data: { id: 'call-3' }, error: null }, // insert ... select single
    ];
    // Ligação avulsa da tela do lead: sem stepId/cadenceId.
    const { stepId: _s, cadenceId: _c, ...standalone } = baseInput;
    const result = await persistWhatsAppCall(standalone);
    expect(result.success).toBe(true);

    const interactionRow = inserts.interactions?.[0] as Record<string, unknown>;
    expect(interactionRow.cadence_id).toBeNull();
    expect(interactionRow.step_id).toBeNull();
    expect(interactionRow.channel).toBe('phone');
  });

  it('writes a descriptive interaction message for an unanswered attempt', async () => {
    queues.organization_members = [{ data: { org_id: 'org-1' } }];
    queues.calls = [
      { data: null }, // no existing call for this service_call_id
      { data: { id: 'call-x' }, error: null }, // insert ... select single
    ];
    const { answeredAt: _a, ...rest } = baseInput;
    const result = await persistWhatsAppCall({
      ...rest,
      connected: false,
      disposition: 'not_connected',
      durationSeconds: 0,
    });
    expect(result.success).toBe(true);

    const interactionRow = inserts.interactions?.[0] as Record<string, unknown>;
    // Sem anotação do SDR, a timeline ainda precisa mostrar algo legível.
    expect(interactionRow.message_content).toBe('Ligação WhatsApp — não atendida');
    expect((interactionRow.metadata as Record<string, unknown>).connected).toBe(false);
  });

  it('re-inserts the retry interaction as a manual touch when it hits the step unique index', async () => {
    queues.organization_members = [{ data: { org_id: 'org-1' } }];
    queues.calls = [
      { data: null }, // sem call existente p/ este service_call_id (retry = callId novo)
      { data: { id: 'call-retry' }, error: null }, // insert ... select single
    ];
    // 1ª interação (com step_id) colide com uq_interactions_sent_step_lead;
    // a reinserção como toque manual (step_id null) passa.
    insertResults.interactions = [
      { error: { code: '23505', message: 'duplicate key value violates unique constraint' } },
      { error: null },
    ];

    const result = await persistWhatsAppCall(baseInput);
    expect(result.success).toBe(true);

    const rows = inserts.interactions as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    // 1ª tentativa mantém o passo; a retentativa vira toque manual (step_id null)
    // para AINDA aparecer na timeline sem violar o índice do passo.
    expect(rows[0]!.step_id).toBe(baseInput.stepId);
    expect(rows[1]!.step_id).toBeNull();
    expect((rows[1]!.metadata as Record<string, unknown>).service_call_id).toBe(baseInput.callId);
  });

  it('does not re-insert when the interaction inserts cleanly (no collision)', async () => {
    queues.organization_members = [{ data: { org_id: 'org-1' } }];
    queues.calls = [
      { data: null },
      { data: { id: 'call-ok' }, error: null },
    ];
    // Sem erro configurado → insere uma única vez, sem toque manual extra.
    const result = await persistWhatsAppCall(baseInput);
    expect(result.success).toBe(true);
    expect(inserts.interactions).toHaveLength(1);
  });

  it('upserts (updates, never duplicates) on the same service_call_id', async () => {
    queues.organization_members = [{ data: { org_id: 'org-1' } }];
    queues.calls = [{ data: { id: 'existing-1' } }]; // existing hit → update path
    queues.interactions = [{ data: { id: 'int-1', metadata: {} } }]; // mirror exists → update

    const result = await persistWhatsAppCall({ ...baseInput, sdrOutcome: 'relevant_conversation', notes: 'ok' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.callId).toBe('existing-1');
    // A tentativa é ATUALIZADA, não reinserida — nada de linha duplicada.
    expect(inserts.calls).toBeUndefined();
    expect(inserts.interactions).toBeUndefined();
  });

  it('errors when the user has no organization', async () => {
    queues.organization_members = [{ data: null }];
    const result = await persistWhatsAppCall(baseInput);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Organização não encontrada');
  });

  it('rejects invalid input', async () => {
    const result = await persistWhatsAppCall({ ...baseInput, leadId: 'nope' });
    expect(result.success).toBe(false);
  });
});
