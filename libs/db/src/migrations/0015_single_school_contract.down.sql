-- Down for 0015_single_school_contract.
--
-- Restores the 0014 schema: single_school_id(), the 18 institution_id columns
-- (NOT NULL, defaulted, backfilled from the one school, with their original
-- foreign key names), the composite keys and indexes, and the two per-school
-- tables (recreated empty: their rows were folded into the global tables by
-- 0014 and are not rebuilt).
--
-- The down runner applies statements one by one, so the guard comes first:
-- with rows to backfill and no school there is nothing to restore them to, and
-- the down refuses before changing anything.
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM "institutions") AND (
		EXISTS (SELECT 1 FROM "academic_periods")
		OR EXISTS (SELECT 1 FROM "assignments")
		OR EXISTS (SELECT 1 FROM "attendance")
		OR EXISTS (SELECT 1 FROM "audit_logs")
		OR EXISTS (SELECT 1 FROM "classrooms")
		OR EXISTS (SELECT 1 FROM "custom_fields")
		OR EXISTS (SELECT 1 FROM "email_deliveries")
		OR EXISTS (SELECT 1 FROM "enrollments")
		OR EXISTS (SELECT 1 FROM "grades")
		OR EXISTS (SELECT 1 FROM "guardian_user_links")
		OR EXISTS (SELECT 1 FROM "guardians")
		OR EXISTS (SELECT 1 FROM "message_threads")
		OR EXISTS (SELECT 1 FROM "messages")
		OR EXISTS (SELECT 1 FROM "notifications")
		OR EXISTS (SELECT 1 FROM "report_history")
		OR EXISTS (SELECT 1 FROM "school_events")
		OR EXISTS (SELECT 1 FROM "students")
		OR EXISTS (SELECT 1 FROM "teacher_classroom_assignments")
	) THEN
		RAISE EXCEPTION '0015_single_school_contract down: rows exist but there is no institutions row to restore institution_id from; insert the school first';
	END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "single_school_id"() RETURNS uuid
	LANGUAGE sql STABLE AS $$
	SELECT "id" FROM "public"."institutions"
	ORDER BY "created_at" ASC NULLS LAST, "id" ASC
	LIMIT 1
$$;
--> statement-breakpoint
DROP INDEX "teacher_classroom_assignments_teacher_idx";
--> statement-breakpoint
DROP INDEX "assignments_due_idx";
--> statement-breakpoint
DROP INDEX "school_events_starts_idx";
--> statement-breakpoint
DROP INDEX "messages_recipient_idx";
--> statement-breakpoint
DROP INDEX "report_history_student_idx";
--> statement-breakpoint
DROP INDEX "email_deliveries_created_idx";
--> statement-breakpoint
DROP INDEX "email_deliveries_inflight_idx";
--> statement-breakpoint
DROP INDEX "guardian_user_links_user_idx";
--> statement-breakpoint
ALTER TABLE "teacher_classroom_assignments" DROP CONSTRAINT "teacher_classroom_assignments_pk";
--> statement-breakpoint
ALTER TABLE "guardian_user_links" DROP CONSTRAINT "guardian_user_links_pk";
--> statement-breakpoint
ALTER TABLE "academic_periods" DROP CONSTRAINT "academic_periods_year_term_unique";
--> statement-breakpoint
ALTER TABLE "classrooms" DROP CONSTRAINT "classrooms_grade_level_section_unique";
--> statement-breakpoint
-- The default fills every existing row with the one school (backfill).
ALTER TABLE "academic_periods" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "academic_periods_institution_id_institutions_id_fk" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "assignments_institution_id_fkey" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "attendance_institution_id_institutions_id_fk" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "audit_logs_institution_id_institutions_id_fk" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "classrooms_institution_id_institutions_id_fk" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "custom_fields" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "custom_fields_institution_id_institutions_id_fk" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "email_deliveries_institution_id_fkey" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "enrollments_institution_id_institutions_id_fk" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "grades" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "grades_institution_id_institutions_id_fk" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "guardian_user_links" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "guardian_user_links_institution_id_fkey" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "guardians" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "guardians_institution_id_institutions_id_fk" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "message_threads" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "message_threads_institution_id_fkey" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "messages_institution_id_fkey" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "notifications_institution_id_institutions_id_fk" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "report_history" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "report_history_institution_id_fkey" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "school_events" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "school_events_institution_id_fkey" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "students_institution_id_institutions_id_fk" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "teacher_classroom_assignments" ADD COLUMN "institution_id" uuid NOT NULL DEFAULT single_school_id()
	CONSTRAINT "teacher_classroom_assignments_institution_id_fkey" REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "teacher_classroom_assignments" ADD CONSTRAINT "teacher_classroom_assignments_pk" PRIMARY KEY ("institution_id", "teacher_user_id", "classroom_id");
--> statement-breakpoint
ALTER TABLE "guardian_user_links" ADD CONSTRAINT "guardian_user_links_pk" PRIMARY KEY ("institution_id", "guardian_id", "user_id");
--> statement-breakpoint
ALTER TABLE "academic_periods" ADD CONSTRAINT "academic_periods_institution_id_year_term_unique" UNIQUE ("institution_id", "year", "term");
--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_institution_id_grade_level_section_unique" UNIQUE ("institution_id", "grade_level", "section");
--> statement-breakpoint
CREATE INDEX "guardian_user_links_user_idx" ON "guardian_user_links" ("institution_id", "user_id");
--> statement-breakpoint
CREATE INDEX "teacher_classroom_assignments_teacher_idx" ON "teacher_classroom_assignments" ("institution_id", "teacher_user_id");
--> statement-breakpoint
CREATE INDEX "assignments_institution_due_idx" ON "assignments" ("institution_id", "due_date");
--> statement-breakpoint
CREATE INDEX "school_events_institution_starts_idx" ON "school_events" ("institution_id", "starts_at");
--> statement-breakpoint
CREATE INDEX "messages_recipient_idx" ON "messages" ("institution_id", "recipient_user_id", "read_at");
--> statement-breakpoint
CREATE INDEX "report_history_student_idx" ON "report_history" ("institution_id", "student_id", "created_at");
--> statement-breakpoint
CREATE INDEX "email_deliveries_institution_created_idx" ON "email_deliveries" ("institution_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "email_deliveries_inflight_idx" ON "email_deliveries" ("institution_id")
	WHERE "status" IN ('queued', 'sending', 'retried');
--> statement-breakpoint
CREATE TABLE "institution_feature_flags" (
	"institution_id" uuid NOT NULL,
	"feature_key" text NOT NULL,
	"enabled" boolean NOT NULL,
	CONSTRAINT "institution_feature_flags_institution_id_feature_key_pk" PRIMARY KEY ("institution_id", "feature_key"),
	CONSTRAINT "institution_feature_flags_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id"),
	CONSTRAINT "institution_feature_flags_feature_key_feature_flags_key_fk" FOREIGN KEY ("feature_key") REFERENCES "feature_flags"("key")
);
--> statement-breakpoint
CREATE TABLE "institution_extensions" (
	"institution_id" uuid NOT NULL,
	"extension_key" text NOT NULL,
	"config" jsonb,
	CONSTRAINT "institution_extensions_institution_id_extension_key_pk" PRIMARY KEY ("institution_id", "extension_key"),
	CONSTRAINT "institution_extensions_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id"),
	CONSTRAINT "institution_extensions_extension_key_extensions_key_fk" FOREIGN KEY ("extension_key") REFERENCES "extensions"("key")
);
