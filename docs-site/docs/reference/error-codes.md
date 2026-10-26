---
title: Error codes
sidebar_label: Error codes
---

# Error codes

## Goal

Recognise every error the API returns and know what to do about it.

## The error body

Errors are returned with their HTTP status and are **not** wrapped in the success envelope:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Score must be an integer",
  "details": {
    "issues": [{ "path": "score", "message": "Score must be an integer", "code": "invalid_type" }]
  },
  "correlationId": "6f1c0b0e-2f0a-4d3a-9a0e-1b2c3d4e5f60"
}
```

| Field | Meaning |
|-------|---------|
| `code` | Stable machine code from the `ErrorCode` enum |
| `message` | Human-readable reason |
| `details` | Present only for errors the API classifies as expected (domain errors), not for internal faults. On validation failures it contains `issues`: an array of `{ path, message, code }` |
| `correlationId` | Request id; quote it when investigating server-side logs |

## Status to code mapping

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Schema or query validation failure; also the fallback code for any unmapped 4xx |
| 401 | `UNAUTHORIZED` | Missing, malformed, or expired token; bad login credentials |
| 403 | `FORBIDDEN` | Authenticated but the role, the student, or the classroom is not allowed |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate, still-referenced record, or an idempotency key in flight |
| 500 | `INTERNAL_ERROR` | Unexpected fault; the message is masked to `Internal Server Error` |
| 503 | `SERVICE_UNAVAILABLE` | Dependency unavailable, for example the database probe |

`IDEMPOTENCY_CONFLICT` shares status 409 with `CONFLICT`. A 429 (login throttling) keeps its
HTTP status but reports the generic 4xx code, because 429 is not part of the stable code set.

## Code reference

### `VALIDATION_ERROR` (400)

| Message pattern | What to do |
|-----------------|------------|
| Zod field messages, for example `Score must be an integer`, `This field is required`, `Invalid uuid`, `Invalid enum value` | Fix the field named in `message`; `message` is the first issue's message and `details.issues` lists every problem |
| `Expected format YYYY-MM-DD or ISO datetime` | Send the date in the documented format |
| `At least one field must be provided` | A PATCH body was empty |
| `Invalid pagination cursor` | Request `cursor=start` or reuse the exact `nextCursor` string |
| `Unsupported filter field: <field>` | Use a whitelisted field for that resource |
| `Unsupported filter operator: <op>` | Use one of `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in` |
| `Invalid sort: <value>` | Use `sort=field:asc` or `sort=field:desc` with a whitelisted field |
| `Too many login attempts. Try again later.` | Login throttling, sent with status 429 |
| `Invalid credentials` (401) | Wrong password, unknown email, or no role |

### `UNAUTHORIZED` (401)

| Message | Cause | Action |
|---------|-------|--------|
| `Authentication is required` | No `Authorization: Bearer` header, or empty token | Sign in and send the token |
| `Invalid token` | Signature or payload invalid | Sign in again; do not retry the same token |
| `Token expired` | Older than 12 hours | Sign in again |

In the web app, any 401 clears the stored session and redirects to your role's login page.

### `FORBIDDEN` (403)

| Message | Cause | Action |
|---------|-------|--------|
| `You do not have permission to perform this action` | Your role is not in the route's allowed list | Use an account with the right role |
| `User role was not found` | The token's user no longer has a role | Ask the administration to restore the account |
| `The student is not in a classroom of this teacher` | A teacher read another teacher's student | Read only your own students |
| `This student is not linked to your account` | A parent read another family's child | Read only your own children |
| `Classroom is required for teachers` | A teacher tried a school-wide assignment or event | Select one of your classrooms |
| `Teacher is not assigned to this classroom` | Publishing for a classroom not on your assignments | Ask an admin to assign you |
| `Parents cannot create assignments` / `cannot create events` / `cannot update assignments` | Parent token on a staff write | Use a staff account |

### `NOT_FOUND` (404)

Messages are resource-specific: `Student not found`, `Guardian not found`,
`Enrollment not found`, `Academic period not found`, `Classroom not found`,
`Grade not found`, `Attendance record not found`, `School profile not found`,
`Assignment not found`, `Event not found`, `Message not found`,
`Notification not found`, `Extension not found`, `Teacher not found`, `Subject not found`,
`Payment not found`,
`Feature flag not found`, `Feature is not available`, `Custom field not found`,
`Message recipient not found`, `Guardian link for this student was not found`.

A 404 usually means the id is wrong or the record was deleted. A teacher or parent asking
for a record outside their scope gets a 403 instead, whether or not it exists.

### `CONFLICT` (409)

| Message | Cause | Action |
|---------|-------|--------|
| `Student is already enrolled in this academic period` | One enrollment per student per period | Edit the existing enrollment |
| `Academic period already exists for this year and term` | One period per year and term | Update the existing period |
| `Classroom already exists for this grade and section` | One classroom per grade and section | Reuse it |
| `Student cannot be deleted while enrollments exist` | Dependent records | Delete the enrollments first |
| `Enrollment cannot be deleted while grades or attendance records exist` | Dependent records | Delete the dependent records first |
| `Academic period cannot be deleted while enrollments exist` | Dependent records | Move the enrollments first |
| `Classroom cannot be deleted while enrollments exist` | Dependent records | Move the enrollments first |
| `Guardian is already linked to this student` | The link exists | Nothing to do |
| `Guardian cannot be deleted while linked to students` | Dependent links | Unlink first |
| `Attendance is already recorded for this enrollment and date` | One mark per enrollment and day | Edit the existing mark |
| `An account with this email already exists` | Duplicate account email | Use the existing account |
| `Extension already exists` | Duplicate extension key | Update the existing extension |

### `IDEMPOTENCY_CONFLICT` (409)

`Idempotency key is already in progress` — the same key is still being processed. Wait and
retry, or use a fresh key.

### `INTERNAL_ERROR` (500) and `SERVICE_UNAVAILABLE` (503)

The message is masked (`Internal Server Error`), and `details` is omitted so internals do not
leak. Capture the `correlationId` and check the API logs. One known 500: creating a second
attendance row for the same enrollment and date violates a unique constraint that is not
mapped to a friendly error.

## If an error is not in this table

1. Read `code` first: it tells you the class of problem.
2. Read `message`: domain errors carry the specific reason.
3. Check `details.issues` for field-level validation output.
4. Quote `correlationId` in your report to support.

## What is not available yet

- No error catalog endpoint; this page mirrors the `ErrorCode` enum and the messages the
  services raise.
- No retry hints or `Retry-After` header, including on the 429 login throttle.
