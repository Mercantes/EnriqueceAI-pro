import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSupabase, mockSupabaseAuth, resetMocks } from '@tests/mocks/supabase';

const mockRedirect = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error('NEXT_REDIRECT');
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

import { requireAuth } from './require-auth';

describe('requireAuth', () => {
  beforeEach(() => {
    resetMocks();
    mockRedirect.mockClear();
  });

  it('should redirect to /login when user is not authenticated', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: null },
    });

    await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('should return user when authenticated', async () => {
    const mockUser = { id: 'user-123', email: 'test@test.com' };
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: mockUser },
    });

    const user = await requireAuth();
    expect(user).toEqual(mockUser);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
