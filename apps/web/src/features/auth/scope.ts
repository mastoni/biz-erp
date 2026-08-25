/**
 * Web authentication scope + role foundation (PHASE 4.1.41C-1).
 *
 * Pure, dependency-free module that models the two disjoint identity scopes
 * described in docs/PHASE_4.1.41B_PLATFORM_AUTH_CONTRACT.md:
 *
 *   TENANT   scope=tenant   role=OWNER|CASHIER   business_id required
 *   PLATFORM scope=platform role=PLATFORM_ADMIN|SUPER_ADMIN  business_id absent
 *
 * These helpers are UX-only. The server/API guards remain authoritative.
 * Client-side guards must never be used as proof of authorization.
 */

export interface Business {
  id: string;
  name: string;
  role?: string;
  plan?: string;
  status?: string;
}

export type AuthScope = 'tenant' | 'platform' | null;
export type TenantRole = 'OWNER' | 'CASHIER' | null;
export type PlatformRole = 'PLATFORM_ADMIN' | 'SUPER_ADMIN' | null;
export type TenantStatus = 'loading' | 'available' | 'active' | 'switching' | 'error' | 'empty';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidBusinessId(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  return UUID_REGEX.test(id);
}

export interface ScopeState {
  scope: AuthScope;
  role: TenantRole;
  platformRole: PlatformRole;
  business: Business | null;
}

export function isTenant(state: ScopeState): boolean {
  return state.scope === 'tenant';
}

export function isPlatform(state: ScopeState): boolean {
  return state.scope === 'platform';
}

export function isOwner(state: ScopeState): boolean {
  return isTenant(state) && state.role === 'OWNER';
}

export function isCashier(state: ScopeState): boolean {
  return isTenant(state) && state.role === 'CASHIER';
}

export function isPlatformAdmin(state: ScopeState): boolean {
  return isPlatform(state) && state.platformRole === 'PLATFORM_ADMIN';
}

export function isSuperAdmin(state: ScopeState): boolean {
  return isPlatform(state) && state.platformRole === 'SUPER_ADMIN';
}

/**
 * Tenant route guard decision.
 *
 * A session is only allowed on tenant routes when it is explicitly a tenant
 * session (scope=tenant) AND carries a business context. Platform sessions
 * (scope=platform) are always rejected, so a platform administrator can never
 * reach tenant pages by UI state alone.
 *
 * An optional `requireRole` narrows access to specific tenant roles.
 */
export function canAccessTenant(state: ScopeState, requireRole?: TenantRole[]): boolean {
  if (!isTenant(state)) return false;
  // Tenant scope requires a business context. A tenant session without a
  // business is incomplete and must not be trusted on tenant routes.
  if (state.business === null) return false;
  if (requireRole && requireRole.length > 0) {
    if (!state.role || !requireRole.includes(state.role)) return false;
  }
  return true;
}

/**
 * Platform route guard decision.
 *
 * A session is only allowed on platform routes when it is explicitly a platform
 * session (scope=platform). Tenant sessions (scope=tenant, including OWNER)
 * are always rejected — OWNER can never satisfy a platform guard.
 *
 * An optional `requirePlatformRole` narrows access to specific platform roles.
 */
export function canAccessPlatform(state: ScopeState, requirePlatformRole?: PlatformRole[]): boolean {
  // MUST reject tenant sessions (including OWNER).
  if (!isPlatform(state)) return false;
  if (requirePlatformRole && requirePlatformRole.length > 0) {
    if (!state.platformRole || !requirePlatformRole.includes(state.platformRole)) return false;
  }
  return true;
}
