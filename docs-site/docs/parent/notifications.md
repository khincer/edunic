---
title: Notifications
sidebar_label: Notifications
---

# Notifications

## Goal

Read school updates addressed to you and clear them from the unread list.

## Prerequisites

- Signed in at `/parents/login`.
- Notifications are created by the platform when something happens to your children's
  records: an enrollment, a grade submission, or an attendance mark.

## In the app

1. Open `/parents`.
2. Scroll to **School updates**. Each row shows the title, the message, and whether it is
   `read` or `unread`.
3. Select **Mark read** on an unread row. The button becomes **Read** and the unread counter
   in the metric cards decreases.
4. When there are no notifications, the panel shows `No school updates yet.`

The list shows the most recent notifications for your role, classroom, and user; it is not
a full history browser.

## Through the API

List your notifications:

```bash
curl "http://localhost:3000/notifications?limit=25" \
  -H "Authorization: Bearer $TOKEN"
```

List only unread ones:

```bash
curl "http://localhost:3000/notifications?unreadOnly=true&limit=25" \
  -H "Authorization: Bearer $TOKEN"
```

Mark one read:

```bash
curl -X PATCH "http://localhost:3000/notifications/$NOTIFICATION_ID/read" \
  -H "Authorization: Bearer $TOKEN"
```

Query parameters: `unreadOnly` (boolean, default false), `eventName` (max 100), `cursor`,
`limit` (1–100), `offset`.

## Expected result

```json
{
  "data": [
    {
      "id": "<uuid>",
      "eventName": "grade.submitted",
      "title": "Grade submitted",
      "message": "Mathematics 90",
      "readAt": null,
      "createdAt": "2026-10-18T12:00:00.000Z"
    }
  ],
  "hasMore": false,
  "meta": { "total": 1, "limit": 25, "offset": 0 }
}
```

Marking read returns the updated notification with `readAt` set.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | Zod message for `limit` or `eventName` | Malformed query |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Role mismatch |
| 404 | `NOT_FOUND` | `Notification not found` | Wrong UUID, or the notification belongs to someone else |

## What is not available yet

- No email or push delivery; notifications exist only in the app and the API.
- No preferences, mute, or per-child filter.
- No delete; you can only mark a notification read.
