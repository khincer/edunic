---
title: Sign in
sidebar_label: Sign in
---

# Sign in

## Goal

Obtain a session token for your role and reach your workspace.

## Prerequisites

- A user account with a role. Accounts are created by the seed, by
  `npm run user:create`, or (for teachers) from the admin console; there is no
  self-registration.
- The API reachable at `http://localhost:3000` and the web app at
  `http://localhost:3001`.

One deployment serves one school, so there is nothing to choose: you sign in with your
email and password only.

## In the app

1. Open the entry point for your role:
   - `http://localhost:3001/admin/login` for the administration (director, vice director,
     subdirector),
   - `http://localhost:3001/teachers/login` for a teacher (the administration can sign in
     here too, to help with classroom work),
   - `http://localhost:3001/parents/login` for a parent.
2. Enter your **Email address**.
3. Enter your **Password** (at least 8 characters). Use **Show** / **Hide** to check it.
4. Select **Sign in**.
5. The app stores the session and redirects: the administration to `/admin/dashboard`,
   teachers to `/teachers`, parents to `/parents`.

If the account's role does not match the entry point, the app clears the session and
shows `This login is for <role>. Your account is marked as <actual role>.` Sign in at the
correct entry point instead. A teacher or parent who opens an `/admin` page with a valid
session sees **This console is for the school administration** and a link to their own
portal.

## Through the API

```bash
curl -X POST "http://localhost:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@central.edu",
    "password": "<password>"
  }'
```

Required body fields, validated by `libs/domain/src/auth/schemas/auth.schemas.ts`:

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Valid email; trimmed and lowercased |
| `password` | string | At least 8 characters |

The seeded demo accounts, one per role, are `admin@central.edu` (director),
`vicedirector@central.edu` (vice director), `subdirector@central.edu` (subdirector),
`teacher@central.edu` (teacher) and `parent@central.edu` (parent). Their passwords are
defined in `tools/seed.ts`. Do not copy credentials into tickets or documentation.

## What a token is

The response token is a signed JWT (HS256) valid for 12 hours. It contains only the user
id (`sub`). The role is **not** trusted from the token: on every request the API re-reads
the user's role from the database. Changing or removing a role therefore takes effect
immediately, even with an unexpired token.

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
      "role": "director"
    }
  }
}
```

Use `$TOKEN` for the token in later calls:

```bash
export TOKEN='<token from the login response>'
```

## If it fails

| Status | Code | Message you will see | What to do |
|--------|------|----------------------|------------|
| 400 | `VALIDATION_ERROR` | Zod message, for example `Invalid email` or `Password must be at least 8 characters long`; `details` lists the field issues | Fix the request body |
| 401 | `UNAUTHORIZED` | `Invalid credentials` | Wrong password, unknown email, or the account has no role |
| 429 | `VALIDATION_ERROR` | `Too many login attempts. Try again later.` | Five failures for the same IP and email lock sign-in for 15 minutes |
| 403 | `FORBIDDEN` | `User role was not found` | The token's user no longer has a role |

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
