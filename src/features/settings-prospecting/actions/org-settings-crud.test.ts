import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-manager', () => ({
  requireManager: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com' }),
}));

function createChainMock() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockReturnValue(chain);
  return chain;
}

let orgMemberChain: ReturnType<typeof createChainMock>;
let orgsChain: ReturnType<typeof createChainMock>;

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      from: (table: string) => {
        if (table === 'organization_members') return orgMemberChain;
        if (table === 'organizations') return orgsChain;
        return createChainMock();
      },
    });
  }),
}));

import { getOrgSettings, saveAbmSettings, saveLeadVisibility } from './org-settings-crud';

describe('org-settings-crud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orgMemberChain = createChainMock();
    orgsChain = createChainMock();

    (orgMemberChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { org_id: 'org-1' } });
  });

  describe('getOrgSettings', () => {
    it('should return error when org not found', async () => {
      (orgMemberChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null });
      const result = await getOrgSettings();
      expect(result.success).toBe(false);
    });

    it('should return org settings', async () => {
      (orgsChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { abm_enabled: false, abm_group_field: 'razao_social', lead_visibility_mode: 'all' },
      });
      const result = await getOrgSettings();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.abm_enabled).toBe(false);
        expect(result.data.lead_visibility_mode).toBe('all');
      }
    });
  });

  describe('saveAbmSettings', () => {
    it('should reject empty group field', async () => {
      const result = await saveAbmSettings(true, '');
      expect(result.success).toBe(false);
    });

    it('should save ABM settings', async () => {
      Object.assign(orgsChain, { error: null });
      const result = await saveAbmSettings(true, 'razao_social');
      expect(result.success).toBe(true);
    });
  });

  describe('saveLeadVisibility', () => {
    it('should reject invalid mode', async () => {
      const result = await saveLeadVisibility('invalid' as 'all');
      expect(result.success).toBe(false);
    });

    it('should save valid mode', async () => {
      Object.assign(orgsChain, { error: null });
      const result = await saveLeadVisibility('own');
      expect(result.success).toBe(true);
    });
  });
});
