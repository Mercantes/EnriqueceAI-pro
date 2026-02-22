-- Rollback for 20260222120000_call_settings.sql

BEGIN;

DROP TABLE IF EXISTS phone_blacklist CASCADE;
DROP TABLE IF EXISTS call_daily_targets CASCADE;
DROP TABLE IF EXISTS organization_call_settings CASCADE;

COMMIT;
