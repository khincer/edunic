-- Down for 0002_phase3_extensions.
--
-- Removes the notifications table, the custom_field_values uniqueness guard
-- and the NOT NULL on custom_fields.institution_id. Existing custom_field_values
-- rows survive; only the unique guarantee is removed.
DROP TABLE IF EXISTS "notifications";
--> statement-breakpoint
ALTER TABLE "custom_field_values" DROP CONSTRAINT IF EXISTS "custom_field_values_field_id_entity_id_unique";
--> statement-breakpoint
ALTER TABLE "custom_fields" ALTER COLUMN "institution_id" DROP NOT NULL;
