/**
 * RFC-4122-shaped UUID matcher (same shape used by the Leads filter guard in
 * features/leads/schemas/lead.schemas.ts).
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True only for a syntactically valid UUID string.
 *
 * Use this to guard `.eq('some_uuid_col', value)` / `.in(...)` filters against
 * client-provided values. Optional filters are often built as
 * `?sdrId=${maybeUndefined}`, which serializes the JS value `undefined` into the
 * literal string `"undefined"` — a non-empty (truthy) string that slips past a
 * plain `if (value)` guard and reaches Postgres as `col=eq.undefined`, blowing up
 * with `invalid input syntax for type uuid: "undefined"`. Gate with `isUuid`
 * instead of a bare truthiness check so non-UUID values become "no filter".
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
