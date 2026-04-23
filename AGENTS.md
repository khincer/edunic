# 🤖 AGENTS.md — Project Roadmap & Development Guide

## 🧠 Project Overview

This project is a **multi-tenant academic management SaaS platform** designed for schools. It supports:

* Student management
* Enrollments
* Grades & attendance
* Government compliance (MINED)
* Extension system (modular features)
* Multi-role access (admin, teacher, parent)

---

## 🧱 Architecture Principles

### 1. Monorepo (Nx)

* All apps and libs live in one repository
* Shared types and logic via `libs/*`

### 2. Domain-Driven Design (DDD)

* Business logic lives in `libs/domain/*`
* Each domain module is self-contained:

  * `application/` → services
  * `infrastructure/` → repos
  * `presentation/` → routes
  * `schemas/` → validation

### 3. Thin API Layer

* `apps/api` only handles:

  * HTTP
  * Middleware
  * Routing
* No business logic in controllers

### 4. Multi-Tenancy First

* Every core table includes `institution_id`
* All queries MUST be scoped by tenant

### 5. Feature Flags

* Incomplete features must be hidden via flags
* Never block merges due to unfinished work

---

## 🚀 Development Phases

---

# 🥇 Phase 1 — MVP Foundation

### 🎯 Goal:

Core academic system working end-to-end

### ✅ Deliverables:

#### Core Domains

* Students CRUD
* Enrollments system
* Academic periods
* Grades submission
* Attendance tracking

#### Backend

* Fastify API setup
* Drizzle ORM integration
* PostgreSQL schema
* Basic validation (Zod)

#### Infra

* Docker (API + Postgres + Redis)
* Nx workspace configured

---

### 📌 Key Tasks

* [ ] Implement students module
* [ ] Implement enrollments module
* [ ] Implement grades module
* [ ] Implement attendance module
* [ ] Implement academic periods
* [ ] Add DB constraints (unique, checks)
* [ ] Seed initial data
* [ ] Deploy staging environment

---

# 🥈 Phase 2 — Compliance & Reporting

### 🎯 Goal:

Meet academic and government requirements

### ✅ Deliverables:

* Grade averages (bimestral & annual)
* Promotion logic (pass/fail)
* Reporting system (PDF/export)
* Parent access (read-only)
* Teacher dashboards

---

### 📌 Key Tasks

* [ ] Compute academic averages
* [ ] Implement promotion rules
* [ ] Build reporting endpoints
* [ ] Generate PDF reports (worker)
* [ ] Add guardians system
* [ ] Add audit logs
* [ ] Add role-based access control

---

# 🥉 Phase 3 — Extensions System

### 🎯 Goal:

Make system customizable per school

### ✅ Deliverables:

* Event-driven architecture
* Extension registry
* Custom fields system
* Marketplace-ready structure

---

### 📌 Key Tasks

* [ ] Implement event bus (initial: in-memory)
* [ ] Define domain events
* [ ] Build extension registry
* [ ] Implement custom fields
* [ ] Create first extension (notifications)
* [ ] Upgrade event system (Redis Streams)

---

# 🏆 Phase 4 — SaaS Features

### 🎯 Goal:

Commercial-ready platform

### ✅ Deliverables:

* Billing system
* Parent portal
* Notifications system
* Analytics dashboards
* Multi-school management

---

### 📌 Key Tasks

* [ ] Implement billing module
* [ ] Build parent UI
* [ ] Add push/email notifications
* [ ] Build analytics dashboards
* [ ] Add subscription system
* [ ] Launch production

---

## 🔐 Core Rules (Non-Negotiable)

### 🚫 Never:

* Access DB without `institution_id`
* Put business logic in routes
* Merge unfinished features without flags
* Modify DB manually outside migrations

---

### ✅ Always:

* Use services (`application/`)
* Validate input with Zod
* Use repositories for DB access
* Write migrations for schema changes

---

## 🧩 Feature Flags Strategy

* All new features must be behind flags
* Flags can be:

  * Global
  * Per institution

Example:

```ts
if (!flags.billing_module) return;
```

---

## 🔄 Event-Driven Design

Domain events should be emitted for:

* Enrollment created
* Grade submitted
* Attendance marked

Used for:

* Notifications
* Extensions
* Analytics

---

## ⚙️ Dev Workflow

### Branching

* `main` → always deployable
* `feature/*` → short-lived
* `hotfix/*` → production fixes

### Flow

1. Create feature branch
2. Implement feature
3. Hide behind feature flag if incomplete
4. Open PR → merge to main

---

## 🧪 Testing Strategy

* Unit tests → services
* Integration tests → API routes
* E2E tests → critical flows

---

## 📦 Future Improvements

* Redis caching layer
* Row-Level Security (Postgres)
* Observability (logs + tracing)
* Load testing

---

## 🧭 Final Vision

This system should evolve into:

> A modular, multi-tenant, extensible academic platform
> capable of serving public and private institutions at scale.

---

## ⚡ For AI Agents

When working on this repo:

* Prefer modifying existing modules over creating new ones
* Follow domain structure strictly
* Do not bypass service layer
* Ensure tenant isolation in all queries
* Keep code minimal, explicit, and testable

---
