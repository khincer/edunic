---
title: Roles and permissions
sidebar_label: Roles and permissions
---

# Roles and permissions

This page is the permission matrix as enforced by the route `preHandler` guards and the
services. It lists every endpoint group that exists.

Two things to know before reading it:

- `admin`, `teacher`, and `parent` are the only roles. There is no student account.
- Authorization is **per institution**. Every token is bound to one institution, and
  every resource query is scoped by `institution_id`.

## Matrix

Legend: **R** = read, **W** = create/update/delete, **—** = denied (403).

| Area | Endpoints | Admin | Teacher | Parent |
|------|-----------|:-----:|:-------:|:------:|
| Authentication | `POST /auth/login` | public | public | public |
| Institutions | `GET/POST /institutions`, `GET/PATCH/DELETE /institutions/:id` | R W | — | — |
| Academic periods | `GET /academic-periods`, `GET /academic-periods/:id` | R | R | R |
| | `POST/PATCH/DELETE /academic-periods...` | W | — | — |
| Students | `GET /students`, `GET /students/:id` | R | R | R |
| | `POST/PATCH/DELETE /students...` | W | — | — |
| Guardians | `GET /guardians`, `GET /guardians/:id`, `GET /students/:id/guardians` | R | R | R |
| | `POST/PATCH/DELETE /guardians...`, `POST /students/:id/guardians/:guardianId` | W | — | — |
| Enrollments | `GET /enrollments`, `GET /enrollments/:id` | R | R ¹ | R |
| | `POST/PATCH/DELETE /enrollments...`, `POST /enrollments/:id/promotion` | W | W | — |
| Attendance | `GET /attendance`, `GET /attendance/:id` | R | R | R |
| | `POST/PATCH/DELETE /attendance...` | W | W | — |
| Grades | `GET /grades`, `GET /grades/:id` | R | R | R |
| | `POST/PATCH/DELETE /grades...` | W | W | — |
| Academic averages | `GET /academic-averages/students/:studentId` | R | R | R |
| Reports | `GET /reports/students/:id/academic-summary` and `/pdf` | R | R | R |
| Classrooms | `GET /classrooms`, `GET /classrooms/:id` | R | R | R |
| | `POST/PATCH/DELETE /classrooms...` | W | — | — |
| Assignments | `GET /assignments` | R | R ² | R ³ |
| | `POST /assignments`, `PATCH /assignments/:id` | W | W ² | — |
| School events | `GET /school-events` | R | R ² | R ³ |
| | `POST /school-events` | W | W ² | — |
| Messages | `GET /messages`, `POST /messages`, `PATCH /messages/:id/read` | R W | R W | R W |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read` | R W | R W | R W |
| Dashboard | `GET /dashboard/admin` | R | — | — |
| | `GET /dashboard/teacher` | R | R | — |
| | `GET /dashboard/parent` | — | — | R |
| Audit logs | `GET /audit-logs` | R | — | — |
| Extensions | `GET/POST /extensions`, `PATCH /extensions/:key` | R W | — | — |
| | `GET/PUT/DELETE /institutions/:id/extensions...` | R W | — | — |
| Feature flags | `GET /feature-flags` | R | R | R |
| | `GET/PUT/DELETE /institutions/:id/feature-flags...` | R W ⁴ | — | — |
| Custom fields | `/custom-fields...` | R W | — | — |
| Bootstrap | `POST /admin/bootstrap` | W | — | — |
| Health, readiness, docs | `GET /health`, `GET /health/db`, `GET /ready`, `GET /docs`, `GET /docs/json` | public | public | public |

¹ `GET /enrollments` is filtered to the teacher's assigned classrooms. `GET
/enrollments/:id` is institution-scoped only.

² Assignment and event lists are filtered to the teacher's assigned classrooms. Teachers
cannot create a school-wide assignment or event: the API returns
`Classroom is required for teachers` (403).

³ Parents see assignments and events for the classrooms of their linked students, plus
school-wide items.

⁴ Institution feature-flag routes also require the path institution to equal the token's
institution; otherwise `Institution access denied` (403).

## What this means in practice

- **Admin** is the only role that can change people and structure: institutions,
  students, guardians, classrooms, academic periods, extensions, and flags.
- **Teacher** can write academic records (attendance, grades, enrollments) and publish
  classroom work, but cannot change the roster or the calendar.
- **Parent** has no write access to academic data. The only writes a parent can make are
  sending a message and marking their own messages and notifications as read.

## Scope caveats you should know

- The parent **portal** only calls `GET /dashboard/parent`, which returns just the students
  linked to that guardian through `guardian_user_links`. However, the route guards on
  `GET /students`, `GET /attendance`, `GET /grades`, `GET /enrollments`, and the reports
  endpoints also admit `parent`. Under a parent token those collections are
  institution-wide, not limited to the guardian's children. Do not treat a parent token as
  row-level security.
- Teacher writes are role-gated, not roster-gated: a teacher token can post attendance or a
  grade for any enrollment id in the institution. The web app only offers the teacher's
  own rosters, but the API does not enforce that.
- Institution endpoints are platform-level: `GET /institutions` lists all institutions for
  any admin token, without a tenant filter. Use an admin account only for platform
  operations.

## What is not available yet

There is no permission editor. Roles are rows in `user_institution_roles`, created by
seeding or directly in the database. There is no endpoint to invite a user, assign a role,
or link a guardian to a parent user account; `guardian_user_links` is populated by the
seed only.
