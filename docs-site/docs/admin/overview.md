---
title: Admin overview
sidebar_label: Overview
---

# Admin overview

## Goal

Understand what the admin workspace shows, where each page lives, and what is scoped to
the signed-in institution.

## Prerequisites

- You are signed in at `/admin/login` with an `admin` role. If you are not, the shell
  redirects to `/admin/login`.
- You know which school you are operating on. The dashboard title is the institution name
  from your token.

## The shell

Every admin page uses the same shell:

- **Sidebar — Workspace**: Dashboard, Institutions.
- **Sidebar — Roadmap**: Students, Enrollments, Academic periods, Grades, Attendance,
  Workflows, Reports.
- **Top bar**: a search box that jumps to `/admin/institutions?search=...`, the signed-in
  email with the role, and **Sign out**.

The URL `/admin/academic-records` also exists and is reachable by typing it, but it is not
linked from the sidebar. It shows three counts (periods, grades, attendance) and the
latest grade and attendance rows.

## What the dashboard shows

At `/admin/dashboard`:

| Block | Contents |
|-------|----------|
| Students | Total students, plus active enrollments and classroom count |
| Today attendance | Number of marks recorded today, split into present, late, absent |
| Grade progress | Submitted versus total active enrollments, as a percentage |
| Assignments / Events / Messages | Upcoming assignment count, upcoming event count, unread message count |
| Upcoming work | Assignments and exams with classroom and due date |
| Calendar | Upcoming school events |
| Modules | Effective feature flags and extensions with Active/Off state |
| Academic period | Active period label and dates, guardian, parent, and teacher counts |
| Notifications | Recent notifications with a **Mark read** button |
| Audit trail | Recent create/update/delete entries |
| Messages | Recent inbox items |
| Reports | Recent report history, with **Open reports** |

Header buttons **Institutions** and **New school** go to the institutions pages.

## Institution context

The API derives the institution from your token, not from the page. The web app also sends
`X-Institution-Id` on most calls; if that header disagrees with the token, the API returns
403 `Authenticated institution does not match x-institution-id`. Keep both values equal.

## In the app

1. Sign in at `/admin/login`.
2. You land on `/admin/dashboard`.
3. Use the sidebar to open the task you need. Each page is documented in this guide.
4. Use **Sign out** in the top bar to clear the local session.

## Through the API

```bash
curl "http://localhost:3000/dashboard/admin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

## Expected result

```json
{
  "data": {
    "institution": { "id": "<uuid>", "name": "Central School" },
    "activePeriod": {
      "id": "<uuid>",
      "year": 2026,
      "term": 1,
      "startDate": "2026-02-01T00:00:00.000Z",
      "endDate": "2026-05-31T00:00:00.000Z",
      "label": "2026 Term 1"
    },
    "counts": {
      "students": 3,
      "teachers": 1,
      "parents": 1,
      "guardians": 2,
      "activeEnrollments": 3,
      "classrooms": 3
    },
    "attendanceToday": { "present": 2, "late": 0, "absent": 1, "marked": 3 },
    "gradeSubmission": { "submitted": 3, "total": 3, "percent": 100 },
    "modules": [],
    "recentNotifications": [],
    "recentAuditActivity": [],
    "upcomingAssignments": [],
    "upcomingEvents": [],
    "unreadMessages": 0,
    "recentMessages": [],
    "reportHistory": []
  }
}
```

Counts and dates vary with your data.

## If it fails

| Status | Code | Cause |
|--------|------|-------|
| 401 | `UNAUTHORIZED` | Missing, invalid, or expired token; sign in again |
| 403 | `FORBIDDEN` | The account role is not `admin` |
| 404 | `NOT_FOUND` | `Institution not found` — the token's institution no longer exists |

## What is not available yet

There is no admin settings page, no user or role management page, no classrooms page, and
no guardians page. Classrooms and guardians are API-only. Custom fields and the academic
averages endpoint are also API-only.
