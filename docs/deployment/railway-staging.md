# Railway Staging Deployment

This repo uses Railway for staging deployments. The monorepo should be deployed as two Railway services from the same GitHub repository:

- `edunic-api-staging` for the Fastify API
- `edunic-web-staging` for the unified Next.js frontend
- one Railway PostgreSQL service linked to the API service

## Repo files

- `railway.api.json` configures the API service build, migration, start command, health check, and watch paths.
- `railway.web.json` configures the frontend service build, start command, health check, and watch paths.
- `.github/workflows/railway-ci.yml` runs build and lint checks for both `api` and `edunic-fe`.

## Railway setup

1. Create a Railway project.
2. Add a PostgreSQL database service.
3. Add a GitHub-backed service named `edunic-api-staging`.
4. In the API service settings:
   - Source repo: this repository
   - Root directory: `/`
   - Config file path: `/railway.api.json`
   - Public networking: enabled
5. Add a GitHub-backed service named `edunic-web-staging`.
6. In the web service settings:
   - Source repo: this repository
   - Root directory: `/`
   - Config file path: `/railway.web.json`
   - Public networking: enabled

## Environment variables

API service:

- `DATABASE_URL`: reference the Railway PostgreSQL service connection URL.
- `JWT_SECRET`: set a strong production/staging secret.
- `NODE_ENV`: `production`.
- `CORS_ORIGINS`: comma-separated frontend origins, for example the Railway web domain.
- `CORS_ALLOW_CREDENTIALS`: `false` unless browser credential cookies are introduced.

Web service:

- `NEXT_PUBLIC_API_URL`: public URL of the Railway API service.
- `NODE_ENV`: `production`.

Railway injects `PORT` automatically for web services. The API reads `PORT` from the environment, and the frontend start target uses `next start`, which also respects Railway's runtime port.

## Deployment flow

1. Open a pull request.
2. GitHub Actions runs API and frontend build/lint checks.
3. Merge to `main`.
4. Railway GitHub deploys the changed service based on each service's watch patterns.
5. The API service runs `npm run db:migrate` as a pre-deploy command before starting.
6. Railway checks `/health` for the API and `/` for the frontend before routing traffic.

## Notes

- Do not run schema changes manually in Railway. Add migrations and let the API pre-deploy command run them.
- Redis is still not required for the current staging setup. Add a Railway Redis service later when the event bus is switched to Redis.
- Keep `NEXT_PUBLIC_API_URL` pointed at the public API URL because browser requests originate from the user's device, not Railway private networking.
