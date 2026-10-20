-- Down for 0010_single_school_merge.
--
-- The merge itself is NOT reversible: once every row points at the surviving
-- school, the original institution of each row is gone. This down restores
-- the previous email unique key and leaves the merged data in place — the real
-- rollback point is a database restore taken before the migration ran.
DROP INDEX IF EXISTS "email_deliveries_event_recipient_unique";
--> statement-breakpoint
ALTER TABLE "email_deliveries" DROP CONSTRAINT IF EXISTS "email_deliveries_event_id_recipient_address_unique";
--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_institution_event_recipient_unique" UNIQUE ("institution_id", "event_id", "recipient_address");
