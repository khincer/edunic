# Railway Portfolio Demo

Use this setup for a public portfolio demo. It deploys the API, the unified web app, and a separate PostgreSQL database inside one Railway project.

## Services

Create these Railway services from the same GitHub repository:

- `edunic-api-demo`: Fastify API, using `/railway.demo-api.json`.
- `edunic-web-demo`: Next.js frontend, using `/railway.web.json`.
- `edunic-postgres-demo`: Railway PostgreSQL database service.

The database is not deployed from this repository. Railway provisions it as its own database service, then the API service receives the database connection string through `DATABASE_URL`.

## Setup

1. Create a Railway project named `edunic-demo`.
2. Add a PostgreSQL database service named `edunic-postgres-demo`.
3. Add a GitHub-backed service named `edunic-api-demo`.
4. In the API service settings:
   - Source repo: this repository
   - Root directory: `/`
   - Config file path: `/railway.demo-api.json`
   - Public networking: enabled
5. Add a GitHub-backed service named `edunic-web-demo`.
6. In the web service settings:
   - Source repo: this repository
   - Root directory: `/`
   - Config file path: `/railway.web.json`
   - Public networking: enabled
7. Generate public domains for both API and web services.

## Variables

API service:

- `DATABASE_URL`: reference `edunic-postgres-demo.DATABASE_URL`.
- `JWT_SECRET`: a generated 64-byte secret.
- `NODE_ENV`: `production`.
- `CORS_ORIGINS`: the public web URL, for example `https://edunic-web-demo.up.railway.app`.
- `CORS_ALLOW_CREDENTIALS`: `false`.

Web service:

- `NEXT_PUBLIC_API_URL`: the public API URL, for example `https://edunic-api-demo.up.railway.app`.
- `NODE_ENV`: `production`.

After setting variables, redeploy both GitHub-backed services.

## Demo data

The API demo config runs this before startup:

```sh
npm run db:migrate && npm run db:seed
```

The seed script is idempotent and creates demo institutions, users, students, enrollments, grades, attendance, extensions, and feature flags. Demo login accounts:

- `admin@central.edu` / `admin1234`
- `teacher@central.edu` / `teacher1234`
- `parent@central.edu` / `parent1234`
- `admin@north.edu` / `admin1234`

Use `/railway.api.json` instead of `/railway.demo-api.json` for non-demo environments where automatic seeding is not desired.

## Verification

After deploy:

1. Open the API public URL plus `/health`; it should return a healthy JSON response.
2. Open the web public URL; it should render the Edunic portal.
3. Log in with one of the demo accounts.
4. Confirm the web app calls the API domain configured in `NEXT_PUBLIC_API_URL`.
