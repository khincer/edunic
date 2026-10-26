# Edunic Monorepo

This repository is an Nx monorepo. Dependencies are installed once at the workspace root, and each application is defined through `project.json` instead of nested package manifests.

Edunic is an academic management platform for **one school per deployment**: there is no tenant dimension. The roles are `director`, `vice_director` and `subdirector` (the administration), `teacher` and `parent`; see [docs-site/docs/getting-started/roles-and-permissions.md](docs-site/docs/getting-started/roles-and-permissions.md).

## Applications

- `edunic-fe`
- `edunic-api`
- `edunic-worker` (Redis Streams consumer and email delivery)

`edunic-fe` is the single Next.js frontend. In local development it runs on port `3001` so the API can keep port `3000`. It owns:

- `http://localhost:3001/admin`
- `http://localhost:3001/teachers`
- `http://localhost:3001/students` and `http://localhost:3001/parents`

## Run apps

```sh
npx nx dev edunic-fe
```

You can also use the root npm shortcuts:

```sh
npm run dev:fe
npm run dev:web
```

The API and its database:

```sh
npm run db:migrate
npm run db:seed
npm run dev:api
```

## Build, lint and test

```sh
npx nx build edunic-fe
npx nx lint edunic-fe

npx nx build api
npx nx lint api
npx tsc --noEmit -p apps/edunic-api/tsconfig.typecheck.json
npx nx test api -- --runInBand
```

The API tests need PostgreSQL (`DATABASE_URL`) and `TZ=UTC`; the worker tests also need Redis.

## Documentation

- Role guides: `docs-site/docs` (Docusaurus)
- Backend architecture: [docs/backend-architecture.md](docs/backend-architecture.md)
- Migrations and rollback: [docs/migrations-runbook.md](docs/migrations-runbook.md)

## Workspace notes

- Keep dependencies in the root `package.json`.
- Avoid creating app-level `node_modules` folders.
- Use `npx nx show project <name>` to inspect targets for any project.

## Deployment

- Railway staging setup: [docs/deployment/railway-staging.md](docs/deployment/railway-staging.md)
- Railway portfolio demo setup: [docs/deployment/railway-portfolio-demo.md](docs/deployment/railway-portfolio-demo.md)
- CI gate for staging deploys: `.github/workflows/railway-ci.yml`
