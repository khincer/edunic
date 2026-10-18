---
title: Enrollments
sidebar_label: Enrollments
---

# Enrollments

## Goal

Enrol a student in an academic period and, at the end of the period, evaluate whether the
student is promoted or retained.

## Prerequisites

- `admin` or `teacher` role to write; all three roles can read.
- The student UUID, the academic period UUID, and optionally the classroom UUID.
- A classroom and period that belong to the same institution.

## In the app

### Review enrollments

1. Open `/admin/enrollments`. The page title is **Enrollment roster**.
2. Use the **active**, **completed**, and **withdrawn** buttons to filter. The selected
   status is highlighted.
3. Each row shows the student's full name, the status, the classroom id (or `unassigned`),
   and the academic period id.
4. The list loads up to 100 rows for the selected status, sorted by student name.

The page is **read-only**. There is no enrol form and no promotion button.

### Enrol a student or evaluate promotion

Use the API calls below. Teachers can perform both, but the teacher UI does not expose
them.

## Through the API

Create an enrollment:

```bash
curl -X POST "http://localhost:3000/enrollments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "30000000-0000-0000-0000-000000000001",
    "academicPeriodId": "10000000-0000-0000-0000-000000000001",
    "classroomId": "20000000-0000-0000-0000-000000000001",
    "status": "active"
  }'
```

Change classroom or status:

```bash
curl -X PATCH "http://localhost:3000/enrollments/$ENROLLMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  -H "Content-Type: application/json" \
  -d '{ "status": "completed" }'
```

Evaluate promotion for the enrollment:

```bash
curl -X POST "http://localhost:3000/enrollments/$ENROLLMENT_ID/promotion" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

List with filters:

```bash
curl "http://localhost:3000/enrollments?academicPeriodId=$PERIOD_ID&status=active&limit=50" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

Required body fields:

| Call | Body |
|------|------|
| `POST /enrollments` | `studentId`, `academicPeriodId`; optional `classroomId`, `status` (`active` default, `withdrawn`, `completed`), `promotionStatus` |
| `PATCH /enrollments/:enrollmentId` | At least one of `classroomId`, `status`, `promotionStatus` |
| `POST /enrollments/:enrollmentId/promotion` | none |

## Expected result

Create returns `201`:

```json
{
  "data": {
    "id": "<enrollment uuid>",
    "institutionId": "<uuid>",
    "studentId": "<uuid>",
    "academicPeriodId": "<uuid>",
    "classroomId": "<uuid or null>",
    "status": "active",
    "promotionStatus": null,
    "createdAt": "2026-10-18T12:00:00.000Z",
    "student": {
      "id": "<uuid>",
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe"
    }
  }
}
```

Promotion returns the evaluation, not a new enrollment:

```json
{
  "data": {
    "enrollmentId": "<uuid>",
    "academicPeriodId": "<uuid>",
    "studentId": "<uuid>",
    "gradeCount": 3,
    "average": 82.33,
    "threshold": 60,
    "promotionStatus": "promoted"
  }
}
```

`promotionStatus` is `pending` when the enrollment has no grades, `promoted` when the
average is at least 60, and `retained` below 60. The value is written back to the
enrollment.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | UUID message, e.g. `Invalid uuid` | Malformed id |
| 400 | `VALIDATION_ERROR` | `At least one field must be provided` | Empty PATCH |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Parent tried to write |
| 404 | `NOT_FOUND` | `Student not found` | Student is not in this institution |
| 404 | `NOT_FOUND` | `Academic period not found` | Period is not in this institution |
| 404 | `NOT_FOUND` | `Classroom not found` | Classroom is not in this institution |
| 404 | `NOT_FOUND` | `Enrollment not found` | Wrong enrollment UUID |
| 409 | `CONFLICT` | `Student is already enrolled in this academic period` | One enrollment per student per period |
| 409 | `CONFLICT` | `Enrollment cannot be deleted while grades or attendance records exist` | Delete the dependent records first |

## What is not available yet

- **Promotion is an evaluation, not a rollover.** `POST /enrollments/:id/promotion` sets
  `promotionStatus`; it does not create an enrollment in the next academic period. Create
  the next period's enrollment yourself.
- No bulk enrolment or CSV import.
- No enrol or promotion controls in the web app.
- No waitlist, transfer, or withdrawal reason.
