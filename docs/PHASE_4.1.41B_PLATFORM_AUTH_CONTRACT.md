# PHASE 4.1.41B — PLATFORM AUTH & CONTROL PLANE CONTRACT (REVISION R1)

Status: DESIGN ONLY. No implementation, no migration, no DB change, no 40B/40C modification.
Revision of `docs/PHASE_4.1.41B_PLATFORM_AUTH_CONTRACT.md` (R0) — resolves all items from the
41B CONTRACT CONSISTENCY REPORT.

Reference inspection (unchanged today):

- `apps/api/src/services/jwt_service.ts` — `AccessTokenClaims { sub, business_id, role: OWNER|CASHIER, session_id, jti }`, verify strict on business_id.
- `apps/api/src/middleware/auth.ts` — `createJwtAuthMiddleware`, `requireSyncAuth`, `requireRole('OWNER'|'CASHIER')`.
- `apps/api/src/services/auth_service.ts` — `authenticateCredentials` returns `{user, membership?}`.
- `apps/api/src/services/refresh_token_service.ts` — `refresh_tokens.business_id NOT NULL`.
- `apps/api/src/routes/auth_routes.ts` — `/login`, `/refresh`, `/me`, `/logout` (tenant-only today).
- `apps/api/src/app.ts` — mounts `/v1/*`; no `/v1/platform/*`.
- `apps/web/src/features/auth/AuthContext.tsx` — tenant-only `{user, business, role}`.
- `apps/web/src/lib/rbac.ts` — `ROUTE_PERMISSIONS` tenant routes only.
- `apps/api/migrations/009_customers_foundation.sql` — `customers` (tenant-scoped).
- `apps/api/migrations/016_subscription_commercial_lifecycle.sql` — `subscriptions.account_customer_id`
  is a DEFERRED FK to a not-yet-created `account_customers` table ("FK added in 40F").

---

## Identity Model

Two disjoint identity scopes, both stored on `users`:

- **Tenant identity**: `users.platform_role IS NULL` AND has ≥1 row in `user_businesses`
  (role `OWNER | CASHIER`, `business_id` NOT NULL, `status='ACTIVE'`).
  Tenant scope = strictly TENANT membership. A user may belong to many businesses
  (multi-business OWNER continues to work unchanged).
- **Platform identity**: `users.platform_role IN ('PLATFORM_ADMIN','SUPER_ADMIN')`.
  Platform users DO NOT require `user_businesses` membership. If they also own a
  business, that is a separate tenant membership and is never inferred from platform role.

`user_businesses.business_id` stays NOT NULL (locked). `platform_role` is a nullable
column on `users`, orthogonal to tenant membership (RBAC ≠ entitlement).

---

## Tenant JWT (MANDATORY DECISION 1)

```jsonc
{
  "sub": "<user_id>",
  "scope": "tenant",                 // REQUIRED, explicit (new tokens)
  "business_id": "<business_id>",   // REQUIRED
  "role": "OWNER" | "CASHIER",
  "session_id": "<refresh_session_id>",
  "jti": "<uuid>",
  "iat": <n>, "exp": <n>, "iss": "biz-erp-api", "aud": "biz-erp-client"
}
```

- `scope=tenant` is **explicit** on all newly issued tokens (MANDATORY DECISION 6).
- `business_id` REQUIRED and validated by `verifyAccessToken`.
- **Legacy tokens** (no `scope` claim) are accepted on tenant routes and default to `tenant`
  (backward compatible). They are never accepted on platform routes.

## Platform JWT (MANDATORY DECISIONS 2, 7)

```jsonc
{
  "sub": "<user_id>",
  "scope": "platform",              // REQUIRED, explicit
  "role": "PLATFORM_ADMIN" | "SUPER_ADMIN",
  "session_id": "<refresh_session_id>",
  "jti": "<uuid>",
  "iat": <n>, "exp": <n>, "iss": "biz-erp-api", "aud": "biz-erp-client"
}
```

- `scope=platform` is **explicit** on all newly issued tokens.
- **`business_id` MUST BE ABSENT** (the claim key is omitted — never `null`).
- A platform token MUST never carry a `business_id` claim (issuance rule enforced at sign time).

---

## Middleware Boundary (resolves R0 contradiction #1)

Two independent auth stacks; they do not share guards.

### Tenant authentication middleware — `createJwtAuthMiddleware` / `requireSyncAuth`

Scope-aware validation (R0 contradiction fixed here):

- `scope === 'platform'` → **`403 WRONG_SCOPE`** (explicit; a platform token is never
  treated as a tenant, and never falls through to a `401` business_id error).
- `scope` absent (legacy token) → default to `tenant`; continue normal tenant validation
  (business_id required).
- `scope === 'tenant'` → normal tenant validation (business_id required, role ∈ OWNER|CASHIER).
- Sets `req.user` / `req.businessId` / `req.tenantId` as today.
- `requireRole('OWNER'|'CASHIER')` is UNCHANGED (tenant compatibility preserved).

### Platform authentication middleware — `createPlatformJwtAuthMiddleware`

- Verifies JWT (same secret/iss/aud).
- STRICT claim validation:
  - `scope === 'platform'` required; otherwise (absent/legacy OR `tenant`) → **`403 WRONG_SCOPE`**.
    A legacy tenant token is NEVER upgraded/defaulted into platform scope.
  - `role` ∈ `PLATFORM_ADMIN | SUPER_ADMIN`, else → `403 FORBIDDEN`.
  - `business_id` MUST be absent; if present → `403 INVALID_PLATFORM_TOKEN`.
- Populates `req.platformUser = { userId, role, sessionId, jti }`.
- Does NOT set `req.businessId` / `req.user` (tenant fields unused on platform routes).

### Isolation guarantee

- `/v1/*` mounts tenant middleware (now scope-aware).
- `/v1/platform/*` mounts `createPlatformJwtAuthMiddleware` only.
- Cross-scope requests fail at the middleware layer before any handler runs, with the
  correct status (`403 WRONG_SCOPE` for scope mismatch; `401` only for missing/expired token).

---

## requirePlatformRole() (MANDATORY DECISION 6 middleware)

New guard, sibling of `requireRole` (left UNCHANGED for tenant compatibility):

```ts
export function requirePlatformRole(...roles: Array<'PLATFORM_ADMIN' | 'SUPER_ADMIN'>) {
  return (req, _res, next) => {
    const p = req as PlatformAuthenticatedRequest
    if (!p.platformUser) return next(new ApiError(401, 'INVALID_TOKEN', 'Platform authentication required'))
    if (!roles.includes(p.platformUser.role)) return next(new ApiError(403, 'FORBIDDEN', 'Insufficient platform permissions'))
    next()
  }
}
```

`requireRole` keeps accepting only `OWNER | CASHIER`, so OWNER can never satisfy a
platform guard (role sets are disjoint).

---

## Login / Refresh Semantics (MANDATORY DECISIONS 3, 4, 5, 8)

### Login (`/v1/auth/login`)

Request carries an explicit context selector `x-auth-context` (MANDATORY DECISION 5):

- `tenant` (or default) → **tenant token**.
- `platform` → **platform token**.
- default = `tenant` (existing Web/Mobile clients unchanged with zero code change).
- `business_id` in the body is **ignored** when `x-auth-context: platform`.

Branches:

1. `x-auth-context: platform`:
   - authenticate credentials;
   - if `users.platform_role IS NULL` → `403 PLATFORM_ACCESS_DENIED` (no platform identity);
   - issue **Platform JWT** (`scope=platform`, `business_id` absent, role=`platform_role`);
   - create a refresh session with `scope='platform'`, `business_id` NULL.
2. `x-auth-context: tenant` (default, unchanged):
   - existing flow: resolve `user_businesses` membership, issue **Tenant JWT** (`scope=tenant`),
     create tenant refresh session. Multi-business OWNER selection (`409 BUSINESS_SELECTION_REQUIRED`)
     is preserved exactly.

Default context = `tenant` ⇒ existing Web/Mobile clients work unchanged. A dual-identity user
(platform_role set AND also an OWNER of a business) chooses explicitly via `x-auth-context`.

### Refresh (`/v1/auth/refresh`) — scope + role preserved (MANDATORY DECISION 8)

- Validate refresh session; re-issue token using the session's stored `scope` and `role`
  (both preserved across rotation — never flipped).
- `scope='platform'`: re-derive role from `users.platform_role` (NO `user_businesses`
  lookup). Respond with Platform JWT (`business_id` absent).
- `scope='tenant'`: existing flow (re-derive role from `user_businesses` membership).
- A tenant refresh can never produce a platform token and vice versa.

---

## Route Boundary (MANDATORY DECISIONS 3, 4)

- `/v1/*` → tenant middleware (scope-aware):
  - platform token → **`403 WRONG_SCOPE`**
  - legacy token (no scope) → allowed as legacy tenant token
  - tenant token → normal tenant validation
- `/v1/platform/*` → `createPlatformJwtAuthMiddleware` only:
  - missing/invalid scope (incl. legacy token) → **`403 WRONG_SCOPE`** (never upgraded)
  - platform role required (`requirePlatformRole`)
  - tenant token → **`403 WRONG_SCOPE`**
- Platform routes NEVER read `req.businessId`; they MUST NOT infer tenant scope from any
  request field. Business-scoped platform reads are passed explicitly as query params
  (e.g. `?business_id=`) and re-validated, never trusted from token.

---

## Error Contract (resolves R0 contradiction #1)

Uniform envelope (`error_handler.ts`): `{ error: { code, message, details } }`.

| Condition                                            | Status  | Code                                               |
| ---------------------------------------------------- | ------- | -------------------------------------------------- |
| Missing / malformed / expired / invalid token        | 401     | `INVALID_TOKEN`                                    |
| Platform token on tenant route                       | 403     | `WRONG_SCOPE`                                      |
| Legacy token (no scope) on tenant route              | allowed | (defaults to tenant)                               |
| Legacy token on platform route                       | 403     | `WRONG_SCOPE` (never upgraded)                     |
| Tenant token on platform route                       | 403     | `WRONG_SCOPE`                                      |
| Platform token carries `business_id`                 | 403     | `INVALID_PLATFORM_TOKEN`                           |
| Correct scope, role insufficient (platform)          | 403     | `FORBIDDEN`                                        |
| Correct scope, role insufficient (tenant, unchanged) | 403     | `INSUFFICIENT_PERMISSIONS` (legacy tenant code)    |
| Tenant business mismatch / no membership             | 403     | `BUSINESS_ACCESS_DENIED` (preserved)               |
| User has no platform identity but requested platform | 403     | `PLATFORM_ACCESS_DENIED`                           |
| Invalid pagination / query                           | 400     | `VALIDATION_ERROR`                                 |

Required error contract (locked):
- `401 INVALID_TOKEN` = unauthenticated / invalid token.
- `403 WRONG_SCOPE` = valid token, wrong scope for route.
- `403 FORBIDDEN` = correct scope, insufficient role/permission.

Compatibility note: existing tenant middleware currently emits `UNAUTHORIZED` /
`TOKEN_EXPIRED` for missing/expired tokens; these are normalized to `INVALID_TOKEN`
during implementation. Existing tenant `requireRole` keeps `INSUFFICIENT_PERMISSIONS`
for backward compatibility; the new `requirePlatformRole` uses `403 FORBIDDEN`.

---

## SUPER_ADMIN vs PLATFORM_ADMIN (MANDATORY DECISION 9)

- `SUPER_ADMIN` = full platform authority (all platform operations, including destructive /
  cross-tenant / identity-lifecycle actions and future privileged controls).
- `PLATFORM_ADMIN` = operational platform authority (day-to-day control-plane operations such
  as reading/monitoring businesses, customers, modules, plans, bundles, subscriptions).

Exact capability boundaries are **not yet locked**. Permission matrix placeholder:

| Capability                                                                             | PLATFORM_ADMIN    | SUPER_ADMIN       |
| -------------------------------------------------------------------------------------- | ----------------- | ----------------- |
| Read platform entities (businesses, customers, modules, plans, bundles, subscriptions) | ✅                | ✅                |
| Manage modules / plans / bundles                                                       | TBD (later phase) | TBD (later phase) |
| Platform user / identity lifecycle                                                     | ❌ (placeholder)  | ✅ (placeholder)  |
| Destructive / cross-tenant ops                                                         | ❌ (placeholder)  | ✅ (placeholder)  |
| Audit / system config                                                                  | TBD (later phase) | TBD (later phase) |

No undocumented permissions are invented. The matrix is finalized in a later phase before
any privileged PLATFORM_ADMIN/S<wbr>UPER_ADMIN write endpoints are implemented.

---

## Initial Platform API Contract (MANDATORY DECISION 10)

All endpoints: `scope=platform`, `role=PLATFORM_ADMIN | SUPER_ADMIN` unless noted.
Read-only over **canonical** entities (no `platform_*` duplicate tables). Platform-wide
(no implicit business filter). Pagination: `?limit=&offset=` (default `limit=50`, `max=200`).

### GET /v1/platform/businesses

- Canonical entity: `businesses`.
- Tenant filtering: NONE (platform-wide list).
- Pagination: yes.
- Errors: 401/403; 400 on bad pagination.

### GET /v1/platform/account-customers

- Canonical entity: **UNRESOLVED.** No `account_customers` table exists today.
  `subscriptions.account_customer_id` (40C) is a DEFERRED FK whose target table is created
  in **40F (Ownership / Migration)**. This endpoint is specified now but its canonical
  backing entity is resolved in 40F. **No duplicate `platform_account_customers` /
  `account_customer` table may be created in 41B.**
- Tenant filtering: NONE (platform-wide, once entity exists).
- Pagination: yes.
- Errors: 401/403; 400 on bad pagination; `409 ENTITY_UNRESOLVED` if queried before 40F lands.

### GET /v1/platform/modules

- Canonical entity: `modules` (40B).
- Tenant filtering: NONE.
- Pagination: optional (small set).
- Errors: 401/403; 400 on bad pagination.

### GET /v1/platform/plans

- Canonical entity: `plans` (40B).
- Tenant filtering: NONE.
- Pagination: optional.
- Errors: 401/403; 400 on bad pagination.

### GET /v1/platform/bundles

- Canonical entity: `bundles` (40B).
- Tenant filtering: NONE.
- Pagination: optional.
- Errors: 401/403; 400 on bad pagination.

### GET /v1/platform/subscriptions

- Canonical entity: `subscriptions` (40C).
- Tenant filtering: NONE — returns subscriptions across ALL businesses.
- Pagination: yes (`limit`, `offset`).
- Errors: 401/403; 400 on bad pagination.

---

## Web Implication

- `AuthContext` gains `scope: 'tenant' | 'platform' | null` and `platformRole`.
  Tenant state (`business`, `role`) unchanged for existing users.
- New `/platform/*` route group + layout, gated by `scope==='platform'`
  (server-enforced too). `ROUTE_PERMISSIONS` in `rbac.ts` is extended with
  `/platform/*` keys; tenant permissions are NOT altered.
- Web login sends `x-auth-context` only when entering the platform console; default
  tenant flow is byte-for-byte compatible.
- A tenant user can never reach `/platform/*` (client gate + server `403 WRONG_SCOPE`).

## Mobile Implication (MANDATORY DECISION 11)

- Mobile is **tenant-only in MVP**. No `x-auth-context: platform`, no platform token,
  no platform admin flow.
- Mobile login/refresh continue exactly as today (default tenant scope; new tenant tokens
  carry `scope=tenant`).
- Platform context is **unsupported by mobile**. The shared login endpoint must reject or
  ignore a mobile `x-auth-context: platform` request (e.g. `400 UNSUPPORTED_CONTEXT` or
  fall back to tenant) so a mobile client cannot obtain a token it cannot use.

---

## Security Invariants (MANDATORY DECISION 12)

- PLATFORM scope is NOT a business; platform tokens carry no `business_id`.
- Platform users do not require `user_businesses` membership.
- OWNER cannot become PLATFORM_ADMIN through UI/state/parameter/route param.
- Platform route never infers business scope from `req.businessId` (field is unset).
- Tenant route never trusts platform role as implicit tenant access (role sets disjoint;
  platform token on tenant route → `403 WRONG_SCOPE`).
- Entitlement evaluation remains separate from RBAC (unchanged).
- Single auth system, single RBAC system (no second security universe).
- Refresh scope is immutable per session (tenant↔platform never cross).
- Legacy tenant tokens default to tenant; legacy tokens are never upgraded to platform.
- **40B = unchanged. 40C = unchanged.** No behavioral or schema modification to completed
  phases (catalog/module/subscription contracts).
- The Control Plane manages canonical ERP entities ONLY. The following MUST NOT be created:
  `platform_businesses`, `platform_plans`, `platform_modules`, `platform_subscriptions`,
  `platform_entitlements`, `platform_customers`, or any other `platform_*` duplicate of a
  canonical entity. Account Customer remains unresolved and owned by 40F.

---

## Files Likely To Change (future implementation phase — NOT now)

- `apps/api/src/services/jwt_service.ts` — add `PlatformClaims` + `scope`-aware verify/sign;
  tenant verify must treat absent `scope` as `tenant` and reject `scope=platform` with `403`.
- `apps/api/src/middleware/auth.ts` — add `createPlatformJwtAuthMiddleware`, `requirePlatformRole`;
  make `createJwtAuthMiddleware`/`requireSyncAuth` scope-aware (reject `platform` → `403 WRONG_SCOPE`,
  default absent → tenant); `requireRole` unchanged.
- `apps/api/src/services/auth_service.ts` — platform login branch + `platform_role` select.
- `apps/api/src/services/refresh_token_service.ts` — `scope`+`role` preservation; `business_id`
  nullable for platform sessions.
- `apps/api/src/repositories/user_repository.ts` — select `platform_role`.
- `apps/api/src/routes/auth_routes.ts` — `x-auth-context` branching; platform login/refresh/me.
- `apps/api/src/app.ts` — mount `/v1/platform/*`.
- `apps/api/src/routes/platform_routes.ts` — NEW platform read endpoints.
- `apps/web/src/features/auth/AuthContext.tsx` — `scope` / `platformRole`.
- `apps/web/src/lib/rbac.ts` — `/platform/*` permissions (tenant keys unchanged).
- Migrations — add `platform_role` to `users`; add `scope` + nullable `business_id` to `refresh_tokens`.

## Migration Required

YES — `users.platform_role` (nullable) and `refresh_tokens` (`scope`, nullable `business_id`)
must be added to implement this contract. Creation is OUT OF SCOPE for 4.1.41B.

## Compatibility Risk

LOW (reduced from R0 MEDIUM) — `scope` is explicit on new tokens, legacy tokens default to
tenant, and tenant middleware now returns `403 WRONG_SCOPE` for platform tokens. Coordinated
deploy still advised but no break for existing clients.

## 40B/40C Impact

MUST BE NO — platform endpoints are read-only over canonical 40B/40C entities; no schema or
behavior change to catalog/module/subscription contracts. `account_customers` is resolved in 40F.

---

## EXACT CHANGES FROM R0

PLATFORM*ADMIN, bukan "PLink ADMIN"
platform JWT → business_id ABSENT
tenant JWT → business_id REQUIRED
tenant route + platform token → 403 WRONG_SCOPE
platform route + non-platform token → 403 WRONG_SCOPE
legacy token tanpa scope → tenant-only fallback
new tokens → selalu explicit scope
refresh → scope tetap
dual-identity → context explicit
mobile → tenant-only
SUPER_ADMIN vs PLATFORM_ADMIN → permission boundary jelas
account_customers → unresolved / 40F
no platform*\* duplicates
40B/40C unchanged

## REMAINING AMBIGUITIES (intentional, deferred)

- Exact PLATFORM_ADMIN/SUPER_ADMIN capability rows beyond read access are locked in a later
  phase (matrix placeholder only).
- `account-customers` canonical backing table lands in 40F; endpoint may return
  `409 ENTITY_UNRESOLVED` pre-40F.
- Token-versioning/`iss`/`aud` partitioning strategy not required (legacy-default + explicit
  scope is sufficient for LOW risk).
- Mobile `x-auth-context: platform` handling mode (`400` vs silent tenant fallback) is an
  implementation detail to confirm in the mobile build phase.

## FINAL VERDICT

READY FOR IMPLEMENTATION
