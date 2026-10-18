---
title: Grades and reports
sidebar_label: Grades and reports
---

# Grades and reports

## Goal

Check a child's average and recent scores, and download the academic summary PDF.

## Prerequisites

- Signed in at `/parents/login`.
- At least one student linked to your guardian record. Without a link, the portal shows no
  student cards.

## In the app

### See grades

1. Open `/parents`.
2. On each child's card, read **Average** in the snapshot row. It shows `n/a` when there are
   no grades.
3. Below the snapshot, the grade chips list recent scores with their subject.

The cards also show the classroom, enrollment status, and academic term.

### Download the report PDF

1. On a child's card, select **Report PDF**.
2. The button shows **Preparing...** while the file is generated.
3. The browser downloads `student-report-<studentId>.pdf`.

The report year is the child's academic year from the dashboard, falling back to the current
year.

## Through the API

The dashboard supplies all grade data:

```bash
curl "http://localhost:3000/dashboard/parent" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

Read the full summary for one child:

```bash
curl "http://localhost:3000/reports/students/$STUDENT_ID/academic-summary?year=2026" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

Download the PDF using the `reportUrl` from the dashboard:

```bash
curl "http://localhost:3000$REPORT_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  --output student-report.pdf
```

## Expected result

The summary returns the annual average, per-subject averages, per-term averages with
promotion status, and the child's enrollments:

```json
{
  "data": {
    "year": 2026,
    "student": { "id": "<uuid>", "fullName": "John Doe" },
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
      { "enrollmentId": "<uuid>", "academicPeriodId": "<uuid>", "term": 1, "status": "active", "promotionStatus": "promoted" }
    ]
  }
}
```

The full field reference is in [Admin reports](../admin/reports.md). The PDF endpoint returns
`application/pdf`.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | Zod message for `year` | Missing or out-of-range year |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again; the portal redirects to the login page |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Role mismatch |
| 404 | `NOT_FOUND` | `Student not found` | Wrong student UUID or another institution |

## What is not available yet

- No per-subject history view, no progress chart, and no term selector in the portal.
- The parent portal does not filter the reports endpoint to your own children; the API
  admits a parent token for any student in the institution. Use the `reportUrl` the
  dashboard gives you.
- No signed or downloadable archive of past reports. PDFs are generated on demand.
