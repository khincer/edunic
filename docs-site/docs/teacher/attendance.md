---
title: Take attendance
sidebar_label: Attendance
---

# Take attendance

## Goal

Mark every student in a classroom for one date and correct a mark later the same day.

## Prerequisites

- Signed in at `/teachers/login` as a teacher or admin.
- At least one classroom assigned to you. The roster is the list of active enrollments in
  the selected classroom.
- The attendance date, as `YYYY-MM-DD`.

## In the app

1. Open `/teachers` and select **Roster** in the sidebar.
2. In **Classroom**, choose the classroom. The selector lists institution classrooms; a
   classroom you are not assigned to returns an empty roster.
3. Set **Attendance date**. It defaults to today.
4. For each student, choose `present`, `late`, or `absent` in the attendance toggle. The
   default is `present`.
5. Select **Save attendance**.
6. The page shows `Attendance saved for the selected date.` and reloads the marks.

The save writes one record per student: an existing mark for that enrollment and date is
patched, a missing one is created. If the classroom has no active enrollments, the page
shows `No active enrollments were found for this classroom.`

## Through the API

Read today's mark for one enrollment:

```bash
curl "http://localhost:3000/attendance?enrollmentId=$ENROLLMENT_ID&date=2026-10-18&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

Create a mark when none exists:

```bash
curl -X POST "http://localhost:3000/attendance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "enrollmentId": "<enrollment uuid>",
    "date": "2026-10-18",
    "status": "late"
  }'
```

Correct an existing mark:

```bash
curl -X PATCH "http://localhost:3000/attendance/$ATTENDANCE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  -H "Content-Type: application/json" \
  -d '{ "status": "present" }'
```

Required body fields: `enrollmentId`, `date`, `status` on create; at least one of `date`,
`status` on patch.

## Expected result

```json
{
  "data": {
    "id": "<attendance uuid>",
    "institutionId": "<uuid>",
    "enrollmentId": "<uuid>",
    "date": "2026-10-18T00:00:00.000Z",
    "status": "late",
    "createdAt": "2026-10-18T12:00:00.000Z"
  }
}
```

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | `Expected format YYYY-MM-DD or ISO datetime` | Bad date |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Parent token |
| 404 | `NOT_FOUND` | `Enrollment not found` | The enrollment is from another institution or was deleted |
| 404 | `NOT_FOUND` | `Attendance record not found` | The mark you tried to patch was deleted |
| 500 | `INTERNAL_ERROR` | `Internal Server Error` | Creating a second mark for the same enrollment and date hits the unique constraint; patch the existing mark |

## What is not available yet

- No reasons, notes, half-days, or excused status.
- No bulk API call: the app sends one request per student.
- No historical bulk editing; change marks one at a time.
