---
slug: /
title: Introduction
sidebar_label: Introduction
---

# Edunic documentation

Edunic is a multi-tenant academic management platform for schools. One deployment serves
several institutions. Inside each institution it tracks students, guardians, academic
periods, enrollments, attendance, grades, assignments, school events, messages, and
generated academic reports.

This site is a set of **role guides**. Each procedure tells one role how to finish one
task in the web app or through the HTTP API.

## The three roles

| Role | Who it is | Entry point |
|------|-----------|-------------|
| `admin` | Institution operator. Manages the school record, calendar, people, academic data, extensions, and flags. | `/admin/login` |
| `teacher` | Classroom staff. Marks attendance, submits grades, and publishes classroom work. | `/teachers/login` |
| `parent` | Guardian account. Reads the progress of the students linked to that guardian. | `/parents/login` |

There are exactly three roles in the route guards. **Students do not have a login and
there is no `student` role.** The `/students` page in the web app is a static placeholder
with no authentication and no data; it is not a workspace. See
[Roles and permissions](./getting-started/roles-and-permissions.md) for the full matrix.

An `admin` account can also use the teacher workspace, because `/teachers/login` accepts
both `teacher` and `admin`. The reverse is not true.

## How to read this guide

- **Administrators** start at [Admin overview](./admin/overview.md).
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
| Web app | `http://localhost:3001` (also served on tenant hosts such as `http://central.localtest.me:3001`) |
| API | `http://localhost:3000` |
| Interactive API reference | `http://localhost:3000/docs` (Swagger UI backed by `/docs/json`) |

The web app resolves the institution from the host name. Open the app through an
institution host when you need a specific school; on plain `localhost` it falls back to
the first seeded institution and shows an information banner.

## Demo data

`tools/seed.ts` creates two institutions, demo users, academic periods, classrooms,
enrollments, grades, attendance, guardians, notifications, and workflow records. The
seeded account emails are visible in that file. This documentation never repeats seeded
passwords or tokens; read them from `tools/seed.ts` in your own checkout.

## What is not available yet

- No student login or student role.
- No self-service sign-up, password reset, SSO, or token refresh endpoint.
- No parent-facing page to edit profile data.
- No UI for classrooms, custom fields, or the academic-averages endpoint; these exist in
  the API only.
- No bulk import or export.
- Billing, analytics, and MINED compliance reporting are roadmap items, not shipped
  features. The only report that exists is the student academic summary and its PDF.
