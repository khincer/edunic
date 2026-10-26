---
title: School profile, extensions and flags
sidebar_label: School profile
---

# School profile, extensions and flags

## Goal

Keep the school's name and email sender identity up to date, and switch extensions and
feature flags on or off for the school.

## Prerequisites

- An administration role (`director`, `vice_director` or `subdirector`).

:::note
One deployment serves one school. The school profile is a single configuration row: it
is created by the seed (or the first bootstrap) and can be edited, not created or deleted
from the app.
:::

## In the app

### Review and edit the school

1. Open `/admin/settings` (**School** in the console navigation). It shows the school
   name and when the record was created.
2. Select **Edit**. On `/admin/settings/edit` change **Institution name**, **Sender name**
   or **Reply-to email** and save.

The sender name and reply-to email are used by the email notifications: with no sender
name configured, nothing is sent. A blank field clears the value.

### Extensions

1. From `/admin/settings` select **Extensions** (`/admin/settings/extensions`).
2. Select **Enable** on a registered extension to switch it on for the school. This calls
   `PUT /extensions/:key/config` with `{ "config": {} }`.
3. Select **Disable** to switch it off (`DELETE /extensions/:key/config`).

Registering a new extension is API-only:

```bash
curl -X POST "http://localhost:3000/extensions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "key": "notifications", "name": "Notifications", "enabled": true }'
```

`key` must match `^[a-z0-9_-]+$`.

### Feature flags

1. From `/admin/settings` select **Feature flags** (`/admin/settings/feature-flags`).
2. Select **Enable** or **Disable** on a flag. Flags are global: the value is what the
   whole school sees.

```bash
curl -X PATCH "http://localhost:3000/feature-flags/reports_pdf" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": true }'
```

## Through the API

Read the profile:

```bash
curl "http://localhost:3000/school-profile" \
  -H "Authorization: Bearer $TOKEN"
```

Update it (send at least one field):

```bash
curl -X PATCH "http://localhost:3000/school-profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Colegio Central", "senderName": "Colegio Central", "replyToEmail": "office@central.example.com" }'
```

| Field | Rule |
|-------|------|
| `name` | 1–160 characters |
| `senderName` | up to 160 characters; blank clears it |
| `replyToEmail` | a valid email, up to 255 characters; blank clears it |

## Expected result

Both calls return the profile:

```json
{
  "data": {
    "id": "<uuid>",
    "name": "Colegio Central",
    "senderName": "Colegio Central",
    "replyToEmail": "office@central.example.com",
    "createdAt": "2026-10-18 12:00:00"
  }
}
```

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | `At least one field must be provided` | Empty `PATCH` body |
| 400 | `VALIDATION_ERROR` | `Institution name must be 160 characters or less` / `Reply-to email must be a valid email address` | Invalid field; `details` shows which |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Not an administration role |
| 404 | `NOT_FOUND` | `School profile not found` | The database was never seeded |
| 404 | `NOT_FOUND` | `Extension not found` / `Feature flag not found` | Unknown key |
| 409 | `CONFLICT` | `Extension already exists` | Duplicate extension key |

## What is not available yet

- No school settings beyond the name and the email sender identity (no address, logo,
  grading scale or timezone).
