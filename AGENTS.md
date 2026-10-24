# 🤖 AGENTS.md — Project Roadmap & Development Guide

## 🧠 Project Overview

This project is a **single-school academic management platform**. One deployment serves exactly one school; there is no tenant dimension. It supports:

- Student management
- Enrollments
- Grades & attendance
- Government compliance (MINED)
- Extension system (modular features)
- Role-based access (director, vice-director, teacher, parent, student)

---

## 🧱 Architecture Principles

### 1. Monorepo (Nx)

- All apps and libs live in one repository
- Shared types and logic via `libs/*`

### 2. Domain-Driven Design (DDD)

- Business logic lives in `libs/domain/*`
- Each domain module is self-contained:
  - `application/` → services
  - `infrastructure/` → repos
  - `presentation/` → routes
  - `schemas/` → validation

### 3. Thin API Layer

- `apps/api` only handles:
  - HTTP
  - Middleware
  - Routing

- No business logic in controllers

### 4. Single School

- One deployment serves exactly one school. There is no tenant dimension.
- New tables and queries MUST NOT add or require `institution_id`.
- The `institutions` table survives only as the single configuration row (school name, sender identity, reply-to). It is not a tenant selector.
- Migration status: the data merge landed in migrations `0009`–`0011`, and `user_roles` already holds one role per user. The code sweep that removes the remaining `institution_id` filters is still in progress. While it runs, do not add new tenant scoping, and remove it in any module you touch.

### 5. Feature Flags

- Incomplete features must be hidden via flags
- Never block merges due to unfinished work

---

## 👥 Roles & Permissions

Five roles. A user holds exactly one role (`user_roles.uniqueUserRole`).

### Director / Administrator

- Manage the teacher roster
- Assign one or more classrooms to each teacher
- Create subjects (materias) and assign them to grades and teachers
- Generate, manage, and export reports
- Create school-wide events
- View activity across all classrooms
- Record student payments (offline payments)

### Vice-Director / Subdirector

Same operational surface as the director unless a spec says otherwise. The
director/vice split is **not yet defined in code**; treat any permission
difference as a product decision, not an assumption.

### Teacher

- Manage their own classrooms
- Record attendance
- Record grades
- Send assignment reports (this notifies parents)
- Create events scoped to their own classroom only (for example, a student's birthday)

### Parent

- Read-only view of their own children: assigned work, pending exams, upcoming payments, activity

### Student

- Record, not necessarily a login. Confirm before giving it authentication.

---

## 🚀 Development Phases

---

# 🥇 Phase 1 — MVP Foundation

### 🎯 Goal:

Core academic system working end-to-end

### ✅ Deliverables:

#### Core Domains

- Students CRUD
- Enrollments system
- Academic periods
- Grades submission
- Attendance tracking

#### Backend

- Fastify API setup
- Drizzle ORM integration
- PostgreSQL schema
- Basic validation (Zod)

#### Infra

- Docker (API + Postgres + Redis)
- Nx workspace configured

---

### 📌 Key Tasks

- [ ] Implement students module
- [ ] Implement enrollments module
- [ ] Implement grades module
- [ ] Implement attendance module
- [ ] Implement academic periods
- [ ] Add DB constraints (unique, checks)
- [ ] Seed initial data
- [ ] Deploy staging environment

---

# 🥈 Phase 2 — Compliance & Reporting

### 🎯 Goal:

Meet academic and government requirements

### ✅ Deliverables:

- Grade averages (bimestral & annual)
- Promotion logic (pass/fail)
- Reporting system (PDF/export)
- Parent access (read-only)
- Teacher dashboards

---

### 📌 Key Tasks

- [ ] Compute academic averages
- [ ] Implement promotion rules
- [ ] Build reporting endpoints
- [ ] Generate PDF reports (worker)
- [ ] Add guardians system
- [ ] Add audit logs
- [ ] Add role-based access control

---

# 🥉 Phase 3 — Extensions System

### 🎯 Goal:

Make system customizable per school

### ✅ Deliverables:

- Event-driven architecture
- Extension registry
- Custom fields system
- Marketplace-ready structure

---

### 📌 Key Tasks

- [ ] Implement event bus (initial: in-memory)
- [ ] Define domain events
- [ ] Build extension registry
- [ ] Implement custom fields
- [ ] Create first extension (notifications)
- [ ] Upgrade event system (Redis Streams)

---

# 🏆 Phase 4 — SaaS Features

### 🎯 Goal:

Commercial-ready platform

### ✅ Deliverables:

- Billing system
- Parent portal
- Notifications system
- Analytics dashboards
- Multi-school management → out of scope; one school per deployment

---

### 📌 Key Tasks

- [ ] Implement billing module
- [ ] Build parent UI
- [ ] Add push/email notifications
- [ ] Build analytics dashboards
- [ ] Add subscription system
- [ ] Launch production

---

## 🔐 Core Rules (Non-Negotiable)

### 🚫 Never:

- Add new `institution_id` scoping or a new tenant dimension
- Put business logic in routes
- Merge unfinished features without flags
- Modify DB manually outside migrations

---

### ✅ Always:

- Use services (`application/`)
- Validate input with Zod
- Use repositories for DB access
- Write migrations for schema changes

---

## 🧩 Feature Flags Strategy

- All new features must be behind flags
- Flags are global. The per-institution dimension is being removed.

Example:

```ts
if (!flags.billing_module) return;
```

---

## 🔄 Event-Driven Design

Domain events should be emitted for:

- Enrollment created
- Grade submitted
- Attendance marked

Used for:

- Notifications
- Extensions
- Analytics

---

## ⚙️ Dev Workflow

### Branching

- `main` → always deployable
- `feature/*` → short-lived
- `hotfix/*` → production fixes
- Never create branches named `code/*`
- Branch names must use Conventional Commits-style prefixes, e.g. `feat/students-crud`, `fix/auth-token-refresh`, `chore/update-deps`

### Flow

1. Create feature branch
2. Implement feature
3. Hide behind feature flag if incomplete
4. Open PR → merge to main

---

## 🧪 Testing Strategy

- Unit tests → services
- Integration tests → API routes
- E2E tests → critical flows

---

## 📦 Future Improvements

- Redis caching layer
- Observability (logs + tracing)
- Load testing

---

## 🧭 Final Vision

This system should evolve into:

> A modular, single-school academic platform, deployed per institution,
> with a clear role hierarchy from leadership to parents.

---

## ⚡ For AI Agents

When working on this repo:

- Prefer modifying existing modules over creating new ones
- Follow domain structure strictly
- Do not bypass service layer
- Do not introduce tenant scoping; one deployment is one school
- Keep code minimal, explicit, and testable
- Agents always have approval to use documented demo credentials for local demo/testing flows.

---

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
