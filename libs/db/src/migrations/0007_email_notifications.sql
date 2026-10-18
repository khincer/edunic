-- 0007_email_notifications (design D4, D7)
--
-- Email delivery for families: the two sender-identity columns on the global
-- institutions catalog, the guardian email contact column, and the global
-- `email_notifications` flag row seeded false (FL-R1).
--
-- All three columns are nullable, so no backfill is needed. `NULL` and `''`
-- both mean "not configured"; the CHECKs keep a blank string from masquerading
-- as a contact (GE-R1) or as a sender identity (SI-R1/SI-R3).
ALTER TABLE "guardians" ADD COLUMN IF NOT EXISTS "email" text;
--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "sender_name" text;
--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "reply_to_email" text;
--> statement-breakpoint
ALTER TABLE "guardians"
  ADD CONSTRAINT "guardians_email_not_blank_check"
  CHECK ("email" IS NULL OR length(trim("email")) > 0);
--> statement-breakpoint
ALTER TABLE "institutions"
  ADD CONSTRAINT "institutions_sender_name_not_blank_check"
  CHECK ("sender_name" IS NULL OR length(trim("sender_name")) > 0);
--> statement-breakpoint
ALTER TABLE "institutions"
  ADD CONSTRAINT "institutions_reply_to_email_not_blank_check"
  CHECK ("reply_to_email" IS NULL OR length(trim("reply_to_email")) > 0);
--> statement-breakpoint
INSERT INTO "feature_flags" ("key", "default_value")
VALUES ('email_notifications', false)
ON CONFLICT ("key") DO NOTHING;
