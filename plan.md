# Remaining plan — `school-roles-single-tenant`

Status as of 2026-10-25. Source of truth for the full plan: Engram `sdd/school-roles-single-tenant/tasks` (#995); slice evidence lives in Engram `sdd/school-roles-single-tenant/apply-progress-*`.

## Where things stand

**Merged on `main`:** #62 (role regression, migration 0013), #64 (report ownership), #65 (FE role gate, S0), #66 (migration 0014, S1.4a), #67 + #68 (global flags and extensions, S1.4b), #69 (events/notifications/email, S1.4c), #70 + #72 (reference data, S1.4d), #71 (student/guardian/enrollment/averages read scoping), #73 + #74 (people, S1.4e), #75 (academics, S1.4f), #76 (grade/attendance read scoping).

**Open, stacked chain (review and merge in this order):**

| Order | PR | Slice | Base |
|---|---|---|---|
| 1 | #77 | S1.4g-1 workflows sweep | `main` |
| 2 | #78 | S1.4g-2 dashboards sweep (+ school-context fix) | `feat/sweep-workflows` |
| 3 | #79 | S1.4h-1 remove the institution context from runtime code | `feat/sweep-dashboards` |
| 4 | #80 | S1.4h-2 OpenAPI matches the single-school routes | `feat/remove-institution-context` |
| 5 | #81 | S1.7 single-school seed, tools, worker tests | `feat/openapi-single-school` |
| 6 | #82 | S1.8a part 1: test suite decoupling | `feat/single-school-seed-tools` |
| 7 | #83 | S1.8a part 2: test suite decoupling | `test/decouple-institution-id` |

**Merge rule:** after each PR merges, retarget the next one to `main` **before** merging it. If a PR is merged while its base is still the old branch, its commits never reach `main` (this happened with #63 and needed #64 to recover). Each PR was verified on its own branch: full API suite on a fresh scratch DB and the worker suite (twice where helpers or Redis were involved).

## 1. S1.8b — Contract migration 0015 (not started)

Requirements: TEN-01..05, NFR-04. Depends on everything above being merged **and deployed to every API and worker instance** first. Destructive: take a DB backup before running it in any real environment.

`0015_single_school_contract.sql`:
- Fail loudly if there is more than one `institutions` row.
- `DROP COLUMN institution_id` on the 18 tables (drops their FKs and the old composite keys/indexes).
- New keys: `teacher_classroom_assignments` PK (teacher_user_id, classroom_id); `guardian_user_links` PK (guardian_id, user_id); `academic_periods` UNIQUE (year, term); `classrooms` UNIQUE (grade_level, section).
- Recreate the lookup indexes that lost their institution prefix (guardian_user_links user_id, teacher_classroom_assignments teacher_user_id, assignments due_date, school_events starts_at, messages recipient+read, report_history student+created_at, email_deliveries created_at / inflight).
- `DROP TABLE institution_feature_flags, institution_extensions`; `DROP FUNCTION single_school_id()`.
- Keep the `institutions` table as the school configuration row (name, sender identity, reply-to).

`0015_single_school_contract.down.sql`: recreate the two tables (empty), re-add the columns, backfill from the single institutions row, restore NOT NULL, FKs, old keys, the function and the defaults.

Also in this slice:
- `libs/db/src/schema/index.ts`: remove the 18 `institution_id` columns and their defaults, `institutionFeatureFlags`, `institutionExtensions`, the email_deliveries index definitions, and the old unique/PK definitions.
- Migration-chain obligations: journal entry idx 15; bump counts in `db-constraints`, `migration-rollback` (16), `migration-roles-director`; one more down-step in `migration-single-school-merge` / `-expand`; in `migration-email-deliveries` take 0015 off first and put it back last around the 0010 replay.
- Adapt the permanently excluded specs (`migration-single-school-default`, `seed-single-school`, `single-school-request-context`, `dashboards-school-context`, the legacy-payload specs) and `test/helpers/db.ts` (its truncate list names the two dropped tables).
- Code that still relies on the 0014 default and must keep working without the column: `teachers.assignClassroom` and every insert that omits `institution_id`.
- New `migration-single-school-contract.spec.ts`: no table has `institution_id`, no FK references `institutions`, the two per-school tables are gone, duplicates on the new keys are rejected, the down restores columns with data, up/down/up is stable.
- Forecast ~490 lines (expect more, given the pattern so far); split if it passes 750.

## 2. S9 — Remaining product features

| Slice | Content | Requirements | Notes |
|---|---|---|---|
| S9a | Report history: write a `report_history` row on each export, `GET /reports/history` (admin all, teacher own classrooms) | REP-03 | Report **ownership** is already done (#64, #71). Re-scope before starting. |
| S9b | `GET /reports/export.csv` (admin all, teacher scoped, parent own child) with CSV escaping and a formula-injection guard | REP-02 | |
| S9c | Classroom activity: `GET /classrooms/:id/activity` (admin any, teacher own) and `GET /classrooms/activity` (admin summary) | ROLE-03, ROLE-04 | ~600, split per-classroom / summary if needed |
| S9d | FE console: shell + teachers page | ROLE-01, TCH-01 | **Also: `admin-shell.tsx` only checks that a session exists, not its role** — a signed-in parent or teacher can open `/admin` pages (the API still refuses the data). Add the role gate here. |
| S9e | FE console: subjects + payments pages | SUB-01..03, PAY-01, PAY-03 | split subjects / payments if needed |
| S9f | FE console: reports + classroom activity pages | REP-01, REP-02, ROLE-03 | depends on S9b, S9c, S9d |

The frontend has no test runner: FE slices are checked with `tsc`, `nx build edunic-fe` and a manual smoke test.

## 3. Follow-ups found during the work

- **Spec delta for the role model.** The spec (ROLE-02, AUTH-03) still says `admin | teacher | parent`; the maintainer kept director / vice_director / subdirector / teacher / parent. Update the spec before `sdd-verify`, or ROLE-02 fails on a literal reading. The director / vice-director split is still undefined in code.
- **Duplicate attendance mark returns an unmapped error** (likely 500) instead of 409. The duplicate is refused and pinned by a test; map the unique violation to 409.
- **Teacher `PATCH /assignments/:id` without `classroomId`** is treated as school-wide and refused (403). Pinned by a test; confirm whether that is intended.
- **No check of the OpenAPI document against the registered Fastify routes** (route-vs-doc drift). Consider a DB-backed test that compares them.
- **OpenAPI extension blocks** do not document 400/403 responses.
- **Demo accounts**: the seed has director, teacher and parent only; add vice_director / subdirector accounts if demos need them.
- **Engram bookkeeping**: fold the per-slice evidence observations (#1194–#1213) into the tasks (#995) and apply-progress (#996) artifacts.

## 4. S10 — Docs sweep (after S1.8b)

`docs-site` (roles-and-permissions, institutions, sign-in, overview, sidebars), `docs/backend-architecture.md` (still mentions `getInstitutionId`), the README, and docs that still describe the two-school demo (`docs/demo-dashboard-walkthrough.md`, `docs/deployment/railway-portfolio-demo.md`). NFR-05.

## 5. C1 — Typecheck cleanup

`tsc -p apps/edunic-api/tsconfig.json` has 29 pre-existing errors (down from 35); `tsconfig.typecheck.json` has 17; the worker has 4 (`bootstrap.ts` db typing, `pagination.ts`). None were introduced by this change.

## 6. Close the change

1. `sdd-verify` on `main` after S1.8b (and S9, if it is part of this change): re-prove every requirement; the earlier verify (#1187) failed on S1.4, S1.8 and S9.
2. `sdd-archive` once verify passes.

## Process notes that bit us

- Never rebase, switch branches or edit files in a checkout while a test run is reading it (a mid-rebase conflict marker produced a false worker failure).
- Tests that write to Redis must use unique ids: the DB is reset per suite, Redis is not (a fixed event id broke the worker suite across runs).
- Specs that replay data-moving migrations on the shared test DB must reset it first.
- Read test results fully before settling an SDD attempt.
- Audit read routes by checking that the caller reaches the read service, not by grepping for `AccessService` in the file (that miss hid the grades/attendance leak fixed in #76).
