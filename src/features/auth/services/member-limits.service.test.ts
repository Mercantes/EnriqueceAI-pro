import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkMemberLimit } from './member-limits.service';

function createMockSupabase(subscriptionData: unknown, memberCount: number) {
  const singleMock = vi.fn().mockResolvedValue({ data: subscriptionData });
  const inMock = vi.fn().mockResolvedValue({ count: memberCount });

  return {
    from: vi.fn((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: singleMock,
            }),
          }),
        };
      }
      // organization_members
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: inMock,
          }),
        }),
      };
    }),
  };
}

describe('checkMemberLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow when under limit', async () => {
    const supabase = createMockSupabase(
      { plan_id: 'plan-1', plans: { included_users: 4 } },
      2,
    );

    const result = await checkMemberLimit(supabase as any, 'org-123');

    expect(result).toEqual({ allowed: true, current: 2, max: 4 });
  });

  it('should not allow when at limit', async () => {
    const supabase = createMockSupabase(
      { plan_id: 'plan-1', plans: { included_users: 4 } },
      4,
    );

    const result = await checkMemberLimit(supabase as any, 'org-123');

    expect(result).toEqual({ allowed: false, current: 4, max: 4 });
  });

  it('should default to 4 max when no subscription found', async () => {
    const supabase = createMockSupabase(null, 1);

    const result = await checkMemberLimit(supabase as any, 'org-123');

    expect(result).toEqual({ allowed: true, current: 1, max: 4 });
  });
});
