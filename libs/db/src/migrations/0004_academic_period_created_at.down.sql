-- Down for 0004_academic_period_created_at.
--
-- Drops the created_at column; stored values for it are destroyed with it.
ALTER TABLE "academic_periods" DROP COLUMN IF EXISTS "created_at";
