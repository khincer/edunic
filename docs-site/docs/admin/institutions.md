---
title: Institutions
sidebar_label: Institutions
---

# Institutions

## Goal

Create a school record, rename it, and manage what is attached to it: extensions, feature
flags, and the audit trail.

## Prerequisites

- `admin` role.
- For rename and delete: the institution UUID, visible on the detail page.

:::note
Creating an institution does not create an admin account, classrooms, or roles for it. The
new school is an empty tenant. You manage it from your current admin session.
:::

## In the app

### Create an institution

1. Open `/admin/institutions`.
2. Select **New institution** (top right) or **New school** on the dashboard.
3. On `/admin/institutions/new`, enter **Institution name** (1–160 characters).
4. Select **Create institution**.
5. On success the app opens `/admin/institutions/<institutionId>`.

### Find, sort, and page through institutions

1. Open `/admin/institutions`.
2. Type a name into **Search** and select **Apply search**.
3. Use **Sort name** or **Sort created** to toggle ascending and descending order. The
   current direction is shown on the button.
4. Use **Previous** and **Next**. The page size is 10 and the footer shows
   `Showing N of M institutions`.
5. Select **Open** on a row to see the detail page.

### Rename an institution

1. Open `/admin/institutions/<institutionId>`.
2. Select **Rename**.
3. On `/admin/institutions/<institutionId>/edit`, change **Institution name**.
4. Select **Save changes**. You return to the detail page.

### Delete an institution

1. Open the institution detail page.
2. In **Danger zone**, select **Delete institution**.
3. Confirm in the dialog. The API removes the institution only when it has no students,
   classrooms, or enrollments.

### Open the attached operations

From the detail page select **Extensions**, **Feature flags**, or **Audit logs**. These
pages are documented under [Extensions and flags](#extensions-and-feature-flags) below and
in [Audit logs](./audit-logs.md).

## Through the API

All institution endpoints require `admin`.

Create:

```bash
curl -X POST "http://localhost:3000/institutions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Central School" }'
```

Rename:

```bash
curl -X PATCH "http://localhost:3000/institutions/$INSTITUTION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Central School North Campus" }'
```

List (legacy offset mode — note the deprecation header):

```bash
curl -i "http://localhost:3000/institutions?search=central&limit=10&offset=0&sortBy=name&sortOrder=asc" \
  -H "Authorization: Bearer $TOKEN"
```

Delete:

```bash
curl -X DELETE "http://localhost:3000/institutions/$INSTITUTION_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Required fields:

| Call | Body |
|------|------|
| `POST /institutions` | `name` (string, 1–160) |
| `PATCH /institutions/:institutionId` | `name` (required by the schema's refinement) |
| `DELETE /institutions/:institutionId` | none |

## Extensions and feature flags

### Extensions

The extensions page is `/admin/institutions/<institutionId>/extensions`. It lists every
registered extension with a global **Registry** state (available or disabled) and an
institution state (enabled or off).

1. Open the institution detail page and select **Extensions**.
2. Select **Enable** on an available extension to attach it to this school. This calls
   `PUT /institutions/:id/extensions/:key` with `{ "config": {} }`.
3. Select **Disable** to detach it. This calls
   `DELETE /institutions/:id/extensions/:key`.

Registering a new extension is API-only:

```bash
curl -X POST "http://localhost:3000/extensions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "key": "notifications", "name": "Notifications", "enabled": true }'
```

`key` must match `^[a-z0-9_-]+$`.

### Feature flags

The page is `/admin/institutions/<institutionId>/feature-flags`. Each row shows the global
**Default**, the **Effective** value, and the **Source** (`global default` or
`school override`).

1. Open the institution detail page and select **Feature flags**.
2. Select **Enable** or **Disable** to write a school override
   (`PUT /institutions/:id/feature-flags/:featureKey` with `{ "enabled": true|false }`).
3. Select **Reset** to remove the override and fall back to the global default
   (`DELETE /institutions/:id/feature-flags/:featureKey`). **Reset** is disabled when the
   value already comes from the global default.

```bash
curl -X PUT "http://localhost:3000/institutions/$INSTITUTION_ID/feature-flags/reports_module" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": true }'
```

Feature-flag keys must match `^[a-z0-9_]+$`.

## Expected result

Create returns `201`:

```json
{
  "data": {
    "id": "<uuid>",
    "name": "Central School",
    "createdAt": "2026-10-18T12:00:00.000Z"
  }
}
```

List returns `{ "data": [ ... ], "hasMore": true, "nextCursor": "<cursor>", "meta": { "total": 2, "limit": 10, "offset": 0 } }`
in offset mode. Delete returns `{ "data": { "id": "<uuid>", "deleted": true } }`.

## If it fails

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `VALIDATION_ERROR` | `Institution name is required` / `Institution name must be 160 characters or less` | Empty or too long name; `details` shows the field |
| 401 | `UNAUTHORIZED` | `Authentication is required` / `Token expired` | Sign in again |
| 403 | `FORBIDDEN` | `You do not have permission to perform this action` | Not an admin |
| 403 | `FORBIDDEN` | `Institution access denied` | Feature-flag path institution differs from your token |
| 404 | `NOT_FOUND` | `Institution not found` | Wrong UUID, or it was deleted |
| 409 | `CONFLICT` | `Institution cannot be deleted while dependent academic records exist` | The school has students, classrooms, or enrollments |
| 409 | `CONFLICT` | `Extension already exists` | Duplicate extension key |
| 404 | `NOT_FOUND` | `Extension not found` / `Feature flag not found` | Unknown key |

## What is not available yet

- No page or endpoint to add users or roles to an institution.
- No institution settings beyond the name (no address, logo, grading scale, or timezone).
- No bulk delete or archive; delete is permanent once dependencies are gone.
