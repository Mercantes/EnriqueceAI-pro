import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-manager', () => ({
  requireManager: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com' }),
}));

function createChainMock() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockReturnValue(chain);
  return chain;
}

let orgMemberChain: ReturnType<typeof createChainMock>;
let goalsChain: ReturnType<typeof createChainMock>;

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      from: (table: string) => {
        if (table === 'organization_members') return orgMemberChain;
        if (table === 'daily_activity_goals') return goalsChain;
        return createChainMock();
      },
    });
  }),
}));

import { saveDailyGoals } from './save-daily-goals';

describe('saveDailyGoals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orgMemberChain = createChainMock();
    goalsChain = createChainMock();

    (orgMemberChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { org_id: 'org-1' } });
    // Default: upsert succeeds
    Object.assign(goalsChain, { error: null });
  });

  it('should return error when org not found', async () => {
    (orgMemberChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null });
    const result = await saveDailyGoals({ orgDefault: 20, memberGoals: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Organização não encontrada');
  });

  it('should return error for negative org default', async () => {
    const result = await saveDailyGoals({ orgDefault: -5, memberGoals: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Meta deve ser maior ou igual a zero');
  });

  it('should save org default successfully', async () => {
    const result = await saveDailyGoals({ orgDefault: 25, memberGoals: [] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.saved).toBeGreaterThanOrEqual(1);
  });

  it('should save with member goals', async () => {
    const result = await saveDailyGoals({
      orgDefault: 20,
      memberGoals: [
        { userId: 'u-1', target: 30 },
        { userId: 'u-2', target: null },
      ],
    });
    expect(result.success).toBe(true);
  });
});
