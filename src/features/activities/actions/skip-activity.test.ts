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

import { skipActivity } from './skip-activity';

// ---------------------------------------------------------------------------
// Chain mock factory
// ---------------------------------------------------------------------------

function createChainMock(finalResult: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockImplementation(() => Promise.resolve(finalResult));
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(finalResult).then(resolve, reject);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('skipActivity', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should update next_step_due to 2 hours from now', async () => {
    const updateChain = createChainMock({ error: null });
    mockFrom.mockImplementation(() => updateChain);

    const before = Date.now();
    const result = await skipActivity('enr-1');
    const after = Date.now();

    expect(result.success).toBe(true);
    if (!result.success) return;

    const nextDue = new Date(result.data.nextStepDue).getTime();
    const twoHoursMs = 2 * 60 * 60 * 1000;

    // nextStepDue should be ~2 hours from now (within test execution window)
    expect(nextDue).toBeGreaterThanOrEqual(before + twoHoursMs);
    expect(nextDue).toBeLessThanOrEqual(after + twoHoursMs);
  });

  it('should return error when database update fails', async () => {
    const updateChain = createChainMock({
      error: { message: 'row not found' },
    });
    mockFrom.mockImplementation(() => updateChain);

    const result = await skipActivity('enr-nonexistent');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Erro ao pular atividade');
    }
  });

  it('should return ISO string format for nextStepDue', async () => {
    const updateChain = createChainMock({ error: null });
    mockFrom.mockImplementation(() => updateChain);

    const result = await skipActivity('enr-1');

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Validate ISO format
    const parsed = new Date(result.data.nextStepDue);
    expect(parsed.toISOString()).toBe(result.data.nextStepDue);
  });
});
