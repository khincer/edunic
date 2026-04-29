# Module Checklist

Use this checklist when implementing a new Edunic API module.

## Before Coding

1. Create a new branch for the module request.
2. Review `AGENTS.md` for roadmap order and tenant rules.
3. Inspect an existing module in `apps/edunic-api/src/modules/`.
4. Confirm whether the entity is tenant-root or tenant-scoped.

## Implementation

1. Add Zod schemas for params, query, and body as needed.
2. Add a repository with scoped queries and delete guards.
3. Add a service that owns business logic and response shaping.
4. Add Fastify routes that only parse/validate input and delegate.
5. Register the route in `apps/edunic-api/src/routes/index.ts`.
6. Document the endpoints in `apps/edunic-api/src/docs/openapi.ts`.

## Verification

1. Run `nx build api`.
2. Run `nx lint api`.
3. Check `http://localhost:3000/docs`.
4. Mention any pre-existing warnings separately from new issues.

## Data Safety

- Never query tenant-owned records without `institution_id`.
- Never place business logic directly in route handlers.
- Never delete records that still have dependent academic data without an explicit rule.
