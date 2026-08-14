import { describe, expect, it } from 'vitest';

import { isSubscriptionBlocked, PAST_DUE_GRACE_DAYS } from './subscription-access';

const NOW = Date.parse('2026-08-14T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

describe('isSubscriptionBlocked', () => {
  it('never blocks an active subscription', () => {
    expect(isSubscriptionBlocked('active', iso(NOW - 100 * DAY), NOW)).toBe(false);
  });

  it('blocks canceled immediately', () => {
    expect(isSubscriptionBlocked('canceled', iso(NOW + 100 * DAY), NOW)).toBe(true);
  });

  it('blocks trialing only after the trial period ended', () => {
    expect(isSubscriptionBlocked('trialing', iso(NOW + DAY), NOW)).toBe(false); // still in trial
    expect(isSubscriptionBlocked('trialing', iso(NOW - DAY), NOW)).toBe(true); // trial ended
    expect(isSubscriptionBlocked('trialing', null, NOW)).toBe(false); // no anchor
  });

  it(`blocks past_due only after the ${PAST_DUE_GRACE_DAYS}-day grace from period end`, () => {
    // Period ended 1 day ago → within grace → NOT blocked
    expect(isSubscriptionBlocked('past_due', iso(NOW - 1 * DAY), NOW)).toBe(false);
    // Period ended exactly 3 days ago → still not past the grace boundary
    expect(isSubscriptionBlocked('past_due', iso(NOW - 3 * DAY), NOW)).toBe(false);
    // Period ended 4 days ago → past the 3-day grace → blocked
    expect(isSubscriptionBlocked('past_due', iso(NOW - 4 * DAY), NOW)).toBe(true);
    // No period anchor → don't block
    expect(isSubscriptionBlocked('past_due', null, NOW)).toBe(false);
  });
});
