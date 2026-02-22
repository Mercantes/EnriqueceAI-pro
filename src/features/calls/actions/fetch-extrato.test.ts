import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/statistics/actions/shared', () => ({
  getManagerOrgId: vi.fn().mockResolvedValue({ orgId: 'org-1', userId: 'user-1' }),
}));

const mockFetchExtratoData = vi.fn();
vi.mock('../services/extrato.service', () => ({
  fetchExtratoData: (...args: unknown[]) => mockFetchExtratoData(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({}),
}));

import { fetchExtrato } from './fetch-extrato';

describe('fetchExtrato', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return extrato data on success', async () => {
    const mockData = {
      kpis: { totalCalls: 10, totalDurationSeconds: 600, totalCost: 5.0, avgCallsPerDay: 3.3 },
      dailyBreakdown: [],
      sdrBreakdown: [],
    };
    mockFetchExtratoData.mockResolvedValue(mockData);

    const result = await fetchExtrato('30d');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kpis.totalCalls).toBe(10);
    }
  });

  it('should return error on failure', async () => {
    mockFetchExtratoData.mockRejectedValue(new Error('DB error'));

    const result = await fetchExtrato('7d');
    expect(result.success).toBe(false);
  });
});
