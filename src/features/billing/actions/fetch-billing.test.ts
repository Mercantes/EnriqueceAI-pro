import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSupabase, mockSupabaseFrom, resetMocks } from '@tests/mocks/supabase';
const mockFrom = mockSupabaseFrom as any;

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(() => Promise.resolve({ id: 'user-1', email: 'test@test.com' })),
}));

vi.mock('../services/feature-flags', () => ({
  calculateMonthlyTotal: vi.fn(() => 34900),
}));

import { fetchBillingOverview, fetchPlanComparison } from './fetch-billing';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockPlan = {
  id: 'plan-1',
  name: 'Pro',
  slug: 'pro',
  price_cents: 34900,
  max_leads: 5000,
  max_ai_per_day: 100,
  max_whatsapp_per_month: 2000,
  included_users: 5,
  additional_user_price_cents: 8900,
  features: { enrichment: 'lemit' as const, crm: true, calendar: true },
  active: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockSubscription = {
  id: 'sub-1',
  org_id: 'org-1',
  plan_id: 'plan-1',
  status: 'active' as const,
  current_period_start: '2025-01-01T00:00:00Z',
  current_period_end: '2025-02-01T00:00:00Z',
  stripe_subscription_id: 'stripe-sub-1',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockMember = { org_id: 'org-1' };

const mockAiUsage = {
  id: 'ai-1',
  org_id: 'org-1',
  usage_date: '2026-02-19',
  generation_count: 42,
  daily_limit: 100,
};

const mockWaCredits = {
  id: 'wa-1',
  org_id: 'org-1',
  plan_credits: 2000,
  used_credits: 350,
  overage_count: 0,
  period: '2026-02',
};

// ---------------------------------------------------------------------------
// Chain mock builder
// ---------------------------------------------------------------------------

/**
 * Creates a fluent Supabase query chain mock that resolves with `resolvedValue`.
 * Supports the method chains used in fetch-billing actions:
 *   select / eq / single / maybeSingle / order
 * The `select` mock also accepts the `{ count, head }` options signature.
 */
function makeChain(resolvedValue: unknown) {
  const terminal = vi.fn().mockResolvedValue(resolvedValue);

  const chain: Record<string, unknown> = {};

  const self = () => chain;

  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = terminal;
  chain.maybeSingle = terminal;

  // When the chain itself is awaited (e.g. count queries that end with .eq())
  // we need it to be thenable.
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(resolvedValue).then(resolve, reject);

  void self; // suppress unused-variable lint hint
  return chain;
}

// ---------------------------------------------------------------------------
// Helper: configure mockSupabaseFrom with sequential per-call responses
// ---------------------------------------------------------------------------

/**
 * Configures `mockSupabaseFrom` so that each successive call to `from()`
 * returns the chain built from the corresponding entry in `responses`.
 * If the call index exceeds the array length the last entry is reused.
 */
function setupFromSequence(responses: unknown[]) {
  let callIndex = 0;
  mockFrom.mockImplementation(() => {
    const value = responses[Math.min(callIndex, responses.length - 1)];
    callIndex++;
    return makeChain(value);
  });
}

// ---------------------------------------------------------------------------
// fetchBillingOverview
// ---------------------------------------------------------------------------

describe('fetchBillingOverview', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns BillingOverview with all data populated', async () => {
    // Call sequence (6 from() calls):
    // 1. organization_members  -> single()    -> member
    // 2. subscriptions         -> maybeSingle -> subscription
    // 3. plans                 -> single()    -> plan
    // 4. organization_members  -> (count)     -> { count: 3 }
    // 5. ai_usage              -> maybeSingle -> aiUsage
    // 6. whatsapp_credits      -> maybeSingle -> waCredits
    setupFromSequence([
      { data: mockMember },
      { data: mockSubscription },
      { data: mockPlan },
      { count: 3 },
      { data: mockAiUsage },
      { data: mockWaCredits },
    ]);

    const result = await fetchBillingOverview();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.plan).toEqual(mockPlan);
    expect(result.data.subscription).toEqual(mockSubscription);
    expect(result.data.memberCount).toBe(3);
    expect(result.data.additionalUsers).toBe(0); // 3 members, 5 included
    expect(result.data.monthlyTotal).toBe(34900);
    expect(result.data.aiUsageToday).toEqual({ used: 42, limit: 100 });
    expect(result.data.whatsappUsage).toEqual({
      used: 350,
      limit: 2000,
      period: expect.stringMatching(/^\d{4}-\d{2}$/),
    });
  });

  it('returns error when org member is not found', async () => {
    setupFromSequence([{ data: null }]);

    const result = await fetchBillingOverview();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe('Organização não encontrada');
  });

  it('returns error when subscription is not found', async () => {
    setupFromSequence([
      { data: mockMember },
      { data: null }, // subscription missing
    ]);

    const result = await fetchBillingOverview();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe('Assinatura não encontrada');
  });

  it('returns error when plan is not found', async () => {
    setupFromSequence([
      { data: mockMember },
      { data: mockSubscription },
      { data: null }, // plan missing
    ]);

    const result = await fetchBillingOverview();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe('Plano não encontrado');
  });

  it('handles null AI usage (used defaults to 0)', async () => {
    setupFromSequence([
      { data: mockMember },
      { data: mockSubscription },
      { data: mockPlan },
      { count: 2 },
      { data: null }, // no AI usage record for today
      { data: mockWaCredits },
    ]);

    const result = await fetchBillingOverview();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.aiUsageToday).toEqual({ used: 0, limit: mockPlan.max_ai_per_day });
  });

  it('handles null WhatsApp credits (used defaults to 0)', async () => {
    setupFromSequence([
      { data: mockMember },
      { data: mockSubscription },
      { data: mockPlan },
      { count: 2 },
      { data: mockAiUsage },
      { data: null }, // no WhatsApp credits record
    ]);

    const result = await fetchBillingOverview();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.whatsappUsage.used).toBe(0);
    expect(result.data.whatsappUsage.limit).toBe(mockPlan.max_whatsapp_per_month);
  });

  it('calculates additional users correctly when members exceed included seats', async () => {
    // Plan includes 5 users; org has 8 members → 3 additional
    const planWith5Seats = { ...mockPlan, included_users: 5 };

    setupFromSequence([
      { data: mockMember },
      { data: mockSubscription },
      { data: planWith5Seats },
      { count: 8 }, // 8 active members
      { data: mockAiUsage },
      { data: mockWaCredits },
    ]);

    const result = await fetchBillingOverview();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.memberCount).toBe(8);
    expect(result.data.additionalUsers).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// fetchPlanComparison
// ---------------------------------------------------------------------------

const mockPlans = [
  { ...mockPlan, id: 'plan-0', slug: 'starter', price_cents: 9900 },
  { ...mockPlan, id: 'plan-1', slug: 'pro', price_cents: 34900 },
  { ...mockPlan, id: 'plan-2', slug: 'enterprise', price_cents: 89900 },
];

describe('fetchPlanComparison', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns plans array and currentPlanSlug on success', async () => {
    // Call sequence (3 from() calls):
    // 1. organization_members -> single()    -> member
    // 2. plans                -> (order)     -> plans[]
    // 3. subscriptions        -> maybeSingle -> { plan_id }
    setupFromSequence([
      { data: mockMember },
      { data: mockPlans },
      { data: { plan_id: 'plan-1' } },
    ]);

    const result = await fetchPlanComparison();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.plans).toEqual(mockPlans);
    expect(result.data.currentPlanSlug).toBe('pro');
  });

  it('returns error when org member is not found', async () => {
    setupFromSequence([{ data: null }]);

    const result = await fetchPlanComparison();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe('Organização não encontrada');
  });

  it('returns empty currentPlanSlug when subscription is not found', async () => {
    setupFromSequence([
      { data: mockMember },
      { data: mockPlans },
      { data: null }, // no subscription
    ]);

    const result = await fetchPlanComparison();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.plans).toEqual(mockPlans);
    expect(result.data.currentPlanSlug).toBe('');
  });
});
