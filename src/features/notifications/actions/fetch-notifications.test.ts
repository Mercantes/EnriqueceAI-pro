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

import { fetchNotifications } from './fetch-notifications';

describe('fetchNotifications', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should redirect if not authenticated', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: null } });

    await expect(fetchNotifications({})).rejects.toThrow('NEXT_REDIRECT');
  });

  it('should return error for invalid params', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });

    // Setup org member lookup
    const singleMock = vi.fn().mockResolvedValue({ data: { org_id: 'org-abc' } });
    const eqMock2 = vi.fn().mockReturnValue({ single: singleMock });
    const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
    mockSupabase.from.mockReturnValue({
      select: selectMock,
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    });

    const result = await fetchNotifications({ limit: -1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Parâmetros inválidos');
    }
  });

  it('should return error if no org found', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });

    const singleMock = vi.fn().mockResolvedValue({ data: null });
    const eqMock2 = vi.fn().mockReturnValue({ single: singleMock });
    const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
    mockSupabase.from.mockReturnValue({
      select: selectMock,
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    });

    const result = await fetchNotifications({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Organização não encontrada');
    }
  });

  it('should return paginated notifications', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });

    const mockNotifications = [
      {
        id: 'notif-1',
        org_id: 'org-abc',
        user_id: 'user-123',
        type: 'member_joined',
        title: 'New member',
        body: null,
        read_at: null,
        resource_type: null,
        resource_id: null,
        metadata: {},
        created_at: '2026-02-19T00:00:00Z',
        updated_at: '2026-02-19T00:00:00Z',
      },
    ];

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;

      if (fromCallCount === 1) {
        // organization_members lookup
        const singleMock = vi.fn().mockResolvedValue({ data: { org_id: 'org-abc' } });
        const eqMock2 = vi.fn().mockReturnValue({ single: singleMock });
        const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
        const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
        return { select: selectMock, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() };
      }

      if (fromCallCount === 2) {
        // notifications query
        const rangeMock = vi.fn().mockResolvedValue({
          data: mockNotifications,
          count: 1,
          error: null,
        });
        const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
        const eqOrg = vi.fn().mockReturnValue({ order: orderMock });
        const eqUser = vi.fn().mockReturnValue({ eq: eqOrg });
        const selectMock = vi.fn().mockReturnValue({ eq: eqUser });
        return { select: selectMock, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() };
      }

      if (fromCallCount === 3) {
        // unread count query
        const isMock = vi.fn().mockResolvedValue({ count: 1 });
        const eqOrg = vi.fn().mockReturnValue({ is: isMock });
        const eqUser = vi.fn().mockReturnValue({ eq: eqOrg });
        const selectMock = vi.fn().mockReturnValue({ eq: eqUser });
        return { select: selectMock, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() };
      }

      return { select: vi.fn().mockReturnThis(), update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn().mockReturnThis(), single: vi.fn() };
    });

    const result = await fetchNotifications({ limit: 20, offset: 0 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toHaveLength(1);
      expect(result.data.total).toBe(1);
      expect(result.data.unread_count).toBe(1);
    }
  });
});
