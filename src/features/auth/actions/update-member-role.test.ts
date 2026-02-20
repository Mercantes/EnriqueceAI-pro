import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockSupabase, mockSupabaseAuth, resetMocks } from '@tests/mocks/supabase';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((...args: unknown[]) => {
    throw new Error('NEXT_REDIRECT: ' + args[0]);
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

import { updateMemberRole } from './update-member-role';

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

function setupManagerMock() {
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: { id: 'user-123' } },
  });

  let fromCallCount = 0;
  mockSupabase.from.mockImplementation(() => {
    fromCallCount++;

    if (fromCallCount === 1) {
      // requireManager: role check
      const singleMock = vi.fn().mockResolvedValue({ data: { role: 'manager' } });
      const eqMock2 = vi.fn().mockReturnValue({ single: singleMock });
      const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
      return { select: selectMock, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() };
    }

    if (fromCallCount === 2) {
      // Get member
      const singleMock = vi.fn().mockResolvedValue({
        data: { user_id: 'other-user', org_id: 'org-abc' },
      });
      const eqMock1 = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
      return { select: selectMock, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() };
    }

    if (fromCallCount === 3) {
      // Get org owner
      const singleMock = vi.fn().mockResolvedValue({
        data: { owner_id: 'user-123' },
      });
      const eqMock1 = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
      return { select: selectMock, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() };
    }

    if (fromCallCount === 4) {
      // Update role
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      return { select: vi.fn(), update: updateMock, insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() };
    }

    return { select: vi.fn().mockReturnThis(), update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn().mockReturnThis(), single: vi.fn() };
  });
}

describe('updateMemberRole', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should return validation error for invalid role', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });
    const singleMock = vi.fn().mockResolvedValue({ data: { role: 'manager' } });
    const eqMock2 = vi.fn().mockReturnValue({ single: singleMock });
    const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
    mockSupabase.from.mockReturnValue({ select: selectMock, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() });

    const result = await updateMemberRole(
      makeFormData({ memberId: '550e8400-e29b-41d4-a716-446655440000', role: 'admin' }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Role');
    }
  });

  it('should prevent changing role of org owner', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;

      if (fromCallCount === 1) {
        const singleMock = vi.fn().mockResolvedValue({ data: { role: 'manager' } });
        const eqMock2 = vi.fn().mockReturnValue({ single: singleMock });
        const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
        const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
        return { select: selectMock, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() };
      }

      if (fromCallCount === 2) {
        // Member IS the owner
        const singleMock = vi.fn().mockResolvedValue({
          data: { user_id: 'owner-user', org_id: 'org-abc' },
        });
        const eqMock1 = vi.fn().mockReturnValue({ single: singleMock });
        const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
        return { select: selectMock, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() };
      }

      if (fromCallCount === 3) {
        // Org owner matches the member
        const singleMock = vi.fn().mockResolvedValue({
          data: { owner_id: 'owner-user' },
        });
        const eqMock1 = vi.fn().mockReturnValue({ single: singleMock });
        const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
        return { select: selectMock, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() };
      }

      return { select: vi.fn().mockReturnThis(), update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn().mockReturnThis(), single: vi.fn() };
    });

    const result = await updateMemberRole(
      makeFormData({ memberId: '550e8400-e29b-41d4-a716-446655440000', role: 'sdr' }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('proprietário');
    }
  });

  it('should succeed with valid data', async () => {
    setupManagerMock();

    const result = await updateMemberRole(
      makeFormData({ memberId: '550e8400-e29b-41d4-a716-446655440000', role: 'sdr' }),
    );

    expect(result.success).toBe(true);
  });
});
