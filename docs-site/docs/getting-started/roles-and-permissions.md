---
title: Roles and permissions
sidebar_label: Roles and permissions
---

# Roles and permissions

This page is the permission matrix as enforced by the route `preHandler` guards and the
services. It lists every endpoint group that exists.

Things to know before reading it:

- Edunic serves **one school per deployment**. There is no school selector, no school id
  in tokens or payloads, and no school header.
- There are five roles: `director`, `vice_director`, `subdirector`, `teacher` and
  `parent`. A user holds exactly one role (`user_roles`).
- The director, the vice director and the subdirector form the **administration**
  ("Admin" below). They have the same permissions: the difference between them is only
  hierarchical, not a permission boundary.
- There is no student account. A student is a record, not a login.

## Matrix

Legend: **R** = read, **W** = create/update/delete, **own** = limited to the caller's own
records (see the notes), **—** = denied (403).

| Area | Endpoints | Admin | Teacher | Parent |
|------|-----------|:-----:|:-------:|:------:|
| Authentication | `POST /auth/login` | public | public | public |
| School profile | `GET/PATCH /school-profile` | R W | — | — |
| Teachers | `GET/POST /teachers`, `PATCH /teachers/:userId/role`, `POST/DELETE /teachers/:userId/classrooms...` | R W | — | — |
| | `GET /teachers/:userId`, `GET /teachers/:userId/classrooms` | R | R own ¹ | — |
| Subjects (materias) | `GET /subjects`, `GET /subjects/:id/topics`, `GET /subjects/classroom/:classroomId` | R | R ² | R ² |
| | `POST/PATCH /subjects...`, topics, classroom and teacher links | W | — | — |
| Academic periods | `GET /academic-periods`, `GET /academic-periods/:id` | R | R | R |
| | `POST/PATCH/DELETE /academic-periods...` | W | — | — |
| Classrooms | `GET /classrooms`, `GET /classrooms/:id` | R | R ³ | R |
| | `POST/PATCH/DELETE /classrooms...` | W | — | — |
| Classroom activity | `GET /classrooms/activity` | R | — | — |
| | `GET /classrooms/:id/activity` | R | R own ³ | — |
| Students | `GET /students`, `GET /students/:id` | R | R own ⁴ | R own ⁵ |
| | `POST/PATCH/DELETE /students...` | W | — | — |
| Guardians | `GET /guardians`, `GET /guardians/:id`, `GET /students/:id/guardians` | R | R own ⁴ | R own ⁵ |
| | `POST/PATCH/DELETE /guardians...`, student links | W | — | — |
| Enrollments | `GET /enrollments`, `GET /enrollments/:id` | R | R own ⁴ | R own ⁵ |
| | `POST/PATCH/DELETE /enrollments...`, `POST /enrollments/:id/promotion` | W | W | — |
| Attendance | `GET /attendance`, `GET /attendance/:id` | R | R own ⁴ | R own ⁵ |
| | `POST/PATCH/DELETE /attendance...` | W | W own ³ | — |
| Grades | `GET /grades`, `GET /grades/:id` | R | R own ⁴ | R own ⁵ |
| | `POST/PATCH/DELETE /grades...` | W | W own ⁶ | — |
| Academic averages | `GET /academic-averages/students/:studentId` | R | R own ⁴ | R own ⁵ |
| Reports | `GET /reports/students/:id/academic-summary` and `/pdf` | R | R own ⁴ | R own ⁵ |
| | `GET /reports/export.csv` | R | R own ⁴ | R own ⁵ |
| | `GET /reports/history` | R | R own ⁴ | — |
| Payments | `GET /payments`, `GET /payments/:id`, `GET /payments/:id/receipt` | R | — | R own ⁵ |
| | `GET /payments/balances`, `POST /payments`, `PATCH /payments/:id` | R W | — | — |
| Assignments | `GET /assignments` | R | R ³ | R ⁷ |
| | `POST /assignments`, `PATCH /assignments/:id` | W | W ³ | — |
| School events | `GET /school-events` | R | R ³ | R ⁷ |
| | `POST /school-events` | W | W ³ | — |
| Messages | `GET /messages`, `POST /messages`, `PATCH /messages/:id/read` | R W | R W | R W |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read` | R W | R W | R W |
| | `GET /notifications/deliveries`, `GET /notifications/deliveries/state` | R | — | — |
| Dashboard | `GET /dashboard/admin` | R | — | — |
| | `GET /dashboard/teacher` | R | R | — |
| | `GET /dashboard/parent` | — | — | R |
| Audit logs | `GET /audit-logs` | R | — | — |
| Feature flags | `GET /feature-flags` | R | R | R |
| | `PATCH /feature-flags/:featureKey` | W | — | — |
| Extensions | `GET/POST /extensions`, `PATCH /extensions/:key`, `PUT/DELETE /extensions/:key/config` | R W | — | — |
| Custom fields | `/custom-fields...` | R W | — | — |
| Bootstrap | `POST /admin/bootstrap` | W | — | — |
| Health, readiness, docs | `GET /health`, `GET /health/db`, `GET /ready`, `GET /docs`, `GET /docs/json` | public | public | public |

¹ A teacher reads only their own account and classrooms.

² The catalog as the caller may see it: a teacher sees the materias assigned to them, a
parent the ones their children study.

³ A teacher's classroom list, classroom activity, attendance writes, and assignments and
events are limited to the classrooms they are assigned to. Teachers cannot create a
school-wide assignment or event: the API answers `Classroom is required for teachers`
(403).

⁴ A teacher reads the students (and their guardians, enrollments, attendance, grades,
averages and reports) of the classrooms they teach. Another student is a 403, whether or
not it exists.

⁵ A parent reads only the students linked to their account (`guardian_user_links`), and
those students' records and payments.

⁶ A teacher writes grades only for enrollments in their classrooms and for materias
assigned to them.

⁷ Parents see the assignments and events of their children's classrooms, plus
school-wide items.

## What this means in practice

- **The administration** manages people and structure: the school profile, teachers and
  their classrooms, materias, students, guardians, classrooms, academic periods, payments,
  extensions and flags. It reads everything, including the activity of every classroom
  and the history of every report export.
- **A teacher** writes the academic records of their own classrooms (attendance, grades)
  and publishes classroom work and events, but cannot change the roster or the calendar.
- **A parent** has read-only access to their own children. The only writes a parent can
  make are sending a message and marking their own messages and notifications as read.

## Scope caveats you should know

- Enrollment writes are role-gated, not roster-gated: a teacher token can create or edit an
  enrollment for any student. The web app only offers the teacher's own rosters.
- By design, a teacher's `PATCH /assignments/:id` must name one of their classrooms
  (`classroomId`); without it the update is treated as school-wide and refused (403).

## What is not available yet

There is no permission editor and no invitation flow. Teacher accounts are created from the
admin console (or `POST /teachers`); other accounts come from the seed or
`npm run user:create`. A guardian is linked to a parent account through
`guardian_user_links`, populated by the seed only.
