import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCallDetail } from './get-call-detail';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

function createChainMock(resolvedValue: unknown = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'order', 'single'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = vi.fn((resolve) => resolve(resolvedValue));
  return chain;
}

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

describe('getCallDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return call with feedback', async () => {
    const callChain = createChainMock({
      data: {
        id: 'call-1',
        origin: '11999991111',
        destination: '11888882222',
        status: 'significant',
        duration_seconds: 120,
        started_at: '2026-02-21T10:00:00Z',
      },
      error: null,
    });
    const feedbackChain = createChainMock({
      data: [
        { id: 'fb-1', call_id: 'call-1', user_id: 'user-1', content: 'Nice', created_at: '2026-02-21T11:00:00Z' },
      ],
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'calls') return callChain;
      if (table === 'call_feedback') return feedbackChain;
      return createChainMock();
    });

    const result = await getCallDetail('call-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('call-1');
      expect(result.data.feedback).toHaveLength(1);
      expect(result.data.feedback[0]!.content).toBe('Nice');
    }
  });

  it('should return call with empty feedback', async () => {
    const callChain = createChainMock({
      data: { id: 'call-1', origin: '11999991111', destination: '11888882222' },
      error: null,
    });
    const feedbackChain = createChainMock({ data: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'calls') return callChain;
      if (table === 'call_feedback') return feedbackChain;
      return createChainMock();
    });

    const result = await getCallDetail('call-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feedback).toEqual([]);
    }
  });

  it('should return error when call not found', async () => {
    const callChain = createChainMock({ data: null, error: { message: 'Not found' } });
    mockFrom.mockReturnValue(callChain);

    const result = await getCallDetail('nonexistent');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Ligação não encontrada');
    }
  });
});
