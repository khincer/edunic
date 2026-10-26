---
title: Grades
sidebar_label: Grades
---

# Grades

## Goal

Submit a grade for an enrollment and correct a grade when needed.

## Prerequisites

- An administration or `teacher` role to write; every role can read (teachers and parents
  only their own students).
- An existing enrollment UUID.
- A subject name (1–120 characters) and an integer score from 0 to 100.

## In the app

1. Open `/admin/grades`. The page title is **Grade submissions**.
2. In **Subject lookup**, enter a subject and select **Search** to filter the list.
3. To submit a grade, use **New grade**:
   - **Enrollment ID** — paste the enrollment UUID,
   - **Subject** — for example `Mathematics`,
   - **Score** — an integer from 0 to 100.
4. Select **Submit grade**. The subject field clears and the list reloads.
5. The **Records** list shows the score, subject, enrollment id, and submission time,
   newest first, up to 50 rows.

There is no edit or delete control in the page. Several grades can share the same subject
and enrollment; each row is a separate score.

## Through the API

Create a grade:

```bash
curl -X POST "http://localhost:3000/grades" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enrollmentId": "40000000-0000-0000-0000-000000000001",
    "subject": "Mathematics",
    "score": 90
  }'
```

Correct a grade:

```bash
curl -X PATCH "http://localhost:3000/grades/$GRADE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "score": 95 }'
```

Filter by subject:

```bash
curl "http://localhost:3000/grades?subject=Mathematics&limit=50&sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN"
```

Delete a grade:

```bash
curl -X DELETE "http://localhost:3000/grades/$GRADE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Required body fields:

| Call | Body |
|------|------|
| `POST /grades` | `enrollmentId` (UUID), `subject` (1–120), `score` (integer 0–100) |
| `PATCH /grades/:gradeId` | At least one of `subject`, `score` |

Numeric strings are coerced, so `"score": "90"` is accepted.

## Expected result

```json
{
  "data": {
    "id": "<grade uuid>",
    "enrollmentId": "<uuid>",
    "subject": "Mathematics",
    "score": 90,
    "createdAt": "2026-10-18T12:00:00.000Z"
  }
}
```

Create returns `201`. Submitting a grade publishes an event that feeds notifications.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | `Score must be an integer` / `Score must be at least 0` / `Score must be 100 or less` | Invalid score |
| 400 | `VALIDATION_ERROR` | `Subject is required` / `Subject must be 120 characters or less` | Invalid subject |
| 400 | `VALIDATION_ERROR` | `At least one field must be provided` | Empty PATCH |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Parent tried to write |
| 404 | `NOT_FOUND` | `Enrollment not found` | Wrong enrollment UUID |
| 404 | `NOT_FOUND` | `Grade not found` | Wrong grade UUID |

## What is not available yet

- No grade categories, weights, rubrics, or term/period field. A grade belongs to the
  enrollment; the period comes from that enrollment.
- No duplicate protection: five grades in the same subject all count toward the average.
- No edit or delete controls in the page, and no bulk grade entry for admins.
