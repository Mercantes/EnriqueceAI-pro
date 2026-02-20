import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSupabase, mockSupabaseFrom, resetMocks } from '@tests/mocks/supabase';
const mockFrom = mockSupabaseFrom as ReturnType<typeof vi.fn>;

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(() => Promise.resolve({ id: 'user-1', email: 'test@test.com' })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockSendEmail = vi.fn();
vi.mock('@/features/integrations/services/email.service', () => ({
  EmailService: {
    sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  },
}));

import { executeActivity } from './execute-activity';
import type { ExecuteActivityInput } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseInput: ExecuteActivityInput = {
  enrollmentId: 'enr-1',
  cadenceId: 'cad-1',
  stepId: 'step-1',
  leadId: 'lead-1',
  orgId: 'org-1',
  cadenceCreatedBy: 'user-1',
  to: 'contato@abc.com',
  subject: 'Olá Empresa ABC',
  body: '<p>Corpo do email</p>',
  aiGenerated: false,
  templateId: 'tpl-1',
};

// ---------------------------------------------------------------------------
// Chain mock factory
// ---------------------------------------------------------------------------

function createChainMock(finalResult: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gt = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockImplementation(() => Promise.resolve(finalResult));
  chain.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(finalResult));
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(finalResult).then(resolve, reject);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executeActivity', () => {
  beforeEach(() => {
    resetMocks();
    mockSendEmail.mockReset();
  });

  it('should return ALREADY_EXECUTED if interaction exists', async () => {
    // 1st from() = idempotency check → existing interaction found
    const idempotencyChain = createChainMock({ data: { id: 'existing-int' } });

    mockFrom.mockImplementation(() => idempotencyChain);

    const result = await executeActivity(baseInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('ALREADY_EXECUTED');
      expect(result.error).toBe('Esta atividade já foi executada');
    }
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('should return error if interaction insert fails', async () => {
    // 1st = idempotency check → no existing
    const idempotencyChain = createChainMock({ data: null });
    // 2nd = insert interaction → returns null (failure)
    const insertChain = createChainMock({ data: null });

    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return idempotencyChain;
      return insertChain;
    });

    const result = await executeActivity(baseInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Falha ao registrar interação');
    }
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('should send email, record interaction, and advance step on success', async () => {
    // 1st = idempotency → no existing
    const idempotencyChain = createChainMock({ data: null });
    // 2nd = insert interaction → success
    const insertChain = createChainMock({ data: { id: 'int-1' } });
    // 3rd = update interaction with external_id (after email send)
    const updateExtChain = createChainMock({ data: null });
    // 4th = get current step_order (inner query for gt comparison)
    const currentStepChain = createChainMock({ data: { step_order: 1 } });
    // 5th = check next step → found
    const nextStepChain = createChainMock({ data: { step_order: 2 } });
    // 6th = update enrollment current_step
    const advanceChain = createChainMock({ data: null });

    mockSendEmail.mockResolvedValue({
      success: true,
      messageId: 'gmail-msg-123',
    });

    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return idempotencyChain;
      if (callIndex === 2) return insertChain;
      if (callIndex === 3) return updateExtChain;
      if (callIndex === 4) return currentStepChain;
      if (callIndex === 5) return nextStepChain;
      if (callIndex === 6) return advanceChain;
      return createChainMock({ data: null });
    });

    const result = await executeActivity(baseInput);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.interactionId).toBe('int-1');

    // Verify email was sent
    expect(mockSendEmail).toHaveBeenCalledWith(
      'user-1', // cadenceCreatedBy
      'org-1',   // orgId
      {
        to: 'contato@abc.com',
        subject: 'Olá Empresa ABC',
        htmlBody: '<p>Corpo do email</p>',
      },
      'int-1',   // interactionId
      mockSupabase,
    );
  });

  it('should mark enrollment completed when no next step exists', async () => {
    const idempotencyChain = createChainMock({ data: null });
    const insertChain = createChainMock({ data: { id: 'int-2' } });
    const updateExtChain = createChainMock({ data: null });
    const currentStepChain = createChainMock({ data: { step_order: 3 } });
    // No next step
    const nextStepChain = createChainMock({ data: null });
    // Update enrollment to completed
    const completeChain = createChainMock({ data: null });

    mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg-2' });

    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return idempotencyChain;
      if (callIndex === 2) return insertChain;
      if (callIndex === 3) return updateExtChain;
      if (callIndex === 4) return currentStepChain;
      if (callIndex === 5) return nextStepChain;
      if (callIndex === 6) return completeChain;
      return createChainMock({ data: null });
    });

    const result = await executeActivity(baseInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.interactionId).toBe('int-2');
    }
  });

  it('should still succeed when email send fails (logs error)', async () => {
    const idempotencyChain = createChainMock({ data: null });
    const insertChain = createChainMock({ data: { id: 'int-3' } });
    const currentStepChain = createChainMock({ data: { step_order: 1 } });
    const nextStepChain = createChainMock({ data: { step_order: 2 } });
    const advanceChain = createChainMock({ data: null });

    mockSendEmail.mockResolvedValue({
      success: false,
      error: 'Token expired',
    });

    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return idempotencyChain;
      if (callIndex === 2) return insertChain;
      // No update for external_id since email failed
      if (callIndex === 3) return currentStepChain;
      if (callIndex === 4) return nextStepChain;
      if (callIndex === 5) return advanceChain;
      return createChainMock({ data: null });
    });

    const result = await executeActivity(baseInput);

    // Still succeeds — interaction was recorded, email failure is logged
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.interactionId).toBe('int-3');
    }
  });
});
