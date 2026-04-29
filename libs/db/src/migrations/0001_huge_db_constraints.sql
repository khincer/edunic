ALTER TABLE "user_institution_roles"
  ADD CONSTRAINT "user_institution_roles_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  ADD CONSTRAINT "user_institution_roles_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "students"
  ADD CONSTRAINT "students_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "guardians"
  ADD CONSTRAINT "guardians_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "student_guardians"
  ADD CONSTRAINT "student_guardians_student_id_students_id_fk"
  FOREIGN KEY ("student_id") REFERENCES "students"("id"),
  ADD CONSTRAINT "student_guardians_guardian_id_guardians_id_fk"
  FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id");
--> statement-breakpoint
ALTER TABLE "academic_periods"
  ADD CONSTRAINT "academic_periods_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id"),
  ADD CONSTRAINT "academic_periods_term_check"
  CHECK ("term" between 1 and 4),
  ADD CONSTRAINT "academic_periods_date_range_check"
  CHECK ("start_date" is null or "end_date" is null or "start_date" <= "end_date"),
  ADD CONSTRAINT "academic_periods_institution_id_year_term_unique"
  UNIQUE("institution_id", "year", "term");
--> statement-breakpoint
ALTER TABLE "classrooms"
  ADD CONSTRAINT "classrooms_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id"),
  ADD CONSTRAINT "classrooms_grade_level_check"
  CHECK ("grade_level" > 0),
  ADD CONSTRAINT "classrooms_institution_id_grade_level_section_unique"
  UNIQUE("institution_id", "grade_level", "section");
--> statement-breakpoint
ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id"),
  ADD CONSTRAINT "enrollments_student_id_students_id_fk"
  FOREIGN KEY ("student_id") REFERENCES "students"("id"),
  ADD CONSTRAINT "enrollments_academic_period_id_academic_periods_id_fk"
  FOREIGN KEY ("academic_period_id") REFERENCES "academic_periods"("id"),
  ADD CONSTRAINT "enrollments_classroom_id_classrooms_id_fk"
  FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id"),
  ADD CONSTRAINT "enrollments_status_check"
  CHECK ("status" in ('active', 'withdrawn', 'completed'));
--> statement-breakpoint
ALTER TABLE "grades"
  ADD CONSTRAINT "grades_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id"),
  ADD CONSTRAINT "grades_enrollment_id_enrollments_id_fk"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id"),
  ADD CONSTRAINT "grades_score_check"
  CHECK ("score" between 0 and 100);
--> statement-breakpoint
ALTER TABLE "attendance"
  ADD CONSTRAINT "attendance_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id"),
  ADD CONSTRAINT "attendance_enrollment_id_enrollments_id_fk"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id"),
  ADD CONSTRAINT "attendance_status_check"
  CHECK ("status" in ('present', 'absent', 'late')),
  ADD CONSTRAINT "attendance_enrollment_id_date_unique"
  UNIQUE("enrollment_id", "date");
--> statement-breakpoint
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id"),
  ADD CONSTRAINT "audit_logs_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "institution_feature_flags"
  ADD CONSTRAINT "institution_feature_flags_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id"),
  ADD CONSTRAINT "institution_feature_flags_feature_key_feature_flags_key_fk"
  FOREIGN KEY ("feature_key") REFERENCES "feature_flags"("key");
--> statement-breakpoint
ALTER TABLE "institution_extensions"
  ADD CONSTRAINT "institution_extensions_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id"),
  ADD CONSTRAINT "institution_extensions_extension_key_extensions_key_fk"
  FOREIGN KEY ("extension_key") REFERENCES "extensions"("key");
--> statement-breakpoint
ALTER TABLE "custom_fields"
  ADD CONSTRAINT "custom_fields_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "custom_field_values"
  ADD CONSTRAINT "custom_field_values_field_id_custom_fields_id_fk"
  FOREIGN KEY ("field_id") REFERENCES "custom_fields"("id");
