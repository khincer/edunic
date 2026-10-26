---
title: Classroom activity
sidebar_label: Classroom activity
---

# Classroom activity

## Goal

See what every classroom recorded recently (grades, attendance marks, assignments and
classroom events) and spot classrooms that have gone quiet.

## Prerequisites

- An administration role for the school-wide view. Teachers can read the activity of
  their own classrooms through the API.

## In the app

1. Open `/admin/activity` (**Classroom activity** in the console navigation).
2. Pick a **Since** date (the default is 30 days ago) and select **Apply**.
3. **All classrooms** lists every classroom with its teachers, active students and what
   was recorded since the date. **Last activity** is the latest entry ever recorded;
   **Never** marks a classroom with no activity at all.
4. Select **Details** on a classroom to see its totals (grade average, absences, lates,
   assignments, events) and its latest entries, newest first.

School-wide assignments and events (with no classroom) belong to no classroom and are not
counted here.

## Through the API

```bash
# Every classroom (administration only)
curl "http://localhost:3000/classrooms/activity?since=2026-02-01" \
  -H "Authorization: Bearer $TOKEN"

# One classroom (administration, or a teacher of that classroom)
curl "http://localhost:3000/classrooms/$CLASSROOM_ID/activity?since=2026-02-01&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

`since` accepts `YYYY-MM-DD` or an ISO datetime; `limit` (1–100, default 20) caps the
latest entries.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | `Expected format YYYY-MM-DD or ISO datetime` | Bad `since` |
| 403 | `FORBIDDEN` | `Teacher is not assigned to this classroom` | A teacher asked for another classroom |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | A parent, or a teacher asking for every classroom |
| 404 | `NOT_FOUND` | `Classroom not found` | Unknown classroom id (administration) |
