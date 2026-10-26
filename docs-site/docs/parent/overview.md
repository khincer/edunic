---
title: Parent overview
sidebar_label: Overview
---

# Parent overview

## Goal

Understand what the parent portal shows and which children appear in it.

## Prerequisites

- A `parent` account. The portal at `/parents/login` accepts only the `parent` role.
- A guardian record linked to your user account. The portal reads `guardian_user_links`
  joined to `student_guardians`; only students connected this way appear.

## The portal

`/parents` is a single page. The top navigation has **Edunic**, links to **Admin** and
**Teachers**, and **Sign out**. The hero shows the signed-in email.

| Block | Contents |
|-------|----------|
| Linked children | Number of students connected through guardian records |
| Grades | Total recent scores across those students |
| Attendance | Total attendance marks recorded |
| Messages | Unread family messages |
| Student cards | One card per child: guardian name, full name, classroom, enrollment status, term, average, attendance counts, recent grade chips, and a **Report PDF** button |
| Upcoming work | Homework and exams for the child's classroom |
| Calendar and inbox | Upcoming events and recent messages with **Mark read** |
| Send a family note | Recipient user id, subject, message, **Send message** |
| School updates | Notifications with **Mark read** |

## What is scoped to a parent

`GET /dashboard/parent` returns only the students linked to the signed-in user, and computes
each child's average, attendance summary, recent grades, and a ready-to-use
`reportUrl` for the PDF.

The same rule holds on every endpoint a parent can call: `GET /students`, `GET /grades`,
`GET /attendance`, the reports, `GET /payments` and the payment receipts return only your
own children's records, and another child is refused with 403. The dashboard also lists
your children's payments and balances.

## In the app

1. Open `http://localhost:3001/parents/login`.
2. Enter your email and password and select **Sign in**.
3. You land on `/parents`.
4. Use **Report PDF** on a child's card to download their academic summary.
5. Use **Sign out** to clear the session.

## Through the API

```bash
curl "http://localhost:3000/dashboard/parent" \
  -H "Authorization: Bearer $TOKEN"
```

## Expected result

```json
{
  "data": {
    "students": [
      {
        "studentId": "<uuid>",
        "fullName": "John Doe",
        "dateOfBirth": "2015-04-12T00:00:00.000Z",
        "guardianName": "Central Family",
        "enrollmentId": "<uuid>",
        "classroomName": "Grade 5 A",
        "enrollmentStatus": "active",
        "academicYear": 2026,
        "academicTerm": 1,
        "average": { "average": 82.33, "gradeCount": 3 },
        "attendance": { "present": 3, "late": 1, "absent": 0, "marked": 4 },
        "recentGrades": [
          {
            "id": "<uuid>",
            "subject": "Mathematics",
            "score": 90,
            "createdAt": "2026-10-18T12:00:00.000Z",
            "studentId": "<uuid>",
            "studentName": "John Doe"
          }
        ],
        "reportUrl": "/reports/students/<uuid>/academic-summary/pdf?year=2026"
      }
    ],
    "recentNotifications": [],
    "upcomingAssignments": [],
    "upcomingEvents": [],
    "unreadMessages": 0,
    "recentMessages": []
  }
}
```

`students` is empty when no guardian link exists for the signed-in user.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | The account is not a parent |
| 404 | `NOT_FOUND` | `Institution not found` | The school profile row is missing (the database was never seeded) |

## What is not available yet

- No profile, password, or contact-details page.
- No per-child detail route: everything is on `/parents`.
- No absence reporting, excuse submission, or appointment booking.
- No user directory, so sending a message requires a user UUID.
