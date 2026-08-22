# SKMNetwork / biz-erp — AI Project Context & Phase Continuity

> **Purpose:** This document is the persistent context guard for AI agents working on the SKMNetwork / biz-erp project.
>
> **Rule:** Read this document **before any non-trivial task**. Then read the current phase document and any relevant product/architecture contract. Do not execute first and reconstruct context later.

---

## 1. Project Identity

### Repositories

**ERP / main repository**
- `mastoni/biz-erp`

**Landing repository**
- `mastoni/landingpage_skmnet_erp`

### Production / staging infrastructure

**Production ERP VPS**
- `38.103.171.143`
- Production ERP services are protected and must not be modified during landing/staging work unless explicitly authorized.

**Staging ERP + Landing VPS**
- `103.168.147.243`
- Existing staging ERP services:
  - `bizerp_staging_api`
  - `bizerp_staging_postgres`
  - `bizerp_staging_nginx`

**Important infrastructure decision**
- There are **two VPS only**: production and staging.
- **DO NOT provision another VPS** unless the project owner explicitly approves it.

---

## 2. Mandatory AI Pre-Flight

Before doing analysis, coding, refactoring, schema work, deployment, infrastructure work, or documentation:

1. Read this file.
2. Identify the requested/current phase.
3. Read the current phase document.
4. Read relevant product/architecture contracts.
5. Inspect repository identity, branch, HEAD, and working tree.
6. Identify completed checkpoints relevant to the task.
7. Identify open decisions relevant to the task.
8. Identify protected components that must not change.
9. State a short **Context Pre-Flight** before execution.

### Required Context Pre-Flight

```text
Repository:
Branch:
HEAD:

Requested phase:
Current project phase:
Previous completed phase:
Next approved phase:

Relevant completed checkpoints:
- ...

Relevant approved decisions:
- ...

Relevant open decisions:
- ...

Files expected to change:
- ...

Protected files/components:
- ...

Potential phase conflict:
NONE / <explain>

Execution mode:
ANALYSIS ONLY / DESIGN ONLY / IMPLEMENTATION / VALIDATION / DEPLOYMENT
```

If the current phase cannot be established, **STOP**.

---

## 3. Phase Discipline

The project roadmap is sequential.

### Never:
- skip a phase
- reorder phases
- merge unrelated phases without explicit approval
- implement a future phase early
- reopen a completed phase without explicit reason and owner approval
- redesign completed infrastructure merely because a different approach looks cleaner

### Current approved position

The latest completed/approved work is:

- **Phase 4.1.22** — Landing final audit & cleanup: COMPLETE
- **Phase 4.1.23** — Landing MIME/content infrastructure correction: COMPLETE
- **Phase 4.1.24** — SKMNetwork brand & CTA realization: PASS
- **Phase 4.1.25** — Visual & content acceptance: PASS
- **Phase 4.1.26** — SKMNetwork ERP market positioning: PASS
- **Phase 4.1.27** — ERP product contract: PASS
- **Phase 4.1.28** — ERP domain mapping: PASS
- **Phase 4.1.29** — Business decision gate: APPROVED
- **Phase 4.1.30** — Minimal domain schema design: APPROVED
- **Phase 4.1.31** — Business rule lock: APPROVED
- **Phase 4.1.32** — Schema review & migration plan: NEXT APPROVED PHASE unless explicitly changed by owner

> If a newer phase document exists, it supersedes this summary for that phase, but the sequential roadmap must still be respected.

---

## 4. Completed Landing Infrastructure Checkpoints

Landing is a **static SPA**.

Public domain:
- `https://www.skmnetwork.com`

Landing source:
- `mastoni/landingpage_skmnet_erp`

Landing deployment model:
- GitHub Actions
- build exact landing commit SHA
- upload `dist` as an Actions artifact
- deploy artifact to staging
- release path:
  - `/var/www/skmnetwork-landing/releases/<SHA>/dist`
- active release:
  - `/var/www/skmnetwork-landing/current`
- atomic symlink switch
- rollback to previous release on validation failure
- retain recent releases
- no need to restart ERP API/PostgreSQL for a static landing deployment

### Staging Nginx facts

Existing staging Nginx serves:
- `staging-api.skmnetwork.com`
- `www.skmnetwork.com`

Important Nginx configuration decisions already completed:
- `server_names_hash_bucket_size 64;`
- standard MIME map is included:
  - `include /etc/nginx/mime.types;`
- landing root:
  - `/var/www/skmnetwork-landing/current`
- SPA fallback:
  - `try_files $uri $uri/ /index.html;`
- static hashed assets receive long immutable caching
- HTML receives `no-cache`
- landing directory is mounted read-only into Nginx:
  - `/var/www/skmnetwork-landing:/var/www/skmnetwork-landing:ro`

### Landing validation already achieved

Confirmed:
- `/` → HTTP 200
- `/dashboard` → HTTP 200
- `/robots.txt` → HTTP 200
- `/sitemap.xml` → HTTP 200
- `/manifest.webmanifest` → HTTP 200
- JS asset → HTTP 200, `application/javascript`
- CSS asset → HTTP 200, `text/css`
- TLS certificate valid for `www.skmnetwork.com`
- browser blank-page issue was fixed by correct MIME handling
- landing is currently displaying correctly in browser

Do not disturb this infrastructure while working on product/content/domain phases.

---

## 5. Branding Invariant

### Primary brand
**SKMNetwork**

### Short / secondary name
**SKMNet**

### Primary ERP product name
**SKMNetwork ERP**

### Acceptable ERP shorthand
**SKMNet ERP**

### Rules
- `SKMNetwork` is the company/primary brand.
- `SKMNet` is only a short/common form.
- Never present SKMNet as a separate company.
- Never perform a blind global replacement of `SKMNet`.
- First prominent ERP mention should prefer `SKMNetwork ERP`; later shorthand may use `SKMNet ERP`.

### Official domain
- `https://www.skmnetwork.com`

### Verified ERP URL
- `https://erp.skmnetwork.com`

---

## 6. ERP Product Positioning

Current target market:
- **UMKM**
- especially UMKM that are customers of SKMNetwork Internet
- also UMKM that want ERP independently

### Two ERP access models

#### INCLUDED
ERP is provided as a benefit for eligible SKMNetwork Internet customers, according to package/policy rules.

#### STANDALONE
ERP is subscribed independently and does **not** require SKMNetwork Internet service.

### Important terminology rule
Prefer **INCLUDED** rather than using “gratis” as the main product term.

Do not invent:
- pricing
- trial duration
- package limits
- coverage numbers
- customer counts
- years of experience
- guarantees
- certifications
- unsupported product capabilities

---

## 7. Approved ERP Product Contract

Authoritative document:
- `docs/skmnetwork-erp-product-contract.md`

### Core model

```text
Account Customer
    |
    +-- Internet Service
    |     |
    |     +-- Internet Package
    |            |
    |            +-- includes_erp
    |
    +-- Businesses
           |
           +-- ERP Tenant
                  |
                  +-- Users / Membership
                  |
                  +-- ERP Entitlement
                         +-- INCLUDED
                         +-- STANDALONE
```

### Contract rules

- One customer may own multiple businesses.
- Each business is an ERP tenant.
- One entitlement belongs to one business/tenant.
- `INCLUDED` derives from eligible Internet service/package.
- `STANDALONE` is independent of Internet.
- No active ERP entitlement => no ERP access.
- Membership and entitlement are separate dimensions.
- Entitlement is not the same as RBAC role.

---

## 8. Existing ERP Domain Facts

From the domain-mapping audit:

### Existing tables/domain
- `businesses`
- `users`
- `user_businesses`
- `branches`
- `products`
- `stocks`
- `stock_movements`
- `sales`
- `sale_items`
- `customers`
- `refresh_tokens`

### Tenant model
- `businesses.id` is the ERP tenant key.
- Business-scoped repositories filter by `business_id`.

### CRM customer warning
Existing `customers` table is **CRM customer data scoped to a business**.

It is **NOT** the account/service customer identity.

Do not reuse `customers` as `account_customers` without explicit approval.

### Encryption decision (Phase 4.1.38)
- **Accepted cipher:** sqlite3mc (SQLite3MultipleCiphers)
- **Algorithm:** ChaCha20-Poly1305 (AEAD)
- **Scope:** Mobile local database encryption
- **Integration:** via sqlite3 build hooks / native assets override
- **Key lifecycle:** 256-bit random key per business, generated on first DB creation; independent from JWT; not auto-deleted on logout

## 9. Authentication & Authorization Facts

Current auth flow:
- login authenticates user credentials
- user membership is checked through `user_businesses`
- selected/active `business_id` becomes part of the JWT
- refresh sessions retain `business_id`
- business-scoped repositories enforce tenant isolation

### Current JWT claims

Known claims:
- `sub`
- `business_id`
- `role`
- `session_id`
- `jti`
- `iat`
- `exp`
- `iss`
- `aud`

Not currently present:
- `email`
- `permissions`
- `token_type`

### Multi-business behavior
- one user can belong to multiple businesses
- login selects a business
- if multiple active businesses exist, business selection is required
- JWT is bound to one business context
- refresh preserves the same business context
- there is currently no in-app business-switch endpoint

### Target authorization boundary

```text
createJwtAuthMiddleware
        |
        v
requireEntitlement
        |
        v
requireRole
        |
        v
ERP operation
```

Do not merge entitlement with RBAC.

---

## 10. Approved Business Rule Lock (Phase 4.1.31)

### Rule 1 — Account Customer ↔ User
Use an explicit mapping table:

- `account_customer_users`

Do NOT use shared email as the domain relationship.

### Rule 2 — INCLUDED scope
An eligible Internet service grants INCLUDED ERP to **exactly one specific business**, not all businesses owned by the account customer.

### Rule 3 — Active entitlement uniqueness
One business may have **at most one ACTIVE ERP entitlement**.

Recommended future DB enforcement:
- partial unique constraint/index on business for `status='ACTIVE'`

### Rule 4 — INCLUDED lifecycle
- Internet ACTIVE → ERP INCLUDED ACTIVE
- Internet SUSPENDED → ERP INCLUDED SUSPENDED
- Internet TERMINATED → ERP INCLUDED TERMINATED/EXPIRED

Grace period remains an open business decision.

### Rule 5 — STANDALONE
STANDALONE is independent of Internet.

---

## 11. Approved Conceptual Schema (Design Only)

These are conceptual design entities, not yet necessarily implemented.

### New conceptual entities

1. `account_customers`
2. `account_customer_users`
3. `internet_packages`
4. `internet_services`
5. `erp_entitlements`

### Existing entity extension under design
- `businesses.account_customer_id`

### Conceptual fields

#### account_customers
- `id`
- `name`
- `email`
- `status`
- `created_at`
- `updated_at`

#### account_customer_users
- `account_customer_id`
- `user_id`
- role/status only if justified
- `created_at`

#### internet_packages
- `id`
- `name`
- `includes_erp`
- `created_at`
- `updated_at`

#### internet_services
- `id`
- `account_customer_id`
- `business_id`
- `package_id`
- `status`
- `starts_at`
- `ends_at`
- `created_at`
- `updated_at`

#### erp_entitlements
- `entitlement_id`
- `account_customer_id`
- `business_id`
- `access_type`
- `eligibility_source`
- `internet_service_id` nullable
- `package_id` nullable
- `status`
- `starts_at`
- `ends_at`
- `created_at`
- `updated_at`

### Important
This schema is **design-only** until a migration phase is explicitly approved.

---

## 12. Open Business Decisions

These remain open unless a newer phase explicitly closes them:

1. Grace-period policy for Internet suspension.
2. Exact linkage semantics between `account_customers` and `users` beyond the approved mapping-table approach.
3. Exact mechanism for binding an Internet service to a business.
4. Which Internet packages have `includes_erp = true`.
5. Whether Internet service is better named `internet_services` or `internet_subscriptions`.
6. STANDALONE trial rules.
7. STANDALONE plan tiers.
8. STANDALONE pricing.
9. Future ERP billing/subscription schema.
10. Data retention policy.
11. Whether INCLUDED covers one or more business contexts beyond the currently locked specific-business rule (do not change the locked rule without explicit owner approval).

Do not silently decide these.

---

## 13. Current Next Phase

### PHASE 4.1.32 — SCHEMA REVIEW & MIGRATION PLAN

This is the current next approved phase unless the project owner explicitly changes the roadmap.

Its purpose is:
- final conceptual schema review
- ownership graph review
- FK dependency review
- cross-entity invariant review
- unique/index strategy
- migration ordering
- existing-data strategy
- rollback considerations
- exact blockers before SQL migration can be written

### Critical warning
Existing `businesses` rows may not yet have proven `account_customer_id`.

Never:
- guess ownership
- fabricate account customers
- backfill by email without explicit proof
- create fake relationships

If ownership is not provable:
- report `DATA BACKFILL REQUIRED`
- stop before migration

---

## 14. Git / Repository Safety

Before changing files:

```bash
git status -sb
git rev-parse HEAD
git rev-parse origin/main
```

Identify:
- repository
- branch
- exact files in scope

Never commit unrelated changes.

Never assume that:
- `biz-erp/apps/landing`
is the canonical landing repository.

Canonical landing repository:
- `mastoni/landingpage_skmnet_erp`

Canonical ERP repository:
- `mastoni/biz-erp`

---

## 15. Infrastructure Protection

### Production is protected
Do not modify:
- production Nginx
- production Compose
- production database
- production auth
- production deployment

during staging/landing work unless explicitly authorized.

### Staging
Avoid unnecessary restart/recreate of:
- `bizerp_staging_api`
- `bizerp_staging_postgres`

If only Nginx/config is required:
- validate Nginx
- reload Nginx
- do not restart unrelated services

### Landing
Landing deployment must remain independent:
- build from landing repository
- transfer artifact
- atomic release
- validate
- rollback on failure

---

## 16. Required AI Behavior

### READ FIRST
Always read context before execution.

### NEVER IMPROVISE
If a decision is not approved:
- mark it as an open decision
- stop if it blocks implementation

### NEVER CLAIM UNVERIFIED WORK
Use:
- `PASS`
- `FAILED`
- `BLOCKED`
- `NOT RUN`
- `NOT VERIFIED`

based on actual evidence.

Do not claim:
- deployed
- committed
- pushed
- migrated
- tested
- verified

unless evidence exists.

### PROTECT COMPLETED WORK
Completed phases are checkpoints.

If a new task appears to require changing a completed checkpoint:
- identify reason
- identify blast radius
- identify affected phase
- request explicit approval if necessary

---

## 17. Task Completion Report

Every non-trivial task must finish with:

```text
PHASE:
STATUS:

REPOSITORY:
BRANCH:
HEAD:

CHANGED FILES:
...

PROTECTED FILES/COMPONENTS:
...

VALIDATION:
...

DECISIONS MADE:
...

DECISIONS STILL OPEN:
...

NEXT APPROVED PHASE:
...

GIT:
commit / no commit

DEPLOY:
deployed / not deployed
```

---

## 18. Stop Conditions

STOP immediately if:
- current phase is unclear
- repository identity is unclear
- requested work conflicts with approved rules
- a business decision is needed but not approved
- existing data ownership is unknown
- production blast radius is unclear
- the task would skip a phase
- source files contradict an approved contract
- implementation would require unsupported assumptions

Return:

```text
BLOCKED:
<exact reason>

REQUIRED DECISION:
<what the owner must decide>
```

Do not improvise.

---

## 19. Owner Override Rule

Only the project owner may change:
- phase order
- architecture invariants
- product contract
- business rules
- production architecture
- deployment model

When the owner explicitly changes a rule, record:

```text
PREVIOUS RULE:
NEW RULE:
REASON:
AFFECTED PHASES:
```

Then continue using the new approved rule.

---

## 20. Final Principle

> **READ FIRST. UNDERSTAND CONTEXT. CONFIRM PHASE. CHECK DECISIONS. PROTECT COMPLETED WORK. THEN EXECUTE.**

Never execute first and reconstruct project context later.
