# Post-Implementation QA Checklist

## Purpose

**Checkpoint "QA"** — Execute AFTER all story tasks are marked [x], BEFORE CodeRabbit self-healing.
Catches schema-code mismatches, migration integrity issues, and type desynchronization before the final quality gate.

**Trigger:** All story tasks are complete (all checkboxes [x]).

---

## Checklist

### 1. Schema-Code Consistency

- [ ] Enum values in TypeScript match PostgreSQL definitions exactly
  - Check `src/features/*/types/` and `src/features/*/schemas/` against migration files
  - Common mismatch: TypeScript has values that don't exist in the DB enum, or vice versa
- [ ] Column names in Supabase queries match actual table columns
- [ ] Foreign key relationships in code match database constraints
- [ ] Zod schemas validate the same constraints as database CHECK constraints

### 2. Migration Integrity

- [ ] All migration file timestamps are unique (no two files share the same 14-digit prefix)
- [ ] Migrations are ordered correctly by dependency (tables referenced by FKs are created first)
- [ ] Every new table with `updated_at` has the `set_updated_at` trigger using `update_updated_at()` function
- [ ] RLS is enabled on all new tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] RLS policies exist for all CRUD operations needed by the application

### 3. Type Synchronization

- [ ] If migrations changed the schema: types in `src/lib/supabase/types.ts` need regeneration
  - Run `npx supabase gen types typescript --local > src/lib/supabase/types.ts` if local Supabase is running
  - If not possible: document `TYPES_STALE` in story Dev Notes / Change Log
- [ ] New tables/columns have corresponding TypeScript types in the feature's `types/index.ts`
- [ ] Contract files (`*.contract.ts`) are updated if public API surface changed

### 4. Automated Checks

Execute each command and verify it passes:

- [ ] `pnpm typecheck` — No TypeScript errors
- [ ] `pnpm lint` — No new lint warnings/errors
- [ ] `pnpm test:run` — All tests pass (including new tests)
- [ ] `pnpm build` — Production build succeeds

### 5. Regression

- [ ] Existing tests are not broken (no new failures in unrelated test files)
- [ ] Existing functionality is not impacted (manual spot-check if applicable)
- [ ] No unintended changes to existing files (review `git diff` for scope creep)

### 6. Security

- [ ] No credentials, API keys, or secrets hardcoded in source files
- [ ] No `console.log` statements with sensitive data (user info, tokens, passwords)
- [ ] Server Actions use `requireAuth()` or `requireManager()` as first call
- [ ] RLS policies don't have overly permissive conditions (e.g., `USING (true)`)

---

## On Failure

If any automated check fails:
1. Fix the issue immediately
2. Re-run the failed check
3. Only proceed to CodeRabbit when all checks pass

If type regeneration is not possible:
1. Add `<!-- TYPES_STALE: Migration {filename} changed schema, types need regeneration -->` to story Change Log
2. This will be caught by the Deploy Verification Checklist

---

## Metadata

```yaml
version: 1.0.0
created: 2026-02-21
applies_to: all stories after implementation
trigger: after all tasks [x], before CodeRabbit
integrated_in: dev-develop-story.md (Checkpoint 2)
```
