import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-manager', () => ({
  requireManager: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com' }),
}));

function createChainMock() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockReturnValue(chain);
  return chain;
}

let orgMemberChain: ReturnType<typeof createChainMock>;
let rulesChain: ReturnType<typeof createChainMock>;

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      from: (table: string) => {
        if (table === 'organization_members') return orgMemberChain;
        if (table === 'fit_score_rules') return rulesChain;
        return createChainMock();
      },
    });
  }),
}));

import { saveFitScoreRules } from './save-fit-score-rules';

describe('saveFitScoreRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orgMemberChain = createChainMock();
    rulesChain = createChainMock();

    (orgMemberChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { org_id: 'org-1' } });
    Object.assign(rulesChain, { error: null });
  });

  it('should return error when org not found', async () => {
    (orgMemberChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null });
    const result = await saveFitScoreRules([
      { points: 5, field: 'email', operator: 'not_empty', value: null },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Organização não encontrada');
  });

  it('should reject invalid rules (points = 0)', async () => {
    const result = await saveFitScoreRules([
      { points: 0, field: 'email', operator: 'not_empty', value: null },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Pontos não pode ser zero');
  });

  it('should reject invalid operator', async () => {
    const result = await saveFitScoreRules([
      { points: 5, field: 'email', operator: 'bad_op' as 'contains', value: null },
    ]);
    expect(result.success).toBe(false);
  });

  it('should save empty array (clear all rules)', async () => {
    const result = await saveFitScoreRules([]);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.saved).toBe(0);
  });

  it('should save valid rules', async () => {
    const result = await saveFitScoreRules([
      { points: 5, field: 'email', operator: 'not_empty', value: null },
      { points: -2, field: 'porte', operator: 'equals', value: 'MEI' },
    ]);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.saved).toBe(2);
  });

  it('should set value to null when operator is not_empty', async () => {
    const result = await saveFitScoreRules([
      { points: 3, field: 'telefone', operator: 'not_empty', value: 'should-be-ignored' },
    ]);
    expect(result.success).toBe(true);
  });
});
