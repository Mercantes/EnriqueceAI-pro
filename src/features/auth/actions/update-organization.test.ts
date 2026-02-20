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

import { updateOrganization } from './update-organization';

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

function setupManagerMock() {
  // requireManager -> requireAuth -> getUser, then from().select().eq().eq().single()
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: { id: 'user-123' } },
  });

  const singleMock = vi.fn().mockResolvedValue({ data: { role: 'manager' } });
  const eqMock2 = vi.fn().mockReturnValue({ single: singleMock });
  const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
  mockSupabase.from.mockReturnValue({ select: selectMock, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() });
}

describe('updateOrganization', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should return error for short name', async () => {
    setupManagerMock();

    const result = await updateOrganization(makeFormData({ name: 'A' }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('2 caracteres');
    }
  });

  it('should return error for name too long', async () => {
    setupManagerMock();

    const result = await updateOrganization(makeFormData({ name: 'A'.repeat(101) }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('100 caracteres');
    }
  });

  it('should redirect if not manager', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });

    const singleMock = vi.fn().mockResolvedValue({ data: { role: 'sdr' } });
    const eqMock2 = vi.fn().mockReturnValue({ single: singleMock });
    const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });
    mockSupabase.from.mockReturnValue({ select: selectMock, update: vi.fn(), insert: vi.fn(), delete: vi.fn(), eq: vi.fn(), single: vi.fn() });

    await expect(updateOrganization(makeFormData({ name: 'New Name' }))).rejects.toThrow(
      'NEXT_REDIRECT',
    );
  });
});
