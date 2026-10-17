-- Down for 0000_clever_doctor_strange.
--
-- Drops every table the initial migration created. Roll back 0001 first:
-- its foreign keys reference these tables and would block the drops.
DROP TABLE IF EXISTS "academic_periods";
--> statement-breakpoint
DROP TABLE IF EXISTS "attendance";
--> statement-breakpoint
DROP TABLE IF EXISTS "audit_logs";
--> statement-breakpoint
DROP TABLE IF EXISTS "classrooms";
--> statement-breakpoint
DROP TABLE IF EXISTS "custom_field_values";
--> statement-breakpoint
DROP TABLE IF EXISTS "custom_fields";
--> statement-breakpoint
DROP TABLE IF EXISTS "enrollments";
--> statement-breakpoint
DROP TABLE IF EXISTS "extensions";
--> statement-breakpoint
DROP TABLE IF EXISTS "feature_flags";
--> statement-breakpoint
DROP TABLE IF EXISTS "grades";
--> statement-breakpoint
DROP TABLE IF EXISTS "guardians";
--> statement-breakpoint
DROP TABLE IF EXISTS "institution_extensions";
--> statement-breakpoint
DROP TABLE IF EXISTS "institution_feature_flags";
--> statement-breakpoint
DROP TABLE IF EXISTS "institutions";
--> statement-breakpoint
DROP TABLE IF EXISTS "student_guardians";
--> statement-breakpoint
DROP TABLE IF EXISTS "students";
--> statement-breakpoint
DROP TABLE IF EXISTS "user_institution_roles";
--> statement-breakpoint
DROP TABLE IF EXISTS "users";
