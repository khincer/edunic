---
title: Messages and notifications
sidebar_label: Messages and notifications
---

# Messages and notifications

## Goal

Read and send messages, and clear notifications from your inbox.

## Prerequisites

- Signed in at `/teachers/login`.
- To send: the recipient's **user UUID**, not their email. The recipient must hold a role in
  the same institution.

## In the app

### Read your inbox

1. Open `/teachers` and select **Messages**.
2. **Recent grades** lists your latest five grade submissions.
3. **School signals** lists notifications. Select **Mark read** to mark one read; the button
   becomes **Read**.
4. **Inbox** lists messages where you are sender or recipient. Select **Mark read** on an
   unread message.

### Send a message

1. Select **Publish work** in the sidebar.
2. In **Message** (titled **Family/admin thread**), fill **Recipient user ID**,
   **Subject**, and **Message**.
3. Select **Send message**. The page shows `Message sent.`

There is no recipient directory in the app, so you need the user id from an administrator.

## Through the API

List messages:

```bash
curl "http://localhost:3000/messages?limit=25" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

Send a message:

```bash
curl -X POST "http://localhost:3000/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientUserId": "70000000-0000-0000-0000-000000000003",
    "subject": "Weekly progress",
    "body": "John finished the fractions practice set."
  }'
```

Mark a message read:

```bash
curl -X PATCH "http://localhost:3000/messages/$MESSAGE_ID/read" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

List notifications, optionally unread only:

```bash
curl "http://localhost:3000/notifications?unreadOnly=true&limit=25" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

Mark a notification read:

```bash
curl -X PATCH "http://localhost:3000/notifications/$NOTIFICATION_ID/read" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

Required body fields:

| Call | Body |
|------|------|
| `POST /messages` | `recipientUserId` (UUID), `subject` (1–160), `body` (1–2000) |
| `PATCH /messages/:messageId/read` | none |
| `PATCH /notifications/:notificationId/read` | none |

Message and notification lists return only records that involve you: messages where you are
sender or recipient, notifications addressed to your role, classroom, or user.

## Expected result

```json
{
  "data": {
    "id": "<message uuid>",
    "institutionId": "<uuid>",
    "threadId": "<thread uuid>",
    "senderUserId": "<your uuid>",
    "recipientUserId": "<recipient uuid>",
    "subject": "Weekly progress",
    "body": "John finished the fractions practice set.",
    "readAt": null,
    "createdAt": "2026-10-18T12:00:00.000Z"
  }
}
```

Marking read returns the updated record with `readAt` set.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|---------|
| 400 | `VALIDATION_ERROR` | Zod message for `body` or `subject` | Empty or too long |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Role cannot access the route |
| 404 | `NOT_FOUND` | `Message recipient not found` | The user has no role in this institution |
| 404 | `NOT_FOUND` | `Message not found` / `Notification not found` | Wrong UUID, or it belongs to another user |

## What is not available yet

- No user directory or autocomplete; you must paste a UUID.
- No attachments, replies within a thread, or group messages. Every send creates a new
  thread.
- No notification preferences or muting.
