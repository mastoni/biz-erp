# BIZ-ERP — DEVELOPMENT RULES v1.0

Status: LOCKED
Scope: All development, testing, deployment, and AI-agent work on `biz-erp`.

## 1. Product Direction

`biz-erp` is a unified ERP platform for UMKM. Billing/Internet, POS, Inventory, Sales, CRM, Finance, CCTV, Hardware, Services, and other capabilities are domains/modules of one canonical ERP platform, not unrelated standalone systems.

The landing page is the commercial entry point and presents the platform's selectable capabilities.

## 2. Canonical Architecture

```text
Platform
├── Control Plane
│   └── PLATFORM_ADMIN / SUPER_ADMIN
├── Account / Customer
├── Business / Tenant
│   ├── Users
│   ├── Subscriptions
│   ├── Entitlements
│   └── ERP Modules
├── Web Client
├── Mobile Client
└── API / Sync Layer
```

Do not create a second source of truth for canonical entities.

## 3. Platform Control Plane

`PLATFORM_ADMIN` / `SUPER_ADMIN` = PLATFORM scope.

The Control Plane governs the platform as a whole, including management of Businesses, Account Customers, Users/platform identities, Modules, Plans, Bundles, Subscriptions, Entitlements, Integrations, Audit/System, and platform configuration.

`OWNER` is NOT a platform administrator.

The Control Plane must remain distinct from tenant/business routes and screens (for example `/v1/platform/*` and `/platform/*`).

## 4. Tenant / Business Scope

`OWNER` = BUSINESS/TENANT administrator.

`CASHIER` / `STAFF` = BUSINESS operational scope.

Tenant isolation is mandatory. Membership/scope is determined by the canonical business membership model.

Never allow OWNER → PLATFORM_ADMIN privilege escalation through aliases, route parameters, business selection, or UI state.

## 5. RBAC != Entitlement

```text
RBAC        = who is allowed to perform an action
Entitlement = which capability/module a business is allowed to use
```

Do not use subscription or entitlement as a role. Do not use OWNER as a substitute for platform administration.

## 6. Mobile Is First-Class and Offline-First

Mobile is a first-class ERP/POS client, not a reduced or secondary Web ERP.

Offline-first is a core architecture rule for operational workflows such as POS, Customers, Products, Inventory, Sales, Checkout, Receipts, Sync, and Outbox.

Canonical flow:

```text
Local State → Outbox → Sync Engine → API → Canonical Server State
```

Offline transactions must tolerate retries, duplicate submission, network interruption, partial synchronization, conflicts, and reconnect.

The server remains canonical:

```text
OFFLINE DATA != SOURCE OF TRUTH
SERVER DATA = CANONICAL SOURCE OF TRUTH
```

Mobile must not become a second business database.

## 7. Mobile Product Architecture

Default: one mobile client with capability/module composition, not three unrelated mobile applications.

Capabilities may include POS, Customers, Products, Inventory, Sales, Receipts, Sync, Profile, and other enabled modules.

Capability exposure is determined by identity + business context + RBAC + subscription + entitlement.

Do not split ERP/POS/Billing/CCTV into unrelated mobile products unless an explicit architectural decision is made later.

## 8. Web ERP

Web ERP is the primary tenant/business management client for administration, configuration, reporting, and operational workflows.

Web tenant scope must not absorb the Platform Control Plane.

## 9. Landing Page

Landing is the commercial entry point for the platform and should reflect canonical capabilities/modules rather than a disconnected set of products.

The current efficiency decision to host the landing on staging infrastructure remains valid unless explicitly changed.

## 10. Completed Phase Protection

Completed phases must not be modified or re-opened without an explicit decision.

Current completed checkpoints:

- Phase 4.1.39 — COMPLETE
- Phase 4.1.40B — COMPLETE
- Phase 4.1.40C — COMPLETE

## 11. Phase Boundary Protection

```text
40B = Catalog + Module Foundation
40C = Subscription / Commercial Lifecycle
40D = ISP / Internet Integration
40E = Entitlement Engine
40F = Ownership / Migration
40G = Hardware / Service
40H = Native ERP Billing (future)
```

Never skip, merge, or reorder phase scope without an explicit decision.

## 12. Existing Billing System

The legacy/existing Billing system is a source/integration component, not the architectural center of the ERP.

The ERP canonical commercial/platform model remains authoritative for ERP design.

## 13. No Duplicate Canonical Entities

Do not create duplicate `platform_*` entities when the canonical ERP entity already exists.

The Control Plane is a management/security scope over canonical ERP entities, not a second entity universe or second database model.

## 14. Security Architecture

Do not create a second authentication system or second RBAC system.

All platform and tenant access must use the canonical security architecture with distinct scopes.

## 15. Production Protection

Do not pull/reset/migrate/restart/deploy production without an explicit checkpoint, authorization, and verification.

Preferred progression:

```text
DEV → CI → STAGING → PRODUCT PREVIEW → PRODUCTION
```

## 16. Test Discipline

For failures, use:

```text
first failure → prove root cause → minimal fix → targeted verification → regression
```

Do not repeatedly rerun the same failing test without a new hypothesis.

## 17. Scope Discipline

Every task must identify:

- phase
- allowed files
- forbidden scope
- dependencies
- exit criteria

Unrelated worktree changes must remain out of the commit.

## 18. Commit Discipline

Commits must be scoped, meaningful, and single-purpose. Do not mix unrelated Web, Mobile, API, database, and infrastructure work.

## 19. Mandatory Agent Behavior

Before changing code, the agent must:

1. Read `AGENTS.md`.
2. Read `docs/DEVELOPMENT_RULES.md`.
3. Read `docs/PHASE_ROADMAP.md`.
4. Read the latest applicable checkpoint.
5. Identify the phase and boundary.
6. Inspect before implementing.
7. Prove root cause before changing production/application code.
8. Make the smallest safe change.
9. Run targeted validation before broad regression.
10. Keep unrelated files out of commits.

## 20. Non-Negotiable Guardrails

- Platform scope must never be confused with tenant scope.
- OWNER must never become platform administrator.
- Mobile must remain first-class and offline-first.
- Server state remains canonical.
- RBAC and entitlement remain separate.
- Completed phases remain protected.
- No duplicate canonical entity universe.
- Production remains protected until explicitly authorized.

## 21. PLATFORM IDENTITY RULE

Platform users DO NOT belong to user_businesses unless they also
have an explicit tenant membership.

user_businesses is strictly TENANT membership:
OWNER | CASHIER.

Platform identity is stored separately on users via nullable
platform_role.

Never make business_id nullable in user_businesses.

Platform JWT:
scope=platform
business_id absent.

Tenant JWT:
scope=tenant
business_id required.

Do not modify completed 40B/40C behavior.

## 22. BRAND / LANDING RULE

1. SKMNetwork = MASTER BRAND / COMPANY BRAND.

2. SKMNet = SUB-BRAND / CONNECTIVITY & NETWORK SERVICE BRAND
   under SKMNetwork.

3. ERP/POS is a SKMNetwork platform/product, not a replacement
   for the SKMNetwork master brand.

4. Landing page must establish SKMNetwork as the umbrella brand
   for the entire business ecosystem.

5. SKMNet may be prominently used for Internet/connectivity
   offerings, but must not be presented as a separate company.

6. All ERP, POS, CCTV, Hardware, IT, and Services offerings
   should have clear relationship to SKMNetwork.

7. Do not rename the company/platform architecture to SKMNet-only.

8. Branding hierarchy must remain consistent across:
   landing, Web ERP, Mobile, API metadata, emails, receipts,
   customer portal, and future Control Plane.

## 23. IMPORTANT UI/UX RULE:

Do not treat the current Mobile UI as final.
The current screens are functional/early-stage and must receive a
dedicated UI/UX acceptance pass after the product sync is fixed.

However:

- First fix only the proven initial sync trigger.
- Do not mix large visual refactors into that functional fix.
- Preserve offline-first behavior.
- Preserve POS as the authenticated home screen.
- After products appear, perform a separate UI/UX audit of:
  hierarchy, spacing, typography, product cards, search, category/filter,
  cart, checkout, branch selector, sync state, loading state, empty state,
  error state, and touch targets.

Do not redesign the entire app until the functional sync path is GREEN.
