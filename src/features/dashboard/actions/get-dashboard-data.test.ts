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

// Mock service functions
const mockFetchKpi = vi.fn();
const mockFetchCadences = vi.fn();

vi.mock('../services/dashboard-metrics.service', () => ({
  fetchOpportunityKpi: (...args: unknown[]) => mockFetchKpi(...args),
  fetchAvailableCadences: (...args: unknown[]) => mockFetchCadences(...args),
}));

import { getDashboardData } from './get-dashboard-data';

// --- Chain mock helper ---
function createChainMock(finalResult: unknown = { data: null }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => Promise.resolve(finalResult)),
  };
}

describe('getDashboardData', () => {
  beforeEach(() => {
    resetMocks();
    mockFetchKpi.mockReset();
    mockFetchCadences.mockReset();
  });

  const validFilters = {
    month: '2026-02',
    cadenceIds: [] as string[],
    userIds: [] as string[],
  };

  it('should return success with dashboard data', async () => {
    // Mock org member lookup
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    mockFrom.mockImplementation(() => memberChain);

    const kpiData = {
      totalOpportunities: 10,
      monthTarget: 50,
      conversionTarget: 5,
      percentOfTarget: -30,
      currentDay: 15,
      daysInMonth: 28,
      dailyData: [],
    };
    const cadences = [{ id: 'c1', name: 'Inbound' }];

    mockFetchKpi.mockResolvedValue(kpiData);
    mockFetchCadences.mockResolvedValue(cadences);

    const result = await getDashboardData(validFilters);

    expect(result).toEqual({
      success: true,
      data: { kpi: kpiData, availableCadences: cadences },
    });
  });

  it('should return error for invalid month format', async () => {
    const result = await getDashboardData({
      month: 'invalid',
      cadenceIds: [],
      userIds: [],
    });

    expect(result).toEqual({
      success: false,
      error: 'Filtros inválidos',
    });
  });

  it('should return error for invalid cadenceIds (not uuid)', async () => {
    const result = await getDashboardData({
      month: '2026-02',
      cadenceIds: ['not-a-uuid'],
      userIds: [],
    });

    expect(result).toEqual({
      success: false,
      error: 'Filtros inválidos',
    });
  });

  it('should return error when org not found', async () => {
    const memberChain = createChainMock({ data: null });
    mockFrom.mockImplementation(() => memberChain);

    const result = await getDashboardData(validFilters);

    expect(result).toEqual({
      success: false,
      error: 'Organização não encontrada',
    });
  });

  it('should return error when service throws', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    mockFrom.mockImplementation(() => memberChain);

    mockFetchKpi.mockRejectedValue(new Error('DB connection failed'));

    const result = await getDashboardData(validFilters);

    expect(result).toEqual({
      success: false,
      error: 'Erro ao buscar dados do dashboard',
    });
  });

  it('should pass org_id and filters to service functions', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-42' } });
    mockFrom.mockImplementation(() => memberChain);

    mockFetchKpi.mockResolvedValue({
      totalOpportunities: 0,
      monthTarget: 0,
      conversionTarget: 0,
      percentOfTarget: 0,
      currentDay: 1,
      daysInMonth: 28,
      dailyData: [],
    });
    mockFetchCadences.mockResolvedValue([]);

    await getDashboardData(validFilters);

    expect(mockFetchKpi).toHaveBeenCalledWith(
      mockSupabase,
      'org-42',
      validFilters,
    );
    expect(mockFetchCadences).toHaveBeenCalledWith(mockSupabase, 'org-42');
  });

  it('should accept valid uuid in cadenceIds', async () => {
    const memberChain = createChainMock({ data: { org_id: 'org-1' } });
    mockFrom.mockImplementation(() => memberChain);

    mockFetchKpi.mockResolvedValue({
      totalOpportunities: 0,
      monthTarget: 0,
      conversionTarget: 0,
      percentOfTarget: 0,
      currentDay: 1,
      daysInMonth: 28,
      dailyData: [],
    });
    mockFetchCadences.mockResolvedValue([]);

    const filters = {
      month: '2026-02',
      cadenceIds: ['550e8400-e29b-41d4-a716-446655440000'],
      userIds: [],
    };

    const result = await getDashboardData(filters);

    expect(result.success).toBe(true);
  });
});
