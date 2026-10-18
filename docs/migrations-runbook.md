# Database Migrations Runbook

How to apply, roll back, and reason about every Drizzle migration in
`libs/db/src/migrations`. Covers **every** migration, including the
pre-existing ones (owner decision, P4-R6).

## How migrations are tracked

- `npm run db:migrate` runs `libs/db/src/run-migrations.ts`: Drizzle reads
  `meta/_journal.json` and applies every pending `NNNN_*.sql` in journal order,
  recording each in `drizzle.__drizzle_migrations` (`id`, `hash`, `created_at`).
- `npm run db:migrate:down` runs `libs/db/src/run-migrations-down.ts`: it rolls
  back **one step** — the last applied journal entry — by executing its sibling
  `NNNN_*.down.sql` and deleting its row from `drizzle.__drizzle_migrations`.
  Run it repeatedly to walk further back (0008 → 0007 → … → 0000).
- Both commands require `DATABASE_URL`.

Rules:

- **Never edit an applied migration file.** The down runner maps the Nth
  applied journal row to the Nth journal entry; adding a new migration is the
  only safe schema change.
- **Every new migration must ship a sibling `.down.sql`** (same tag,
  `.down.sql` suffix) or `db:migrate:down` fails loudly on it.
- Always roll back in reverse order (the runner enforces this by only ever
  rolling back the most recent applied migration).

## Rollback procedure (failed deploy)

1. Identify how far the deploy got: `SELECT * FROM drizzle.__drizzle_migrations ORDER BY id;`
2. Roll back one step at a time with `npm run db:migrate:down` until the schema
   is at the last known-good state (each run prints success or a clear error).
3. Redeploy the previous release with `npm run db:migrate` — re-applying over a
   fully rolled-back chain is a clean no-op rebuild.

Automated proof: `apps/edunic-api/test/integration/migration-rollback.spec.ts`
runs **up → down → up** for the whole chain (0000–0008) against a real
Postgres scratch database, plus per-step rollback and the empty-state error;
`apps/edunic-api/test/integration/migration-email-deliveries.spec.ts` adds the
constraint (blank-string and status CHECKs, unique ledger key) and
down-then-up reversal proof for 0007 and 0008.

## Migration reference

| # | File | Purpose | Objects touched | Down does | Data safety |
|---|------|---------|-----------------|-----------|-------------|
| 0000 | `0000_clever_doctor_strange.sql` | Initial schema | 18 tables: institutions, users, user_institution_roles, students, student_guardians, guardians, academic_periods, classrooms, enrollments, grades, attendance, audit_logs, extensions, institution_extensions, feature_flags, institution_feature_flags, custom_fields, custom_field_values | `DROP TABLE IF EXISTS` all 18 | **Destructive**: all row data in these tables is destroyed. Full-chain rollback is for disaster recovery, not routine use. |
| 0001 | `0001_huge_db_constraints.sql` | DB-level integrity | 28 constraints across 14 tables (FKs, CHECKs: term 1–4, grade_level > 0, status enums, score 0–100, date range; UNIQUEs: enrollment, email, user+institution, attendance date, …) | `DROP CONSTRAINT IF EXISTS` all 28 | Non-destructive (data survives) but removes every database-level guarantee; treat a rolled-back 0001 as an incident, not a steady state. |
| 0002 | `0002_phase3_extensions.sql` | Phase-3 extensions | `notifications` table (+FK), `custom_fields.institution_id SET NOT NULL`, unique `(field_id, entity_id)` | Drops `notifications`, the unique constraint, and the NOT NULL | **Destructive** for `notifications` rows only; custom-field data survives. |
| 0003 | `0003_noisy_shooting_star.sql` | Journal no-op (created because 0001/0002 snapshots were missing from Drizzle metadata; it creates nothing) | None | No-op comment file | Safe. |
| 0004 | `0004_academic_period_created_at.sql` | `created_at` on academic periods | `academic_periods.created_at` (nullable, default now()) | `DROP COLUMN IF EXISTS created_at` | **Destructive** for that column's stored values; rows themselves survive. |
| 0005 | `0005_non_billing_dashboards.sql` | Dashboards/messaging feature | 7 tables: guardian_user_links, teacher_classroom_assignments, assignments, school_events, message_threads, messages, report_history + 6 indexes | `DROP TABLE IF EXISTS` all 7 (indexes drop with their tables; `messages` before `message_threads`) | **Destructive**: all row data in these tables is destroyed. |
| 0006 | `0006_outbox_events.sql` | Transactional outbox (P2-R6) | `outbox_events` table + `outbox_events_unpublished_idx` | Drops the index and table | **Destructive** for unpublished/pending outbox events; committed domain rows are untouched. |
| 0007 | `0007_email_notifications.sql` | Email delivery for families — sender identity, guardian contact, feature flag (D4, D7) | `guardians.email` (+ not-blank CHECK), `institutions.sender_name` / `institutions.reply_to_email` (+ not-blank CHECKs), `feature_flags` row `('email_notifications', false)` | Deletes the flag row and its `institution_feature_flags` overrides, drops the three CHECKs and the three columns | **Destructive** for the email columns' stored values, the flag row and any per-institution `email_notifications` overrides; all other rows survive. Columns are nullable, so a re-up needs no backfill. |
| 0008 | `0008_email_deliveries.sql` | Delivery ledger with the once-only unique key (D2, D4) | `email_deliveries` table + unique `(institution_id, event_id, recipient_address)`, status/recipient-source CHECKs, `email_deliveries_institution_created_idx` (keyset), `email_deliveries_inflight_idx` (partial, in-flight) | Drops the two indexes, then the table (the unique index goes with it) | **Destructive** for the whole delivery history; the origin domain rows are untouched. |

### How 0007 and 0008 were authored

`meta/` holds snapshots only up to `0003_snapshot.json`: 0004–0006 were
hand-authored (their journal entries were added without snapshots). A plain
`npm run db:generate` therefore diffs the current schema against the 0003
snapshot and emits a polluted migration that re-creates 0004–0006's objects.
Both entries here were created with `npx drizzle-kit generate --custom
--name=<tag>` (clean journal entry, no schema diff) and the SQL was written by
hand; the stale snapshot copies drizzle-kit emitted alongside them were
discarded, matching the 0004–0006 precedent.

## Honest reversibility notes

- Every migration 0000–0008 is **structurally reversible**: the chain proves
  up → down → up restores an identical schema on a fresh database.
- Structurally reversible ≠ data-safe. Downs of 0000, 0002, 0004, 0005, 0007
  (the email columns and the flag row) and 0006/0008 (pending outbox events,
  delivery history) **destroy data by design** — `DROP TABLE`/`DROP
  COLUMN`/`DELETE` cannot preserve it. Before running any down against a
  database with real data, take a backup (`pg_dump`).
- 0001's down is the only fully non-destructive rollback; 0003 is a no-op.
