# Schema & Migration Pre-Flight Checklist

## Purpose

**Checkpoint "Data Engineer"** — Execute BEFORE writing any SQL migration file.
Prevents naming convention bugs, enum mismatches, and structural inconsistencies by cross-referencing the canonical initial_schema conventions.

**Trigger:** Story task involves database changes (new table, alter column, new enum, new migration file).

---

## Reference: Canonical Schema Conventions

> Source of truth: `supabase/migrations/20260219_000001_initial_schema.sql`

### Naming

- **Tables**: plural, snake_case (e.g., `leads`, `cadence_steps`, `crm_connections`)
- **Columns**: snake_case (e.g., `org_id`, `created_at`, `enrichment_status`)
- **Enums**: snake_case (e.g., `member_role`, `lead_status`, `channel_type`)
- **Indexes**: `idx_{table}_{column(s)}` (e.g., `idx_leads_org`, `idx_interactions_type`)
- **Constraints**: `chk_{table}_{description}` (e.g., `chk_leads_cnpj_format`, `chk_plans_price_positive`)
- **RLS Policies**: `{table_short}_{scope}_{operation}` (e.g., `leads_org_read`, `crm_manager_update`)
- **Triggers**: `set_updated_at` (trigger name), `set_next_step_due` (trigger name)
- **Functions**: `update_updated_at()` (trigger fn), `user_org_id()`, `is_manager()`

### Migration File Naming

- Format: `YYYYMMDDHHMMSS_{description}.sql` (14-digit timestamp)
- Each migration MUST have a **unique** timestamp — NO duplicates
- Description in snake_case (e.g., `20260221001500_calls_module.sql`)

---

## Checklist

### 1. Migration File Naming

- [ ] Timestamp has exactly 14 digits (`YYYYMMDDHHMMSS`)
- [ ] Timestamp is unique — no other migration file shares the same prefix
- [ ] Description is in snake_case and clearly describes the change
- [ ] Verify with: `ls supabase/migrations/` to check for conflicts

### 2. Enum Validation

- [ ] Any new enum value references an **existing** enum type (see Enum Reference below)
- [ ] If creating a new enum type: name is snake_case, values are lowercase
- [ ] If inserting data with enum columns: values are valid members of that enum
- [ ] Cross-reference enum values against the Enum Reference table — do NOT assume values exist

#### Enum Reference (from initial_schema)

| Enum Type | Valid Values |
|-----------|-------------|
| `member_role` | `'manager'`, `'sdr'` |
| `member_status` | `'invited'`, `'active'`, `'suspended'`, `'removed'` |
| `lead_status` | `'new'`, `'contacted'`, `'qualified'`, `'unqualified'`, `'archived'` |
| `enrichment_status` | `'pending'`, `'enriching'`, `'enriched'`, `'enrichment_failed'`, `'not_found'` |
| `import_status` | `'processing'`, `'completed'`, `'failed'` |
| `cadence_status` | `'draft'`, `'active'`, `'paused'`, `'archived'` |
| `enrollment_status` | `'active'`, `'paused'`, `'completed'`, `'replied'`, `'bounced'`, `'unsubscribed'` |
| `channel_type` | `'email'`, `'whatsapp'` |
| `interaction_type` | `'sent'`, `'delivered'`, `'opened'`, `'clicked'`, `'replied'`, `'bounced'`, `'failed'`, `'meeting_scheduled'` |
| `crm_type` | `'hubspot'`, `'pipedrive'`, `'rdstation'` |
| `connection_status` | `'connected'`, `'disconnected'`, `'error'`, `'syncing'` |
| `subscription_status` | `'active'`, `'past_due'`, `'canceled'`, `'trialing'` |
| `sync_direction` | `'push'`, `'pull'` |

> **Note:** If a migration adds new values to an existing enum (ALTER TYPE ... ADD VALUE), update this table and `dev-checkpoints.md`.

### 3. Functions & Triggers

- [ ] Trigger function for `updated_at` is **`update_updated_at()`** — NEVER `set_updated_at()`, `handle_updated_at()`, or any other variant
- [ ] Trigger name on tables is `set_updated_at` (this is the trigger name, not the function)
- [ ] Every new table with an `updated_at` column has the trigger: `CREATE TRIGGER set_updated_at BEFORE UPDATE ON {table} FOR EACH ROW EXECUTE FUNCTION update_updated_at();`
- [ ] Custom trigger functions use `RETURNS TRIGGER` and `plpgsql` language
- [ ] RLS helper functions are `public.user_org_id()` and `public.is_manager()` — NEVER inline subqueries for org isolation

### 4. RLS Policies

- [ ] Use `public.user_org_id()` for org-scoped access — NEVER `(SELECT org_id FROM organization_members WHERE ...)`
- [ ] Use `public.is_manager()` for manager-only access — NEVER inline role checks
- [ ] New table has `ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;`
- [ ] Policies follow naming convention: `{table_short}_{scope}_{operation}`
- [ ] SELECT policies use `USING (...)`, INSERT policies use `WITH CHECK (...)`

### 5. Table Design

- [ ] Primary key: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- [ ] Has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- [ ] Has `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` (if table supports updates)
- [ ] Has `org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL` (if org-scoped)
- [ ] Foreign keys specify `ON DELETE` behavior (CASCADE, SET NULL, or RESTRICT)
- [ ] CHECK constraints where appropriate (e.g., positive counts, valid formats)

### 6. Migration Safety

- [ ] Wrapped in `BEGIN;` / `COMMIT;` transaction
- [ ] Uses `IF NOT EXISTS` / `IF EXISTS` for idempotency where appropriate
- [ ] No destructive operations (DROP TABLE, DROP COLUMN) without explicit approval
- [ ] `CREATE OR REPLACE` for functions to allow re-running
- [ ] Comments on tables/columns for documentation

---

## On Failure

If any check fails:
1. **STOP** — do not write the migration file
2. Fix the issue in the SQL draft
3. Re-run the checklist
4. Only proceed when all applicable items pass

---

## Metadata

```yaml
version: 1.0.0
created: 2026-02-21
applies_to: stories with database changes
trigger: before writing SQL migration
integrated_in: dev-develop-story.md (Checkpoint 1)
```
