-- Down for 0007_email_notifications.
--
-- Removes the flag row, its per-institution overrides (the FK would block the
-- delete otherwise), then the three columns and their CHECKs.
-- Row data in the dropped columns is destroyed by the drops.
DELETE FROM "institution_feature_flags" WHERE "feature_key" = 'email_notifications';
--> statement-breakpoint
DELETE FROM "feature_flags" WHERE "key" = 'email_notifications';
--> statement-breakpoint
ALTER TABLE "institutions" DROP CONSTRAINT IF EXISTS "institutions_sender_name_not_blank_check";
--> statement-breakpoint
ALTER TABLE "institutions" DROP CONSTRAINT IF EXISTS "institutions_reply_to_email_not_blank_check";
--> statement-breakpoint
ALTER TABLE "guardians" DROP CONSTRAINT IF EXISTS "guardians_email_not_blank_check";
--> statement-breakpoint
ALTER TABLE "institutions" DROP COLUMN IF EXISTS "sender_name";
--> statement-breakpoint
ALTER TABLE "institutions" DROP COLUMN IF EXISTS "reply_to_email";
--> statement-breakpoint
ALTER TABLE "guardians" DROP COLUMN IF EXISTS "email";
