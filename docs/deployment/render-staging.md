# Render Staging Deployment

This repo is set up to use Render as the staging deployment platform and GitHub Actions as the CI gate before Render auto-deploys.

## What was added

- `render.yaml` provisions:
  - one Render web service for the Fastify API
  - one managed PostgreSQL database
- `.github/workflows/render-staging.yml` runs the required API checks:
  - `npx nx build api`
  - `npx nx lint api`
- `apps/edunic-api/src/main.ts` now reads `PORT` from the environment, which Render injects at runtime.

## How the flow works

1. Push code to GitHub.
2. GitHub Actions runs the API build and lint workflow.
3. Render waits for those checks because `render.yaml` uses `autoDeployTrigger: checksPass`.
4. After checks pass, Render builds the service, runs migrations, and starts the API.

## Render setup

1. In Render, create a new Blueprint instance from this repository.
2. Confirm the `render.yaml` services:
   - `edunic-api-staging`
   - `edunic-postgres-staging`
3. Add the required environment values if you want to override defaults:
   - `JWT_SECRET`
   - any future app secrets not yet defined in the blueprint
4. Leave `DATABASE_URL` managed by Render from the provisioned Postgres service.

## Notes

- The API health endpoint for Render is `/health`.
- `preDeployCommand` runs `npm run db:migrate`, so schema changes continue to go through migrations.
- Redis is not included in this staging setup because the current API does not use it yet.
- The current workflow is intentionally narrow and only validates the `api` project.
