import { describe, expect, it } from 'vitest';

import { fetchNotificationsSchema, markNotificationReadSchema } from './notification.schemas';

describe('fetchNotificationsSchema', () => {
  it('should accept valid input with defaults', () => {
    const result = fetchNotificationsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
      expect(result.data.unread_only).toBe(false);
    }
  });

  it('should accept custom values', () => {
    const result = fetchNotificationsSchema.safeParse({
      limit: 10,
      offset: 20,
      unread_only: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(20);
      expect(result.data.unread_only).toBe(true);
    }
  });

  it('should reject limit above 50', () => {
    const result = fetchNotificationsSchema.safeParse({ limit: 100 });
    expect(result.success).toBe(false);
  });

  it('should reject negative offset', () => {
    const result = fetchNotificationsSchema.safeParse({ offset: -1 });
    expect(result.success).toBe(false);
  });

  it('should reject limit of 0', () => {
    const result = fetchNotificationsSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });
});

describe('markNotificationReadSchema', () => {
  it('should accept valid UUID', () => {
    const result = markNotificationReadSchema.safeParse({
      notification_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID', () => {
    const result = markNotificationReadSchema.safeParse({
      notification_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing notification_id', () => {
    const result = markNotificationReadSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
