import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateCallStatus } from './update-call-status';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

function createChainMock(resolvedValue: unknown = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['update', 'eq', 'single'];
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

describe('updateCallStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update status successfully', async () => {
    const chain = createChainMock({ error: null });
    mockFrom.mockReturnValue(chain);

    const result = await updateCallStatus({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'significant',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    }
  });

  it('should return error for invalid input', async () => {
    const result = await updateCallStatus({ id: 'not-uuid', status: 'invalid' as never });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Dados inválidos');
    }
  });

  it('should return error on db failure', async () => {
    const chain = createChainMock({ error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    const result = await updateCallStatus({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'busy',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Erro ao atualizar status');
    }
  });
});
