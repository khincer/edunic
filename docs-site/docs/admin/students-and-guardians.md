---
title: Students and guardians
sidebar_label: Students and guardians
---

# Students and guardians

## Goal

Create a student record and connect it to one or more guardians.

## Prerequisites

- An administration role. Teachers and parents can read their own students and
  guardians, but cannot create or change them.
- The student's first and last name. Date of birth is optional.

## In the app

### Find a student

1. Open `/admin/students`. The page title is **Student directory**.
2. In **Find a student**, enter part of a name in **Name** and select **Search**.
3. The **Records** list shows each student's full name, date of birth (or `No birth date`),
   and creation time. It is loaded with a limit of 50, sorted by last name ascending.

### Create a student

1. On `/admin/students`, go to **New student**.
2. Fill **First name** and **Last name** (both required, up to 120 characters).
3. Optionally set **Date of birth** with the date picker.
4. Select **Create student**. The form clears and the list reloads.

There is no edit or delete control on this page, and no guardian section.

### Guardians

The web app has no guardian page. Use the API calls below.

## Through the API

Create a student:

```bash
curl -X POST "http://localhost:3000/students" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "2015-04-12"
  }'
```

Update a student (at least one field):

```bash
curl -X PATCH "http://localhost:3000/students/$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "lastName": "Doe-Smith" }'
```

Create a guardian:

```bash
curl -X POST "http://localhost:3000/guardians" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Maria Doe", "phone": "+505 8888 0000" }'
```

Link the guardian to the student:

```bash
curl -X POST "http://localhost:3000/students/$STUDENT_ID/guardians/$GUARDIAN_ID" \
  -H "Authorization: Bearer $TOKEN"
```

List a student's guardians:

```bash
curl "http://localhost:3000/students/$STUDENT_ID/guardians" \
  -H "Authorization: Bearer $TOKEN"
```

Delete a student:

```bash
curl -X DELETE "http://localhost:3000/students/$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Required body fields:

| Call | Body |
|------|------|
| `POST /students` | `firstName`, `lastName`; `dateOfBirth` optional (`YYYY-MM-DD`) |
| `PATCH /students/:studentId` | At least one of `firstName`, `lastName`, `dateOfBirth` |
| `POST /guardians` | `name` (1–150); `phone` optional (max 50) |
| `PATCH /guardians/:guardianId` | At least one of `name`, `phone` |
| `POST /students/:studentId/guardians/:guardianId` | none |

## Expected result

```json
{
  "data": {
    "id": "<student uuid>",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "dateOfBirth": "2015-04-12T00:00:00.000Z",
    "createdAt": "2026-10-18T12:00:00.000Z"
  }
}
```

The link call returns the linked guardian. Lists return `data` plus `hasMore`,
`nextCursor`, and, in offset mode, `meta`.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | `This field is required` | Empty first or last name |
| 400 | `VALIDATION_ERROR` | `Expected format YYYY-MM-DD` | Bad date of birth |
| 400 | `VALIDATION_ERROR` | `At least one field must be provided` | Empty PATCH |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Teacher or parent tried to write |
| 404 | `NOT_FOUND` | `Student not found` / `Guardian not found` | Wrong UUID |
| 409 | `CONFLICT` | `Student cannot be deleted while enrollments exist` | Remove the enrollments first |
| 409 | `CONFLICT` | `Guardian is already linked to this student` | The link already exists |
| 409 | `CONFLICT` | `Guardian cannot be deleted while linked to students` | Unlink the guardian first |
| 404 | `NOT_FOUND` | `Guardian link for this student was not found` | Nothing to unlink |

## What is not available yet

- No guardian page, edit form, or delete button in the web app.
- No endpoint to edit or delete an individual student–guardian link; only link and unlink.
- **No endpoint links a guardian record to a parent user account.** The parent portal reads
  `guardian_user_links`, which is created by the seed only. Creating a guardian does not
  give that person a login or make the student appear in a parent portal.
- No student photo, address, document, or enrollment status on the student record.
