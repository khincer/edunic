---
title: Attendance
sidebar_label: Attendance
---

# Attendance

## Goal

See how many attendance marks your children have, and how they split between present, late,
and absent.

## Prerequisites

- Signed in at `/parents/login`.
- At least one linked student with attendance records.

## In the app

1. Open `/parents`.
2. The **Attendance** metric card shows the total number of attendance marks across your
   linked children.
3. Each child's card has a snapshot row with four values:
   - **Present** — marks recorded as present,
   - **Late** — marks recorded as late,
   - **Absent** — marks recorded as absent,
   - **Average** — the grade average, not attendance.
4. The cards also show the classroom, the enrollment status, and the term the counts belong
   to.

Attendance is read-only in the portal. There is no way to justify an absence or send a note
from this block; use [Messages](./messages.md) instead.

## Through the API

The dashboard is the canonical source and returns the per-student summary:

```bash
curl "http://localhost:3000/dashboard/parent" \
  -H "Authorization: Bearer $TOKEN"
```

If you know the enrollment id (the dashboard returns it as `enrollmentId`), you can read
that enrollment's marks directly:

```bash
curl "http://localhost:3000/attendance?enrollmentId=$ENROLLMENT_ID&sortBy=date&sortOrder=desc&limit=25" \
  -H "Authorization: Bearer $TOKEN"
```

## Expected result

From the dashboard:

```json
{
  "attendance": {
    "present": 3,
    "late": 1,
    "absent": 0,
    "marked": 4
  }
}
```

From `GET /attendance`:

```json
{
  "data": [
    {
      "id": "<uuid>",
      "enrollmentId": "<uuid>",
      "date": "2026-10-18T00:00:00.000Z",
      "status": "present",
      "createdAt": "2026-10-18T12:00:00.000Z"
    }
  ],
  "hasMore": false,
  "meta": { "total": 1, "limit": 25, "offset": 0 }
}
```

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | Zod message for `enrollmentId` or `limit` | Malformed query |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Role mismatch |
| 403 | `FORBIDDEN` | `This student is not linked to your account` | The record belongs to another family's child |

:::note
`GET /attendance` with a parent token returns only the attendance of your own children.
The card counts in the portal come from `/dashboard/parent`.
:::

## What is not available yet

- No attendance calendar, no per-day detail view, and no monthly percentage.
- No absence justification, note upload, or approval flow.
- Attendance rows cannot be changed by a parent.
