-- 0008_email_deliveries (design D4, D2)
--
-- The delivery ledger: one row per (institution, event, recipient address)
-- attempt. The unique key is the database half of the once-only guarantee
-- (OC-R1/RC-R2): enqueue inserts `on conflict do nothing`, so a redelivered
-- event can never add a second record for the same address.
--
-- `event_id` is the envelope id and deliberately has no FK to `outbox_events`,
-- so the ledger survives outbox retention. `status` carries DR-R1's four
-- statuses plus `sending`, the transient in-flight claim D2 uses as the guard.
CREATE TABLE IF NOT EXISTS "email_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id"),
  "event_id" uuid NOT NULL,
  "event_name" text NOT NULL,
  "recipient_address" text NOT NULL,
  "recipient_source" text NOT NULL,
  "student_id" uuid,
  "status" text NOT NULL DEFAULT 'queued',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "provider_message_id" text,
  "provider_error" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "sent_at" timestamp,
  CONSTRAINT "email_deliveries_recipient_source_check"
    CHECK ("recipient_source" IN ('guardian', 'user')),
  CONSTRAINT "email_deliveries_status_check"
    CHECK ("status" IN ('queued', 'sending', 'sent', 'failed', 'retried')),
  CONSTRAINT "email_deliveries_institution_event_recipient_unique"
    UNIQUE ("institution_id", "event_id", "recipient_address")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_deliveries_institution_created_idx"
  ON "email_deliveries" ("institution_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_deliveries_inflight_idx"
  ON "email_deliveries" ("institution_id")
  WHERE "status" IN ('queued', 'sending', 'retried');
