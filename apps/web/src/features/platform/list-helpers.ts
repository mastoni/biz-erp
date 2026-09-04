/**
 * Pure, dependency-free helpers for the Platform Control Plane shell.
 *
 * Kept free of React and of the API client so the logic can be unit-tested
 * without a DOM or a live backend. Pages compose these helpers and render.
 */
import { AxiosError } from 'axios';
import { PlatformContext } from './types';

export const PLATFORM_PAGE_SIZE = 20;

export type PlatformRole = 'PLATFORM_ADMIN' | 'SUPER_ADMIN';

// ── Pagination ───────────────────────────────────────────────────────────────

/** Inclusive 1-based range of rows currently shown. */
export function getPaginationRange(
  total: number,
  offset: number,
  pageSize: number
): { start: number; end: number } {
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + pageSize, total);
  return { start, end };
}

/** "Menampilkan X–Y dari Z <noun>" */
export function formatRangeLabel(total: number, offset: number, pageSize: number, noun: string): string {
  const { start, end } = getPaginationRange(total, offset, pageSize);
  return `Menampilkan ${start}–${end} dari ${total} ${noun}`;
}

export function isPreviousDisabled(loading: boolean, offset: number): boolean {
  return loading || offset === 0;
}

export function isNextDisabled(loading: boolean, hasMore: boolean): boolean {
  return loading || !hasMore;
}

// ── View-state transitions (shared by every list page) ──────────────────────

export function shouldShowSkeleton(loading: boolean): boolean {
  return loading;
}

export function shouldShowError(loading: boolean, error: string | null): boolean {
  return !loading && error !== null;
}

export function shouldShowEmpty(loading: boolean, error: string | null, count: number): boolean {
  return !loading && error === null && count === 0;
}

export function shouldShowTable(loading: boolean, error: string | null, count: number): boolean {
  return !loading && error === null && count > 0;
}

// ── Error extraction ─────────────────────────────────────────────────────────

export interface ApiErrorInfo {
  message: string;
  requestId: string | null;
}

export function getApiErrorInfo(err: unknown, fallback: string): ApiErrorInfo {
  if (err instanceof AxiosError) {
    const backendMessage = err.response?.data?.message;
    const message =
      typeof backendMessage === 'string' && backendMessage.length > 0
        ? backendMessage
        : err.message || fallback;
    const requestId = err.response?.headers?.['x-request-id'] ?? null;
    return { message, requestId };
  }
  return { message: fallback, requestId: null };
}

// ── Formatting (existing id-ID conventions) ─────────────────────────────────

export function formatPlatformDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number | null, currency: string | null): string {
  if (amount === null) return '-';
  const cur = currency ?? 'USD';
  try {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: cur }).format(amount);
  } catch {
    return `${cur} ${amount}`;
  }
}

export function formatNullable(value: string | null | boolean | number): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  return String(value);
}

// ── Role / context labels ────────────────────────────────────────────────────

export function getPlatformRoleLabel(role: PlatformRole | null | undefined): string {
  if (role === 'SUPER_ADMIN') return 'Super Admin';
  if (role === 'PLATFORM_ADMIN') return 'Platform Admin';
  return 'Unknown';
}

export interface PlatformContextDisplay {
  scope: string;
  roleLabel: string;
}

/** Maps the raw platform context into display fields for the Overview page. */
export function getPlatformContextDisplay(ctx: PlatformContext): PlatformContextDisplay {
  return {
    scope: ctx.scope,
    roleLabel: getPlatformRoleLabel(ctx.role),
  };
}

// ── Navigation (distinct from tenant nav; no Account Customers) ───────────────

export interface PlatformNavItem {
  name: string;
  href: string;
}

export const PLATFORM_NAVIGATION: PlatformNavItem[] = [
  { name: 'Overview', href: '/platform' },
  { name: 'Businesses', href: '/platform/businesses' },
  { name: 'Plans & Pricing', href: '/platform/plans' },
  { name: 'Bundle Composer', href: '/platform/bundles' },
  { name: 'Landing Showcase', href: '/platform/showcase' },
  { name: 'Modules', href: '/platform/modules' },
  { name: 'Subscriptions', href: '/platform/subscriptions' },
  { name: 'Support Tickets', href: '/platform/tickets' },
  { name: 'Audit Logs', href: '/platform/audit' },
  { name: 'Service Registry', href: '/platform/services' },
];

// ── Sensitive Payload Masking ────────────────────────────────────────────────
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
  /bearer/i,
  /private[_-]?key/i,
];

export function maskSensitivePayload(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(data.trim())) {
      return '[REDACTED_JWT]';
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => maskSensitivePayload(item));
  }
  if (typeof data === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
        masked[key] = '[REDACTED]';
      } else {
        masked[key] = maskSensitivePayload(value);
      }
    }
    return masked;
  }
  return data;
}

