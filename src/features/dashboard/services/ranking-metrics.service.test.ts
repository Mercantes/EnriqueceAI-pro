import { describe, expect, it, vi } from 'vitest';

import {
  fetchActivitiesRanking,
  fetchConversionRanking,
  fetchLeadsFinishedRanking,
  fetchRankingData,
} from './ranking-metrics.service';

// --- Chainable + thenable mock builder ---
function createChainMock(finalResult: unknown = { data: null }) {
  const chain: Record<string, unknown> = {};

  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(finalResult).then(resolve);

  for (const method of ['select', 'eq', 'is', 'in', 'gte', 'lt', 'order']) {
    chain[method] = vi.fn(() => chain);
  }

  chain.maybeSingle = vi.fn(() => Promise.resolve(finalResult));
  chain.single = vi.fn(() => Promise.resolve(finalResult));

  return chain;
}

function createMockSupabase(fromImpl: (table: string) => Record<string, unknown>) {
  return { from: vi.fn(fromImpl) } as unknown;
}

const ORG = 'org-1';
const baseFilters = { month: '2026-01', cadenceIds: [] as string[], userIds: [] as string[] };

describe('fetchLeadsFinishedRanking', () => {
  it('should return 0 when no enrollments', async () => {
    const enrollmentChain = createChainMock({ data: [] });
    const goalsChain = createChainMock({ data: null });

    const supabase = createMockSupabase((table) => {
      if (table === 'cadence_enrollments') return enrollmentChain;
      if (table === 'goals') return goalsChain;
      return createChainMock();
    });

    const result = await fetchLeadsFinishedRanking(supabase as never, ORG, baseFilters);

    expect(result.total).toBe(0);
    expect(result.sdrBreakdown).toHaveLength(0);
  });

  it('should count completed and replied as finished', async () => {
    const enrollmentChain = createChainMock({
      data: [
        { enrolled_by: 'u1', status: 'completed' },
        { enrolled_by: 'u1', status: 'replied' },
        { enrolled_by: 'u1', status: 'active' },
        { enrolled_by: 'u2', status: 'completed' },
        { enrolled_by: 'u2', status: 'bounced' },
      ],
    });
    const goalsChain = createChainMock({ data: { opportunity_target: 10 } });

    const supabase = createMockSupabase((table) => {
      if (table === 'cadence_enrollments') return enrollmentChain;
      if (table === 'goals') return goalsChain;
      return createChainMock();
    });

    const result = await fetchLeadsFinishedRanking(supabase as never, ORG, baseFilters);

    expect(result.total).toBe(3); // 2 from u1 + 1 from u2
    expect(result.monthTarget).toBe(10);
    expect(result.sdrBreakdown).toHaveLength(2);

    const u1 = result.sdrBreakdown.find((s) => s.userId === 'u1');
    expect(u1?.value).toBe(2); // completed + replied
    expect(u1?.secondaryValue).toBe(1); // active = prospecting
  });

  it('should sort breakdown by value descending', async () => {
    const enrollmentChain = createChainMock({
      data: [
        { enrolled_by: 'u1', status: 'completed' },
        { enrolled_by: 'u2', status: 'completed' },
        { enrolled_by: 'u2', status: 'completed' },
      ],
    });
    const goalsChain = createChainMock({ data: null });

    const supabase = createMockSupabase((table) => {
      if (table === 'cadence_enrollments') return enrollmentChain;
      if (table === 'goals') return goalsChain;
      return createChainMock();
    });

    const result = await fetchLeadsFinishedRanking(supabase as never, ORG, baseFilters);

    expect(result.sdrBreakdown[0]?.userId).toBe('u2');
    expect(result.sdrBreakdown[0]?.value).toBe(2);
  });
});

describe('fetchActivitiesRanking', () => {
  it('should return 0 when no interactions', async () => {
    const interactionsChain = createChainMock({ data: [] });
    const goalsChain = createChainMock({ data: null });

    const supabase = createMockSupabase((table) => {
      if (table === 'interactions') return interactionsChain;
      if (table === 'goals') return goalsChain;
      return createChainMock();
    });

    const result = await fetchActivitiesRanking(supabase as never, ORG, baseFilters);

    expect(result.total).toBe(0);
    expect(result.sdrBreakdown).toHaveLength(0);
  });

  it('should count interactions per SDR via enrollment lookup', async () => {
    const interactionsChain = createChainMock({
      data: [
        { lead_id: 'l1', type: 'sent' },
        { lead_id: 'l1', type: 'opened' },
        { lead_id: 'l2', type: 'sent' },
      ],
    });
    const enrollmentChain = createChainMock({
      data: [
        { lead_id: 'l1', enrolled_by: 'u1' },
        { lead_id: 'l2', enrolled_by: 'u2' },
      ],
    });
    const goalsChain = createChainMock({ data: { activities_target: 100 } });

    const supabase = createMockSupabase((table) => {
      if (table === 'interactions') return interactionsChain;
      if (table === 'cadence_enrollments') return enrollmentChain;
      if (table === 'goals') return goalsChain;
      return createChainMock();
    });

    const result = await fetchActivitiesRanking(supabase as never, ORG, baseFilters);

    expect(result.total).toBe(3);
    expect(result.monthTarget).toBe(100);
    expect(result.sdrBreakdown).toHaveLength(2);

    const u1 = result.sdrBreakdown.find((s) => s.userId === 'u1');
    expect(u1?.value).toBe(2); // l1 has 2 interactions
  });
});

describe('fetchConversionRanking', () => {
  it('should return 0% when no leads', async () => {
    const leadsChain = createChainMock({ data: [] });
    const goalsChain = createChainMock({ data: null });

    const supabase = createMockSupabase((table) => {
      if (table === 'leads') return leadsChain;
      if (table === 'goals') return goalsChain;
      return createChainMock();
    });

    const result = await fetchConversionRanking(supabase as never, ORG, baseFilters);

    expect(result.total).toBe(0);
  });

  it('should compute conversion rate per SDR', async () => {
    const leadsChain = createChainMock({
      data: [
        { id: 'l1', status: 'qualified' },
        { id: 'l2', status: 'contacted' },
        { id: 'l3', status: 'qualified' },
        { id: 'l4', status: 'new' },
      ],
    });
    const enrollmentChain = createChainMock({
      data: [
        { lead_id: 'l1', enrolled_by: 'u1' },
        { lead_id: 'l2', enrolled_by: 'u1' },
        { lead_id: 'l3', enrolled_by: 'u2' },
        { lead_id: 'l4', enrolled_by: 'u2' },
      ],
    });
    const goalsChain = createChainMock({ data: { conversion_target: 30 } });

    const supabase = createMockSupabase((table) => {
      if (table === 'leads') return leadsChain;
      if (table === 'cadence_enrollments') return enrollmentChain;
      if (table === 'goals') return goalsChain;
      return createChainMock();
    });

    const result = await fetchConversionRanking(supabase as never, ORG, baseFilters);

    // Overall: 2 qualified / 4 total = 50%
    expect(result.total).toBe(50);
    expect(result.monthTarget).toBe(30);
    expect(result.sdrBreakdown).toHaveLength(2);

    // u1: 1/2 = 50%, u2: 1/2 = 50%
    const u1 = result.sdrBreakdown.find((s) => s.userId === 'u1');
    expect(u1?.value).toBe(50);
    expect(u1?.secondaryValue).toBe(2); // total leads
  });
});

describe('fetchRankingData', () => {
  it('should return all 3 cards', async () => {
    // Minimal mocks — all return empty data
    const emptyChain = createChainMock({ data: [] });
    const goalsChain = createChainMock({ data: null });

    const supabase = createMockSupabase((table) => {
      if (table === 'goals') return goalsChain;
      return emptyChain;
    });

    const result = await fetchRankingData(supabase as never, ORG, baseFilters);

    expect(result).toHaveProperty('leadsFinished');
    expect(result).toHaveProperty('activitiesDone');
    expect(result).toHaveProperty('conversionRate');
    expect(result.leadsFinished.total).toBe(0);
  });
});
