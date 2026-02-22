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
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockReturnValue(chain);
  return chain;
}

let orgMemberChain: ReturnType<typeof createChainMock>;
let blacklistChain: ReturnType<typeof createChainMock>;

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      from: (table: string) => {
        if (table === 'organization_members') return orgMemberChain;
        if (table === 'email_blacklist') return blacklistChain;
        return createChainMock();
      },
    });
  }),
}));

import { addBlacklistDomain, deleteBlacklistDomain, listBlacklistDomains } from './email-blacklist-crud';

describe('email-blacklist-crud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orgMemberChain = createChainMock();
    blacklistChain = createChainMock();

    (orgMemberChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { org_id: 'org-1' } });
  });

  describe('listBlacklistDomains', () => {
    it('should return error when org not found', async () => {
      (orgMemberChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null });
      const result = await listBlacklistDomains();
      expect(result.success).toBe(false);
    });

    it('should return empty array', async () => {
      Object.assign(blacklistChain, { data: [], error: null });
      const result = await listBlacklistDomains();
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toEqual([]);
    });
  });

  describe('addBlacklistDomain', () => {
    it('should reject empty domain', async () => {
      const result = await addBlacklistDomain('');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('Domínio é obrigatório');
    });

    it('should reject invalid domain format', async () => {
      const result = await addBlacklistDomain('nodots');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe('Formato de domínio inválido');
    });

    it('should add valid domain', async () => {
      (blacklistChain.single as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 'b-1', org_id: 'org-1', domain: 'spam.com', created_at: '2026-01-01' },
      });
      const result = await addBlacklistDomain('spam.com');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.domain).toBe('spam.com');
    });
  });

  describe('deleteBlacklistDomain', () => {
    it('should delete domain', async () => {
      Object.assign(blacklistChain, { error: null });
      const result = await deleteBlacklistDomain('b-1');
      expect(result.success).toBe(true);
    });
  });
});
