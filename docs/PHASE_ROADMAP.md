# BIZ-ERP — PHASE ROADMAP & CHECKPOINTS

Status: LOCKED unless an explicit decision changes it.

## Completed

| Phase | Scope | Status |
|---|---|---|
| 4.1.39 | Customer contract/sync/management | COMPLETE |
| 4.1.40B | Canonical Catalog + Module Foundation | COMPLETE |
| 4.1.40C | Subscription / Commercial Lifecycle | COMPLETE |

## 4.1.40 Track Boundaries

| Track | Scope | Status |
|---|---|---|
| 4.1.40B | Catalog + Module Foundation | COMPLETE |
| 4.1.40C | Subscription / Commercial Lifecycle | COMPLETE |
| 4.1.40D | ISP / Internet Integration | NEXT PHASE / NOT STARTED |
| 4.1.40E | Entitlement Engine | BLOCKED UNTIL 40C + 40D |
| 4.1.40F | Ownership / Migration | AFTER 40E |
| 4.1.40G | Hardware / Service | AFTER 40B; independent of 40E |
| 4.1.40H | Native ERP Billing | FUTURE |

## 4.1.40B — Completed Contract

Canonical catalog/module foundation:

- modules
- module_features
- module_dependencies
- catalog_products
- plans
- plan_modules
- bundles
- bundle_items

No subscription lifecycle or entitlement evaluation belongs here.

## 4.1.40C — Completed Contract

Subscription/commercial lifecycle:

- subscription_families
- subscriptions
- lifecycle/state machine
- source semantics
- price snapshots
- replaceable/additive family behavior
- tenant isolation and RBAC

DIRECT/INCLUDED linkage fields remain optional where deferred dependencies require them.

## Current Staging Checkpoint

Staging is GREEN as of commit `1f0cef8` and the associated successful workflow verification.

Verified:

- API build/test green (285/285)
- Flutter tests green (324)
- typecheck/build green
- Docker build/push green
- PostgreSQL healthy
- API healthy
- migrations 001–016 applied
- `https://staging-api.skmnetwork.com/health` = 200
- `https://www.skmnetwork.com/` = 200
- `/v1/subscriptions` route live behind auth
- landing hosted on staging infrastructure

## Production Safety Checkpoint

Production has NOT received 4.1.40B/40C at the time this document was created.

Known production baseline from audit:

- production API/Web image: `6a9cbe1...`
- production database schema: legacy/earlier baseline (13 tables observed)
- migrations 015/016 were not applied in production during the audit

Do not treat staging success as production authorization.

## Control Plane Architecture Checkpoint

The current backend role model is tenant-oriented (`OWNER | CASHIER`).

The Control Plane is an explicit future platform scope:

- `PLATFORM_ADMIN` / `SUPER_ADMIN` = platform scope
- OWNER remains tenant/business scope
- Control Plane should use a separate route/layout boundary
- RBAC remains separate from entitlement
- Control Plane manages canonical ERP entities; do not create a duplicate platform entity universe

This is an architecture rule/checkpoint, not permission to implement it automatically.

## Mobile Architecture Checkpoint

Mobile remains a first-class offline-first ERP/POS client.

Canonical sync pattern:

`Local State → Outbox → Sync Engine → API → Canonical Server State`

Mobile must not become a second source of truth or separate business database.

## Current Product Preview Status

- Landing: LIVE on staging
- API: LIVE on staging
- Web ERP: source exists but was not part of the current staging deployment topology at the latest preview
- Mobile: source/build/test exists; not deployed to staging at the latest preview
- Control Plane UI: not implemented at the latest preview

## Change Control

Do not reorder phase execution, reopen completed phases, or deploy production without an explicit decision and updated checkpoint.
