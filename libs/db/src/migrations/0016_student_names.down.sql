-- Down for 0016_student_names.
--
-- Drops the second name and second last name (their values are lost) and
-- renames first_last_name back to last_name.
ALTER TABLE "students" DROP CONSTRAINT "students_second_last_name_not_blank_check";
--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "second_last_name";
--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "second_name";
--> statement-breakpoint
ALTER TABLE "students" RENAME COLUMN "first_last_name" TO "last_name";
