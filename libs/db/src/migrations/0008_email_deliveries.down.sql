-- Down for 0008_email_deliveries.
--
-- Indexes drop explicitly, then the table (the unique constraint's index goes
-- with it). Row data in the ledger is destroyed by the drop.
DROP INDEX IF EXISTS "email_deliveries_inflight_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "email_deliveries_institution_created_idx";
--> statement-breakpoint
DROP TABLE IF EXISTS "email_deliveries";
