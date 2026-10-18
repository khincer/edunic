---
title: Attendance
sidebar_label: Attendance
---

# Attendance

## Goal

Record a daily attendance mark for an enrollment and correct marks when needed.

## Prerequisites

- `admin` or `teacher` role to write; all three roles can read.
- An existing enrollment UUID. Attendance is attached to the enrollment, not directly to
  the student.
- The date, as `YYYY-MM-DD` or an ISO datetime.

## In the app

1. Open `/admin/attendance`. The page title is **Daily attendance marks**.
2. To filter, select **all**, **present**, **late**, or **absent** in the **Status** card.
3. To create a mark, use **New mark**:
   - **Enrollment ID** — paste the enrollment UUID,
   - **Date** — defaults to today,
   - **Status** — `present`, `late`, or `absent`.
4. Select **Mark attendance**.
5. The **Records** list shows the status, the enrollment id, and the date. It loads up to
   50 marks, newest date first.

The page does not show student names, and it has no edit or delete controls.

## Through the API

Create a mark:

```bash
curl -X POST "http://localhost:3000/attendance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "enrollmentId": "40000000-0000-0000-0000-000000000001",
    "date": "2026-10-18",
    "status": "present"
  }'
```

Correct a mark:

```bash
curl -X PATCH "http://localhost:3000/attendance/$ATTENDANCE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  -H "Content-Type: application/json" \
  -d '{ "status": "late" }'
```

List one day for one enrollment:

```bash
curl "http://localhost:3000/attendance?enrollmentId=$ENROLLMENT_ID&date=2026-10-18&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

Delete a mark:

```bash
curl -X DELETE "http://localhost:3000/attendance/$ATTENDANCE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

Required body fields:

| Call | Body |
|------|------|
| `POST /attendance` | `enrollmentId` (UUID), `date`, `status` (`present`, `absent`, `late`) |
| `PATCH /attendance/:attendanceId` | At least one of `date`, `status` |

## Expected result

```json
{
  "data": {
    "id": "<attendance uuid>",
    "institutionId": "<uuid>",
    "enrollmentId": "<uuid>",
    "date": "2026-10-18T00:00:00.000Z",
    "status": "present",
    "createdAt": "2026-10-18T12:00:00.000Z"
  }
}
```

Create returns `201`; list returns `data` plus pagination fields.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | `Expected format YYYY-MM-DD or ISO datetime` | Bad date |
| 400 | `VALIDATION_ERROR` | `Invalid enum value` | Status is not present, absent, or late |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Parent tried to write |
| 404 | `NOT_FOUND` | `Enrollment not found` | Wrong enrollment UUID or wrong institution |
| 404 | `NOT_FOUND` | `Attendance record not found` | Wrong mark UUID |
| 500 | `INTERNAL_ERROR` | `Internal Server Error` | A second mark for the same enrollment and date hits the unique constraint; update the existing mark instead |

:::note
The database enforces one attendance row per enrollment and date. There is no friendly
409 for that case — the unique violation is not mapped by the attendance service, so it
surfaces as a 500. Always list the day first and PATCH an existing mark.
:::

## What is not available yet

- No bulk "mark whole roster" page for admins. The teacher roster does batch-create marks
  for its own classroom.
- No attendance reasons, notes, half-days, or excused/unexcused distinction.
- No edit or delete controls in the admin page.
