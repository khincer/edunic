---
title: Reports
sidebar_label: Reports
---

# Reports

## Goal

Read a student's academic summary for a year and download the PDF version.

## Prerequisites

- Any signed-in role. `admin`, `teacher`, and `parent` can read reports.
- The student UUID.
- The report year (2000–2100). The API requires it; the app supplies the active period's
  year, or the current year when there is no active period.

## In the app

1. Open `/admin/reports`. The page title is **Academic summaries**.
2. The **Students** card lists up to 100 students sorted by last name.
3. Select **PDF** next to a student.
4. The browser downloads `student-report-<studentId>-<year>.pdf`.
5. **Generated reports** shows the rows returned in the dashboard's `reportHistory`.

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

Required query parameter: `year` (integer 2000–2100). There is no request body.

## Expected result

The JSON endpoint returns the envelope:

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
    "annualSubjects": [
      { "subject": "Mathematics", "average": 90 },
      { "subject": "Science", "average": 74.67 }
    ],
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

Averages are rounded to two decimals and are `null` when the student has no grades in the
year. The PDF endpoint returns `Content-Type: application/pdf` with
`Content-Disposition: attachment` and the same data rendered as a document.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | Zod message for `year` | Missing year, non-numeric year, or out of range |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Role not in admin, teacher, parent |
| 404 | `NOT_FOUND` | `Student not found` | Wrong student UUID or wrong institution |

## What is not available yet

- **Downloading a PDF does not add a report-history row.** `report_history` is written by
  the seed in the current build; the reports endpoint is read-only. Treat the **Generated
  reports** panel as seeded history, not an audit of downloads.
- No asynchronous generation, no email delivery, and no stored PDF files.
- No institution-wide report, class report, or MINED compliance export.
- The PDF is built on request from the same data the JSON endpoint returns.
