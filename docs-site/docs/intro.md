---
slug: /
title: Introduction
sidebar_label: Introduction
---

# Edunic documentation

Edunic is an academic management platform for one school. Each deployment serves exactly
one school: it tracks students, guardians, teachers and their classrooms, materias,
academic periods, enrollments, attendance, grades, payments, assignments, school events,
messages, and generated academic reports.

This site is a set of **role guides**. Each procedure tells one role how to finish one
task in the web app or through the HTTP API.

## The roles

| Role | Who it is | Entry point |
|------|-----------|-------------|
| `director`, `vice_director`, `subdirector` | The school administration. Manages the school profile, teachers, materias, calendar, people, academic data, payments, extensions and flags, and reads the activity of every classroom. | `/admin/login` |
| `teacher` | Classroom staff. Marks attendance, submits grades and publishes work for the classrooms assigned to them. | `/teachers/login` |
| `parent` | Guardian account. Reads the progress and payments of the students linked to that guardian. | `/parents/login` |

A user holds exactly one role. The three administration roles have the same permissions;
the difference between them is only hierarchical. **Students do not have a login and there is no `student` role.** The `/students`
page in the web app is a static placeholder with no authentication and no data. See
[Roles and permissions](./getting-started/roles-and-permissions.md) for the full matrix.

The administration can also use the teacher workspace, because `/teachers/login` accepts
both. The reverse is not true: a teacher or parent who opens the admin console is pointed
back to their own portal.

## How to read this guide

- **The administration** starts at [Admin overview](./admin/overview.md).
- **Teachers** start at [Teacher overview](./teacher/overview.md).
- **Parents** start at [Parent overview](./parent/overview.md).
- Everyone needs [Sign in](./getting-started/sign-in.md) first.
- API integrators should read [API conventions](./reference/api-conventions.md) and
  [Error codes](./reference/error-codes.md).

Every procedure has the same shape: **Goal**, **Prerequisites**, **In the app**,
**Through the API**, **Expected result**, and **If it fails**.

## Environments

| Component | Local address |
|-----------|---------------|
| Web app | `http://localhost:3001` |
| API | `http://localhost:3000` |
| Interactive API reference | `http://localhost:3000/docs` (Swagger UI backed by `/docs/json`) |

## Demo data

`tools/seed.ts` creates the school profile, one demo account per role, academic periods,
classrooms, materias, enrollments, grades, attendance, guardians, notifications, and
workflow records. The seeded account emails are visible in that file. This documentation
never repeats seeded passwords or tokens; read them from `tools/seed.ts` in your own
checkout.

## What is not available yet

- No student login or student role.
- No self-service sign-up, password reset, SSO, or token refresh endpoint.
- No parent-facing page to edit profile data.
- No UI for custom fields or the academic-averages endpoint; these exist in the API only.
- No bulk import.
- No online billing, analytics, or MINED compliance export. Reports are the student
  academic summary (JSON and PDF) and the grades CSV export.
