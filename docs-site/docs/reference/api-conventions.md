---
title: API conventions
sidebar_label: API conventions
---

# API conventions

## Goal

Know the request and response shapes that every Edunic endpoint shares, so an integration
written for one module works for the rest.

## Prerequisites

- A token from `POST /auth/login`.
- The API base URL. Local development uses `http://localhost:3000`; the web app gets it from
  `NEXT_PUBLIC_API_URL` and falls back to the same value.

## Request headers

| Header | Required | Notes |
|--------|----------|-------|
| `Authorization: Bearer <token>` | Yes, except on public routes | Login, health, readiness, and docs are public |
| `Content-Type: application/json` | On any request with a body | |
| `Idempotency-Key` | No | See [Idempotency](#idempotency) |

## Success envelope

Successful JSON responses are wrapped once:

```json
{
  "data": { "...": "payload" }
}
```

`meta` is added for lists in offset mode. The `links` field exists in the envelope type but
no endpoint currently populates it.

## List responses

List endpoints return a page object that already carries `data`, so the envelope plugin
leaves it unchanged:

```json
{
  "data": [ "..." ],
  "hasMore": true,
  "nextCursor": "<opaque base64url cursor>",
  "meta": { "total": 42, "limit": 25, "offset": 0 }
}
```

- `hasMore` says whether another page exists.
- `nextCursor` is present only when `hasMore` is true.
- `meta` (`total`, `limit`, `offset`) is present only in legacy offset mode.
- The page is never nested under a `page` key.

## Cursor pagination

Send `cursor` to switch a list endpoint into keyset mode:

```bash
curl "http://localhost:3000/students?cursor=start&limit=25" \
  -H "Authorization: Bearer $TOKEN"
```

- `cursor=start` is the sentinel for the first page in stable keyset order.
- Any other value is the opaque `nextCursor` from the previous response.
- Real cursors are base64url-encoded JSON and never equal `start`.
- A malformed cursor is rejected with 400 `VALIDATION_ERROR` and the message
  `Invalid pagination cursor`.
- Cursor mode ignores `offset`.

## Legacy offset pagination

Omitting `cursor` keeps the older `limit`/`offset` mode and the API flags it:

```
X-Pagination-Deprecated: offset
```

Use `cursor` in new integrations. Offset mode still works and is what the admin
audit and report history pages use today.

## Filtering and sorting

List endpoints accept the uniform filter and sort syntax:

```
filter=field:operator:value     (repeatable)
sort=field:direction
```

Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains` (case-insensitive substring),
`in` (comma-separated list). Example:

```bash
curl "http://localhost:3000/audit-logs?filter=entity:eq:grades&filter=action:in:create,update&sort=createdAt:desc" \
  -H "Authorization: Bearer $TOKEN"
```

Each resource whitelists its filterable and sortable fields. An unknown field or operator is
rejected with 400 `VALIDATION_ERROR` and a message such as
`Unsupported filter field: score` or `Invalid sort: subject:sideways`. Most list endpoints
also accept simpler module-specific parameters (for example `search`, `subject`,
`enrollmentId`, `status`); those are documented per module.

## Idempotency

Send an `Idempotency-Key` header on `POST`, `PATCH`, `PUT`, or `DELETE` to make a retry
safe:

```bash
curl -X POST "http://localhost:3000/grades" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: 8f1c0b0e-2f0a-4d3a-9a0e-1b2c3d4e5f60" \
  -H "Content-Type: application/json" \
  -d '{ "enrollmentId": "<uuid>", "subject": "Mathematics", "score": 90 }'
```

Behaviour:

- The key is scoped to the route and your user id.
- A repeated key with a stored successful response replays it, with the header
  `idempotency-replayed: true`. The replayed status and body are identical.
- A key that is still in flight returns 409 `IDEMPOTENCY_CONFLICT`
  (`Idempotency key is already in progress`).
- Failed attempts release the key, so you can retry with the same value.
- Entries live for 24 hours.
- If the Redis store behind this feature is unavailable, the request runs normally without
  replay protection and the API logs a warning.
- Login, docs, and health paths ignore the header.

## Errors

Errors are **not** wrapped in the success envelope. See
[Error codes](./error-codes.md) for the body shape, the code table, and the status mapping.

## Discoverability

- `GET /docs` serves a Swagger UI page for the same API.
- `GET /docs/json` returns the OpenAPI document.
- Both are public. The document is generated in the API code, so it can lag the code; the
  route files and this guide are the source of truth for guards and bodies.

## What is not available yet

- No versioning prefix: routes live at the root (`/students`, not `/v1/students`).
- No rate-limit headers. Only login is throttled, and it reports that with a 429.
- No `Link` headers; pagination is carried in the body.
- No webhooks or event subscriptions for external consumers.
