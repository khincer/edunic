CREATE TABLE IF NOT EXISTS "guardian_user_links" (
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id"),
  "guardian_id" uuid NOT NULL REFERENCES "guardians"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  CONSTRAINT "guardian_user_links_pk" PRIMARY KEY ("institution_id", "guardian_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "teacher_classroom_assignments" (
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id"),
  "teacher_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "classroom_id" uuid NOT NULL REFERENCES "classrooms"("id"),
  CONSTRAINT "teacher_classroom_assignments_pk" PRIMARY KEY ("institution_id", "teacher_user_id", "classroom_id")
);

CREATE TABLE IF NOT EXISTS "assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id"),
  "classroom_id" uuid REFERENCES "classrooms"("id"),
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "title" text NOT NULL,
  "type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "due_date" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "school_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id"),
  "classroom_id" uuid REFERENCES "classrooms"("id"),
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "title" text NOT NULL,
  "event_type" text NOT NULL DEFAULT 'school',
  "starts_at" timestamp NOT NULL,
  "ends_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "message_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id"),
  "subject" text NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id"),
  "thread_id" uuid NOT NULL REFERENCES "message_threads"("id"),
  "sender_user_id" uuid REFERENCES "users"("id"),
  "recipient_user_id" uuid REFERENCES "users"("id"),
  "body" text NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "report_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id"),
  "student_id" uuid NOT NULL REFERENCES "students"("id"),
  "year" integer NOT NULL,
  "report_type" text NOT NULL DEFAULT 'academic_summary',
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "guardian_user_links_user_idx"
  ON "guardian_user_links" ("institution_id", "user_id");

CREATE INDEX IF NOT EXISTS "teacher_classroom_assignments_teacher_idx"
  ON "teacher_classroom_assignments" ("institution_id", "teacher_user_id");

CREATE INDEX IF NOT EXISTS "assignments_institution_due_idx"
  ON "assignments" ("institution_id", "due_date");

CREATE INDEX IF NOT EXISTS "school_events_institution_starts_idx"
  ON "school_events" ("institution_id", "starts_at");

CREATE INDEX IF NOT EXISTS "messages_recipient_idx"
  ON "messages" ("institution_id", "recipient_user_id", "read_at");

CREATE INDEX IF NOT EXISTS "report_history_student_idx"
  ON "report_history" ("institution_id", "student_id", "created_at");
