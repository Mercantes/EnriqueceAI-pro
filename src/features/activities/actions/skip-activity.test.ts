import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ getAuthOrgIdResult: vi.fn() }));
const leadEvent = vi.hoisted(() => ({ logLeadEvent: vi.fn() }));

vi.mock('@/lib/auth/get-org-id', () => auth);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/leads/actions/log-lead-event', () => leadEvent);
vi.mock('@/lib/actions/handle-error', () => ({
  handleQueryError: (err: unknown) => (err ? { success: false, error: 'Erro ao adiar atividade' } : null),
}));

import { SNOOZE_LIMIT, SNOOZE_LIMIT_CODE } from '../constants/skip-reasons';
import { skipActivity } from './skip-activity';

const ENROLLMENT_ID = '11111111-1111-1111-1111-111111111111';

// Estado que os mocks devolvem — cada teste ajusta antes de chamar a action.
let enrollmentResult: { data: unknown };
let updateResult: { data: unknown; error: unknown };
const updatePayloads: Array<Record<string, unknown>> = [];
const updateEqCalls: Array<[string, unknown]> = [];

function makeChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.update = vi.fn((payload: Record<string, unknown>) => {
    updatePayloads.push(payload);
    return chain;
  });
  chain.eq = vi.fn((col: string, val: unknown) => {
    updateEqCalls.push([col, val]);
    return chain;
  });
  chain.single = vi.fn(() => Promise.resolve(enrollmentResult));
  chain.maybeSingle = vi.fn(() => Promise.resolve(updateResult));
  return chain;
}

const supabase = { from: () => makeChain() };

/** Hora BRT (0-23) e dia da semana (0=dom) de um ISO. */
function brtParts(iso: string) {
  const d = new Date(iso);
  return {
    hour: Number(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false })),
    dow: new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay(),
  };
}

describe('skipActivity — "Adiar p/ amanhã"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatePayloads.length = 0;
    updateEqCalls.length = 0;
    auth.getAuthOrgIdResult.mockResolvedValue({
      success: true,
      data: { orgId: 'org-1', userId: 'u1', role: 'sdr', supabase },
    });
    enrollmentResult = {
      data: { cadence_id: 'cad-1', current_step: 3, lead_id: 'lead-1', status: 'active', snooze_count: 0 },
    };
    updateResult = { data: { id: ENROLLMENT_ID }, error: null };
  });

  it('rejeita id que não é UUID sem tocar no banco', async () => {
    const result = await skipActivity('enr-1');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('ID inválido');
    expect(auth.getAuthOrgIdResult).not.toHaveBeenCalled();
  });

  it('adia para 09:00 BRT de um dia útil (nunca hoje, nunca fim de semana)', async () => {
    const result = await skipActivity(ENROLLMENT_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const { hour, dow } = brtParts(result.data.nextStepDue);
    expect(hour).toBe(9);
    expect(dow).not.toBe(0);
    expect(dow).not.toBe(6);
    expect(new Date(result.data.nextStepDue).getTime()).toBeGreaterThan(Date.now());
    // Não é mais o snooze de 2h: sempre pelo menos algumas horas à frente.
    expect(new Date(result.data.nextStepDue).getTime() - Date.now()).toBeGreaterThan(2 * 60 * 60 * 1000);
  });

  it('incrementa snooze_count com optimistic lock no valor lido', async () => {
    enrollmentResult.data = { ...(enrollmentResult.data as object), snooze_count: 1 };

    const result = await skipActivity(ENROLLMENT_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.snoozeCount).toBe(2);
    expect(result.data.snoozesLeft).toBe(SNOOZE_LIMIT - 2);
    expect(updatePayloads[0]).toMatchObject({ snooze_count: 2 });
    // O UPDATE só aplica se snooze_count ainda for 1 (o valor lido).
    expect(updateEqCalls).toContainEqual(['snooze_count', 1]);
  });

  it(`recusa o ${SNOOZE_LIMIT + 1}º adiamento com SNOOZE_LIMIT e não grava nada`, async () => {
    enrollmentResult.data = { ...(enrollmentResult.data as object), snooze_count: SNOOZE_LIMIT };

    const result = await skipActivity(ENROLLMENT_ID);
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.code).toBe(SNOOZE_LIMIT_CODE);
    expect(updatePayloads).toHaveLength(0);
    expect(leadEvent.logLeadEvent).not.toHaveBeenCalled();
  });

  it('detecta corrida (outra aba adiou antes) e não consome mais um adiamento', async () => {
    updateResult = { data: null, error: null };

    const result = await skipActivity(ENROLLMENT_ID);
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.code).toBe('SNOOZE_CONFLICT');
    expect(leadEvent.logLeadEvent).not.toHaveBeenCalled();
  });

  it('recusa enrollment que não está ativo', async () => {
    enrollmentResult.data = { ...(enrollmentResult.data as object), status: 'completed' };

    const result = await skipActivity(ENROLLMENT_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('não está ativa');
  });

  it('retorna erro quando o UPDATE falha', async () => {
    updateResult = { data: null, error: { message: 'boom' } };

    const result = await skipActivity(ENROLLMENT_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Erro ao adiar atividade');
  });

  it('grava o evento activity_skipped com contagem e passo na timeline', async () => {
    const result = await skipActivity(ENROLLMENT_ID);
    expect(result.success).toBe(true);

    expect(leadEvent.logLeadEvent).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        event: 'activity_skipped',
        leadId: 'lead-1',
        metadata: expect.objectContaining({ cadence_id: 'cad-1', snooze_count: 1, step_order: 3 }),
      }),
    );
  });
});
