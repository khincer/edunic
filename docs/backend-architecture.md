# Backend Architecture

How a request travels through the `edunic-api`, and why each layer exists.

This document describes the **current** backend as it is checked into the repository: a modular
monolith built on Fastify, Drizzle ORM and PostgreSQL, with an in-process domain event bus that can
be switched to Redis Streams. Everything below is verified against the code — file paths and symbols
are real. Where the broader architecture plan called for a component that **was not built yet**, it
carried a **Planned (P<phase>)** label and stayed out of the "current" sections, so the reader never
mistook intent for reality; no such label remains, every row in the summary below is shipped.

- API app: `apps/edunic-api`
- Domain logic: `libs/domain` (19 modules)
- Database: `libs/db`
- Event bus: `libs/events`

## At a glance

| Layer | Lives in | Owns |
|-------|----------|------|
| HTTP / plugins | `apps/edunic-api/src/plugins` | Cross-cutting concerns: CORS, DB pool, event bus, auth, audit, response envelope, idempotency, error handling, outbox publishing, notifications |
| Routes | `apps/edunic-api/src/routes` | HTTP shape: paths, methods, status codes, input parsing |
| Application services | `libs/domain/src/<module>/application` | Use-case orchestration, business rules, error mapping |
| Repositories | `libs/domain/src/<module>/infrastructure` | All database access (Drizzle) |
| Schema / migrations | `libs/db/src` | Tables, constraints, migrations |
| Events | `libs/events`, `libs/domain/src/events.ts` | Domain event contracts and the bus |

## 1. Request flow

A synchronous request moves through the layers below. Each layer exists to keep a single
responsibility, so a change in one does not ripple through the others.

```mermaid
flowchart LR
    HTTP[HTTP request] --> CORS["onRequest:\nCORS headers"]
    CORS --> Route["Fastify route\n(registerRoutes)"]
    Route --> Auth["preHandler:\nauthenticate + authorizeRoles"]
    Auth --> Validation["parseWithSchema\n(Zod, inside handler)"]
    Validation --> Service["Application service"]
    Service --> Domain["Domain rules\n+ error mapping"]
    Domain --> Repo["Repository\n(Drizzle)"]
    Repo --> DB[(PostgreSQL)]
    Service -. optional .-> Bus["EventBus.publish"]
    Bus -.-> Notif["notifications-plugin\nsubscriber"]
    Route -. on error .-> ErrHandler["Global error handler"]
    Route -. onSend .-> Audit1["audit-logs: capture payload"]
    Audit1 -. onResponse .-> Audit2["audit-logs: persist row"]
```

| Step | Where | Why it exists |
|------|-------|---------------|
| CORS | `plugins/cors.plugin.ts` (`onRequest`) | Answers preflight `OPTIONS` and adds CORS headers before any route logic runs. |
| Route | `routes/*.routes.ts` | The HTTP contract only: path, method, status code, wiring. No business logic. |
| Auth | `plugins/auth.plugin.ts` (`preHandler`) | Verifies the JWT and resolves the caller's role before the handler runs. |
| Validation | `libs/domain/src/shared/parse-with-schema.ts` | Rejects malformed input at the boundary. Called **inside each route handler**, not as a Fastify `preValidation` hook. |
| Service | `libs/domain/src/<module>/application/*.service.ts` | Orchestrates the use case, enforces rules, maps DB errors to HTTP status codes. |
| Repository | `libs/domain/src/<module>/infrastructure/*.repository.ts` | The only place that talks to the database. Every tenant-scoped query filters by `institutionId` (global catalogs: see section 4). |
| Events | `libs/events`, service constructor | Publishes domain events after a state change so other parts of the system can react. |

**Worked example (`POST /enrollments`):** `apps/edunic-api/src/routes/enrollments.routes.ts` builds
`EnrollmentsService` with `EnrollmentsRepository` and `app.eventBus`, gates it behind
`app.authenticate` + `app.authorizeRoles(['admin', 'teacher'])`, parses the body with
`parseWithSchema(createEnrollmentBodySchema, request.body)`, then calls
`createEnrollment()`. The service (`libs/domain/src/enrollments/application/enrollments.service.ts`)
verifies related rows exist, writes through the repository, and finally
`eventBus.publish(createEnrollmentCreatedEvent(...))`.

**Current error handling.** `apps/edunic-api/src/plugins/error-handler.plugin.ts` owns the global
Fastify error handler (the bare `{ message }` handler that used to live in `app.ts` was removed). An
`onRequest` hook assigns every request a `correlationId` (UUID), and errors are answered with an
`ErrorEnvelope` — `{ code, message, details?, correlationId }`, built by `createErrorEnvelope()` in
`libs/domain/src/shared/http/response-envelope.ts`. `code` comes from the stable `ErrorCode` enum
(eight members): `400` → `VALIDATION_ERROR`, `401` → `UNAUTHORIZED`, `403` → `FORBIDDEN`,
`404` → `NOT_FOUND`, `409` → `CONFLICT`, `503` → `SERVICE_UNAVAILABLE`; an unmapped 5xx becomes
`INTERNAL_ERROR`, any other unmapped 4xx reuses `VALIDATION_ERROR` (so `429` keeps its HTTP status
while reusing the generic client-error code). Errors that carry an explicit `statusCode` keep their
own message; everything else is masked to `Internal Server Error` so internals never leak. Error
replies are never enveloped — the envelope plugin skips status `>= 400`.

## 2. Plugin registration order

Plugins are registered in `apps/edunic-api/src/plugins/index.ts`, and the order is significant.

**Current order (as registered):**

| # | Plugin | File | Why here |
|---|--------|------|----------|
| 1 | `corsPlugin` | `cors.plugin.ts` | Must add its `onRequest` hook first so headers are present even on early responses and errors. |
| 2 | `dbPlugin` | `db.plugin.ts` | Decorates `app.db` and opens the pool. Auth and audit-logs declare it as a dependency, so it must load first. |
| 3 | `eventBusPlugin` | `event-bus.plugin.ts` | Decorates `app.eventBus`. The notifications subscriber depends on it. |
| 4 | `authPlugin` | `auth.plugin.ts` | Depends on `db-plugin`; decorates `authenticate` and `authorizeRoles` used by route `preHandler`s. |
| 5 | `auditLogsPlugin` | `audit-logs.plugin.ts` | Depends on `db-plugin`; registers the `onSend` (capture) and `onResponse` (persist) hooks. |
| 6 | `envelopePlugin` | `envelope.plugin.ts` | Registered right after `audit-logs` so the audit `onSend` hook captures the raw payload first. Wraps JSON success bodies in `{ data }`; idempotent (bodies with a top-level `data` key pass through) and skips errors, non-JSON payloads, and `/health`, `/ready`, `/docs`, `/auth/login`. |
| 7 | `idempotencyPlugin` | `idempotency.plugin.ts` | After `envelope-plugin`: its `onSend` hook must store the post-envelope payload for `Idempotency-Key` replay. |
| 8 | `errorHandlerPlugin` | `error-handler.plugin.ts` | Provides the global error handler and the per-request `correlationId` `onRequest` hook. Declares no `fastify-plugin` dependencies (only a plugin `name`), so registration order alone fixes its position after `idempotency`. |
| 9 | `outboxPublisherPlugin` | `outbox-publisher.plugin.ts` | Depends on `db-plugin` and `event-bus-plugin`; polls `outbox_events` every 500 ms and publishes unpublished rows. Registered before `notifications` so deliveries are flowing before subscribers attach. |
| 10 | `notificationsPlugin` | `notifications.plugin.ts` | Depends on `db-plugin` and `event-bus-plugin`; subscribes to the three domain events. |

Two mechanisms enforce this: the explicit `app.register(...)` order above, and `fastify-plugin`
`dependencies` (`auth-plugin` → `db-plugin`; `audit-logs-plugin` → `db-plugin`;
`outbox-publisher-plugin` → `db-plugin`, `event-bus-plugin`; `notifications-plugin` → `db-plugin`,
`event-bus-plugin`). A dependent plugin cannot load before the plugin it depends on. The convention is
that a plugin which *provides* a decorator is registered before any plugin that consumes it.
`envelope-plugin`, `idempotency-plugin` and `error-handler-plugin` declare no `dependencies` — only a
`name` — so their position is fixed by registration order alone; that is why the ordering comments sit
next to the `envelope` → `idempotency` pair in `plugins/index.ts`.

`/health` and `/ready` are both registered from `health.routes.ts`: `/health` via `healthRoutes` under
the `/health` prefix, `/ready` via `readyRoutes` at the root. Both paths are listed in
`envelope.plugin.ts`'s `isExcludedPath`, so their bodies are never wrapped in the response envelope.

`notifications` stays last.

## 3. Auth, RBAC and multi-tenancy

### Authentication (JWT)

- Tokens are signed and verified with **`jose`** (HS256), in `libs/domain/src/auth/application/jwt.ts`
  (`signJwt`, `verifyJwt`).
- The payload is `{ sub, institutionId, exp }`; tokens expire after 12 hours by default.
- `plugins/auth.plugin.ts` decorates `app.authenticate`. It reads the `Authorization: Bearer` header,
  calls `verifyJwt(token, env.JWT_SECRET)`, then loads the user's role for the token's institution via
  `AuthRepository.findUserRole`. Missing/invalid tokens return `401`; a missing role returns `403`.
- `AuthService.login` (`libs/domain/src/auth/application/auth.service.ts`) verifies the password hash
  and issues the token.

### Authorization (RBAC)

- `app.authorizeRoles([...])` returns a `preHandler` that returns `403` unless `request.user.role` is
  in the allowed list.
- Roles in use include `admin`, `teacher` and `parent` (see
  `apps/edunic-api/src/routes/enrollments.routes.ts`).
- Protection is opt-in per route: each route attaches `preHandler: [app.authenticate, app.authorizeRoles([...])]`.
  There is no global "all routes are protected" default, so every new route must add it explicitly.

### Multi-tenancy

- Every core table carries `institution_id` with a foreign key to `institutions`
  (`libs/db/src/schema/index.ts`).
- The tenant is read from the **`x-institution-id`** header via
  `getInstitutionId(request)` (`libs/domain/src/shared/institution.ts`), which validates it as a UUID.
- To close the cross-tenant hole, `authenticate` (in `plugins/auth.plugin.ts`) rejects the request with
  `403` when the `x-institution-id` header does not match the institution embedded in the token.
- Repositories receive `institutionId` and include it in the `where` clause of every tenant-scoped
  query (the two global catalogs, `institutions` and the `extensions` catalog, are the documented
  exceptions — see section 4), so tenant isolation is enforced at the data-access layer as well as at
  the edge.

## 4. Database patterns

- **ORM:** Drizzle over `pg` (`drizzle-orm/node-postgres`).
- **Connection:** `createDb()` in `libs/db/src/create-db.ts` builds a `pg.Pool` and returns
  `{ pool, db }`. It reads `DATABASE_URL`, and sets `allowExitOnIdle` in test runs. `plugins/db.plugin.ts`
  calls it, decorates `app.db`, and closes the pool on `onClose`.
- **Schema:** a single `libs/db/src/schema/index.ts` defines all tables as `pgTable` definitions,
  including the constraints that enforce data integrity:
  - `unique` — e.g. one enrollment per student per academic period (`uniqueStudentPeriod`), one
    attendance row per enrollment per day (`uniqueEnrollmentDate`), unique `(year, term)` per institution.
  - `check` — e.g. grade `score` between 0 and 100, attendance `status` in `('present','absent','late')`,
    academic period `term` between 1 and 4, `startDate <= endDate`.
  - foreign keys on `institution_id` and relationships (`student_id`, `enrollment_id`, …).
- **Migrations:** SQL files under `libs/db/src/migrations` (`0000`–`0006`), each with a sibling
  `.down.sql`, plus Drizzle's `meta/_journal.json`. `drizzle-kit` config lives in
  `libs/db/src/drizzle.config.ts` (schema `./libs/db/src/schema`, out `./libs/db/src/migrations`).
  `runMigrations()` (`libs/db/src/run-migrations.ts`) applies them with `migrate()` against
  `DATABASE_URL`; `npm run db:migrate:down` (`tools/migrate-down.ts`) rolls back one step per run.
  Every migration is structurally reversible, but the downs of `0000`, `0002`, `0004`, `0005` (and
  `0006` while unpublished events remain) are data-destructive — follow `docs/migrations-runbook.md`.
- **Transactions and the transactional outbox:** `outbox_events` (migration `0006`) is inserted
  **inside the same `db.transaction()`** as the domain row for the enrollment, grade and attendance
  creates, so neither can commit without the other. The `outbox-publisher` plugin polls unpublished
  rows every 500 ms and publishes them through `app.eventBus`, marking each row published only after
  `publish` resolved; a failure leaves the row unpublished for the next poll to retry.
- **Errors:** services map known Postgres codes to HTTP status codes, e.g. unique-violation `23505`
  becomes `409` in `EnrollmentsService.handlePersistenceError`.

**Caveat:** importing `libs/db/src/index.ts` (`@edunic/source/db`) executes a module-level
`createDb()` that exports a singleton `{ pool, db }`. Because `plugins/db.plugin.ts` imports from the
same entry, that module side effect also runs at startup. Use `createDb()` explicitly for new code and
be aware of the eager singleton.

### List conventions (cursor pagination, filter and sort)

List endpoints follow two shared conventions implemented in
`libs/domain/src/shared/http/{pagination,filter-sort}.ts`. They are wired on **13 of the 21** route
modules: the four migrated first (`students`, `enrollments`, `grades`, `attendance`) and the nine that
followed (`academic-periods`, `audit-logs`, `classrooms`, `custom-fields`, `extensions`, `guardians`,
`institutions`, `notifications`, `workflows` — 15 endpoints, since `workflows` shares one wire across
its three list routes). The other nine modules deliberately do not paginate; the disposition table
below says which and why.

- **Dual-parameter pagination.** `?cursor=<value>&limit=<n>` selects keyset (cursor) pagination;
  omitting `cursor` keeps the legacy `offset`/`limit` mode, which the route flags with an
  `X-Pagination-Deprecated: offset` response header. `cursor=start` is a sentinel requesting the
  first page in stable keyset order — real cursors are base64url JSON (`{ k, i }`, with `k` a
  composite array for multi-column orders) and can never equal `start`. A malformed cursor, or one
  whose key arity does not match the resource's stable order, is rejected with `400`
  `VALIDATION_ERROR`.
- **Keyset mechanics.** Repositories call `applyCursorPagination()` to get a constant per-resource
  stable `ORDER BY`, a bound-parameter keyset predicate, and a `limit + 1` sentinel row that detects
  `hasMore` without running `count(*)`. Cursor mode omits `meta.total` entirely; legacy mode keeps
  `meta: { total, limit, offset }`.
- **Response shape.** Services return `CursorPage<T>` — `{ data, hasMore, nextCursor?, meta? }` —
  assembled by `buildCursorPage()`. Cursor mode returns `{ data, hasMore, nextCursor? }`, offset mode
  returns the same fields **plus** the nested `meta: { total?, limit, offset }`; `nextCursor` is
  present if and only if `hasMore` is true. The page is always at the top level (never wrapped in a
  `page` key) and `meta` is never hoisted next to `data`. Because the page carries a top-level `data`
  key, the envelope plugin passes it through unchanged.
- **Uniform filter and sort.** List queries accept repeatable `filter=field:operator:value`
  (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in`) and `sort=field:direction`, parsed by
  `parseFilterSort()`. Field names are validated against a per-resource whitelist and mapped to
  constant column literals; values always travel as bound parameters, so identifiers from user input
  never reach SQL construction. In cursor mode the stable keyset order takes precedence over `sort`.

#### Disposition of the 18 remaining route modules

After the first four migrations, every module registered in `routes/index.ts` carries exactly one
recorded disposition — none may be silently skipped. A module with a list endpoint ships the full
five-part wire; a module without one is recorded `N/A` with a reason class. Nine paginate, nine do not.

| # | Module | Disposition | Reason class / endpoint |
|---|--------|-------------|-------------------------|
| 1 | `academic-averages` | N/A | Singleton year-scoped aggregate; no `limit`/`offset` |
| 2 | `admin` | N/A | POST-only (`POST /bootstrap`) |
| 3 | `audit-logs` | paginate | `GET /audit-logs` |
| 4 | `academic-periods` | paginate | `GET /academic-periods` |
| 5 | `auth` | N/A | POST-only (`POST /login`) |
| 6 | `classrooms` | paginate | `GET /classrooms` |
| 7 | `custom-fields` | paginate | `GET /custom-fields`; its nested values GET is bounded by the parent entity → N/A within this row |
| 8 | `dashboards` | N/A | Three aggregate GETs; no query schema |
| 9 | `docs` | N/A | Static OpenAPI-document GETs (`/docs`, `/docs/json`) |
| 10 | `extensions` | paginate | `GET /extensions`; nested by-institution GET bounded → N/A within this row |
| 11 | `feature-flags` | N/A | Result bounded by the flag-key set; no `limit`/`offset` |
| 12 | `guardians` | paginate | `GET /guardians`; nested by-student GET bounded → N/A within this row |
| 13 | `health` | N/A | Dependency-free liveness probe; no query schema |
| 14 | `ready` | N/A | Readiness probe, envelope-excluded; no query schema |
| 15 | `institutions` | paginate | `GET /institutions` |
| 16 | `notifications` | paginate | `GET /notifications` |
| 17 | `reports` | N/A | Per-student report documents; no `limit`/`offset` |
| 18 | `workflows` | paginate | `GET /assignments`, `GET /messages`, `GET /school-events` (one shared schema, repository and service) |

Reason classes behind the nine `N/A` rows: **POST-only**, **no list surface** (singleton, aggregate or
document response), **static/framework** (serves the OpenAPI document or is a probe), **bounded
non-list GET** (`feature-flags`), and **nested GET inside a paginating module** (recorded in that
module's row, whose disposition stays `paginate`).

Every paginated module declares one constant keyset order (`<M>_CURSOR_ORDER`) beside its repository,
always ending on the unique `id` so the order is total. A module whose leading order column is a
high-precision `timestamp` inherits the `toCursorSortKey(Date)` millisecond-truncation caveat
(`notifications`, `workflows`); `institutions` deliberately leads on `name` instead of its legacy
`created_at desc` so that caveat stays unreachable there. `workflows` aliases its three base tables to
`w` so a single constant order serves all three endpoints — which is why its uniform whitelist is only
`createdAt`.

Two of the paginated lists are global catalogs rather than tenant-scoped collections, so their `WHERE`
clause is assembled from optional filters and is empty when none are supplied: `institutions` and the
`extensions` catalog (`GET /extensions`). Everything else keeps the tenant filter described in
section 1; the tenant-scoped nested GETs (`/guardians` by student, `/custom-fields/values/...`,
`/institutions/:institutionId/extensions`) still filter by their parent entity.

## 5. Events and Redis

### Contracts and bus

`libs/events/src/index.ts` defines:

- `EventEnvelope<TName, TPayload>` — `{ id, name, institutionId, payload, occurredAt }`.
- `createEventEnvelope(...)` — assigns a UUID and timestamp.
- `EventBus` — `publish(event)` and `subscribe(eventName, handler)`.
- `InMemoryEventBus` — the **default**. Handlers run in-process, synchronously.
- `RedisStreamsEventBus` — used when `EVENT_BUS_BACKEND=redis`.
- `createEventBusFromEnv()` — returns the Redis bus when `EVENT_BUS_BACKEND=redis`, otherwise the
  in-memory bus. It throws if `REDIS_URL` is unset in Redis mode. `plugins/event-bus.plugin.ts`
  decorates `app.eventBus` with the result.

### Domain events

`libs/domain/src/events.ts` declares three events, each with a typed payload and a factory:

| Event | Factory | Payload |
|-------|---------|---------|
| `enrollment.created` | `createEnrollmentCreatedEvent` | `enrollmentId`, `studentId`, `academicPeriodId`, `classroomId` |
| `grade.submitted` | `createGradeSubmittedEvent` | `gradeId`, `enrollmentId`, `subject`, `score` |
| `attendance.marked` | `createAttendanceMarkedEvent` | `attendanceId`, `enrollmentId`, `date`, `status` |

`plugins/notifications.plugin.ts` subscribes to all three and forwards each to
`NotificationsService.handleDomainEvent`, which writes a `notifications` row when the institution has
the notifications extension enabled. A fourth event, `enrollment.welcomed`
(`createEnrollmentWelcomedEvent`), exists only as the worker's side effect and is deliberately **not**
part of `AcademicDomainEvent` — that union is the notifications subscriber's contract.

### Redis

- Redis carries three things: the event-bus transport, the `Idempotency-Key` store, and the worker's
  per-event dedupe markers. It is not used for caching or rate limiting.
- In Redis mode, `RedisStreamsEventBus.publish` calls Redis `XADD` on the stream
  `edunic:domain-events` (override with `EVENT_STREAM_NAME`) using `ioredis`, then also dispatches to
  its in-memory subscribers. `subscribe` still delegates to the in-memory bus: the Redis transport is
  read by the worker process, not by process-local subscribers.
- **Worker.** `apps/edunic-worker` (Nx project `worker`) requires `EVENT_BUS_BACKEND=redis` and runs
  `RedisStreamConsumer` (`libs/events/src/consumer.ts`) against the consumer group `edunic-worker`,
  which it creates at the stream tip (`$`) and then polls with `XREADGROUP`. Each delivery runs the
  handler first, then writes `processed:{event.id}` and `XACK`s the entry — so a failed or crashed
  delivery stays pending and is retried (at-least-once), while a repeated delivery is acked without
  re-running the side effect. For `enrollment.created` the side effect is publishing
  `enrollment.welcomed`, which closes the `POST /enrollments` → outbox → stream → worker loop.

## Current status (summary)

| Component | Status | Where / when |
|-----------|--------|--------------|
| Request → route → validation → service → repository → DB | Current | This document, section 1 |
| Plugins: cors, db, event-bus, auth, audit-logs, envelope, idempotency, error-handler, outbox-publisher, notifications | Current | `plugins/index.ts` |
| JWT auth + RBAC + `institution_id` scoping | Current | `plugins/auth.plugin.ts`, shared/institution |
| Drizzle schema + migrations (with `.down.sql` + runbook) | Current | `libs/db/src`, `docs/migrations-runbook.md` |
| In-memory event bus, 3 domain events, notifications subscriber | Current | `libs/events`, `libs/domain/src/events.ts` |
| Response envelope + error codes | Current | `libs/domain/src/shared/http/response-envelope.ts`, `plugins/envelope.plugin.ts`, `plugins/error-handler.plugin.ts` |
| Cursor pagination / filter-sort (13 modules, 15 endpoints) | Current | `libs/domain/src/shared/http/{pagination,filter-sort}.ts` (section 4, "List conventions") |
| Idempotency keys (Redis) | Current | `libs/domain/src/shared/http/idempotency.ts`, `idempotency.plugin.ts` |
| Transactional outbox + publisher | Current | `libs/db` `outbox_events` (migration 0006), `libs/domain/src/shared/outbox.ts`, `outbox-publisher.plugin.ts` |
| Tests (unit / integration / API / DB / E2E) | Current | `apps/edunic-api/test` (56 suites), `apps/edunic-worker/test` |
| Docker / Railway / `/health`, `/ready` | Current | `docker/{api.dockerfile,worker.dockerfile}`, `railway*.json`, `health.routes.ts` |
| Worker + Redis Streams consumer | Current | `apps/edunic-worker`, `libs/events/src/consumer.ts` |

## Reference

- Plugins: `apps/edunic-api/src/plugins/`
- Routes: `apps/edunic-api/src/routes/` (21 route modules, 22 registrations in `index.ts` —
  `health.routes.ts` exports both `healthRoutes` and `readyRoutes`)
- Worker: `apps/edunic-worker`, `libs/events/src/consumer.ts`
- App bootstrap: `apps/edunic-api/src/app.ts`, `apps/edunic-api/src/main.ts`
- Domain modules: `libs/domain/src/`
- DB: `libs/db/src/`
- Events: `libs/events/src/index.ts`, `libs/domain/src/events.ts`
