---
title: Messages
sidebar_label: Messages
---

# Messages

## Goal

Read messages from the school and send a note to a staff member.

## Prerequisites

- Signed in at `/parents/login`.
- To send a message, the recipient's **user UUID**. The recipient must hold a role in the
  same institution. The portal has no directory, so ask the school for the id.

## In the app

### Read messages

1. Open `/parents`.
2. In **Calendar and inbox**, each message shows its subject and body.
3. Select **Mark read** on an unread row; the button becomes **Read** and the unread counter
   decreases.
4. The **Messages** metric card shows how many unread messages you have.

### Send a family note

1. Open `/parents`.
2. In **Send a family note**, fill **Recipient user ID**, **Subject**, and **Message**.
3. Select **Send message**. The page shows `Message sent.` and clears the body.

## Through the API

List your threads:

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
    "recipientUserId": "70000000-0000-0000-0000-000000000002",
    "subject": "Question about attendance",
    "body": "John was marked late on Monday; he arrived at 07:55."
  }'
```

Mark a message read:

```bash
curl -X PATCH "http://localhost:3000/messages/$MESSAGE_ID/read" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Institution-Id: $INSTITUTION_ID"
```

Required body fields: `recipientUserId` (UUID), `subject` (1–160), `body` (1–2000).

The list returns only messages where you are the sender or the recipient.

## Expected result

```json
{
  "data": {
    "id": "<message uuid>",
    "institutionId": "<uuid>",
    "threadId": "<thread uuid>",
    "senderUserId": "<your uuid>",
    "recipientUserId": "<recipient uuid>",
    "subject": "Question about attendance",
    "body": "John was marked late on Monday; he arrived at 07:55.",
    "readAt": null,
    "createdAt": "2026-10-18T12:00:00.000Z"
  }
}
```

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | Zod message for `subject` or `body` | Empty or over the length limit |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Role mismatch |
| 404 | `NOT_FOUND` | `Message recipient not found` | The user has no role in this institution |
| 404 | `NOT_FOUND` | `Message not found` | Wrong UUID, or the message is not yours |

## What is not available yet

- No recipient directory, autocomplete, or "message the teacher" shortcut.
- No attachments, and no reply inside an existing thread: each send creates a new thread.
- No delete or archive. You can only mark messages read.
