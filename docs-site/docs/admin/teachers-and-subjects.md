---
title: Teachers and subjects
sidebar_label: Teachers and subjects
---

# Teachers and subjects

## Goal

Keep the teacher roster, give each teacher the classrooms they teach, build the catalog of
materias (subjects) and their temas (topics), and decide which grade levels offer which
materias and which teacher is responsible for each.

## Prerequisites

- An administration role (`director`, `vice_director` or `subdirector`).
- At least one classroom (see [Academic periods](./academic-periods.md) and the
  classrooms API) before assigning one.

## In the app

### Teacher roster

1. Open `/admin/teachers` (**Teachers** in the console navigation).
2. Under **New teacher**, enter the **Email** and a **Temporary password** (at least 8
   characters), tick the classrooms the teacher starts with, and select
   **Create teacher**.
3. In **Teachers and their classrooms**, choose a classroom in a teacher's row and select
   **Assign**, or select **×** on a classroom badge to remove it.

A teacher only reads and writes the academic records of the classrooms assigned to them,
so the roster is also their permission list.

### Materias and temas

1. Open `/admin/subjects` (**Subjects**).
2. Under **New materia**, enter a **Name** (and optionally a **Code** and
   **Description**) and select **Create materia**.
3. Under **Topics of a materia**, pick a materia, enter a **New tema** and select
   **Add tema**.
4. In **Catalog**, select **Deactivate** to retire a materia (existing grades keep it) or
   **Activate** to bring it back.

### Who offers and teaches a materia

1. Under **Materias offered**, pick a classroom, choose a materia and select **Add**.
   Select **×** on a badge to stop offering it.
2. Under **Materias a teacher is responsible for**, pick a teacher, choose a materia and
   select **Add**. A teacher can only grade the materias assigned to them.

## Through the API

```bash
# Create a teacher with a first classroom
curl -X POST "http://localhost:3000/teachers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "email": "ana@central.edu", "password": "a-long-password", "classroomIds": ["<classroomId>"] }'

# Assign or remove classrooms
curl -X POST "http://localhost:3000/teachers/$TEACHER_ID/classrooms" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "classroomIds": ["<classroomId>"] }'
curl -X DELETE "http://localhost:3000/teachers/$TEACHER_ID/classrooms/$CLASSROOM_ID" \
  -H "Authorization: Bearer $TOKEN"

# Materias, temas and their links
curl -X POST "http://localhost:3000/subjects" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{ "name": "Mathematics", "code": "MAT" }'
curl -X POST "http://localhost:3000/subjects/$SUBJECT_ID/topics" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{ "name": "Fractions" }'
curl -X POST "http://localhost:3000/subjects/classroom/$CLASSROOM_ID" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{ "subjectIds": ["<subjectId>"] }'
curl -X POST "http://localhost:3000/subjects/teacher/$TEACHER_ID" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{ "subjectIds": ["<subjectId>"] }'
```

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | `Password must be at least 8 characters long` | Short password |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Not an administration role |
| 404 | `NOT_FOUND` | `Teacher not found` / `Classroom not found` / `Subject not found` | Unknown id |
| 404 | `NOT_FOUND` | `The teacher is not assigned to that classroom` | Removing an assignment that does not exist |
| 409 | `CONFLICT` | `An account with this email already exists` | Duplicate email |

## What is not available yet

- No invitation email: share the temporary password with the teacher yourself.
- No page to change a teacher's role; use `PATCH /teachers/:userId/role`.
