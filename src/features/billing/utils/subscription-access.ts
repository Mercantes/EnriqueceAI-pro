import type { SubscriptionStatus } from '../types';

/** Grace period (days) before a `past_due` subscription blocks app access. */
export const PAST_DUE_GRACE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the org's subscription should block access to the app.
 *
 * - `canceled` → block immediately.
 * - `trialing` → block once the trial period ended.
 * - `past_due` → block only after a 3-day grace from `current_period_end`
 *   (the renewal failed at period end; Stripe retries within a few days, so we
 *   don't cut access on the first failure). No period anchor → don't block.
 *
 * Shared by the server-side gate (the `(app)` layout) and the client
 * `SubscriptionGuard` so the two never disagree. `now` is injectable for tests.
 */
export function isSubscriptionBlocked(
  status: SubscriptionStatus,
  periodEnd: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (status === 'canceled') return true;
  if (status === 'trialing') {
    return Boolean(periodEnd) && new Date(periodEnd as string).getTime() < now;
  }
  if (status === 'past_due') {
    if (!periodEnd) return false;
    return new Date(periodEnd).getTime() + PAST_DUE_GRACE_DAYS * DAY_MS < now;
  }
  return false;
}

/** Paths that must stay reachable while blocked, so the user can pay. */
export const BILLING_EXEMPT_PREFIXES = ['/upgrade', '/settings/billing'];
