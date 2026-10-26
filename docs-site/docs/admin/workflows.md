---
title: Workflows
sidebar_label: Workflows
---

# Workflows

## Goal

Publish assignments and exams, schedule school events, and send messages from the admin
console.

## Prerequisites

- An administration or `teacher` role to publish assignments and events; all three roles can send
  messages.
- For a classroom-specific item, the classroom UUID. The page loads classrooms itself and
  offers a **School-wide** option.
- For a message, the recipient's **user** UUID (not their email). The recipient must hold a
  role at the school.

## In the app

Open `/admin/workflows`. The page title is **Assignments, calendar, and messaging**.

### Publish an assignment

1. In **Publish work**, fill **Title**.
2. Choose **Type**: `assignment`, `homework`, or `exam`.
3. Choose **Classroom**, or leave **School-wide**.
4. Set **Due date** with the datetime picker (defaults to two days ahead at 09:00).
5. Select **Publish assignment**. The list below reloads and the page shows
   `Assignment published.`

### Mark an assignment reviewed

1. In the **Assignments** list, find the item.
2. Select **Review**. This patches the status to `reviewed`. The button is disabled once the
   item is reviewed.

### Schedule a school event

1. In **Schedule event**, fill **Title** and **Event type** (free text, for example
   `school`).
2. Choose **Classroom** or leave **School-wide**.
3. Set **Starts at**.
4. Select **Schedule event**.

### Send a message

1. In **Send thread**, enter the **Recipient user ID**.
2. Fill **Subject** and **Message**.
3. Select **Send message**. The page shows `Message sent.`
4. In **Inbox**, select **Mark read** on a message to mark it read.

## Through the API

Publish an assignment:

```bash
curl -X POST "http://localhost:3000/assignments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "classroomId": "20000000-0000-0000-0000-000000000001",
    "title": "Fractions practice set",
    "type": "homework",
    "status": "published",
    "dueDate": "2026-10-20T15:00:00.000Z"
  }'
```

Mark it reviewed:

```bash
curl -X PATCH "http://localhost:3000/assignments/$ASSIGNMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "reviewed" }'
```

Schedule an event:

```bash
curl -X POST "http://localhost:3000/school-events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "classroomId": null,
    "title": "Family conference block",
    "eventType": "school",
    "startsAt": "2026-10-21T14:00:00.000Z"
  }'
```

Send a message:

```bash
curl -X POST "http://localhost:3000/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientUserId": "70000000-0000-0000-0000-000000000002",
    "subject": "Grade entry reminder",
    "body": "Please finish term 1 grades by Friday."
  }'
```

Required body fields:

| Call | Body |
|------|------|
| `POST /assignments` | `title` (1–160); optional `classroomId`, `type` (`homework`/`exam`/`assignment`, default `assignment`), `status` (`draft`/`published`/`reviewed`, default `published`), `dueDate` (ISO datetime) |
| `PATCH /assignments/:assignmentId` | At least one field from the same set |
| `POST /school-events` | `title`, `startsAt` (ISO datetime); optional `classroomId` (nullable), `eventType` (default `school`), `endsAt` |
| `POST /messages` | `recipientUserId`, `subject` (1–160), `body` (1–2000) |
| `PATCH /messages/:messageId/read` | none |

## Expected result

```json
{
  "data": {
    "id": "<uuid>",
    "classroomId": "<uuid or null>",
    "title": "Fractions practice set",
    "type": "homework",
    "status": "published",
    "dueDate": "2026-10-20T15:00:00.000Z",
    "createdByUserId": "<uuid>",
    "createdAt": "2026-10-18T12:00:00.000Z",
    "classroomName": "Grade 5 A"
  }
}
```

Creating an assignment also writes a notification for the `admin`, `teacher`, and `parent`
audiences attached to that classroom (or school-wide).

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | Zod messages such as `String must contain at most 160 character(s)` | Field limits |
| 400 | `VALIDATION_ERROR` | `Invalid datetime` | `dueDate` or `startsAt` is not ISO |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `Classroom is required for teachers` | A teacher tried a school-wide assignment or event |
| 403 | `FORBIDDEN` | `Teacher is not assigned to this classroom` | The classroom is not on the teacher's assignments |
| 403 | `FORBIDDEN` | `Parents cannot create assignments` / `Parents cannot create events` / `Parents cannot update assignments` | Parent token on a staff write |
| 404 | `NOT_FOUND` | `Classroom not found` | Wrong classroom UUID |
| 404 | `NOT_FOUND` | `Assignment not found` / `Event not found` / `Message not found` | Wrong UUID |
| 404 | `NOT_FOUND` | `Message recipient not found` | The recipient has no role |

## What is not available yet

- No PATCH or DELETE endpoint for school events; a scheduled event cannot be edited or
  removed through the API.
- No message threads view: the inbox shows each message, and replies create a new thread.
- No attachments, read receipts, or recipient picker. You must paste a user UUID.
- No assignment submissions or grading of assignments; grades are separate records.
