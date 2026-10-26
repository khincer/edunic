# Remaining plan — `school-roles-single-tenant`

Status as of 2026-10-26. Source of truth for the full plan: Engram `sdd/school-roles-single-tenant/tasks` (#995); slice evidence lives in Engram `sdd/school-roles-single-tenant/apply-progress-*`.

## Where things stand

**Merged on `main`:** #62–#84: the role regression, report ownership, the FE role gate (S0), migrations 0013 and 0014, the global flags and extensions, the module sweeps (S1.4a–S1.4h), the single-school seed and tools (S1.7) and the test-suite decoupling (S1.8a).

**Stacked chain for the rest of the plan (review and merge in this order):**

| Order | Branch | Slice | Base |
|---|---|---|---|
| 1 | `fix/attendance-duplicate-conflict` | Follow-up: a duplicate attendance mark answers 409 | `main` |
| 2 | `feat/single-school-contract` | S1.8b: contract migration 0015 | 1 |
| 3 | `feat/report-history` | S9a: report history (REP-03) | 2 |
| 4 | `feat/report-csv-export` | S9b: grades CSV export (REP-02) | 3 |
| 5 | `feat/classroom-activity` | S9c: classroom activity (ROLE-03, ROLE-04) | 4 |
| 6 | `test/openapi-route-drift` | Follow-ups: OpenAPI vs routes drift test; extension 400/403 | 5 |
| 7 | `feat/seed-leadership-accounts` | Follow-up: vice director and subdirector demo accounts | 6 |
| 8 | `chore/typecheck-cleanup` | C1: typecheck and API lint errors | 7 |
| 9 | `feat/fe-console-teachers` | S9d: console role gate and teacher roster (ROLE-01, TCH-01) | 8 |
| 10 | `feat/fe-console-subjects-payments` | S9e: subjects and payments pages (SUB-01..03, PAY-01, PAY-03) | 9 |
| 11 | `feat/fe-console-reports-activity` | S9f: reports and classroom activity pages (REP-01..03, ROLE-03) | 10 |
| 12 | `docs/single-school-sweep` | S10: docs sweep (NFR-05) | 11 |

**Merge rule:** after each PR merges, retarget the next one to `main` **before** merging it. If a PR is merged while its base is still the old branch, its commits never reach `main` (this happened with #63 and needed #64 to recover).

**Deploying 0015 (slice 2):** destructive. Back up the database, deploy the column-free code (already on `main`) to every API and worker instance first, then migrate. 0015 refuses to run with more than one `institutions` row. See `docs/migrations-runbook.md`, "Applying 0015".

## Verification of the chain

On the tip (`docs/single-school-sweep`): `nx test api` (fresh scratch database and a second run on the used one), `nx test worker`, `nx lint api` (0 errors), `tsc` on `apps/edunic-api/tsconfig.json`, `tsconfig.typecheck.json` and the worker (0 errors each), `nx build api`, `nx lint edunic-fe`, `nx build edunic-fe`, and the docs-site build (broken links fail it). The FE slices were also smoke-tested in a browser against a seeded API.

## Still open

- **Product decisions:** the director / vice-director split (all three administration roles share the same permissions), and whether a teacher's `PATCH /assignments/:id` without `classroomId` should stay a 403 (pinned by a test and documented).
- **Spec delta for the role model.** The Engram spec (ROLE-02, AUTH-03) still says `admin | teacher | parent`; the code and the docs site describe director / vice_director / subdirector / teacher / parent. Update the spec before `sdd-verify`.
- **Engram bookkeeping:** fold the per-slice evidence observations (#1194–#1213 and this chain) into the tasks (#995) and apply-progress (#996) artifacts.
- **Close the change:** `sdd-verify` on `main` once the chain is merged (the earlier verify, #1187, failed on S1.4, S1.8 and S9), then `sdd-archive`.
- **Smaller follow-ups found on the way:** the API returns raw database timestamp text (`YYYY-MM-DD HH:MM:SS`) from every raw-SQL read; the worker's spec tsconfig does not load the Fastify type augmentation; enrollment writes are role-gated, not roster-gated, for teachers.

## Process notes that bit us

- Never rebase, switch branches or edit files in a checkout while a test run is reading it (a mid-rebase conflict marker produced a false worker failure).
- Tests that write to Redis must use unique ids: the DB is reset per suite, Redis is not (a fixed event id broke the worker suite across runs).
- Specs that replay data-moving migrations on the shared test DB must reset it first (0015's down refuses rows without a school).
- Specs about an older migration replay the chain only up to it (`test/helpers/migrations.ts`) instead of running every migration.
- Read test results fully before settling an SDD attempt.
- Audit read routes by checking that the caller reaches the read service, not by grepping for `AccessService` in the file (that miss hid the grades/attendance leak fixed in #76).
