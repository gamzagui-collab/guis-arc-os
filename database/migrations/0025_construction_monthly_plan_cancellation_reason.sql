PRAGMA foreign_keys = ON;

ALTER TABLE construction_monthly_plans ADD COLUMN cancellation_reason TEXT;
