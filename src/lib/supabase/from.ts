import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './types';

/**
 * Typed wrapper for supabase.from() — avoids the verbose
 * `as ReturnType<typeof supabase.from>` cast on every query.
 *
 * The return type is intentionally loose (generic PostgrestQueryBuilder over
 * `any`) because callers use outer `as { data: T }` casts on query results.
 *
 * Why `SupabaseClient<any>` and not `SupabaseClient<Database>` in the return
 * cast: `ReturnType` of the overloaded/generic `from()` collapses to ONE branch
 * of the `Database` union. With the full generated `types.ts` (161 tables and
 * views) that branch was `leads`, so every `.update({...})` / `.insert({...})`
 * on any other table was type-checked against `leads` columns (29 false errors
 * such as "'abm_enabled' does not exist" on `organizations`). Story
 * supabase-types-regeneration, phase 1. Real per-table typing is a follow-up.
 */
export function from(supabase: SupabaseClient<Database>, table: string) {
  return supabase.from(table as any) as ReturnType<SupabaseClient<any>['from']>;
}
