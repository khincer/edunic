-- 0013_roles_director_drop_user_institution_roles
--
-- Replace admin with director, drop user_institution_roles (no longer used).
--
UPDATE "user_roles" SET "role" = 'director' WHERE "role" = 'admin';
--> statement-breakpoint
DROP TABLE IF EXISTS "user_institution_roles";
--> statement-breakpoint
