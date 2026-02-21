import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSupabase, mockSupabaseFrom, resetMocks } from '@tests/mocks/supabase';

const mockFrom = mockSupabaseFrom as ReturnType<typeof vi.fn>;

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({ id: 'user-1', email: 'test@test.com' }),
  ),
}));

const mockFetchRanking = vi.fn();

vi.mock('../services/ranking-metrics.service', () => ({
  fetchRankingData: (...args: unknown[]) => mockFetchRanking(...args),
}));

import { getRankingData } from './get-ranking-data';

function createChainMock(finalResult: unknown = { data: null }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => Promise.resolve(finalResult)),
  };
}

const emptyCard = {
  total: 0,
  monthTarget: 0,
  percentOfTarget: 0,
  averagePerSdr: 0,
  sdrBreakdown: [],
};

describe('getRankingData', () => {
  beforeEach(() => {
    resetMocks();
    mockFetchRanking.mockReset();
  });

  const validFilters = {
    month: '2026-02',
    cadenceIds: [] as string[],
    userIds: [] as string[],
  };

  it('should return success with ranking data', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    mockFrom.mockImplementation(() => memberChain);

    const rankingData = {
      leadsFinished: { ...emptyCard, total: 15 },
      activitiesDone: { ...emptyCard, total: 200 },
      conversionRate: { ...emptyCard, total: 42 },
    };
    mockFetchRanking.mockResolvedValue(rankingData);

    const result = await getRankingData(validFilters);

    expect(result).toEqual({ success: true, data: rankingData });
  });

  it('should return error for invalid filters', async () => {
    const result = await getRankingData({
      month: 'bad',
      cadenceIds: [],
      userIds: [],
    });

    expect(result).toEqual({ success: false, error: 'Filtros inválidos' });
  });

  it('should return error when org not found', async () => {
    const memberChain = createChainMock({ data: null });
    mockFrom.mockImplementation(() => memberChain);

    const result = await getRankingData(validFilters);

    expect(result).toEqual({
      success: false,
      error: 'Organização não encontrada',
    });
  });

  it('should return error when service throws', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    mockFrom.mockImplementation(() => memberChain);

    mockFetchRanking.mockRejectedValue(new Error('fail'));

    const result = await getRankingData(validFilters);

    expect(result).toEqual({
      success: false,
      error: 'Erro ao buscar dados de ranking',
    });
  });

  it('should pass org_id and filters to service', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-42' } });
    mockFrom.mockImplementation(() => memberChain);

    mockFetchRanking.mockResolvedValue({
      leadsFinished: emptyCard,
      activitiesDone: emptyCard,
      conversionRate: emptyCard,
    });

    await getRankingData(validFilters);

    expect(mockFetchRanking).toHaveBeenCalledWith(
      mockSupabase,
      'org-42',
      validFilters,
    );
  });
});
