---
title: Student reports
sidebar_label: Reports
---

# Student reports

## Goal

Read or download a student's academic summary for a year.

## Prerequisites

- Signed in as a teacher or admin. The API also admits parents on this route.
- The student UUID and the report year (2000–2100).

## In the app

The teacher workspace has **no reports section**. Use the API calls below, or ask an
administrator to download the PDF from `/admin/reports`.

## Through the API

JSON summary:

```bash
curl "http://localhost:3000/reports/students/$STUDENT_ID/academic-summary?year=2026" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

PDF:

```bash
curl "http://localhost:3000/reports/students/$STUDENT_ID/academic-summary/pdf?year=2026" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  --output student-report.pdf
```

`year` is required and must be an integer between 2000 and 2100. There is no body.

## Expected result

```json
{
  "data": {
    "institutionId": "<uuid>",
    "year": 2026,
    "student": {
      "id": "<uuid>",
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe",
      "dateOfBirth": "2015-04-12T00:00:00.000Z"
    },
    "annualAverage": 82.33,
    "annualSubjects": [{ "subject": "Mathematics", "average": 90 }],
    "termAverages": [
      {
        "academicPeriodId": "<uuid>",
        "term": 1,
        "average": 82.33,
        "promotionStatus": "promoted",
        "subjects": [{ "subject": "Mathematics", "average": 90 }]
      }
    ],
    "enrollments": [
      {
        "enrollmentId": "<uuid>",
        "academicPeriodId": "<uuid>",
        "term": 1,
        "status": "active",
        "promotionStatus": "promoted"
      }
    ]
  }
}
```

The full field reference is in [Admin reports](../admin/reports.md).

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | Zod message for `year` | Missing or out-of-range year |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Role not admitted on the route |
| 404 | `NOT_FOUND` | `Student not found` | Wrong student UUID or another institution |

## What is not available yet

- No reports page in the teacher workspace.
- No batch report for a whole classroom.
- A teacher token is not limited to assigned classrooms on this endpoint; any student in the
  institution can be requested.
