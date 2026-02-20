import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSupabase, mockSupabaseAuth, resetMocks } from '@tests/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

import { signOut } from './sign-out';

describe('signOut', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should return success when signout succeeds', async () => {
    mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

    const result = await signOut();

    expect(result).toEqual({ success: true, data: undefined });
    expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
  });

  it('should return error when signout fails', async () => {
    mockSupabaseAuth.signOut.mockResolvedValue({
      error: { message: 'Session not found', code: 'session_not_found' },
    });

    const result = await signOut();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Session not found');
    }
  });
});
