import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exportCallsCsv } from './export-calls-csv';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

function createChainMock(resolvedValue: unknown = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'neq', 'in', 'is', 'not', 'gte', 'lte', 'or', 'order', 'range', 'single', 'limit'];
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

describe('exportCallsCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export CSV with header and data', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    const callsChain = createChainMock({
      data: [
        {
          id: 'call-1',
          origin: '11999991111',
          destination: '11888882222',
          started_at: '2026-02-21T10:00:00Z',
          duration_seconds: 120,
          status: 'significant',
          type: 'outbound',
          cost: 1.5,
          is_important: true,
          notes: 'Test note',
        },
      ],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organization_members') return memberChain;
      return callsChain;
    });

    const result = await exportCallsCsv({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.csv).toContain('Status,Tipo,Origem,Destino');
      expect(result.data.csv).toContain('Significativa');
      expect(result.data.csv).toContain('11999991111');
      expect(result.data.csv).toContain('02:00');
      expect(result.data.filename).toMatch(/^ligacoes-\d{4}-\d{2}-\d{2}\.csv$/);
    }
  });

  it('should return empty CSV when no calls', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    const callsChain = createChainMock({ data: [], error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organization_members') return memberChain;
      return callsChain;
    });

    const result = await exportCallsCsv({});

    expect(result.success).toBe(true);
    if (result.success) {
      const lines = result.data.csv.split('\n');
      expect(lines).toHaveLength(1); // Header only
    }
  });

  it('should return error when org not found', async () => {
    const memberChain = createChainMock({ data: null });
    mockFrom.mockReturnValue(memberChain);

    const result = await exportCallsCsv({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Organização não encontrada');
    }
  });

  it('should return error on db failure', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    const callsChain = createChainMock({ data: null, error: { message: 'DB error' } });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organization_members') return memberChain;
      return callsChain;
    });

    const result = await exportCallsCsv({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Erro ao exportar ligações');
    }
  });

  it('should escape CSV fields with commas', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    const callsChain = createChainMock({
      data: [
        {
          id: 'call-1',
          origin: '11999991111',
          destination: '11888882222',
          started_at: '2026-02-21T10:00:00Z',
          duration_seconds: 60,
          status: 'significant',
          type: 'manual',
          cost: null,
          is_important: false,
          notes: 'Note with, comma',
        },
      ],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organization_members') return memberChain;
      return callsChain;
    });

    const result = await exportCallsCsv({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.csv).toContain('"Note with, comma"');
    }
  });
});
