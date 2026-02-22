import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/get-org-id', () => ({
  getManagerOrgId: vi.fn().mockResolvedValue({ orgId: 'org-1', userId: 'user-1' }),
}));

const mockFetchExtratoData = vi.fn();
vi.mock('../services/extrato.service', () => ({
  fetchExtratoData: (...args: unknown[]) => mockFetchExtratoData(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({}),
}));

import { exportExtratoCsv } from './export-extrato-csv';

describe('exportExtratoCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate CSV with correct sections', async () => {
    mockFetchExtratoData.mockResolvedValue({
      kpis: { totalCalls: 5, totalDurationSeconds: 300, totalCost: 2.5, avgCallsPerDay: 1.7 },
      dailyBreakdown: [
        { date: '2026-01-15', calls: 3, durationSeconds: 200, significantCalls: 1, cost: 1.5 },
      ],
      sdrBreakdown: [
        { userId: 'u1', userName: 'alice', calls: 5, avgDurationSeconds: 60, connectionRate: 60, cost: 2.5 },
      ],
    });

    const result = await exportExtratoCsv('30d');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.csv).toContain('RESUMO');
      expect(result.data.csv).toContain('Total de Ligações,5');
      expect(result.data.csv).toContain('EXTRATO DIÁRIO');
      expect(result.data.csv).toContain('POR VENDEDOR');
      expect(result.data.csv).toContain('alice');
      expect(result.data.filename).toMatch(/^extrato-ligacoes-\d{4}-\d{2}-\d{2}\.csv$/);
    }
  });

  it('should return error on failure', async () => {
    mockFetchExtratoData.mockRejectedValue(new Error('fail'));

    const result = await exportExtratoCsv('7d');
    expect(result.success).toBe(false);
  });
});
