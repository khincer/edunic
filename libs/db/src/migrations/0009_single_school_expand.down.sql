-- Down for 0009_single_school_expand.
--
-- Only the columns and tables this migration created are removed. The
-- backfilled data (a user's role, a grade's subject) lives in tables this
-- migration does not create, so nothing else is touched.
ALTER TABLE "assignments" DROP COLUMN IF EXISTS "topic_id";
--> statement-breakpoint
ALTER TABLE "assignments" DROP COLUMN IF EXISTS "subject_id";
--> statement-breakpoint
ALTER TABLE "grades" DROP COLUMN IF EXISTS "topic_id";
--> statement-breakpoint
ALTER TABLE "grades" DROP COLUMN IF EXISTS "subject_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "payments";
--> statement-breakpoint
DROP TABLE IF EXISTS "subject_teachers";
--> statement-breakpoint
DROP TABLE IF EXISTS "classroom_subjects";
--> statement-breakpoint
DROP TABLE IF EXISTS "topics";
--> statement-breakpoint
DROP TABLE IF EXISTS "subjects";
--> statement-breakpoint
DROP TABLE IF EXISTS "user_roles";
