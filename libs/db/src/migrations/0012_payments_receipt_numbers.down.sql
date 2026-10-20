-- Down for 0012_payments_receipt_numbers.
--
-- The receipt numbers already issued keep their value; the sequence starts
-- over, so a number could be handed out twice. The ledger is the record of
-- what was issued.
drop index if exists payments_status_due_idx;
--> statement-breakpoint
drop index if exists payments_student_idx;
--> statement-breakpoint
drop sequence if exists payment_receipt_number_seq;
