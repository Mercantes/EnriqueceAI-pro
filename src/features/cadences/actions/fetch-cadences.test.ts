import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSupabase, mockSupabaseFrom, resetMocks } from '@tests/mocks/supabase';
const mockFrom = mockSupabaseFrom as any;

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(() => Promise.resolve({ id: 'user-1', email: 'test@test.com' })),
}));

import { fetchCadences } from './fetch-cadences';

function createChainMock(finalResult: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockImplementation(() => Promise.resolve(finalResult)),
    single: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: { org_id: 'org-1' } }),
    ),
  };
  return chain;
}

function setupMocks(cadencesResult: unknown) {
  const memberChain = createChainMock(null);
  const cadencesChain = createChainMock(cadencesResult);

  mockFrom.mockImplementation((table: string) => {
    if (table === 'organization_members') {
      return memberChain;
    }
    return cadencesChain;
  });

  return { memberChain, cadencesChain };
}

const baseCadence = {
  id: 'cadence-1',
  org_id: 'org-1',
  name: 'Test Cadence',
  description: 'A test cadence',
  status: 'active' as const,
  total_steps: 3,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
};

describe('fetchCadences', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should return cadences with pagination info on success', async () => {
    const cadences = [baseCadence, { ...baseCadence, id: 'cadence-2', name: 'Another Cadence' }];
    setupMocks({ data: cadences, count: 2, error: null });

    const result = await fetchCadences();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toHaveLength(2);
      expect(result.data.total).toBe(2);
      expect(result.data.page).toBe(1);
      expect(result.data.per_page).toBe(20);
      expect(result.data.data[0]).toMatchObject({ id: 'cadence-1', name: 'Test Cadence' });
    }
  });

  it('should return error when org is not found', async () => {
    mockFrom.mockImplementation(() => {
      const chain = createChainMock(null);
      chain.single.mockImplementation(() => Promise.resolve({ data: null }));
      return chain;
    });

    const result = await fetchCadences();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Organização não encontrada');
    }
  });

  it('should apply status filter when status param is provided', async () => {
    const cadences = [{ ...baseCadence, status: 'active' as const }];
    const { cadencesChain } = setupMocks({ data: cadences, count: 1, error: null });

    const result = await fetchCadences({ status: 'active' });

    expect(result.success).toBe(true);
    expect(cadencesChain.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('should apply ilike filter when search param is provided', async () => {
    const cadences = [{ ...baseCadence, name: 'Follow Up Cadence' }];
    const { cadencesChain } = setupMocks({ data: cadences, count: 1, error: null });

    const result = await fetchCadences({ search: 'Follow' });

    expect(result.success).toBe(true);
    expect(cadencesChain.ilike).toHaveBeenCalledWith('name', '%Follow%');
  });

  it('should apply correct range for custom pagination (page 2, per_page 10)', async () => {
    const cadences = [{ ...baseCadence, id: 'cadence-11' }];
    const { cadencesChain } = setupMocks({ data: cadences, count: 15, error: null });

    const result = await fetchCadences({ page: 2, per_page: 10 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.per_page).toBe(10);
      expect(result.data.total).toBe(15);
    }
    // page 2, per_page 10 → from = 10, to = 19
    expect(cadencesChain.range).toHaveBeenCalledWith(10, 19);
  });

  it('should return error message when DB query fails', async () => {
    setupMocks({ data: null, count: null, error: { message: 'DB connection error' } });

    const result = await fetchCadences();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Erro ao buscar cadências');
    }
  });

  it('should return empty array with total 0 when no cadences exist', async () => {
    setupMocks({ data: [], count: 0, error: null });

    const result = await fetchCadences();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toEqual([]);
      expect(result.data.total).toBe(0);
      expect(result.data.page).toBe(1);
      expect(result.data.per_page).toBe(20);
    }
  });
});
