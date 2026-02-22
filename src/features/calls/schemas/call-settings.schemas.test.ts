import { describe, expect, it } from 'vitest';

import {
  addPhoneBlacklistSchema,
  saveCallDailyTargetsSchema,
  saveCallSettingsSchema,
} from './call-settings.schemas';

describe('saveCallSettingsSchema', () => {
  it('should accept valid input', () => {
    const result = saveCallSettingsSchema.safeParse({
      calls_enabled: true,
      default_call_type: 'outbound',
      significant_threshold_seconds: 30,
      daily_call_target: 20,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid call type', () => {
    const result = saveCallSettingsSchema.safeParse({
      calls_enabled: true,
      default_call_type: 'invalid',
      significant_threshold_seconds: 30,
      daily_call_target: 20,
    });
    expect(result.success).toBe(false);
  });

  it('should reject zero threshold', () => {
    const result = saveCallSettingsSchema.safeParse({
      calls_enabled: true,
      default_call_type: 'outbound',
      significant_threshold_seconds: 0,
      daily_call_target: 20,
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative daily target', () => {
    const result = saveCallSettingsSchema.safeParse({
      calls_enabled: true,
      default_call_type: 'outbound',
      significant_threshold_seconds: 30,
      daily_call_target: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('saveCallDailyTargetsSchema', () => {
  it('should accept valid targets', () => {
    const result = saveCallDailyTargetsSchema.safeParse({
      targets: [
        { userId: '550e8400-e29b-41d4-a716-446655440000', dailyTarget: 25 },
        { userId: '550e8400-e29b-41d4-a716-446655440001', dailyTarget: null },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-uuid userId', () => {
    const result = saveCallDailyTargetsSchema.safeParse({
      targets: [{ userId: 'bad', dailyTarget: 10 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('addPhoneBlacklistSchema', () => {
  it('should accept valid phone pattern', () => {
    const result = addPhoneBlacklistSchema.safeParse({
      phone_pattern: '+5511999*',
      reason: 'Spam',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty pattern', () => {
    const result = addPhoneBlacklistSchema.safeParse({
      phone_pattern: '',
    });
    expect(result.success).toBe(false);
  });

  it('should accept pattern without reason', () => {
    const result = addPhoneBlacklistSchema.safeParse({
      phone_pattern: '0800*',
    });
    expect(result.success).toBe(true);
  });
});
