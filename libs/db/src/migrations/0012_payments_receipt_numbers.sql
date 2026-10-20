-- 0012_payments_receipt_numbers
--
-- The receipt number of a payment comes from a sequence, so two payments
-- registered at the same moment never share one.
create sequence if not exists payment_receipt_number_seq;
--> statement-breakpoint
create index if not exists payments_student_idx on payments (student_id);
--> statement-breakpoint
create index if not exists payments_status_due_idx on payments (status, due_date);
