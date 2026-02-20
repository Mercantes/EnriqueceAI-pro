import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WhatsAppCreditService } from './whatsapp-credit.service';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Chain mock factory
// ---------------------------------------------------------------------------

function createChainMock(finalResult: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockImplementation(() => Promise.resolve(finalResult));
  chain.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(finalResult));
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(finalResult).then(resolve, reject);
  return chain;
}

function createMockSupabase(implementations: Array<() => unknown>) {
  let callIndex = 0;
  return {
    from: vi.fn(() => {
      const impl = implementations[callIndex];
      callIndex++;
      return impl ? impl() : createChainMock({ data: null });
    }),
  };
}

describe('WhatsAppCreditService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should deduct credit when under limit', async () => {
    const supabase = createMockSupabase([
      // 1st: fetch credit row
      () => createChainMock({
        data: { id: 'credit-1', plan_credits: 500, used_credits: 10, overage_count: 0 },
      }),
      // 2nd: update credit row
      () => createChainMock({ data: null }),
    ]);

    const result = await WhatsAppCreditService.checkAndDeductCredit(
      'org-1',
      supabase as never,
    );

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(11);
    expect(result.limit).toBe(500);
    expect(result.isOverage).toBe(false);
  });

  it('should allow overage and flag it', async () => {
    const supabase = createMockSupabase([
      // 1st: fetch credit row — used == plan_credits
      () => createChainMock({
        data: { id: 'credit-1', plan_credits: 500, used_credits: 500, overage_count: 2 },
      }),
      // 2nd: update credit row
      () => createChainMock({ data: null }),
    ]);

    const result = await WhatsAppCreditService.checkAndDeductCredit(
      'org-1',
      supabase as never,
    );

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(501);
    expect(result.limit).toBe(500);
    expect(result.isOverage).toBe(true);
  });

  it('should create period row when not found and plan exists', async () => {
    const supabase = createMockSupabase([
      // 1st: fetch credit row — not found
      () => createChainMock({ data: null }),
      // 2nd: fetch subscription → plan
      () => createChainMock({
        data: { plan: { max_whatsapp_per_month: 2500 } },
      }),
      // 3rd: insert new credit row
      () => createChainMock({ error: null }),
    ]);

    const result = await WhatsAppCreditService.checkAndDeductCredit(
      'org-1',
      supabase as never,
    );

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(1);
    expect(result.limit).toBe(2500);
    expect(result.isOverage).toBe(false);
  });

  it('should return not allowed when no plan exists', async () => {
    const supabase = createMockSupabase([
      // 1st: fetch credit row — not found
      () => createChainMock({ data: null }),
      // 2nd: fetch subscription → null (no plan)
      () => createChainMock({ data: null }),
    ]);

    const result = await WhatsAppCreditService.checkAndDeductCredit(
      'org-1',
      supabase as never,
    );

    expect(result.allowed).toBe(false);
    expect(result.error).toBe('Sem plano WhatsApp ativo');
  });

  it('should handle race condition on insert (retry)', async () => {
    const supabase = createMockSupabase([
      // 1st: fetch credit row — not found
      () => createChainMock({ data: null }),
      // 2nd: fetch subscription → plan
      () => createChainMock({
        data: { plan: { max_whatsapp_per_month: 500 } },
      }),
      // 3rd: insert — conflict error
      () => createChainMock({ error: { message: 'duplicate key' } }),
      // 4th: retry fetch
      () => createChainMock({
        data: { id: 'credit-1', plan_credits: 500, used_credits: 5, overage_count: 0 },
      }),
      // 5th: update after retry
      () => createChainMock({ data: null }),
    ]);

    const result = await WhatsAppCreditService.checkAndDeductCredit(
      'org-1',
      supabase as never,
    );

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(6);
  });
});
