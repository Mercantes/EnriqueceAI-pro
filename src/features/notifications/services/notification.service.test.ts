import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();

const mockFrom = vi.fn();
const mockServiceClient = { from: mockFrom };

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => mockServiceClient,
}));

import { createNotification, createNotificationsForOrgMembers } from './notification.service';

function resetChain() {
  mockFrom.mockReset();
  mockInsert.mockReset();
  mockSelect.mockReset();
  mockSingle.mockReset();
  mockEq.mockReset();
}

describe('createNotification', () => {
  beforeEach(resetChain);

  it('should insert a notification and return id', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'notif-1' }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const result = await createNotification({
      org_id: 'org-1',
      user_id: 'user-1',
      type: 'member_invited',
      title: 'Test notification',
    });

    expect(result).toEqual({ id: 'notif-1' });
    expect(mockFrom).toHaveBeenCalledWith('notifications');
  });

  it('should throw on insert error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'insert failed' } });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    await expect(
      createNotification({
        org_id: 'org-1',
        user_id: 'user-1',
        type: 'member_invited',
        title: 'Test',
      }),
    ).rejects.toThrow('Failed to create notification');
  });
});

describe('createNotificationsForOrgMembers', () => {
  beforeEach(resetChain);

  it('should fetch members and insert notifications for each', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Fetching members
        const eqStatus = vi.fn().mockResolvedValue({
          data: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
          error: null,
        });
        const eqOrg = vi.fn().mockReturnValue({ eq: eqStatus });
        const select = vi.fn().mockReturnValue({ eq: eqOrg });
        return { select };
      }
      // Inserting notifications
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    await createNotificationsForOrgMembers({
      orgId: 'org-1',
      type: 'member_joined',
      title: 'Someone joined',
    });

    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('should exclude specified user', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const eqStatus = vi.fn().mockResolvedValue({
          data: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
          error: null,
        });
        const eqOrg = vi.fn().mockReturnValue({ eq: eqStatus });
        const select = vi.fn().mockReturnValue({ eq: eqOrg });
        return { select };
      }
      return { insert: insertMock };
    });

    await createNotificationsForOrgMembers({
      orgId: 'org-1',
      type: 'member_joined',
      title: 'Someone joined',
      excludeUserId: 'user-1',
    });

    // Should only insert for user-2
    const insertedData = insertMock.mock.calls[0]?.[0];
    expect(insertedData).toHaveLength(1);
    expect(insertedData[0].user_id).toBe('user-2');
  });

  it('should not insert if no members after exclusion', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const eqStatus = vi.fn().mockResolvedValue({
          data: [{ user_id: 'user-1' }],
          error: null,
        });
        const eqOrg = vi.fn().mockReturnValue({ eq: eqStatus });
        const select = vi.fn().mockReturnValue({ eq: eqOrg });
        return { select };
      }
      return { insert: vi.fn() };
    });

    await createNotificationsForOrgMembers({
      orgId: 'org-1',
      type: 'member_joined',
      title: 'Someone joined',
      excludeUserId: 'user-1',
    });

    // Should only call from once (for members), not a second time (no insert)
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
