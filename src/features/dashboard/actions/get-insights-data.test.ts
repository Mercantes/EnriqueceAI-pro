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

const mockFetchInsights = vi.fn();

vi.mock('../services/insights-metrics.service', () => ({
  fetchInsightsData: (...args: unknown[]) => mockFetchInsights(...args),
}));

import { getInsightsData } from './get-insights-data';

function createChainMock(finalResult: unknown = { data: null }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => Promise.resolve(finalResult)),
  };
}

describe('getInsightsData', () => {
  beforeEach(() => {
    resetMocks();
    mockFetchInsights.mockReset();
  });

  const validFilters = {
    month: '2026-02',
    cadenceIds: [] as string[],
    userIds: [] as string[],
  };

  it('should return success with insights data', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    mockFrom.mockImplementation(() => memberChain);

    const insightsData = {
      lossReasons: [{ reason: 'Sem orçamento', count: 5, percent: 100 }],
      conversionByOrigin: [{ origin: 'Inbound', converted: 3, lost: 1 }],
    };
    mockFetchInsights.mockResolvedValue(insightsData);

    const result = await getInsightsData(validFilters);

    expect(result).toEqual({ success: true, data: insightsData });
  });

  it('should return error for invalid filters', async () => {
    const result = await getInsightsData({
      month: 'invalid',
      cadenceIds: [],
      userIds: [],
    });

    expect(result).toEqual({ success: false, error: 'Filtros inválidos' });
  });

  it('should return error when org not found', async () => {
    const memberChain = createChainMock({ data: null });
    mockFrom.mockImplementation(() => memberChain);

    const result = await getInsightsData(validFilters);

    expect(result).toEqual({
      success: false,
      error: 'Organização não encontrada',
    });
  });

  it('should return error when service throws', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    mockFrom.mockImplementation(() => memberChain);

    mockFetchInsights.mockRejectedValue(new Error('fail'));

    const result = await getInsightsData(validFilters);

    expect(result).toEqual({
      success: false,
      error: 'Erro ao buscar dados de insights',
    });
  });

  it('should pass org_id and filters to service', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-42' } });
    mockFrom.mockImplementation(() => memberChain);

    mockFetchInsights.mockResolvedValue({
      lossReasons: [],
      conversionByOrigin: [],
    });

    await getInsightsData(validFilters);

    expect(mockFetchInsights).toHaveBeenCalledWith(
      mockSupabase,
      'org-42',
      validFilters,
    );
  });
});
