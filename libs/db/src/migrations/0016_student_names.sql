-- 0016_student_names
--
-- A student carries four name parts: first name, optional second name, first
-- last name and second last name. last_name becomes first_last_name.
--
-- second_last_name stays nullable so rows created before this migration
-- survive; the API requires it for every new student. The CHECK keeps a blank
-- string from masquerading as a name.
ALTER TABLE "students" RENAME COLUMN "last_name" TO "first_last_name";
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "second_name" text;
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "second_last_name" text;
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_second_last_name_not_blank_check"
	CHECK ("second_last_name" IS NULL OR length(trim("second_last_name")) > 0);
