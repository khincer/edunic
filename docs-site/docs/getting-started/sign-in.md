---
title: Sign in
sidebar_label: Sign in
---

# Sign in

## Goal

Obtain a session token for your role and reach your workspace.

## Prerequisites

- A user account that already has a role in the institution you are signing in to.
  Accounts are created by seeding; there is no self-registration.
- The institution UUID. The web app derives it from the host name; API clients must send
  it explicitly.
- The API reachable at `http://localhost:3000` and the web app at
  `http://localhost:3001`.

## How the institution is resolved

Edunic is multi-tenant. The login request always includes an `institutionId`, and the
token is bound to that institution.

| What you open | Institution used |
|---------------|------------------|
| `http://central.localtest.me:3001/...` | Central School (`00000000-0000-0000-0000-000000000001`) |
| `http://north.localtest.me:3001/...` | North School (`00000000-0000-0000-0000-000000000002`) |
| `http://localhost:3001/...` | Central School, with a visible "Using Central School for localhost" banner |

A host that maps to no seeded institution cannot submit the form; the page reports that
the institution could not be resolved from the domain.

## In the app

1. Open the entry point for your role:
   - `http://central.localtest.me:3001/admin/login` for an admin,
   - `http://central.localtest.me:3001/teachers/login` for a teacher or an admin helping
     with classroom work,
   - `http://central.localtest.me:3001/parents/login` for a parent.
2. Confirm the school name shown in the right-hand panel. If it is the wrong school, you
   are on the wrong host.
3. Enter your **Email address**.
4. Enter your **Password** (at least 8 characters). Use **Show** / **Hide** to check it.
5. Select **Sign in**.
6. The app stores the session and redirects: admins to `/admin/dashboard`, teachers to
   `/teachers`, parents to `/parents`.

If the account's role does not match the entry point, the app clears the session and
shows `This login is for <role> role. Your account is marked as <actual role>.` Sign in at
the correct entry point instead.

## Through the API

```bash
curl -X POST "http://localhost:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@central.edu",
    "password": "<password>",
    "institutionId": "00000000-0000-0000-0000-000000000001"
  }'
```

Required body fields, validated by `libs/domain/src/auth/schemas/auth.schemas.ts`:

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Valid email; trimmed and lowercased |
| `password` | string | At least 8 characters |
| `institutionId` | string | UUID of the institution where the account holds a role |

The seeded account emails (`admin@central.edu`, `teacher@central.edu`,
`parent@central.edu`, `admin@north.edu`) are defined in `tools/seed.ts`, together with
their demo passwords. Do not copy credentials into tickets or documentation.

## What a token is

The response token is a signed JWT (HS256) valid for 12 hours. It contains only the user
id (`sub`) and the `institutionId`. The role is **not** trusted from the token: on every
request the API re-reads the user's role for that institution from the database. Removing
a role therefore takes effect immediately, even with an unexpired token.

The web app keeps the session in `localStorage` under the key `edunic-admin-session` and
sends it as `Authorization: Bearer <token>`.

## Expected result

```json
{
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "<uuid>",
      "email": "admin@central.edu",
      "institutionId": "00000000-0000-0000-0000-000000000001",
      "role": "admin"
    }
  }
}
```

Use `$TOKEN` for the token and `$INSTITUTION_ID` for the institution id in later calls:

```bash
export TOKEN='<token from the login response>'
export INSTITUTION_ID='00000000-0000-0000-0000-000000000001'
```

## If it fails

| Status | Code | Message you will see | What to do |
|--------|------|----------------------|------------|
| 400 | `VALIDATION_ERROR` | Zod message, for example `Invalid email` or `Password must be at least 8 characters long`; `details` lists the field issues | Fix the request body |
| 401 | `UNAUTHORIZED` | `Invalid credentials` | Wrong password, unknown email, or the account has no role in that institution |
| 429 | `VALIDATION_ERROR` | `Too many login attempts. Try again later.` | Five failures for the same IP and email lock sign-in for 15 minutes |
| 403 | `FORBIDDEN` | `User role for this institution was not found` | The account exists but has no role row for the institution in the token |
| 403 | `FORBIDDEN` | `Authenticated institution does not match x-institution-id` | Remove the `X-Institution-Id` header or set it to the token's institution |

### What 401 and 403 mean in the web app

- **401** — the token is missing, invalid, or expired (`Token expired`). The app clears the
  stored session and redirects to the matching login page with
  `?reason=session-expired`. Sign in again.
- **403** — you are authenticated but your role cannot perform the action. The app keeps
  the session and shows the API message in an error banner. Do not retry; use an account
  with the right role.

## What is not available yet

- No refresh token and no "remember me": the session simply expires after 12 hours.
- No password reset, account invitation, or profile page.
- No SSO.
