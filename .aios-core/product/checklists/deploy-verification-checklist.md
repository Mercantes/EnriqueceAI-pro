# Deploy Verification Checklist

## Purpose

**Checkpoint "DevOps"** — Execute AFTER QA/CodeRabbit, BEFORE the story-dod-checklist.
Ensures the implementation is deployment-ready: migrations committed, git state clean, types current, and documentation complete.

**Trigger:** CodeRabbit self-healing completed (or skipped). All code quality checks passed.

---

## Checklist

### 1. Migration Status

- [ ] All migration files are complete (no TODOs, no placeholder SQL)
- [ ] Migration files are staged/committed in git
- [ ] Rollback files exist if required by story scope (in `supabase/rollbacks/`)
- [ ] Seed data included in migration if applicable (not in separate uncommitted file)

### 2. Git State

- [ ] Working tree is clean for all files related to this story
  - Run `git status` and verify no unstaged changes for story files
- [ ] All new files are tracked (no untracked story-related files)
- [ ] No accidental files included (`.env`, `node_modules/`, `.DS_Store`)
- [ ] Commit messages follow conventional commits format (`feat:`, `fix:`, etc.)

### 3. Type Generation

- [ ] Supabase types are up to date with current schema
  - If types were regenerated: verify `src/lib/supabase/types.ts` is committed
  - If types are stale: `TYPES_STALE` marker exists in story Change Log with specific migration reference
- [ ] No `@ts-ignore` or `@ts-expect-error` comments added as workarounds for stale types

### 4. Build Verification

- [ ] `pnpm build` passes with zero errors
- [ ] No new build warnings that indicate potential runtime issues
- [ ] Bundle size hasn't increased unexpectedly (check if new heavy dependencies were added)

### 5. Documentation

- [ ] Story **File List** section lists ALL created, modified, and deleted files
- [ ] Story **Change Log** has an entry for this implementation with date and summary
- [ ] Deploy notes documented if migration requires special handling:
  - Manual steps (e.g., backfill data, run seed)
  - Environment variables needed
  - Feature flags to enable/disable
  - Order of operations (e.g., deploy migration before code)

---

## On Failure

If git state is not clean:
1. Stage and commit remaining files
2. Re-verify git status

If build fails:
1. Return to Post-Implementation QA Checklist
2. Fix build issues
3. Re-run from Checkpoint 2

If types are stale and no marker exists:
1. Add `TYPES_STALE` marker to Change Log
2. Proceed — type regeneration can happen in next session with local Supabase

---

## Metadata

```yaml
version: 1.0.0
created: 2026-02-21
applies_to: all stories before DoD
trigger: after CodeRabbit, before story-dod-checklist
integrated_in: dev-develop-story.md (Checkpoint 3)
```
