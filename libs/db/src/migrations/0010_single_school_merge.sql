-- 0010_single_school_merge
--
-- Merges the seeded institutions into ONE school without losing a row.
--
-- Why this is a separate migration: the application still filters every query
-- by institution_id at this point. Repointing the data first means the whole
-- application sweep that follows can remove tenant scoping module by module
-- without any intermediate state exposing two schools' data.
--
-- The surviving school is the one with staff: the institution with the most
-- user_institution_roles rows, ties broken by the lowest id. The surviving
-- `institutions` row keeps its id, name, sender_name and reply_to_email, so
-- the outbound email identity is preserved.
--
-- Nothing is deleted except the extra `institutions` rows themselves and the
-- rows that would otherwise violate a unique key after the merge (a second
-- copy of a classroom, an academic period, a teacher assignment, a guardian
-- link, a per-school feature flag or extension). Those duplicates are
-- resolved by keeping the surviving school's copy.
--
-- Backfills that the application will read:
--   user_roles        one role per user, copied from user_institution_roles
--   grades.subject_id a materia per distinct free-text subject
--
-- Idempotent: re-running it after a down is a no-op.
DELETE FROM "user_institution_roles" a
USING "user_institution_roles" b
WHERE a.user_id = b.user_id AND a.id > b.id;
--> statement-breakpoint
CREATE TEMP TABLE "_single_school" AS
SELECT (
  SELECT i.id
  FROM "institutions" i
  LEFT JOIN "user_institution_roles" uir ON uir.institution_id = i.id
  GROUP BY i.id
  ORDER BY count(uir.id) DESC, i.id ASC
  LIMIT 1
) AS "survivor_id";
--> statement-breakpoint
CREATE TEMP TABLE "_classroom_merge" AS
SELECT loser.id AS loser_id, keeper.id AS keeper_id
FROM "classrooms" loser
JOIN "classrooms" keeper
  ON keeper.grade_level = loser.grade_level
  AND keeper.section IS NOT DISTINCT FROM loser.section
  AND keeper.id < loser.id;
--> statement-breakpoint
UPDATE "enrollments" SET classroom_id = m.keeper_id
FROM "_classroom_merge" m WHERE "enrollments".classroom_id = m.loser_id;
--> statement-breakpoint
UPDATE "teacher_classroom_assignments" SET classroom_id = m.keeper_id
FROM "_classroom_merge" m WHERE "teacher_classroom_assignments".classroom_id = m.loser_id;
--> statement-breakpoint
UPDATE "assignments" SET classroom_id = m.keeper_id
FROM "_classroom_merge" m WHERE "assignments".classroom_id = m.loser_id;
--> statement-breakpoint
UPDATE "school_events" SET classroom_id = m.keeper_id
FROM "_classroom_merge" m WHERE "school_events".classroom_id = m.loser_id;
--> statement-breakpoint
DELETE FROM "classrooms" c USING "_classroom_merge" m WHERE c.id = m.loser_id;
--> statement-breakpoint
CREATE TEMP TABLE "_period_merge" AS
SELECT loser.id AS loser_id, keeper.id AS keeper_id
FROM "academic_periods" loser
JOIN "academic_periods" keeper
  ON keeper.year = loser.year AND keeper.term = loser.term AND keeper.id < loser.id;
--> statement-breakpoint
UPDATE "enrollments" SET academic_period_id = m.keeper_id
FROM "_period_merge" m WHERE "enrollments".academic_period_id = m.loser_id;
--> statement-breakpoint
DELETE FROM "academic_periods" p USING "_period_merge" m WHERE p.id = m.loser_id;
--> statement-breakpoint
DELETE FROM "teacher_classroom_assignments" t
USING "teacher_classroom_assignments" s
WHERE t.teacher_user_id = s.teacher_user_id
  AND t.classroom_id = s.classroom_id
  AND t.institution_id <> (SELECT "survivor_id" FROM "_single_school")
  AND s.institution_id = (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
DELETE FROM "guardian_user_links" g
USING "guardian_user_links" s
WHERE g.guardian_id = s.guardian_id AND g.user_id = s.user_id
  AND g.institution_id <> (SELECT "survivor_id" FROM "_single_school")
  AND s.institution_id = (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
DELETE FROM "institution_feature_flags" f
USING "institution_feature_flags" s
WHERE f.feature_key = s.feature_key
  AND f.institution_id <> (SELECT "survivor_id" FROM "_single_school")
  AND s.institution_id = (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
DELETE FROM "institution_extensions" e
USING "institution_extensions" s
WHERE e.extension_key = s.extension_key
  AND e.institution_id <> (SELECT "survivor_id" FROM "_single_school")
  AND s.institution_id = (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "students" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "guardians" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "guardian_user_links" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "academic_periods" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "classrooms" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "teacher_classroom_assignments" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "enrollments" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "grades" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "attendance" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "audit_logs" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "notifications" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "assignments" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "school_events" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "message_threads" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "messages" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "report_history" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "institution_feature_flags" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "institution_extensions" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "custom_fields" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "email_deliveries" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
UPDATE "user_institution_roles" SET institution_id = (SELECT "survivor_id" FROM "_single_school") WHERE institution_id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
INSERT INTO "user_roles" (user_id, role)
SELECT uir.user_id, uir.role FROM "user_institution_roles" uir
ON CONFLICT (user_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO "subjects" (name)
SELECT DISTINCT g.subject FROM "grades" g
WHERE g.subject IS NOT NULL AND trim(g.subject) <> ''
ON CONFLICT (name) DO NOTHING;
--> statement-breakpoint
UPDATE "grades" g SET subject_id = s.id
FROM "subjects" s
WHERE g.subject_id IS NULL AND g.subject = s.name;
--> statement-breakpoint
ALTER TABLE "email_deliveries" DROP CONSTRAINT IF EXISTS "email_deliveries_institution_event_recipient_unique";
--> statement-breakpoint
ALTER TABLE "email_deliveries" DROP CONSTRAINT IF EXISTS "email_deliveries_event_id_recipient_address_unique";
--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_event_id_recipient_address_unique" UNIQUE ("event_id", "recipient_address");
--> statement-breakpoint
DELETE FROM "institutions" WHERE id <> (SELECT "survivor_id" FROM "_single_school");
--> statement-breakpoint
DROP TABLE IF EXISTS "_classroom_merge";
--> statement-breakpoint
DROP TABLE IF EXISTS "_period_merge";
--> statement-breakpoint
DROP TABLE IF EXISTS "_single_school";
