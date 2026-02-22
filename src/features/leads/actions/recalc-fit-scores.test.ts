import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

function createChainMock() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockReturnValue(chain);
  return chain;
}

import { createServerSupabaseClient } from '@/lib/supabase/server';

import { recalcFitScoreForLead, recalcFitScoresForOrg } from './recalc-fit-scores';

describe('recalcFitScoreForLead', () => {
  it('should calculate and update score for a single lead', async () => {
    const rulesChain = createChainMock();
    const leadsChain = createChainMock();
    const updateChain = createChainMock();

    // Rules query
    Object.assign(rulesChain, {
      data: [
        { points: 5, field: 'email', operator: 'not_empty', value: null },
      ],
    });

    // Lead data query (first call)
    (leadsChain.single as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        data: { email: 'test@example.com', telefone: null, razao_social: 'Test', nome_fantasia: null, porte: null, cnae: null, situacao_cadastral: null, faturamento_estimado: null, notes: null },
      })
      // endereco query (second call)
      .mockResolvedValueOnce({
        data: { endereco: { uf: 'SP' } },
      });

    Object.assign(updateChain, { error: null });

    const supabase = {
      from: (table: string) => {
        if (table === 'fit_score_rules') return rulesChain;
        if (table === 'leads') return leadsChain;
        return createChainMock();
      },
    };

    // Should not throw
    await recalcFitScoreForLead(
      supabase as Awaited<ReturnType<typeof createServerSupabaseClient>>,
      'lead-1',
      'org-1',
    );

    // Verify update was called
    expect(leadsChain.update).toHaveBeenCalled();
  });
});

describe('recalcFitScoresForOrg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should recalculate scores for all leads', async () => {
    const rulesChain = createChainMock();
    const leadsChain = createChainMock();

    Object.assign(rulesChain, {
      data: [
        { points: 3, field: 'email', operator: 'not_empty', value: null },
      ],
    });

    Object.assign(leadsChain, {
      data: [
        { id: 'l1', email: 'a@b.com', telefone: null, razao_social: null, nome_fantasia: null, porte: null, cnae: null, situacao_cadastral: null, faturamento_estimado: null, notes: null, endereco: null },
        { id: 'l2', email: null, telefone: null, razao_social: null, nome_fantasia: null, porte: null, cnae: null, situacao_cadastral: null, faturamento_estimado: null, notes: null, endereco: null },
      ],
      error: null,
    });

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'fit_score_rules') return rulesChain;
        if (table === 'leads') return leadsChain;
        return createChainMock();
      },
    };

    (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

    const result = await recalcFitScoresForOrg('org-1');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.updated).toBe(2);
  });

  it('should return error when leads fetch fails', async () => {
    const rulesChain = createChainMock();
    const leadsChain = createChainMock();

    Object.assign(rulesChain, { data: [] });
    Object.assign(leadsChain, { data: null, error: { message: 'DB error' } });

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'fit_score_rules') return rulesChain;
        if (table === 'leads') return leadsChain;
        return createChainMock();
      },
    };

    (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

    const result = await recalcFitScoresForOrg('org-1');
    expect(result.success).toBe(false);
  });

  it('should handle empty leads list', async () => {
    const rulesChain = createChainMock();
    const leadsChain = createChainMock();

    Object.assign(rulesChain, { data: [{ points: 5, field: 'email', operator: 'not_empty', value: null }] });
    Object.assign(leadsChain, { data: [], error: null });

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'fit_score_rules') return rulesChain;
        if (table === 'leads') return leadsChain;
        return createChainMock();
      },
    };

    (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

    const result = await recalcFitScoresForOrg('org-1');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.updated).toBe(0);
  });
});
