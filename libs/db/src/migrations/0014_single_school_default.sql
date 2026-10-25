-- 0014_single_school_default (expand step of the single-school contract)
--
-- single_school_id() returns the one school of the installation: the oldest
-- institutions row, the same rule AuthRepository.findAuthContext applies
-- (created_at ascending, NULLs last, id as the tie-break). It is the DEFAULT of
-- every institution_id column, which stays NOT NULL: code that stops writing
-- the column keeps producing valid rows, and with no school at all an insert
-- fails with a NOT NULL violation instead of succeeding silently.
-- institution_feature_flags and institution_extensions are excluded: 0015
-- drops them. 0015 also drops this function with the columns.
--
-- The whole file can be replayed: the function is replaced, the column is added
-- only if missing, SET DEFAULT is repeatable and the copies below are stable.
CREATE OR REPLACE FUNCTION "single_school_id"() RETURNS uuid
	LANGUAGE sql STABLE AS $$
	SELECT "id" FROM "public"."institutions"
	ORDER BY "created_at" ASC NULLS LAST, "id" ASC
	LIMIT 1
$$;
--> statement-breakpoint
ALTER TABLE "academic_periods" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "assignments" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "classrooms" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "custom_fields" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "email_deliveries" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "enrollments" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "grades" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "guardian_user_links" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "guardians" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "message_threads" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "report_history" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "school_events" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
ALTER TABLE "teacher_classroom_assignments" ALTER COLUMN "institution_id" SET DEFAULT single_school_id();
--> statement-breakpoint
-- Feature flags: the single school's explicit override is today's effective
-- value, so it replaces the global default_value. Overrides of any other school
-- are ignored. With no school, single_school_id() is NULL and nothing matches.
UPDATE "feature_flags"
	SET "default_value" = "institution_feature_flags"."enabled"
	FROM "institution_feature_flags"
	WHERE "institution_feature_flags"."feature_key" = "feature_flags"."key"
		AND "institution_feature_flags"."institution_id" = single_school_id();
--> statement-breakpoint
-- Extensions: the global table gets the config column. The single school's
-- config is copied only where the global config is still NULL, so a value set
-- globally (by a replay after the global write path exists) is never clobbered.
ALTER TABLE "extensions" ADD COLUMN IF NOT EXISTS "config" jsonb;
--> statement-breakpoint
UPDATE "extensions"
	SET "config" = "institution_extensions"."config"
	FROM "institution_extensions"
	WHERE "institution_extensions"."extension_key" = "extensions"."key"
		AND "institution_extensions"."institution_id" = single_school_id()
		AND "institution_extensions"."config" IS NOT NULL
		AND "extensions"."config" IS NULL;
