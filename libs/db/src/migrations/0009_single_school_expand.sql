-- 0009_single_school_expand
--
-- Additive only. The single-school model needs a few tables and columns that
-- do not exist yet, so this migration creates them without removing or
-- rewriting anything. The running application is unaffected until it starts
-- using them, which is what makes this safe to deploy on its own.
--
-- Adds:
--   user_roles            one role per user, replacing the institution
--                         dimension of user_institution_roles (ROLE-05)
--   subjects / topics     a "materia" and the "temas" it contains
--   classroom_subjects    which materias a grade level (classroom) offers
--   subject_teachers      which materias a teacher is responsible for
--   payments              the offline payment ledger
--   grades.subject_id     grades point at a materia instead of free text
--   grades.topic_id       ... and optionally at one of its temas
--   assignments.subject_id / assignments.topic_id
--
-- The free-text `grades.subject` column is kept: the backfill that derives
-- `subject_id` from it, and the contract migration that drops it, are later
-- steps of the same change.
CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "role" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "user_roles_user_id_unique" UNIQUE ("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "code" text,
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "subjects_name_unique" UNIQUE ("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
  "name" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "topics_subject_id_name_unique" UNIQUE ("subject_id", "name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "classroom_subjects" (
  "classroom_id" uuid NOT NULL REFERENCES "classrooms"("id"),
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
  CONSTRAINT "classroom_subjects_classroom_id_subject_id_pk"
    PRIMARY KEY ("classroom_id", "subject_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subject_teachers" (
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id"),
  "teacher_user_id" uuid NOT NULL REFERENCES "users"("id"),
  CONSTRAINT "subject_teachers_subject_id_teacher_user_id_pk"
    PRIMARY KEY ("subject_id", "teacher_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" uuid NOT NULL REFERENCES "students"("id"),
  "concept" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "due_date" timestamp,
  "paid_at" timestamp,
  "method" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "receipt_number" text NOT NULL,
  "recorded_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "note" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "payments_receipt_number_unique" UNIQUE ("receipt_number"),
  CONSTRAINT "payments_amount_cents_check" CHECK ("amount_cents" > 0),
  CONSTRAINT "payments_status_check"
    CHECK ("status" IN ('pending', 'paid', 'cancelled')),
  CONSTRAINT "payments_paid_at_check"
    CHECK (("status" = 'paid') = ("paid_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "grades" ADD COLUMN IF NOT EXISTS "subject_id" uuid REFERENCES "subjects"("id");
--> statement-breakpoint
ALTER TABLE "grades" ADD COLUMN IF NOT EXISTS "topic_id" uuid REFERENCES "topics"("id");
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "subject_id" uuid REFERENCES "subjects"("id");
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "topic_id" uuid REFERENCES "topics"("id");
