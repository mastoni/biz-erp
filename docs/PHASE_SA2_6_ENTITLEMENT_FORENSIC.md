# PHASE SA-2.6: ENTITLEMENT / SUBSCRIPTION FORENSIC REVIEW ROUND 2

## Verified Existing Schema

A forensic audit of the actual `016_subscription_commercial_lifecycle.sql`, `015_canonical_catalog_module_foundation.sql`, and `034_commercial_governance_foundation.sql` migrations reveals that a comprehensive Subscription structure is strictly enforced:
- **`businesses`**: Represents the tenant entity.
- **`user_businesses`**: Manages RBAC and membership.
- **`subscriptions`**: Represents the entitlement, strictly linking `business_id` to a `plan_code` and `family_code`.
- **`subscription_families`**: Defines `replacement_policy` (e.g., `REPLACEABLE`, `ADDITIVE`) to prevent conflicts (e.g., maximum one `ACTIVE` subscription for `ERP_PLAN`).

## Actual Subscription States

The `subscriptions.status` enum strictly allows:
`PENDING`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `CANCELLED`

**Findings**:
- **There is no `TERMINATED` state.** Termination semantics are handled by either `EXPIRED` (natural end of term) or `CANCELLED` (manual/hard abort).
- `EXPIRED` allows a transition only to `CANCELLED`.
- `CANCELLED` is a terminal state (cannot transition anywhere).
- **Mapping to Access**: 
  - `ACTIVE` -> Access Granted.
  - `SUSPENDED`, `EXPIRED`, `CANCELLED` -> Access Denied.

## Existing Data Mapping

Currently, subscriptions are grouped logically by `subscription_families` (e.g., `ERP_PLAN`, `INTERNET_PLAN`, `CCTV_PLAN`). 
- There is currently no direct `plan_code` to `service_code` mapping because `service_code` does not exist on `plans`.
- Entitlements rely entirely on the `family_code` string matching to determine what capability a subscription unlocks. This is brittle.

## Verified Service Codes

SA-2.5 introduced the `services` table as the Canonical Macro-Service Registry. However, migration `035` did not seed any default services. 

Following a comprehensive ecosystem audit (see [SKMNETWORK_CANONICAL_SERVICE_TAXONOMY.md](file:///d:/projectfolder/biz-erp/docs/SKMNETWORK_CANONICAL_SERVICE_TAXONOMY.md)), the revised canonical services to be introduced are strictly B2B SaaS platform capabilities:
- `ERP` (Enterprise Resource Planning) - INTERNAL, ACTIVE
- `ISP_MANAGEMENT` (ISP Management System) - INTERNAL, ACTIVE
- `CCTV_MANAGEMENT` (CCTV Management) - HYBRID, ACTIVE
- `WA_GATEWAY` (WhatsApp Gateway) - HYBRID, DRAFT
- `AUTOPOST` (AI AutoPost) - EXTERNAL, DRAFT

*(Note: Data mapping proposal below assumes the creation of these canonical codes).*

## Plan → Service Mapping

**Proposal for Existing ERP/Internet Plans**:
- Any `plan_code` where `family_code = 'ERP_PLAN'` → `service_code: 'ERP'`
- Any `plan_code` where `family_code = 'INTERNET_PLAN'` → `service_code: 'ISP_MANAGEMENT'`
- Any `plan_code` where `family_code = 'CCTV_PLAN'` → `service_code: 'CCTV_MANAGEMENT'`
- Any other plans (e.g., Cloud Storage): MARK AS UNRESOLVED pending formal macro-service definition.

**Recommendation**: Add `plans.service_code` as `NULLABLE`, backfill based on `family_code`, and then optionally apply a `NOT NULL` constraint for new records.

## Bundle Analysis

**Finding**: DO NOT add `bundles.service_code`.
**Reasoning**: The `bundle_items` schema explicitly allows a single bundle to contain a mixture of `item_type IN ('PRODUCT', 'PLAN', 'SERVICE', 'HARDWARE')`. A bundle can literally contain both an ISP plan and an ERP plan. Therefore, a bundle is fundamentally a multi-service commercial packaging construct and cannot map 1:1 to a single canonical `service_code`.

## Entitlement Authorization Contract

The authorization contract must strictly decouple "Who you are" (RBAC) from "What the business bought" (Entitlement).

**Contract for `requireEntitlement(serviceCode)`**:
1. Validate the JWT to ensure an authenticated user.
2. Extract the `business_id` directly from the trusted server-side JWT context (`req.businessId`). **Never** trust a client-provided `business_id` in a query param or body.
3. Validate that the user actually holds a valid `user_businesses` membership for that `business_id` (RBAC precondition).
4. Query the `subscriptions` table (joining `plans`) to find a record where:
   - `business_id = req.businessId`
   - `plan.service_code = serviceCode`
   - `status = 'ACTIVE'`
5. **Expected Failure Semantics**:
   - `401 Unauthorized`: Token invalid or missing.
   - `403 Forbidden`: User lacks membership (`user_businesses`) or business lacks an `ACTIVE` subscription for the requested service.
   - `404 Not Found`: Used strictly for missing resources, not authorization failures.

## ERP Access Gap Analysis

An audit of `apps/api/src/middleware/auth.ts` reveals:
- ERP routes currently rely on `requireActiveTenant` (or `createRequireActiveTenant`), which only verifies that the user is a member of an active `business`.
- **Gap**: There is currently NO subscription/entitlement check blocking ERP access. If a user is a member of a business, they get into the ERP, regardless of whether the business actually paid for an ERP subscription.
- **Migration Path**: `requireEntitlement('ERP')` must be injected into the ERP route chains (after `requireActiveTenant`) to enforce commercial access.

## Internet → ERP Evidence

There is currently no database trigger, procedure, or explicit application logic in the backend enforcing automatic lifecycle propagation from an ISP subscription to an ERP subscription. The relationship is purely a business rule/documentation concept right now. SA-2.7 (Provisioning) or an explicit webhook architecture will be required to physically automate this synchronization.

## Canonical Service Seed Decision

### Schema Requirements
Based on `035_service_registry_foundation.sql`, the exact minimum required shape for an `INSERT` into `services` is:
- `code` (TEXT PRIMARY KEY)
- `name` (TEXT NOT NULL)
- `category` (TEXT NOT NULL)
- `service_type` (TEXT NOT NULL, ENUM: 'INTERNAL', 'EXTERNAL', 'HYBRID')
- Optional/Defaulted fields: `owner` (defaults to 'PLATFORM'), `lifecycle_status` (defaults to 'DRAFT'), `public_visibility` (defaults to FALSE).

### Canonical Code Evidence
Repository evidence heavily supports the existence of these macro domains, explicitly listed in `016_subscription_commercial_lifecycle.sql` under the `family_code` constraints (`ERP_PLAN`, `INTERNET_PLAN`, `CCTV_PLAN`). 

### Seed Recommendation
**Option A is recommended**: Seed canonical services at the beginning of SA-2.6 migration `036`. Repository conventions heavily favor embedding idempotent `INSERT ... ON CONFLICT DO UPDATE` statements directly within migrations (as seen with `subscription_families` in `016`). This ensures the data requirements for the `ALTER TABLE` backfill are met safely in a single transaction.

### Exact Proposed Service Rows
```sql
INSERT INTO services (code, name, category, service_type, owner, lifecycle_status, public_visibility)
VALUES
('ERP', 'Enterprise Resource Planning', 'OPERATIONS', 'INTERNAL', 'PLATFORM', 'ACTIVE', FALSE),
('ISP_MANAGEMENT', 'ISP Management System', 'OPERATIONS', 'INTERNAL', 'PLATFORM', 'ACTIVE', FALSE),
('CCTV_MANAGEMENT', 'CCTV Management', 'PROTECTION', 'EXTERNAL', 'PLATFORM', 'ACTIVE', FALSE),
('WA_GATEWAY', 'WhatsApp Gateway', 'COMMUNICATIONS', 'HYBRID', 'PLATFORM', 'DRAFT', FALSE),
('AUTOPOST', 'AI AutoPost', 'MARKETING', 'EXTERNAL', 'PLATFORM', 'DRAFT', FALSE)
ON CONFLICT (code) DO UPDATE SET
name = EXCLUDED.name,
category = EXCLUDED.category,
service_type = EXCLUDED.service_type,
lifecycle_status = EXCLUDED.lifecycle_status;
```
*Note on Lifecycle*: The initial status MUST be `ACTIVE`. If they remain `DRAFT`, plans mapped to them may be considered invalid by strict commercial/provisioning engines later. 
*Note on Visibility*: `public_visibility` remains `FALSE` because the Service Registry is a technical control-plane construct. Commercial visibility is governed separately via the `showcase_items` public module.

### Subscription Route Authorization Findings
The `/v1/subscriptions` route requires tenant authentication (`requireActiveTenant`) because a business uses this interface to manage/purchase their plans. 
- It MUST NOT require `requireEntitlement('ERP')`.
- It is perfectly safe because access is gated by strict RBAC and tenant membership. It does not accidentally become public.

### ERP Route Classification
The identified routes (`/v1/users`, `/v1/media`, `/v1/settings`, `/v1/sync/*`, `/v1/finance/*`, `/v1/dashboard`) are classified as **Category A: Definitely ERP capability**. They exclusively represent data manipulation and operational capabilities associated with the ERP product and must be protected by the `ERP` entitlement check.

## Migration Preconditions

1. A migration (`036`) must safely seed the `services` rows.
2. It must then `ALTER TABLE plans ADD COLUMN service_code TEXT REFERENCES services(code) ON DELETE RESTRICT`.
3. A data backfill must safely map existing plans to canonical services.

## Security Findings

- **Privilege Escalation Risk**: If entitlement checks accidentally read `business_id` from `req.body.business_id` instead of the JWT context, an attacker could supply a different tenant's ID to bypass subscription locks. Entitlement lookups MUST be hardcoded to `req.tenant.id` / `req.businessId` extracted during JWT verification.
- Platform scopes (`SUPER_ADMIN`, `PLATFORM_ADMIN`) bypass tenant entitlement checks because they govern the platform, but they should not be able to execute tenant-specific business operations without explicitly assuming a tenant role.

## Performance Findings

- **Expected Query**:
  ```sql
  SELECT 1 FROM subscriptions s
  JOIN plans p ON s.plan_code = p.code
  WHERE s.business_id = $1 AND p.service_code = $2 AND s.status = 'ACTIVE' LIMIT 1
  ```
- **Required Indexes**: `idx_subscriptions_business`, `idx_subscriptions_status`, `idx_plans_service_code`.
- **Caching**: The query is lightweight and heavily indexed. Caching (Redis) is NOT required for the MVP correctness phase. It should only be introduced if APM (Application Performance Monitoring) indicates this specific query is a bottleneck. Correctness > Premature Optimization.

## Final SA-2.6 Implementation Contract

SA-2.6 is formally scoped to:
1. Creating migration `036` to:
   - Seed `ERP`, `ISP`, `CCTV` services idempotently.
   - Add `plans.service_code`.
   - Backfill plan mappings based on `family_code`.
2. Implementing `requireEntitlement(serviceCode)` middleware.
3. Applying `requireEntitlement('ERP')` to the ERP API module routes.
4. Writing targeted tests to prove that a tenant without an `ACTIVE` subscription is rejected (403 Forbidden).
