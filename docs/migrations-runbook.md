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
  Run it repeatedly to walk further back (0015 → 0014 → … → 0000).
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
runs **up → down → up** for the whole chain (0000–0015) against a real
Postgres scratch database, plus per-step rollback and the empty-state error;
`apps/edunic-api/test/integration/migration-email-deliveries.spec.ts` adds the
constraint (blank-string and status CHECKs, unique ledger key) and
down-then-up reversal proof for 0007 and 0008. The single-school migrations
have their own specs: `migration-single-school-expand` (0009),
`migration-single-school-merge` (0010), `migration-roles-director` (0013),
`migration-single-school-default` (0014) and
`migration-single-school-contract` (0015). Specs about an older migration
replay the chain only up to it (`test/helpers/migrations.ts`).

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
| 0009 | `0009_single_school_expand.sql` | Single-school expand (additive) | `user_roles`, `subjects`, `topics`, `classroom_subjects`, `subject_teachers`, `payments`; `grades.subject_id/topic_id`, `assignments.subject_id/topic_id` | Drops only what it created | **Destructive** for the rows of the new tables. |
| 0010 | `0010_single_school_merge.sql` | Merges every school into one (the one with the most staff) and backfills one role per user and a materia per grade subject | Repoints every school-scoped row; deletes the extra `institutions` rows and the duplicates the merge would create | Restores the old email unique key only | **Irreversible**: the original school of each row is gone. The real rollback point is a backup taken before it ran. |
| 0011 | `0011_single_school_subjects.sql` | Grades and assignments point at a materia (and optionally a tema of it); the free-text subject goes | `grades.subject` dropped, `subject_id` NOT NULL, composite tema FK | Brings the free-text subject back from the catalog | Non-destructive. |
| 0012 | `0012_payments_receipt_numbers.sql` | Receipt numbers from a sequence | `payments_receipt_number_seq` | Drops the sequence | Issued numbers keep their value; after a down a number could be issued twice. |
| 0013 | `0013_roles_director_drop_user_institution_roles.sql` | `admin` becomes `director`; drops `user_institution_roles` | `user_roles.role`, `user_institution_roles` | Recreates the table empty; directors go back to `admin` | **Destructive** for the old per-school role rows (unused since 0009). |
| 0014 | `0014_single_school_default.sql` | Expand step of the contract: `single_school_id()` (the oldest school) becomes the default of every school column; per-school flag and extension overrides are folded into the global tables | 18 column defaults, `extensions.config` | Drops the defaults, the function and `extensions.config` | Non-destructive for rows; the folded flag values stay global. |
| 0015 | `0015_single_school_contract.sql` | Contract step: drops the school column from the 18 tables, the two per-school tables and `single_school_id()`; rebuilds the keys and lookup indexes without the school | 18 tables, `institution_feature_flags`, `institution_extensions` | Re-adds the columns NOT NULL, backfilled from the one school, with their original keys, indexes and FKs; recreates the two tables empty and the function | **Destructive and refuses unsafe states** — see below. |

### How 0007 and 0008 were authored

`meta/` holds snapshots only up to `0003_snapshot.json`: 0004–0006 were
hand-authored (their journal entries were added without snapshots). A plain
`npm run db:generate` therefore diffs the current schema against the 0003
snapshot and emits a polluted migration that re-creates 0004–0006's objects.
Both entries here were created with `npx drizzle-kit generate --custom
--name=<tag>` (clean journal entry, no schema diff) and the SQL was written by
hand; the stale snapshot copies drizzle-kit emitted alongside them were
discarded, matching the 0004–0006 precedent.

### Applying 0015 (the single-school contract)

0015 removes the school column for good. Apply it in this order:

1. **Back up the database** (`pg_dump`). The down can restore the columns, but
   only by backfilling them from the one remaining school.
2. **Deploy the column-free code first** to every API and worker instance and
   let it run. That code never reads or writes the school column; with 0014 in
   place the database still fills it in, so old and new code coexist.
3. Run `npm run db:migrate`. 0015 checks that there is **at most one**
   `institutions` row and raises an exception otherwise; the migrator runs the
   whole file in one transaction, so a refusal leaves the 0014 schema intact.
   Merge or delete the extra rows first.
4. The `institutions` row stays as the school profile (`/school-profile`).

Rolling 0015 back (`npm run db:migrate:down`) first checks that a school row
exists whenever any of the 18 tables has data, and refuses before changing
anything if not. The two per-school tables come back empty: their values were
folded into the global tables by 0014.

## Honest reversibility notes

- Every migration 0000–0015 is **structurally reversible**: the chain proves
  up → down → up restores an identical schema on a fresh database.
- Structurally reversible ≠ data-safe. Downs of 0000, 0002, 0004, 0005, 0007
  (the email columns and the flag row) and 0006/0008 (pending outbox events,
  delivery history) **destroy data by design** — `DROP TABLE`/`DROP
  COLUMN`/`DELETE` cannot preserve it. Before running any down against a
  database with real data, take a backup (`pg_dump`).
- 0001's down is the only fully non-destructive rollback; 0003 is a no-op.
- 0010's merge cannot be undone by its down; 0015's down restores the school
  column only from the single remaining school.
