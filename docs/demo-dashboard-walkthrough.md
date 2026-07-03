# Dashboard Demo Walkthrough

## Local URLs

- Frontend: http://localhost:3003
- API: http://localhost:3002
- API docs: http://localhost:3002/docs

## Required Environment

- `JWT_SECRET`: any stable local secret, for example `local-dev-secret`
- `DATABASE_URL`: PostgreSQL connection string used by Drizzle
- `PORT`: API port, typically `3002` for the demo run
- `NEXT_PUBLIC_API_URL`: frontend API base URL, typically `http://localhost:3002`

## Demo Institution

- Central institution ID: `10000000-0000-0000-0000-000000000001`
- North institution ID: `10000000-0000-0000-0000-000000000002`

## Demo Credentials

- Admin: `admin@central.edu` / `admin1234`
- Teacher: `teacher@central.edu` / `teacher1234`
- Parent: `parent@central.edu` / `parent1234`
- Cross-tenant admin: `admin@north.edu` / `admin1234`

## Walkthrough Order

1. Log in as the Central admin and open `/admin/dashboard`.
2. Confirm billing is absent from navigation, module status, and dashboard cards.
3. Visit Students, Enrollments, Grades & Attendance, and Reports from the admin shell.
4. Download a student academic report from `/admin/reports`.
5. Log in as the teacher and open `/teachers`; verify only assigned classroom data appears.
6. Log in as the parent and open `/parents`; verify only linked students, family notifications, assignments, events, and messages appear.
7. Use the North admin credentials to confirm tenant data stays separate from Central.

## Seed And Verification

Run these commands from the workspace root:

```bash
npm run db:migrate
npm run db:seed
PORT=3002 JWT_SECRET=local-dev-secret npm run dev:api
NEXT_PUBLIC_API_URL=http://localhost:3002 npm run dev:fe -- --port 3003
```

The current demo intentionally excludes billing. Keep `billing_module` disabled and out of dashboard visibility until the billing phase resumes.
