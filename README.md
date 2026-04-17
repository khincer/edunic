# Edunic Monorepo

This repository is an Nx monorepo. Dependencies are installed once at the workspace root, and each application is defined through `project.json` instead of nested package manifests.

## Applications

- `edunic-fe`
- `edunic-admin`
- `edunic-teachers`
- `edunic-api`

## Run apps

```sh
npx nx dev edunic-fe
npx nx dev edunic-admin
npx nx dev edunic-teachers
```

You can also use the root npm shortcuts:

```sh
npm run dev:fe
npm run dev:admin
npm run dev:teachers
```

## Build and lint

```sh
npx nx build edunic-fe
npx nx build edunic-admin
npx nx build edunic-teachers

npx nx lint edunic-fe
npx nx lint edunic-admin
npx nx lint edunic-teachers
```

## Workspace notes

- Keep dependencies in the root `package.json`.
- Avoid creating app-level `node_modules` folders.
- Use `npx nx show project <name>` to inspect targets for any project.
