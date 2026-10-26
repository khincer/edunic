---
title: Teacher overview
sidebar_label: Overview
---

# Teacher overview

## Goal

Understand the teacher workspace, how to reach each section, and what is limited to your
assigned classrooms.

## Prerequisites

- A `teacher` account, or an administration account using the teacher workspace.
- Sign in at `/teachers/login`. The login page accepts `teacher` and the administration roles; a `parent`
  account is rejected there.

## The workspace

The teacher workspace is a single page at `/teachers` with client-side sections. The left
sidebar has two groups:

| Group | Section | Contents |
|-------|---------|----------|
| Workspace | Overview | KPI tiles, attendance summary, classroom readiness, students at risk, upcoming work and events |
| | Roster | Classroom selector, attendance date, per-student attendance and score entry |
| | Messages | Recent grades, notifications, and inbox |
| Publish | Events | Upcoming events list |
| | Publish work | Create classroom work, a classroom event, or a message |

The top bar shows the current section, your email and role, and **Sign out**.

## What the overview shows

- **Attendance pending** — active enrollments in your classrooms without a mark today.
- **Students at risk** — students with low averages or absences; select the tile to stay on
  the overview.
- **Unread messages** and **Upcoming items**.
- Present, late, and absent totals for today.
- **Classroom readiness** — each assigned classroom with roster count and
  `marked/roster` for today.
- **Needs attention** — at-risk students with average and absence count.
- **Assignments and exams** and **Upcoming events**.

## What is scoped to a teacher

- `GET /dashboard/teacher` is filtered through `teacher_classroom_assignments`: only
  classrooms assigned to the signed-in teacher are counted.
- `GET /students`, `GET /enrollments`, `GET /attendance`, `GET /grades`, the averages
  and the reports return only the students of your classrooms; another student is a 403.
- `GET /classrooms/:id/activity` shows the activity of one of your classrooms.
- Assignment and event lists show items for your assigned classrooms plus school-wide
  items.
- Messages show only threads where you are the sender or recipient.

Attendance and grade **writes** are limited to the enrollments of your classrooms, and a
grade must be for a materia assigned to you; anything else is refused with 403.
Enrollment writes are role-gated only: the app offers your roster, but the API accepts any
enrollment.

## In the app

1. Sign in at `/teachers/login`.
2. You land on `/teachers` in the **Overview** section.
3. Use the sidebar to switch to **Roster**, **Messages**, **Events**, or **Publish work**.
4. Use **Sign out** when finished.

## Through the API

```bash
curl "http://localhost:3000/dashboard/teacher" \
  -H "Authorization: Bearer $TOKEN"
```

## Expected result

```json
{
  "data": {
    "classrooms": [
      {
        "id": "<uuid>",
        "name": "Grade 5 A",
        "gradeLevel": 5,
        "section": "A",
        "rosterCount": 12,
        "attendanceMarkedToday": 9
      }
    ],
    "attendanceToday": { "present": 8, "late": 1, "absent": 0, "marked": 9 },
    "pendingAttendance": 3,
    "activeEnrollmentCount": 12,
    "recentGrades": [],
    "studentsAtRisk": [],
    "recentNotifications": [],
    "upcomingAssignments": [],
    "upcomingEvents": [],
    "unreadMessages": 0,
    "recentMessages": []
  }
}
```

An administration token can call this endpoint too; in that case the data is not filtered to a
teacher's assignments.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | A parent token called the teacher dashboard |
| 404 | `NOT_FOUND` | `Institution not found` | The school profile row is missing (the database was never seeded) |

## What is not available yet

- No separate teacher routes: everything is sections inside `/teachers`.
- No class management, timetable, lesson plans, or assignment submissions.
- Teachers cannot create school-wide assignments or events; a classroom is required.
- No teacher-facing reports page, although the reports API accepts a teacher token.
