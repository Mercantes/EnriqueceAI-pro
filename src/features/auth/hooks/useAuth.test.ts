import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

vi.mock('../actions/sign-out', () => ({
  signOut: vi.fn(() => Promise.resolve({ success: true, data: undefined })),
}));

import { useAuth } from './useAuth';

describe('useAuth', () => {
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });

  it('should start with loading true and user null', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('should set user after getUser resolves', async () => {
    const mockUser = { id: 'user-123', email: 'test@test.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it('should update user on auth state change', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    let authCallback: (event: string, session: unknown) => void;
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newUser = { id: 'user-456', email: 'new@test.com' };
    act(() => {
      authCallback('SIGNED_IN', { user: newUser });
    });

    expect(result.current.user).toEqual(newUser);
  });

  it('should unsubscribe on unmount', async () => {
    const { unmount } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalled();
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should clear user on signOut', async () => {
    const mockUser = { id: 'user-123', email: 'test@test.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.user).toBeNull();
  });
});
