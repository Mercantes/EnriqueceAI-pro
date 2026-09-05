import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ getAuthOrgIdResult: vi.fn() }));
const leadEvent = vi.hoisted(() => ({ logLeadEvent: vi.fn() }));
const notif = vi.hoisted(() => ({ createNotification: vi.fn(() => Promise.resolve()) }));
const waInvalid = vi.hoisted(() => ({ reportWhatsAppInvalid: vi.fn() }));

vi.mock('@/lib/auth/get-org-id', () => auth);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/leads/actions/log-lead-event', () => leadEvent);
vi.mock('@/features/notifications/services/notification.service', () => notif);
vi.mock('./report-whatsapp-invalid', () => waInvalid);

import { skipStep } from './skip-step';

const ENR = '11111111-1111-1111-1111-111111111111';
const STEP = '22222222-2222-2222-2222-222222222222';

let enrollmentData: unknown;
let stepData: unknown;
const inserted: Array<Record<string, unknown>> = [];
const rpc = vi.fn();

function makeChain(table: string) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.insert = vi.fn((row: Record<string, unknown>) => {
    inserted.push(row);
    return Promise.resolve({ error: null });
  });
  chain.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: table === 'cadence_enrollments' ? enrollmentData : stepData }),
  );
  return chain;
}

const supabase = { from: (table: string) => makeChain(table), rpc };

describe('skipStep — "Pular este passo"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inserted.length = 0;
    auth.getAuthOrgIdResult.mockResolvedValue({
      success: true,
      data: { orgId: 'org-1', userId: 'u1', role: 'sdr', supabase },
    });
    enrollmentData = { lead_id: 'lead-1', cadence_id: 'cad-1', org_id: 'org-1', current_step: 4 };
    stepData = { channel: 'phone' };
    rpc.mockResolvedValue({ data: [{ advanced: true, completed: false, new_step: 5 }], error: null });
    waInvalid.reportWhatsAppInvalid.mockResolvedValue({ success: true, data: undefined });
  });

  it('exige motivo: sem reason não toca no banco', async () => {
    const result = await skipStep({ enrollmentId: ENR, stepId: STEP } as never);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Escolha um motivo');
    expect(auth.getAuthOrgIdResult).not.toHaveBeenCalled();
  });

  it('rejeita motivo fora da lista', async () => {
    const result = await skipStep({ enrollmentId: ENR, stepId: STEP, reason: 'preguica' } as never);
    expect(result.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('grava skip_reason/skip_note na interaction e avança via RPC', async () => {
    const result = await skipStep({
      enrollmentId: ENR,
      stepId: STEP,
      reason: 'other',
      note: 'lead pediu só e-mail',
    });
    expect(result.success).toBe(true);

    expect(inserted[0]).toMatchObject({
      channel: 'system',
      lead_id: 'lead-1',
      cadence_id: 'cad-1',
      metadata: {
        system_event: 'step_skipped_manual',
        step_at_skip: 4,
        skip_reason: 'other',
        skip_note: 'lead pediu só e-mail',
      },
    });
    expect(String(inserted[0]?.message_content)).toContain('Outro');
    expect(String(inserted[0]?.message_content)).toContain('lead pediu só e-mail');

    expect(rpc).toHaveBeenCalledWith('advance_enrollment_after_step', {
      p_enrollment_id: ENR,
      p_executed_step_id: STEP,
      p_performed_by: 'u1',
    });
    expect(waInvalid.reportWhatsAppInvalid).not.toHaveBeenCalled();
  });

  it('contato inválido em passo WhatsApp desvia para reportWhatsAppInvalid (sem RPC)', async () => {
    stepData = { channel: 'whatsapp' };

    const result = await skipStep({ enrollmentId: ENR, stepId: STEP, reason: 'invalid_contact' });
    expect(result.success).toBe(true);

    expect(waInvalid.reportWhatsAppInvalid).toHaveBeenCalledWith({
      enrollmentId: ENR,
      cadenceId: 'cad-1',
      stepId: STEP,
      leadId: 'lead-1',
      orgId: 'org-1',
    });
    expect(rpc).not.toHaveBeenCalled();
    // O motivo continua registrado na timeline mesmo no desvio.
    expect(inserted[0]).toMatchObject({ metadata: expect.objectContaining({ skip_reason: 'invalid_contact' }) });
  });

  it('contato inválido em passo de e-mail só registra e avança (sem marcar WhatsApp)', async () => {
    stepData = { channel: 'email' };

    const result = await skipStep({ enrollmentId: ENR, stepId: STEP, reason: 'invalid_contact' });
    expect(result.success).toBe(true);
    expect(waInvalid.reportWhatsAppInvalid).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalled();
  });

  it('pular o último passo conclui a cadência e notifica', async () => {
    rpc.mockResolvedValue({ data: [{ advanced: true, completed: true, new_step: 4 }], error: null });

    const result = await skipStep({ enrollmentId: ENR, stepId: STEP, reason: 'contacted_other_channel' });
    expect(result.success).toBe(true);
    expect(leadEvent.logLeadEvent).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ event: 'cadence_completed' }),
    );
    expect(notif.createNotification).toHaveBeenCalled();
  });

  it('erro na RPC vira erro tratado', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const result = await skipStep({ enrollmentId: ENR, stepId: STEP, reason: 'no_phone_or_whatsapp' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Erro ao pular atividade');
  });

  it('enrollment inexistente', async () => {
    enrollmentData = null;
    const result = await skipStep({ enrollmentId: ENR, stepId: STEP, reason: 'other' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Inscrição não encontrada');
  });
});
