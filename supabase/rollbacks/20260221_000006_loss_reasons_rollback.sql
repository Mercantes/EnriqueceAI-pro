-- Rollback Story 3.4: Remove loss_reason_id and loss_reasons table
DROP INDEX IF EXISTS idx_enrollments_loss_reason;
ALTER TABLE cadence_enrollments DROP COLUMN IF EXISTS loss_reason_id;
DROP TABLE IF EXISTS loss_reasons;
