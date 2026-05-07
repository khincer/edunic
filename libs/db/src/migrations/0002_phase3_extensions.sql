CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL,
  "event_name" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "metadata" jsonb,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_institution_id_institutions_id_fk"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id");
--> statement-breakpoint
ALTER TABLE "custom_fields"
  ALTER COLUMN "institution_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "custom_field_values"
  ADD CONSTRAINT "custom_field_values_field_id_entity_id_unique"
  UNIQUE("field_id", "entity_id");
