# PHASE SA-2.6 ENTITLEMENT IMPLEMENTATION MAP

This document inventories the current API routes to identify where the new `requireEntitlement(serviceCode)` middleware should be applied.

## Global Middleware
- `createRequireActiveTenant` is currently mounted globally at `/v1` (except public, health, platform, and auth). This guarantees tenant membership but does NOT verify commercial entitlement.

## Target Protection Mapping: `ERP` Service

The following routes represent core ERP business capabilities. They must be protected by `requireEntitlement('ERP')`.

### Core ERP Routes
| Base Path | Description | Target Service | Requires Entitlement |
|---|---|---|---|
| `/v1/products` | Product management | `ERP` | YES |
| `/v1/branches` | Branch management | `ERP` | YES |
| `/v1/inventory` | Inventory management | `ERP` | YES |
| `/v1/customers` | Customer management | `ERP` | YES |
| `/v1/users` | Tenant staff management | `ERP` | YES |
| `/v1/dashboard` | ERP dashboard & metrics | `ERP` | YES |
| `/v1/reports` | Sales/Inventory reports | `ERP` | YES |
| `/v1/media` | Media uploads for products | `ERP` | YES |
| `/v1/settings` | Store/tenant settings | `ERP` | YES |
| `/v1/suppliers` | Supplier management | `ERP` | YES |
| `/v1/purchases` | Purchase orders | `ERP` | YES |
| `/v1/finance` | General ledger/accounts | `ERP` | YES |
| `/v1/finance/reports` | Financial reporting | `ERP` | YES |
| `/v1/receivables` | Accounts receivable | `ERP` | YES |
| `/v1/expenses` | Expense tracking | `ERP` | YES |
| `/v1/incomes` | Income tracking | `ERP` | YES |

### ERP Offline Sync Routes (Mobile App)
| Base Path | Description | Target Service | Requires Entitlement |
|---|---|---|---|
| `/v1/sync/products` | Offline product sync | `ERP` | YES |
| `/v1/sync/sales` | Offline POS sales sync | `ERP` | YES |
| `/v1/sync/customers` | Offline customer sync | `ERP` | YES |
| `/v1/sync/suppliers` | Offline supplier sync | `ERP` | YES |
| `/v1/sync/purchases` | Offline purchase sync | `ERP` | YES |

## Exception Routes (Do NOT Protect with ERP Entitlement)

The following routes must NOT have the `ERP` entitlement applied, as they serve different scopes or are prerequisites for purchasing the entitlement itself.

| Base Path | Description | Reason for Exemption |
|---|---|---|
| `/health` | System health check | Public infrastructure route |
| `/v1/auth` | Login and session management | Auth infrastructure route |
| `/v1/public` | Public APIs (Showcase, etc.) | No tenant context required |
| `/v1/platform` | Super Admin control plane | Uses platform scope auth, not tenant scope |
| `/v1/subscriptions` | Tenant commercial portal | This is where tenants *buy* the ERP. Blocking this would prevent purchase. |

## Implementation Strategy

1. Expose `requireEntitlement(serviceCode)` from `middleware/auth.ts`.
2. Apply it selectively in `app.ts` to the required `/v1/*` route handlers immediately after `createRequireActiveTenant`.
3. Do NOT apply it to `/v1/subscriptions`.

## Stop Condition Block (Canonical Services Missing)

**WARNING**: While mapping the implementation, we verified that the canonical services (`ERP`, `ISP`, `CCTV`) **do not exist** in the `services` table. Phase SA-2.5 defined the schema but did not seed the data. 

Applying Migration 036 (Entitlement Mapping) requires backfilling `plans.service_code`. The backfill cannot be safely performed because there are no valid `service_code` targets in the database. A seed strategy for `services` must be resolved before proceeding.
