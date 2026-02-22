import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCall } from './create-call';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

function createChainMock(resolvedValue: unknown = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'insert', 'single'];
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

describe('createCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a call successfully', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    const insertChain = createChainMock({
      data: { id: 'call-1', origin: '11999991111', destination: '11888882222', status: 'outbound' },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organization_members') return memberChain;
      return insertChain;
    });

    const result = await createCall({
      origin: '11999991111',
      destination: '11888882222',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('call-1');
    }
  });

  it('should return error for invalid input', async () => {
    const result = await createCall({ origin: '', destination: '' });

    expect(result.success).toBe(false);
  });

  it('should return error when org not found', async () => {
    const memberChain = createChainMock({ data: null });
    mockFrom.mockReturnValue(memberChain);

    const result = await createCall({
      origin: '11999991111',
      destination: '11888882222',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Organização não encontrada');
    }
  });

  it('should return error on insert failure', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    const insertChain = createChainMock({ data: null, error: { message: 'DB error' } });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organization_members') return memberChain;
      return insertChain;
    });

    const result = await createCall({
      origin: '11999991111',
      destination: '11888882222',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Erro ao registrar ligação');
    }
  });
});
