# Edunic Monorepo

This repository is an Nx monorepo. Dependencies are installed once at the workspace root, and each application is defined through `project.json` instead of nested package manifests.

## Applications

- `edunic-fe`
- `edunic-api`

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

## Build and lint

```sh
npx nx build edunic-fe

npx nx lint edunic-fe
```

## Workspace notes

- Keep dependencies in the root `package.json`.
- Avoid creating app-level `node_modules` folders.
- Use `npx nx show project <name>` to inspect targets for any project.

## Deployment

- Railway staging setup: [docs/deployment/railway-staging.md](docs/deployment/railway-staging.md)
- CI gate for staging deploys: `.github/workflows/railway-ci.yml`
