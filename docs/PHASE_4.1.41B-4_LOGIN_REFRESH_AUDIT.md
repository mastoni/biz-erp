# 41B-4 LOGIN / REFRESH CONTEXT AUDIT

Status: DESIGN ONLY. No implementation, no migration created, no code changed.
Preceded by 41B-1 (71c6069), 41B-2 (6ae07b9), 41B-3 (b9a1f34).

Reference inspection (unchanged today):
- `apps/api/migrations/007_auth_foundation.sql` — `refresh_tokens` DDL.
- `apps/api/src/repositories/refresh_session_repository.ts` — session CRUD.
- `apps/api/src/services/refresh_token_service.ts` — create / validate / rotate / revoke.
- `apps/api/src/routes/auth_routes.ts` — `/login`, `/refresh`, `/logout`, `/me`.
- `apps/api/src/services/auth_service.ts` — `authenticateCredentials` (returns `{user, membership?}`).
- `apps/api/src/repositories/user_repository.ts` — `PublicUser.platformRole` (added 41B-1).

---

## Current Login Flow

`POST /v1/auth/login` (`auth_routes.ts:106`):
1. `authService.authenticateCredentials(email, password, business_id?)`.
2. If `membership` absent → list active businesses; 0 → 403, 1 → pick, >1 → 409 `BUSINESS_SELECTION_REQUIRED`.
3. `refreshTokenService.createRefreshSession(userId, businessId)` → always requires a `business_id`.
4. `jwtService.signAccessToken({ sub, business_id, role, session_id, jti })` → now emits `scope:'tenant'` (41B-2).
5. For web client, refresh token set as httpOnly cookie; otherwise returned in body.

No `x-auth-context` parsing exists. No platform branch exists. A user with `platform_role` set is still treated purely as a tenant if they also have a `user_businesses` membership.

## Current Refresh Flow

`POST /v1/auth/refresh` (`auth_routes.ts:189`):
1. Resolve refresh token (cookie or body).
2. `refreshTokenService.rotateRefreshToken(refresh_token)`.
3. `userBusinessRepo.findActiveMembership(session.user_id, session.business_id)` → if none, 403 `BUSINESS_ACCESS_DENIED`.
4. `jwtService.signAccessToken({ sub, business_id, role: membership.role, session_id, jti })`.

Rotation hard-copies `session.business_id` into the new session and re-derives `role` from the tenant membership. `scope` is defaulted to `tenant` by `signAccessToken` (41B-2). The refresh session itself carries **no `scope`** and **always a non-null `business_id`**.

## refresh_tokens Schema

From `migrations/007_auth_foundation.sql:22-32`:

| column | type | constraint |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | NOT NULL, FK users(id) |
| business_id | UUID | **NOT NULL**, FK businesses(id) |
| token_hash | TEXT | UNIQUE NOT NULL |
| device_id | TEXT | nullable |
| expires_at | TIMESTAMPTZ | NOT NULL |
| revoked_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| last_used_at | TIMESTAMPTZ | nullable |

NOT NULL: `id`, `user_id`, `business_id`, `token_hash`, `expires_at`.
`business_id` is `NOT NULL` and FK-constrained to `businesses(id)`.

---

## Platform Compatibility

- **Can a platform refresh session be represented today?** **NO.**
  - `business_id NOT NULL` blocks a platform session (which must have `business_id` ABSENT).
  - There is no `scope` column, so a session cannot declare `platform`; every session is implicitly tenant.
- **Can legacy tenant refresh sessions still be accepted?** **YES** — with a schema default of
  `scope='tenant'`, every existing row (which has a real `business_id`) continues to be a valid
  tenant session. No code change needed for legacy acceptance beyond honoring the default.

## Required Schema Changes

**Migration required: YES** (but NOT created in this phase).

Minimal, safe, additive:
1. Make `refresh_tokens.business_id` nullable (`ALTER COLUMN business_id DROP NOT NULL`).
   FK to `businesses(id)` still permits NULL.
2. Add `scope TEXT NOT NULL DEFAULT 'tenant' CHECK (scope IN ('tenant','platform'))`.

Rationale for NOT storing `role` in the session: current tenant refresh already **re-derives `role`**
from `user_businesses` on every refresh (so demotion/revocation is reflected immediately). Platform
refresh must mirror this and **re-read `role` from `users.platform_role`** at refresh time. Storing
`role` in the session would risk serving a stale/revoked platform role. Therefore the session needs
only `scope` + a nullable `business_id`; `role` is always re-derived.

## Required Code Changes

1. **`refresh_session_repository.ts`**
   - `create(params)` → `businessId?: string | null`, `scope: 'tenant' | 'platform'`; persist both.
   - `revokeByOwnership(id, userId, businessId)` → handle NULL business_id:
     `WHERE id=$1 AND user_id=$2 AND (business_id = $3 OR (business_id IS NULL AND $3 IS NULL)) AND revoked_at IS NULL`.
     (Platform logout must revoke its NULL-business_id row; a plain `business_id = $3` would never match NULL.)
2. **`refresh_token_service.ts`**
   - `createRefreshSession(userId, businessId | null, scope, deviceId?)` — pass through.
   - `rotateRefreshToken(oldToken, scope?)` — preserve `session.scope` and `session.business_id`
     (null for platform) into the new session; never flip scope.
   - `validateRefreshToken` already tolerates null `businessId` (binding check is skipped when
     `businessId` absent) — sufficient for platform.
3. **`auth_routes.ts` — login**
   - Read `x-auth-context` header (default `tenant`).
   - `platform`: if `user.platformRole` is null → `403 PLATFORM_ACCESS_DENIED`; else issue platform
     token (`scope:'platform'`, no `business_id`) and create refresh session with `businessId: null`,
     `scope:'platform'`.
   - `tenant`/default: unchanged (existing flow).
4. **`auth_routes.ts` — refresh**
   - Branch on `session.scope`:
     - `platform`: re-read `users.platform_role` (must be present, else `403 PLATFORM_ACCESS_DENIED`);
       issue platform token (no `business_id`); rotate with `scope:'platform'`, `businessId: null`.
     - `tenant`: unchanged (existing membership lookup).
5. **Logout / revoke for both scopes**
   - `POST /v1/auth/logout` is gated by the **tenant** middleware (41B-3) and derives `businessId`
     from the tenant token, so a platform token is already rejected there (`403 WRONG_SCOPE`).
   - Add a **platform-scoped logout** (e.g. `POST /v1/platform/logout` mounted after
     `createPlatformJwtAuthMiddleware`) that revokes `session.id` by id (business_id is NULL).
   - `revokeSession(id, userId, businessId)` currently calls `revokeByOwnership`; for platform it must
     call the NULL-safe `revokeByOwnership` (item 1) so the NULL row is actually revoked.

## Legacy Compatibility

- Existing sessions: `business_id` populated + new `scope` default `'tenant'` → accepted as tenant.
- The default `'tenant'` prevents any legacy session from being interpreted as platform.
- Tenant login/refresh code paths are byte-for-byte compatible for the `tenant`/`default` context.
- Rotation for tenant sessions is unchanged (same `business_id`, same membership-derived `role`,
  `scope` stays `'tenant'`).

## Security Risks

- **Business-id invention**: platform refresh session MUST store `business_id = NULL`, never a
  placeholder. Enforced by construction + NOT-NULL drop (null allowed) + platform issuance path
  never passing a `business_id`.
- **Auto tenant escalation**: platform session `scope='platform'`; `rotateRefreshToken` copies
  `session.scope` verbatim — it can never become `tenant`. Refresh for platform re-reads
  `users.platform_role`, so a demoted admin immediately loses platform access on next refresh.
- **Session reuse across scopes**: a single DB row has exactly one `scope`; tenant and platform
  sessions are distinct rows. No shared session.
- **Platform role bypass**: platform refresh re-validates `users.platform_role` every time
  (never trusts the token alone beyond `scope`), and the platform middleware re-checks
  `role ∈ PLATFORM_ADMIN|SUPER_ADMIN`.
- **Revoke gap**: if `revokeByOwnership` is not made NULL-safe, a platform logout would silently
  fail to revoke its NULL-business_id row → token remains usable. Must use the NULL-safe variant.
- **Logout routing**: platform logout must not reuse the tenant `/v1/auth/logout` (which would
  403 a platform token); it needs its own platform-gated endpoint.

## Exact Migration Design

```sql
-- Phase 4.1.41B-4: Platform refresh-session support (additive, non-breaking)
-- 1. Allow platform refresh sessions (no business scope).
ALTER TABLE refresh_tokens
  ALTER COLUMN business_id DROP NOT NULL;

-- 2. Record the session scope so rotation preserves it and legacy rows stay tenant.
ALTER TABLE refresh_tokens
  ADD COLUMN scope TEXT NOT NULL DEFAULT 'tenant'
  CHECK (scope IN ('tenant', 'platform'));
```

Notes:
- `DEFAULT 'tenant'` keeps every pre-existing row a valid tenant session (backward compatible).
- `business_id` FK to `businesses(id)` still permits NULL.
- No change to `token_hash`, `expires_at`, `revoked_at`, or `user_id`.
- No change to `users`, `user_businesses`, 40B, or 40C entities.

## Exact Files Likely To Change (future implementation phase — NOT now)

- `apps/api/migrations/018_platform_refresh_session.sql` — NEW (the design above).
- `apps/api/src/repositories/refresh_session_repository.ts` — nullable `businessId`, `scope`, NULL-safe `revokeByOwnership`.
- `apps/api/src/services/refresh_token_service.ts` — `createRefreshSession`/`rotateRefreshToken` carry `scope` + nullable `businessId`.
- `apps/api/src/routes/auth_routes.ts` — `x-auth-context` branching in login; `scope` branching in refresh.
- `apps/api/src/routes/platform_routes.ts` — add `POST /v1/platform/logout` (platform revoke by id).
- Tests: `apps/api/test/platform_login_refresh.test.ts` (NEW) — dual-context login, platform refresh
  preserves scope+role with NULL business_id, tenant refresh unchanged, legacy session accepted.
- Existing `apps/api/test/auth_login.test.ts`, `auth_refresh.test.ts`, `auth_logout.test.ts` remain
  green (tenant paths unchanged; default `scope='tenant'`).

## Does this affect 40B/40C?
**MUST BE NO.** The change touches only `refresh_tokens` (auth infrastructure) and login/refresh
issuance. Canonical 40B (catalog/modules/plans/bundles) and 40C (subscriptions) entities, queries,
and behaviors are untouched.

## Implementation Plan (summary, not executed)

1. Create migration `018` (nullable `business_id` + `scope`), apply, verify legacy sessions still
   rotate as tenant.
2. Update `refresh_session_repository` (nullable businessId, scope, NULL-safe revoke).
3. Update `refresh_token_service` (scope-preserving create/rotate).
4. Update `auth_routes` login: `x-auth-context` → platform issues `scope:'platform'`, `business_id:null`
   refresh session; tenant unchanged.
5. Update `auth_routes` refresh: branch on `session.scope`; platform re-reads `users.platform_role`.
6. Add `POST /v1/platform/logout` for platform revocation by id.
7. Add targeted tests; run full regression; typecheck.

## Final Verdict
**READY FOR IMPLEMENTATION** (schema + code changes are additive, backward compatible, and preserve
all security invariants; the exact migration is specified and must be created in the implementation
phase, not here).
