-- Down for 0005_non_billing_dashboards.
--
-- Drops the seven dashboards/messaging tables (indexes drop with their
-- tables). Messages go before message_threads: its foreign key references it.
-- Row data in these tables is destroyed by the drops.
DROP TABLE IF EXISTS "messages";
--> statement-breakpoint
DROP TABLE IF EXISTS "report_history";
--> statement-breakpoint
DROP TABLE IF EXISTS "message_threads";
--> statement-breakpoint
DROP TABLE IF EXISTS "school_events";
--> statement-breakpoint
DROP TABLE IF EXISTS "assignments";
--> statement-breakpoint
DROP TABLE IF EXISTS "teacher_classroom_assignments";
--> statement-breakpoint
DROP TABLE IF EXISTS "guardian_user_links";
