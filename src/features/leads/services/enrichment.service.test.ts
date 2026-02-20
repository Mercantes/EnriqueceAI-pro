import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EnrichmentProvider, EnrichmentResult } from './enrichment-provider';
import { enrichLead } from './enrichment.service';

// Mock provider
function createMockProvider(results: EnrichmentResult[]): EnrichmentProvider {
  let callIndex = 0;
  return {
    name: 'test_provider',
    enrich: vi.fn(async () => {
      const result = results[callIndex] ?? results[results.length - 1]!;
      callIndex++;
      return result;
    }),
  };
}

// Mock supabase client
function createMockSupabase() {
  const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const insertFn = vi.fn().mockResolvedValue({ error: null });

  return {
    from: vi.fn().mockReturnValue({
      update: updateFn,
      insert: insertFn,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { cnpj: '11222333000181' } }),
        }),
      }),
    }),
    _updateFn: updateFn,
    _insertFn: insertFn,
  };
}

describe('enrichment.service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should enrich a lead successfully on first attempt', async () => {
    const provider = createMockProvider([
      {
        success: true,
        data: {
          razao_social: 'Test Company',
          porte: 'ME',
          cnae: '6201-5/01',
        },
      },
    ]);

    const supabase = createMockSupabase();

    const promise = enrichLead({
      leadId: 'lead-1',
      cnpj: '11222333000181',
      provider,
      supabase: supabase as never,
    });

    // Advance timers for any internal delays
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(provider.enrich).toHaveBeenCalledTimes(1);
    expect(provider.enrich).toHaveBeenCalledWith('11222333000181');
  });

  it('should retry on failure and succeed', async () => {
    const provider = createMockProvider([
      { success: false, error: 'Rate limit exceeded' },
      {
        success: true,
        data: { razao_social: 'Test Company' },
      },
    ]);

    const supabase = createMockSupabase();

    const promise = enrichLead({
      leadId: 'lead-1',
      cnpj: '11222333000181',
      provider,
      supabase: supabase as never,
      maxRetries: 3,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(provider.enrich).toHaveBeenCalledTimes(2);
  });

  it('should not retry on CNPJ not found', async () => {
    const provider = createMockProvider([
      { success: false, error: 'CNPJ not found' },
    ]);

    const supabase = createMockSupabase();

    const promise = enrichLead({
      leadId: 'lead-1',
      cnpj: '11222333000181',
      provider,
      supabase: supabase as never,
      maxRetries: 3,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toBe('CNPJ not found');
    expect(provider.enrich).toHaveBeenCalledTimes(1);
  });

  it('should fail after max retries', async () => {
    const provider = createMockProvider([
      { success: false, error: 'Rate limit exceeded' },
      { success: false, error: 'Rate limit exceeded' },
      { success: false, error: 'Rate limit exceeded' },
    ]);

    const supabase = createMockSupabase();

    const promise = enrichLead({
      leadId: 'lead-1',
      cnpj: '11222333000181',
      provider,
      supabase: supabase as never,
      maxRetries: 3,
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(provider.enrich).toHaveBeenCalledTimes(3);
  });

  it('should record enrichment attempt in database', async () => {
    const provider = createMockProvider([
      {
        success: true,
        data: { razao_social: 'Test Company' },
      },
    ]);

    const supabase = createMockSupabase();

    const promise = enrichLead({
      leadId: 'lead-1',
      cnpj: '11222333000181',
      provider,
      supabase: supabase as never,
    });

    await vi.runAllTimersAsync();
    await promise;

    // Should have called from('enrichment_attempts').insert()
    expect(supabase.from).toHaveBeenCalledWith('enrichment_attempts');
  });
});
