'use client';

import React, { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { type TenantRole, type PlatformRole } from './scope';

interface TenantGuardProps {
  children: ReactNode;
  requireRole?: TenantRole[];
  fallback?: ReactNode;
}

/**
 * Route guard foundation for TENANT (business) routes.
 *
 * Renders `children` only when the current session is a valid tenant session
 * (scope=tenant, with a business context). Platform sessions are rejected, so a
 * platform administrator (including OWNER with a platform role) can never reach
 * tenant pages through UI state alone — they must explicitly obtain a tenant
 * context (e.g. re-login with x-auth-context=tenant / business selection).
 *
 * UX-only: the server remains authoritative.
 */
export function TenantGuard({ children, requireRole, fallback = null }: TenantGuardProps) {
  const auth = useAuth();
  if (!auth.canAccessTenant(requireRole)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

interface PlatformGuardProps {
  children: ReactNode;
  requirePlatformRole?: PlatformRole[];
  fallback?: ReactNode;
}

/**
 * Route guard foundation for PLATFORM (Control Plane) routes.
 *
 * Renders `children` only when the current session is a valid platform session
 * (scope=platform). Tenant sessions are always rejected (MUST reject tenant
 * sessions) — OWNER can never satisfy a platform guard.
 *
 * UX-only: the server remains authoritative.
 */
export function PlatformGuard({ children, requirePlatformRole, fallback = null }: PlatformGuardProps) {
  const auth = useAuth();
  if (!auth.canAccessPlatform(requirePlatformRole)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
