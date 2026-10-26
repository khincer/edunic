---
title: Admin overview
sidebar_label: Overview
---

# Admin overview

## Goal

Understand what the admin console shows and where each page lives.

## Prerequisites

- You are signed in at `/admin/login` with an administration role (`director`,
  `vice_director` or `subdirector`). Without a session the console redirects to
  `/admin/login`; a teacher or parent session gets a page that points to their own portal.

## The shell

Every admin page uses the same shell:

- **Sidebar — Workspace**: Dashboard, School, Teachers, Subjects, Payments, Classroom
  activity, Notifications.
- **Sidebar — Roadmap**: Students, Enrollments, Academic periods, Grades, Attendance,
  Workflows, Reports.
- **Top bar**: the current section, the signed-in email with the role, and **Sign out**.

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
| Modules | Feature flags and extensions with Active/Off state |
| Academic period | Active period label and dates, guardian, parent, and teacher counts |
| Notifications | Recent notifications with a **Mark read** button |
| Audit trail | Recent create/update/delete entries |
| Messages | Recent inbox items |
| Reports | Recent report exports, with **Open reports** |

The header button **School** opens the [school profile](./school-profile.md).

## In the app

1. Sign in at `/admin/login`.
2. You land on `/admin/dashboard`.
3. Use the sidebar to open the task you need. Each page is documented in this guide.
4. Use **Sign out** in the top bar to clear the local session.

## Through the API

```bash
curl "http://localhost:3000/dashboard/admin" \
  -H "Authorization: Bearer $TOKEN"
```

## Expected result

```json
{
  "data": {
    "institution": { "id": "<uuid>", "name": "Colegio Central" },
    "activePeriod": {
      "id": "<uuid>",
      "year": 2026,
      "term": 1,
      "startDate": "2026-02-01 00:00:00",
      "endDate": "2026-05-31 00:00:00",
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

`institution` names the school (its configuration row). Counts and dates vary with your
data.

## If it fails

| Status | Code | Cause |
|--------|------|-------|
| 401 | `UNAUTHORIZED` | Missing, invalid, or expired token; sign in again |
| 403 | `FORBIDDEN` | The account is not an administration role |
| 404 | `NOT_FOUND` | `Institution not found` — the school profile row is missing (the database was never seeded) |

## What is not available yet

There is no user or role management page beyond the teacher roster, no classrooms page
and no guardians page. Classrooms and guardians are API-only. Custom fields and the
academic averages endpoint are also API-only.
