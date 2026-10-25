-- Down for 0014_single_school_default.
--
-- Removes the defaults, the function and extensions.config. institution_id
-- columns stay NOT NULL and every row keeps its value. The flag copy is not
-- reversed: feature_flags.default_value keeps the copied value (the
-- institution_feature_flags overrides it came from are untouched).
ALTER TABLE "academic_periods" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "assignments" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "classrooms" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "custom_fields" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "email_deliveries" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "enrollments" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "grades" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "guardian_user_links" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "guardians" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "message_threads" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "report_history" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "school_events" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "teacher_classroom_assignments" ALTER COLUMN "institution_id" DROP DEFAULT;
--> statement-breakpoint
DROP FUNCTION IF EXISTS "single_school_id"();
--> statement-breakpoint
ALTER TABLE "extensions" DROP COLUMN IF EXISTS "config";
