/**
 * Log a Supabase/PostgREST query error that would otherwise be swallowed.
 *
 * Many actions do `const { data } = await query` and drop `error`, or return a
 * generic message (e.g. "Erro ao buscar leads") without the underlying cause.
 * That makes root-causing production failures painful — e.g. a stray
 * `invalid input syntax for type uuid: "undefined"` shows up in the Postgres
 * logs with no hint of which action/query produced it.
 *
 * Call this at the swallow points with a short `context` label. It no-ops when
 * there is no error, and emits `console.error` (captured by Sentry server-side)
 * with the label plus the PostgREST error fields (message/code/details/hint) so
 * the failing query is identifiable from logs.
 */
export function logQueryError(
  error: unknown,
  context: string,
  extra?: Record<string, unknown>,
): void {
  if (!error) return;

  const e = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };

  console.error(`[query-error] ${context}`, {
    message: e.message,
    code: e.code,
    details: e.details,
    hint: e.hint,
    ...extra,
  });
}
