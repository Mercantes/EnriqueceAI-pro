-- ============================================================================
-- Flux Sales Engagement 2.0 — ROLLBACK for Initial Schema
-- ============================================================================
-- Run this to completely undo 20260219_000001_initial_schema.sql
-- WARNING: This drops ALL tables and data. Use only in development.
-- ============================================================================

BEGIN;

-- 1. Remove pg_cron jobs
SELECT cron.unschedule('execute-cadence-steps');
SELECT cron.unschedule('sync-crm');
SELECT cron.unschedule('cleanup-ai-usage-history');
SELECT cron.unschedule('create-monthly-wa-credits');

-- 2. Drop triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS set_next_step_due ON cadence_enrollments;
DROP TRIGGER IF EXISTS set_updated_at ON organizations;
DROP TRIGGER IF EXISTS set_updated_at ON organization_members;
DROP TRIGGER IF EXISTS set_updated_at ON leads;
DROP TRIGGER IF EXISTS set_updated_at ON cadences;
DROP TRIGGER IF EXISTS set_updated_at ON message_templates;
DROP TRIGGER IF EXISTS set_updated_at ON cadence_enrollments;
DROP TRIGGER IF EXISTS set_updated_at ON crm_connections;
DROP TRIGGER IF EXISTS set_updated_at ON subscriptions;
DROP TRIGGER IF EXISTS set_updated_at ON gmail_connections;
DROP TRIGGER IF EXISTS set_updated_at ON whatsapp_connections;
DROP TRIGGER IF EXISTS set_updated_at ON calendar_connections;
DROP TRIGGER IF EXISTS set_updated_at ON plans;

-- 3. Drop functions
DROP FUNCTION IF EXISTS update_updated_at();
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS calculate_next_step_due();
DROP FUNCTION IF EXISTS public.user_org_id();
DROP FUNCTION IF EXISTS public.is_manager();

-- 4. Drop tables (reverse dependency order)
DROP TABLE IF EXISTS crm_sync_log CASCADE;
DROP TABLE IF EXISTS crm_connections CASCADE;
DROP TABLE IF EXISTS calendar_connections CASCADE;
DROP TABLE IF EXISTS whatsapp_connections CASCADE;
DROP TABLE IF EXISTS gmail_connections CASCADE;
DROP TABLE IF EXISTS whatsapp_credits CASCADE;
DROP TABLE IF EXISTS ai_usage CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS interactions CASCADE;
DROP TABLE IF EXISTS cadence_enrollments CASCADE;
DROP TABLE IF EXISTS cadence_steps CASCADE;
DROP TABLE IF EXISTS cadences CASCADE;
DROP TABLE IF EXISTS message_templates CASCADE;
DROP TABLE IF EXISTS enrichment_attempts CASCADE;
DROP TABLE IF EXISTS lead_import_errors CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS lead_imports CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- 5. Drop enum types
DROP TYPE IF EXISTS sync_direction;
DROP TYPE IF EXISTS subscription_status;
DROP TYPE IF EXISTS connection_status;
DROP TYPE IF EXISTS crm_type;
DROP TYPE IF EXISTS interaction_type;
DROP TYPE IF EXISTS channel_type;
DROP TYPE IF EXISTS enrollment_status;
DROP TYPE IF EXISTS cadence_status;
DROP TYPE IF EXISTS import_status;
DROP TYPE IF EXISTS enrichment_status;
DROP TYPE IF EXISTS lead_status;
DROP TYPE IF EXISTS member_status;
DROP TYPE IF EXISTS member_role;

COMMIT;
