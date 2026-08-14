/**
 * Re-export of the hardened UUID guard from the base lib layer.
 *
 * This module previously carried a weaker duplicate — `isUuid(value: string)`
 * with no `unknown` acceptance and no `value is string` type-guard — which meant
 * `arr.filter(isUuid)` did NOT narrow to `string[]`, reintroducing the
 * `col=eq.undefined` class of bug the lib version was written to prevent. Public
 * routes (api/v1/leads, api/track/*, api/feedback) import from here, so they now
 * get the narrowing guard.
 */
export { isUuid, UUID_RE } from '@/lib/utils/uuid';
