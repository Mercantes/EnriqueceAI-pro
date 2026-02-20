import { describe, expect, it } from 'vitest';

import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateMemberStatusSchema,
} from './member.schemas';

describe('inviteMemberSchema', () => {
  it('should accept valid input', () => {
    expect(inviteMemberSchema.safeParse({ email: 'user@test.com', role: 'sdr' }).success).toBe(
      true,
    );
  });

  it('should reject invalid email', () => {
    expect(inviteMemberSchema.safeParse({ email: 'invalid', role: 'sdr' }).success).toBe(false);
  });

  it('should reject invalid role', () => {
    expect(inviteMemberSchema.safeParse({ email: 'user@test.com', role: 'admin' }).success).toBe(
      false,
    );
  });
});

describe('updateMemberStatusSchema', () => {
  it('should accept valid input', () => {
    const result = updateMemberStatusSchema.safeParse({
      memberId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'active',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID', () => {
    expect(updateMemberStatusSchema.safeParse({ memberId: 'bad', status: 'active' }).success).toBe(
      false,
    );
  });

  it('should reject invalid status', () => {
    const result = updateMemberStatusSchema.safeParse({
      memberId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'removed',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateMemberRoleSchema', () => {
  it('should accept valid input', () => {
    const result = updateMemberRoleSchema.safeParse({
      memberId: '550e8400-e29b-41d4-a716-446655440000',
      role: 'manager',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid role', () => {
    const result = updateMemberRoleSchema.safeParse({
      memberId: '550e8400-e29b-41d4-a716-446655440000',
      role: 'admin',
    });
    expect(result.success).toBe(false);
  });
});
