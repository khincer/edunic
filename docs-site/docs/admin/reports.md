---
title: Reports
sidebar_label: Reports
---

# Reports

## Goal

Read a student's academic summary for a year, download it as PDF, export the grades of a
year as CSV, and review the history of every export.

## Prerequisites

- The administration reads and exports every student. Teachers and parents use the same
  endpoints for their own students and children (see
  [Roles and permissions](../getting-started/roles-and-permissions.md)).
- The report year (2000–2100). The API requires it.

## In the app

1. Open `/admin/reports` (**Reports** in the console navigation).
2. Set the **School year**.
3. Under **Academic summaries**, select **PDF** next to a student to download their
   summary for that year.
4. Under **Grades as CSV**, keep **Whole school** and **Every student**, or narrow the
   export to one classroom or one student, and select **Export CSV**.
5. **History** lists every export, newest first: when, which student, which report and
   which year. Use **Older** and **Newer** to page through it.

Every PDF download and every CSV export is recorded in the history (one row per student
included in a CSV). Viewing the JSON summary is not an export and is not recorded.

## Through the API

JSON summary:

```bash
curl "http://localhost:3000/reports/students/$STUDENT_ID/academic-summary?year=2026" \
  -H "Authorization: Bearer $TOKEN"
```

PDF:

```bash
curl "http://localhost:3000/reports/students/$STUDENT_ID/academic-summary/pdf?year=2026" \
  -H "Authorization: Bearer $TOKEN" \
  --output student-report.pdf
```

CSV export (`classroomId` and `studentId` are optional):

```bash
curl "http://localhost:3000/reports/export.csv?year=2026&classroomId=$CLASSROOM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  --output grades-2026.csv
```

The CSV has one row per grade with the columns
`student_id,student_name,grade_level,section,year,term,subject,score`, comma separated
with CRLF line endings. Cells with a comma, a quote or a line break are quoted. A text
cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with a
single quote so a spreadsheet never runs it as a formula.

Export history (administration and teachers; `studentId`, `year`, `limit`, `offset` and
`cursor` are optional):

```bash
curl "http://localhost:3000/reports/history?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

## Expected result

The JSON summary returns:

```json
{
  "data": {
    "year": 2026,
    "student": {
      "id": "<uuid>",
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe",
      "dateOfBirth": "2015-04-12"
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

A history row looks like:

```json
{
  "id": "<uuid>",
  "studentId": "<uuid>",
  "studentName": "John Doe",
  "year": 2026,
  "reportType": "academic_summary_pdf",
  "createdByUserId": "<uuid>",
  "createdAt": "2026-10-18 12:00:00"
}
```

`reportType` is `academic_summary_pdf` for a PDF and `grades_csv` for a CSV export.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | Zod message for `year`, `studentId` or `classroomId` | Missing or invalid query |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `The student is not in a classroom of this teacher` / `This student is not linked to your account` | Outside the caller's students |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | A parent reading the history |
| 404 | `NOT_FOUND` | `Student not found` | Wrong student UUID |

## What is not available yet

- No asynchronous generation, no email delivery, and no stored PDF files: the PDF is built
  on request from the same data the JSON endpoint returns.
- No MINED compliance export format.
