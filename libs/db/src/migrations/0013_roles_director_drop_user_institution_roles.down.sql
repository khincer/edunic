-- Down for 0013_roles_director_drop_user_institution_roles.
--
-- The table comes back empty: roles live in user_roles since 0009, and the
-- rows it held before 0013 are gone. Directors go back to admin, the role the
-- code before 0013 knows; vice_director and subdirector stay as they are.
UPDATE "user_roles" SET "role" = 'admin' WHERE "role" = 'director';
--> statement-breakpoint
CREATE TABLE "user_institution_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "user_institution_roles_user_id_institution_id_unique" UNIQUE("user_id","institution_id"),
	CONSTRAINT "user_institution_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
	CONSTRAINT "user_institution_roles_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id")
);
