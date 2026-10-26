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

## Demo School

One deployment serves one school. The seed creates its profile (`Colegio Central`) and one
account per role; there is no second school to switch to.

## Demo Accounts

| Role | Email |
|------|-------|
| Director | `admin@central.edu` |
| Vice director | `vicedirector@central.edu` |
| Subdirector | `subdirector@central.edu` |
| Teacher | `teacher@central.edu` |
| Parent | `parent@central.edu` |

The passwords are defined in `tools/seed.ts`; read them from your checkout rather than copying
them into tickets or documents.

## Walkthrough Order

1. Log in as the director and open `/admin/dashboard`.
2. Confirm billing is absent from navigation, module status, and dashboard cards.
3. Open **Teachers**: create a teacher, assign and remove a classroom.
4. Open **Subjects**: create a materia, add a tema, offer it in a grade level and assign it to a
   teacher.
5. Open **Payments**: record a payment, mark it paid and download its receipt.
6. Open **Reports**: download a student's academic summary PDF, export the grades CSV, and check
   both exports appear in the history.
7. Open **Classroom activity** and select **Details** on a classroom.
8. Log in as the teacher and open `/teachers`; verify only assigned classroom data appears. Open
   `/admin/dashboard` with the same session and verify the console points the teacher back to
   their portal.
9. Log in as the parent and open `/parents`; verify only linked students, payments, family
   notifications, assignments, events, and messages appear.
10. Log in as the vice director or the subdirector and verify they reach the same console as the
    director.

## Seed And Verification

Run these commands from the workspace root:

```bash
npm run db:migrate
npm run db:seed
PORT=3002 JWT_SECRET=local-dev-secret npm run dev:api
NEXT_PUBLIC_API_URL=http://localhost:3002 npm run dev:fe -- --port 3003
```

The current demo intentionally excludes billing. Keep `billing_module` disabled and out of dashboard visibility until the billing phase resumes.
