# Railway Staging Deployment

This repo uses Railway for staging deployments. The monorepo should be deployed as two Railway services from the same GitHub repository:

- `edunic-api-staging` for the Fastify API
- `edunic-web-staging` for the unified Next.js frontend
- one Railway PostgreSQL service linked to the API service

## Repo files

- `railway.json` is the default Railway config and deploys the API service. Railway reads this file automatically when no custom config file path is set.
- `railway.api.json` configures the API service build, migration, start command, health check, and watch paths.
- `railway.demo-api.json` configures the API for portfolio demos and runs migrations plus the seed script before startup.
- `railway.web.json` configures the frontend service build, start command, health check, and watch paths.
- `.github/workflows/railway-ci.yml` runs build and lint checks for both `api` and `edunic-fe`.

## Railway setup

1. Create a Railway project.
2. Add a PostgreSQL database service.
3. Add a GitHub-backed service named `edunic-api-staging`.
4. In the API service settings:
   - Source repo: this repository
   - Root directory: `/`
   - Config file path: `/railway.api.json` or leave unset to use the default `/railway.json`
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

Railway injects `PORT` automatically for web services. The API reads `PORT` from the environment and binds Fastify to `::` for Railway public/private networking. The frontend is built with Next.js standalone output and starts the generated standalone server through `tools/start-fe-standalone.mjs`, which binds to `0.0.0.0` and respects Railway's runtime port.

## Deployment flow

1. Open a pull request.
2. GitHub Actions runs API and frontend build/lint checks.
3. Merge to `main`.
4. Railway GitHub deploys the changed service based on each service's watch patterns.
5. The API service runs `npm run db:migrate` as a pre-deploy command before starting.
6. Railway checks `/health` for the API and `/` for the frontend before routing traffic.

## Troubleshooting

If Railpack fails with `No start command detected`, Railway is not using the intended deployment config. The root `package.json` only has service-specific scripts such as `start:api` and `start:fe`, so Railpack cannot infer the correct monorepo service automatically.

Check the service settings:

- Root directory must be `/`, not `apps/edunic-api` or `apps/edunic-fe`.
- API service can use the default `/railway.json` or custom `/railway.api.json`.
- Web service must use custom config file path `/railway.web.json`.
- The API start command should resolve to `npm run start:api`.
- The web start command should resolve to `npm run start:fe`.
- If the web service cannot find `server.js`, confirm the frontend build produced `apps/edunic-fe/.next/standalone/apps/edunic-fe/server.js`.
- If the web service builds successfully but health checks fail, confirm the start command resolves to `npm run start:fe`; the startup helper forces `HOSTNAME=0.0.0.0` for Railway networking.

If the API pre-deploy migration fails, first confirm the API service has `DATABASE_URL` set to the Railway PostgreSQL connection URL. The migration script requires `DATABASE_URL` explicitly in deploys and prints the underlying PostgreSQL error when the database rejects a migration.

## Notes

- Do not run schema changes manually in Railway. Add migrations and let the API pre-deploy command run them.
- Use `docs/deployment/railway-portfolio-demo.md` for the public portfolio demo setup with seeded demo data.
- Redis is still not required for the current staging setup. Add a Railway Redis service later when the event bus is switched to Redis.
- Keep `NEXT_PUBLIC_API_URL` pointed at the public API URL because browser requests originate from the user's device, not Railway private networking.
