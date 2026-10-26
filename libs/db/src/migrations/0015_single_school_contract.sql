-- 0015_single_school_contract (contract step of the single-school change)
--
-- DESTRUCTIVE. Take a database backup first, and apply it only after every API
-- and worker instance runs code that no longer reads or writes institution_id
-- (all of it relies on the 0014 single_school_id() default today).
--
-- Drops the 18 institution_id columns (with their foreign keys and the
-- composite keys and indexes that led with them), the two per-school tables and
-- single_school_id(). The keys and lookup indexes that carried the school are
-- rebuilt without it. The institutions table stays: it is the one school
-- configuration row (name, sender identity, reply-to).
--
-- The migrator runs the whole file in one transaction, so a refused guard or a
-- failed statement leaves the 0014 schema untouched.
DO $$
BEGIN
	IF (SELECT COUNT(*) FROM "institutions") > 1 THEN
		RAISE EXCEPTION '0015_single_school_contract: found % institutions rows, expected at most one; merge the schools (0010) before dropping institution_id',
			(SELECT COUNT(*) FROM "institutions");
	END IF;
END $$;
--> statement-breakpoint
DROP TABLE "institution_feature_flags";
--> statement-breakpoint
DROP TABLE "institution_extensions";
--> statement-breakpoint
ALTER TABLE "academic_periods" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "assignments" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "attendance" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "classrooms" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "custom_fields" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "email_deliveries" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "enrollments" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "grades" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "guardian_user_links" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "guardians" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "message_threads" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "report_history" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "school_events" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "institution_id";
--> statement-breakpoint
ALTER TABLE "teacher_classroom_assignments" DROP COLUMN "institution_id";
--> statement-breakpoint
DROP FUNCTION "single_school_id"();
--> statement-breakpoint
-- New keys: the same uniqueness, without the school.
ALTER TABLE "teacher_classroom_assignments" ADD CONSTRAINT "teacher_classroom_assignments_pk" PRIMARY KEY ("teacher_user_id", "classroom_id");
--> statement-breakpoint
ALTER TABLE "guardian_user_links" ADD CONSTRAINT "guardian_user_links_pk" PRIMARY KEY ("guardian_id", "user_id");
--> statement-breakpoint
ALTER TABLE "academic_periods" ADD CONSTRAINT "academic_periods_year_term_unique" UNIQUE ("year", "term");
--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_grade_level_section_unique" UNIQUE ("grade_level", "section");
--> statement-breakpoint
-- Lookup indexes that lost their institution prefix.
CREATE INDEX "guardian_user_links_user_idx" ON "guardian_user_links" ("user_id");
--> statement-breakpoint
CREATE INDEX "teacher_classroom_assignments_teacher_idx" ON "teacher_classroom_assignments" ("teacher_user_id");
--> statement-breakpoint
CREATE INDEX "assignments_due_idx" ON "assignments" ("due_date");
--> statement-breakpoint
CREATE INDEX "school_events_starts_idx" ON "school_events" ("starts_at");
--> statement-breakpoint
CREATE INDEX "messages_recipient_idx" ON "messages" ("recipient_user_id", "read_at");
--> statement-breakpoint
CREATE INDEX "report_history_student_idx" ON "report_history" ("student_id", "created_at");
--> statement-breakpoint
CREATE INDEX "email_deliveries_created_idx" ON "email_deliveries" ("created_at" DESC, "id" DESC);
--> statement-breakpoint
-- In-flight rows (the stale-claim sweep reads status = 'sending' by updated_at).
CREATE INDEX "email_deliveries_inflight_idx" ON "email_deliveries" ("updated_at")
	WHERE "status" IN ('queued', 'sending', 'retried');
