---
title: Audit logs
sidebar_label: Audit logs
---

# Audit logs

## Goal

Read the school's create, update, and delete trail.

## Prerequisites

- An administration role (`director`, `vice_director` or `subdirector`).

## What gets recorded

The API writes an audit row after every successful (`2xx`/`3xx`) `POST`, `PATCH`, or
`DELETE` request made by an authenticated user. Login, docs, and health paths are excluded.
Each row stores:

- `action` — `create`, `update`, or `delete` (derived from the HTTP method),
- `entity` — the first route segment, for example `students`, `grades`, `enrollments`;
  student–guardian links are recorded as `student_guardians`,
- `entityId` — the most specific id in the route, or the `data.id` from the response,
- `userId` — who made the request,
- `before` — always `null` in the current build,
- `after` — route, method, params, request body, and the response payload,
- `createdAt`.

## In the app

1. Open `/admin/settings` (**School** in the console navigation).
2. Select **Audit logs**. The URL is `/admin/settings/audit-logs`.
3. The table shows **Action**, **Entity** (with entity id), **User** (or `System` when
   `userId` is null), and **Created**.
4. Use **Previous** and **Next**. The page size is 10 and the footer shows
   `Showing N of M audit entries`.

There are no filters and no export on this page.

## Through the API

```bash
curl "http://localhost:3000/audit-logs?limit=10&offset=0&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN"
```

Filter by entity, action, or user:

```bash
curl "http://localhost:3000/audit-logs?entity=enrollments&action=create&userId=$USER_ID&limit=25" \
  -H "Authorization: Bearer $TOKEN"
```

Query parameters:

| Parameter | Values |
|-----------|--------|
| `entity` | Any entity string, max 100 |
| `action` | `create`, `update`, `delete` |
| `userId` | UUID |
| `sortOrder` | `asc`, `desc` (default `desc`) |
| `limit` | 1–100 (default 25) |
| `offset` | 0 or more (legacy mode) |
| `cursor` | Cursor from a previous response; `start` for the first page |

## Expected result

```json
{
  "data": [
    {
      "id": "<uuid>",
      "userId": "<uuid>",
      "action": "create",
      "entity": "grades",
      "entityId": "<grade uuid>",
      "before": null,
      "after": {
        "route": "/grades",
        "method": "POST",
        "params": {},
        "body": { "enrollmentId": "<uuid>", "subject": "Mathematics", "score": 90 },
        "response": { "data": { "id": "<grade uuid>" } }
      },
      "createdAt": "2026-10-18T12:00:00.000Z"
    }
  ],
  "hasMore": false,
  "meta": { "total": 1, "limit": 10, "offset": 0 }
}
```

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | Zod message for `action`, `userId`, or `limit` | Invalid filter value |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Teacher or parent |
| 500 | `INTERNAL_ERROR` | `Internal Server Error` | Audit persistence failure is logged server-side; reads should still work |

## What is not available yet

- Read-only: there is no endpoint to edit or delete an audit row.
- No `before` snapshot, so the trail shows the new state but not the previous one.
- No filter controls, CSV export, or retention policy in the app.
- Failed requests are not audited; only successful mutations are.
