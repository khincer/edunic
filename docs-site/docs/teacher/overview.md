---
title: Teacher overview
sidebar_label: Overview
---

# Teacher overview

## Goal

Understand the teacher workspace, how to reach each section, and what is limited to your
assigned classrooms.

## Prerequisites

- A `teacher` account, or an `admin` account using the teacher workspace.
- Sign in at `/teachers/login`. The login page accepts `teacher` and `admin`; a `parent`
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
- `GET /enrollments` is filtered the same way for a teacher token.
- Assignment and event lists show items for your assigned classrooms plus school-wide
  items.
- Messages show only threads where you are the sender or recipient.

Teacher **writes** are role-gated, not roster-gated. The API accepts an attendance mark or
grade for any enrollment id in the institution. The app only offers your roster, but do not
treat a teacher token as row-level security.

## In the app

1. Sign in at `/teachers/login`.
2. You land on `/teachers` in the **Overview** section.
3. Use the sidebar to switch to **Roster**, **Messages**, **Events**, or **Publish work**.
4. Use **Sign out** when finished.

## Through the API

```bash
curl "http://localhost:3000/dashboard/teacher" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
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

An `admin` token can call this endpoint too; in that case the data is not filtered to a
teacher's assignments.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | A parent token called the teacher dashboard |
| 404 | `NOT_FOUND` | `Institution not found` | The token's institution no longer exists |

## What is not available yet

- No separate teacher routes: everything is sections inside `/teachers`.
- No class management, timetable, lesson plans, or assignment submissions.
- Teachers cannot create school-wide assignments or events; a classroom is required.
- No teacher-facing reports page, although the reports API accepts a teacher token.
