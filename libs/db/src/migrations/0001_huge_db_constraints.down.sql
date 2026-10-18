-- Down for 0001_huge_db_constraints.
--
-- Drops every foreign key, check and unique constraint the migration added.
-- Data is untouched; only the database-level guarantees are removed.
ALTER TABLE "user_institution_roles" DROP CONSTRAINT IF EXISTS "user_institution_roles_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_institution_roles" DROP CONSTRAINT IF EXISTS "user_institution_roles_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "guardians" DROP CONSTRAINT IF EXISTS "guardians_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "student_guardians" DROP CONSTRAINT IF EXISTS "student_guardians_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "student_guardians" DROP CONSTRAINT IF EXISTS "student_guardians_guardian_id_guardians_id_fk";
--> statement-breakpoint
ALTER TABLE "academic_periods" DROP CONSTRAINT IF EXISTS "academic_periods_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "academic_periods" DROP CONSTRAINT IF EXISTS "academic_periods_term_check";
--> statement-breakpoint
ALTER TABLE "academic_periods" DROP CONSTRAINT IF EXISTS "academic_periods_date_range_check";
--> statement-breakpoint
ALTER TABLE "academic_periods" DROP CONSTRAINT IF EXISTS "academic_periods_institution_id_year_term_unique";
--> statement-breakpoint
ALTER TABLE "classrooms" DROP CONSTRAINT IF EXISTS "classrooms_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "classrooms" DROP CONSTRAINT IF EXISTS "classrooms_grade_level_check";
--> statement-breakpoint
ALTER TABLE "classrooms" DROP CONSTRAINT IF EXISTS "classrooms_institution_id_grade_level_section_unique";
--> statement-breakpoint
ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_academic_period_id_academic_periods_id_fk";
--> statement-breakpoint
ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_classroom_id_classrooms_id_fk";
--> statement-breakpoint
ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_status_check";
--> statement-breakpoint
ALTER TABLE "grades" DROP CONSTRAINT IF EXISTS "grades_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "grades" DROP CONSTRAINT IF EXISTS "grades_enrollment_id_enrollments_id_fk";
--> statement-breakpoint
ALTER TABLE "grades" DROP CONSTRAINT IF EXISTS "grades_score_check";
--> statement-breakpoint
ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "attendance_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "attendance_enrollment_id_enrollments_id_fk";
--> statement-breakpoint
ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "attendance_status_check";
--> statement-breakpoint
ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "attendance_enrollment_id_date_unique";
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "institution_feature_flags" DROP CONSTRAINT IF EXISTS "institution_feature_flags_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "institution_feature_flags" DROP CONSTRAINT IF EXISTS "institution_feature_flags_feature_key_feature_flags_key_fk";
--> statement-breakpoint
ALTER TABLE "institution_extensions" DROP CONSTRAINT IF EXISTS "institution_extensions_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "institution_extensions" DROP CONSTRAINT IF EXISTS "institution_extensions_extension_key_extensions_key_fk";
--> statement-breakpoint
ALTER TABLE "custom_fields" DROP CONSTRAINT IF EXISTS "custom_fields_institution_id_institutions_id_fk";
--> statement-breakpoint
ALTER TABLE "custom_field_values" DROP CONSTRAINT IF EXISTS "custom_field_values_field_id_custom_fields_id_fk";
