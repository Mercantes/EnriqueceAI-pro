-- Rollback: Story 3.2 goals tables
DROP TRIGGER IF EXISTS set_goals_per_user_updated_at ON goals_per_user;
DROP TRIGGER IF EXISTS set_goals_updated_at ON goals;
DROP TABLE IF EXISTS goals_per_user;
DROP TABLE IF EXISTS goals;
