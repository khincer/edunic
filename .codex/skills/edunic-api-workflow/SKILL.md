---
name: edunic-api-workflow
description: Implement or extend backend modules in the Edunic monorepo. Use when working on Fastify API endpoints, Zod validation, tenant-scoped CRUD, Swagger/OpenAPI docs, or roadmap-driven academic modules such as students, institutions, enrollments, grades, attendance, and academic periods. Also use when deciding the next module from the project roadmap or when a new module request requires its own branch.
---

# Edunic API Workflow

Implement backend changes in the Edunic monorepo with the repo's existing structure and constraints.

## Core Rules

- Create a new git branch before implementing a new module request.
- Keep business logic out of routes.
- Put request validation in `schemas/`.
- Put orchestration and business rules in `application/`.
- Put data access in `infrastructure/`.
- Keep routes thin and focused on HTTP input/output.
- Scope every tenant-owned query by `institution_id`.
- Do not bypass migrations for schema changes.

## Behavioral Guidelines

Bias toward caution over speed unless the task is truly trivial.

### Think Before Coding

- State assumptions explicitly before implementing.
- If something is unclear, name the ambiguity and ask instead of guessing.
- If multiple interpretations exist, present them instead of silently picking one.
- If a simpler approach exists, say so.
- Push back when the requested shape appears overcomplicated or risky.

### Simplicity First

- Write the minimum code that solves the requested problem.
- Do not add features, abstractions, flexibility, or configurability that were not requested.
- Do not add handling for impossible scenarios.
- If the implementation feels too large for the task, simplify it before continuing.
- Prefer the version a senior engineer would describe as straightforward and boring.

### Surgical Changes

- Touch only the code required for the request.
- Do not refactor adjacent code unless the task requires it.
- Match existing style and structure unless the user asked for a change.
- If unrelated dead code is noticed, mention it without deleting it.
- Remove only the unused imports, variables, or functions created by your own change.
- Make sure every changed line traces directly back to the request.

### Goal-Driven Execution

- Translate requests into concrete, verifiable outcomes before coding.
- For bug fixes, reproduce the bug first when practical, then make the failing check pass.
- For validation work, add checks or tests for invalid inputs and verify behavior.
- For refactors, preserve behavior and verify before and after.
- For multi-step tasks, state a short plan with a verification check for each step.
- Prefer success criteria that can be independently verified over vague goals like "make it work".

## Module Pattern

For new API modules, follow the shape already used in `apps/edunic-api/src/modules/`:

1. Add `schemas/<entity>.schemas.ts` with Zod request schemas and exported inferred types.
2. Add `infrastructure/<entity>.repository.ts` with database access.
3. Add `application/<entity>.service.ts` with business rules and response shaping.
4. Add `apps/edunic-api/src/routes/<entity>.routes.ts` with thin Fastify handlers.
5. Register the route in `apps/edunic-api/src/routes/index.ts`.
6. Update `apps/edunic-api/src/docs/openapi.ts` so the endpoint appears in `/docs`.
7. Verify with `nx build api` and `nx lint api`.

## Tenant Rules

- Treat institutions as the tenant root.
- For tenant-owned entities such as students, enrollments, grades, attendance, classrooms, and academic periods, require tenant scoping in repository queries.
- If an endpoint operates inside a tenant context, use the request header `x-institution-id` unless the module is the tenant root itself.
- Protect deletes when dependent academic records still exist.

## Roadmap Order

Use the Phase 1 order from `AGENTS.md` when the user asks what to build next:

1. Students
2. Enrollments
3. Grades
4. Attendance
5. Academic periods

After Phase 1, continue with compliance/reporting, then extensions, then SaaS features.

## Working Style

- Prefer modifying existing patterns over inventing new infrastructure.
- Keep implementations minimal, explicit, and testable.
- If Nx module-boundary friction appears, stay consistent with current repo conventions instead of forcing a larger refactor.
- Update Swagger docs whenever an endpoint changes so `http://localhost:3000/docs` stays useful for manual testing.
- Favor fewer unnecessary diff lines, fewer speculative rewrites, and clarifying questions before implementation mistakes.

## References

- Read `AGENTS.md` for product roadmap and non-negotiable rules.
- Read `references/module-checklist.md` before implementing a new academic module end to end.
