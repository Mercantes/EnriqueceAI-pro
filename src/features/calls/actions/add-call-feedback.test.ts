import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addCallFeedback } from './add-call-feedback';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

function createChainMock(resolvedValue: unknown = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['insert', 'select', 'single'];
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

describe('addCallFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add feedback successfully', async () => {
    const chain = createChainMock({
      data: {
        id: 'fb-1',
        call_id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: 'user-1',
        content: 'Great call',
        created_at: '2026-02-21T00:00:00Z',
      },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const result = await addCallFeedback({
      call_id: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Great call',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe('Great call');
    }
  });

  it('should return error for empty content', async () => {
    const result = await addCallFeedback({
      call_id: '550e8400-e29b-41d4-a716-446655440000',
      content: '',
    });

    expect(result.success).toBe(false);
  });

  it('should return error for invalid call_id', async () => {
    const result = await addCallFeedback({
      call_id: 'not-uuid',
      content: 'Some feedback',
    });

    expect(result.success).toBe(false);
  });

  it('should return error on db failure', async () => {
    const chain = createChainMock({ data: null, error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    const result = await addCallFeedback({
      call_id: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Some feedback',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Erro ao adicionar feedback');
    }
  });
});
