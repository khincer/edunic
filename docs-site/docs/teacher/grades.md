---
title: Submit grades
sidebar_label: Grades
---

# Submit grades

## Goal

Record one subject score for each student in a classroom.

## Prerequisites

- Signed in at `/teachers/login` as a teacher or admin.
- A classroom with active enrollments.
- A subject name and integer scores from 0 to 100.

## In the app

1. Open `/teachers` and select **Roster**.
2. Choose the **Classroom**.
3. In **Grade subject**, enter the subject for this batch, for example `Mathematics`.
4. In the **Score** column, enter a score for each student you want to grade. Leave a field
   empty to skip that student.
5. Select **Submit grades**.
6. The page reports `Submitted N grades.` and clears the score inputs.

The button is disabled when the roster is empty or the subject is blank. If you submit
without any score, the page says `Enter at least one score before submitting grades.`

## Through the API

```bash
curl -X POST "http://localhost:3000/grades" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "enrollmentId": "<enrollment uuid>",
    "subject": "Mathematics",
    "score": 88
  }'
```

Read the grades you have submitted:

```bash
curl "http://localhost:3000/grades?subject=Mathematics&limit=25" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

Required body fields: `enrollmentId` (UUID), `subject` (1–120 characters), `score`
(integer 0–100). Numeric strings are coerced.

## Expected result

```json
{
  "data": {
    "id": "<grade uuid>",
    "institutionId": "<uuid>",
    "enrollmentId": "<uuid>",
    "subject": "Mathematics",
    "score": 88,
    "createdAt": "2026-10-18T12:00:00.000Z"
  }
}
```

Each successful submission also emits a grade-submitted event, which the notifications
subscriber turns into a notification.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | `Score must be an integer` / `Score must be at least 0` / `Score must be 100 or less` | Invalid score |
| 400 | `VALIDATION_ERROR` | `Subject is required` | Blank subject |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Parent token |
| 404 | `NOT_FOUND` | `Enrollment not found` | Wrong enrollment or another institution |

## What is not available yet

- Submitting does not update a previous score; it creates a new grade row. Both rows count
  toward the average. Use `PATCH /grades/:gradeId` if you need to correct a value.
- No grade categories, weights, or term selector. The term comes from the enrollment.
- No bulk import, draft state, or approval workflow.
