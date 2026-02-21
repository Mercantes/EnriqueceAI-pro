-- Rollback Story 3.3: Remove ranking target columns
ALTER TABLE goals_per_user
  DROP COLUMN IF EXISTS conversion_target,
  DROP COLUMN IF EXISTS activities_target;

ALTER TABLE goals
  DROP COLUMN IF EXISTS activities_target;
