---
title: Publish assignments and events
sidebar_label: Assignments and events
---

# Publish assignments and events

## Goal

Publish classroom work and schedule a classroom event.

## Prerequisites

- Signed in at `/teachers/login` as a teacher or admin.
- A classroom **selected in the Roster section**. The publish forms use that selection; they
  do not have their own classroom field.
- You must be assigned to the classroom. Publishing for a classroom you are not assigned to
  returns 403.

## In the app

### Publish work

1. Open `/teachers` and select **Roster**.
2. Choose the **Classroom** you are publishing for.
3. Select **Publish work** in the sidebar.
4. In **Classroom work**, fill **Title**.
5. Choose **Type**: `homework`, `exam`, or `assignment`.
6. Set **Due date** with the datetime picker.
7. Select **Publish work**. The page shows `Classroom work published.`

The item is created with status `published`.

### Schedule a classroom event

1. In the same **Publish work** section, use **Classroom event**.
2. Fill **Title** and **Starts at**.
3. Select **Schedule event**. The page shows `Classroom event scheduled.`

The event is created with `eventType: "classroom"` and the classroom selected in the Roster.

### Review upcoming items

Select **Events** in the sidebar to see the upcoming event list. Assignments and exams also
appear on the **Overview** section under **Upcoming work**.

## Through the API

```bash
curl -X POST "http://localhost:3000/assignments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "classroomId": "<classroom uuid>",
    "title": "Classroom practice set",
    "type": "homework",
    "status": "published",
    "dueDate": "2026-10-20T15:00:00.000Z"
  }'
```

```bash
curl -X POST "http://localhost:3000/school-events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "classroomId": "<classroom uuid>",
    "title": "Classroom review session",
    "eventType": "classroom",
    "startsAt": "2026-10-21T14:00:00.000Z"
  }'
```

Update an assignment's status:

```bash
curl -X PATCH "http://localhost:3000/assignments/$ASSIGNMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  -H "Content-Type: application/json" \
  -d '{ "status": "reviewed" }'
```

Required body fields:

| Call | Body |
|------|------|
| `POST /assignments` | `title`; `classroomId` is optional for admins but required for teachers; optional `type`, `status`, `dueDate` |
| `POST /school-events` | `title`, `startsAt`; `classroomId` optional for admins, required for teachers |
| `PATCH /assignments/:assignmentId` | At least one field; teachers may only use classrooms they are assigned to |

## Expected result

```json
{
  "data": {
    "id": "<uuid>",
    "institutionId": "<uuid>",
    "classroomId": "<uuid>",
    "title": "Classroom practice set",
    "type": "homework",
    "status": "published",
    "dueDate": "2026-10-20T15:00:00.000Z",
    "createdByUserId": "<uuid>",
    "createdAt": "2026-10-18T12:00:00.000Z",
    "classroomName": "Grade 5 A"
  }
}
```

Create returns `201`.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|---------|
| 400 | `VALIDATION_ERROR` | `Invalid datetime` | `dueDate` or `startsAt` is not ISO |
| 400 | `VALIDATION_ERROR` | `String must contain at most 160 character(s)` | Title too long |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `Classroom is required for teachers` | No classroom selected, or a school-wide attempt |
| 403 | `FORBIDDEN` | `Teacher is not assigned to this classroom` | The classroom is not on your assignments |
| 403 | `FORBIDDEN` | `Parents cannot create assignments` / `Parents cannot create events` | Parent token |
| 404 | `NOT_FOUND` | `Classroom not found` | Wrong classroom UUID |

## What is not available yet

- No edit or delete for assignments in the UI. `PATCH` exists for status and fields, but
  there is no `DELETE` endpoint.
- No event editing or deletion endpoint.
- Teachers cannot publish school-wide work; only admins can omit the classroom.
- No attachments, submissions, or assignment-level grading.
