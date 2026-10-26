---
title: Academic periods
sidebar_label: Academic periods
---

# Academic periods

## Goal

Create the school terms that enrollments, grades, and reports hang off.

## Prerequisites

- An administration role (teachers and parents can read periods, but only the
  administration can change them).
- A year between 2000 and 2100 and a term between 1 and 4.

## In the app

1. Open `/admin/academic-periods`. The page title is **School calendar terms**.
2. In **New period**, fill:
   - **Year** — for example `2026`,
   - **Term** — `1` to `4`,
   - **Start date** — optional date picker,
   - **End date** — optional date picker.
3. Select **Create period**. The right-hand list refreshes.
4. The list is sorted by year descending and shows `YYYY Term N` with the date range. A
   period with no dates shows `No start` and `No end`.
5. Select **Refresh** to reload the list.

The page has no edit or delete controls. Use the API for those operations.

## Through the API

Create:

```bash
curl -X POST "http://localhost:3000/academic-periods" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2026,
    "term": 1,
    "startDate": "2026-02-01",
    "endDate": "2026-05-31"
  }'
```

List:

```bash
curl "http://localhost:3000/academic-periods?year=2026&limit=50&sortBy=year&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN"
```

Update or clear dates:

```bash
curl -X PATCH "http://localhost:3000/academic-periods/$PERIOD_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "startDate": "2026-02-03", "endDate": null }'
```

Delete:

```bash
curl -X DELETE "http://localhost:3000/academic-periods/$PERIOD_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Required body fields:

| Call | Body |
|------|------|
| `POST /academic-periods` | `year` (int 2000–2100), `term` (int 1–4); `startDate` and `endDate` optional |
| `PATCH /academic-periods/:academicPeriodId` | At least one of `year`, `term`, `startDate`, `endDate`; dates accept `null` to clear |
| `DELETE` | none |

Dates accept `YYYY-MM-DD` or an ISO datetime such as `2026-02-01T00:00:00Z`. An empty
string is treated as "not provided" on create, which lets an HTML date input submit
untouched.

## Expected result

```json
{
  "data": {
    "id": "<uuid>",
    "year": 2026,
    "term": 1,
    "startDate": "2026-02-01T00:00:00.000Z",
    "endDate": "2026-05-31T00:00:00.000Z",
    "createdAt": "2026-10-18T12:00:00.000Z"
  }
}
```

Create returns `201`; list returns `{ "data": [ ... ], "hasMore": false, "nextCursor": ..., "meta": ... }`.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | `Start date must be before or equal to end date` | Inverted range |
| 400 | `VALIDATION_ERROR` | `Expected format YYYY-MM-DD or ISO datetime` | Bad date string |
| 400 | `VALIDATION_ERROR` | `At least one field must be provided` | Empty PATCH body |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Teacher or parent tried to write |
| 404 | `NOT_FOUND` | `Academic period not found` | Wrong UUID |
| 409 | `CONFLICT` | `Academic period already exists for this year and term` | One period per year and term |
| 409 | `CONFLICT` | `Academic period cannot be deleted while enrollments exist` | Remove or move the enrollments first |

## What is not available yet

- No edit or delete control in the web app.
- There is no "set active" control. The dashboard picks the period whose date range
  contains today; if none does, it falls back to the newest year and term. Periods with no
  end date count as open-ended for that comparison.
- No term rollover or copy-forward.
