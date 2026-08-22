/**
 * Pure logic for the Customers list page (/customers).
 *
 * Kept free of React so it can be unit-tested without a DOM.
 * The page component only composes these helpers and renders.
 */
import { AxiosError } from 'axios';

/** Page size used for GET /v1/customers (backend allows 1-500). */
export const CUSTOMERS_PAGE_SIZE = 20;

/** Header and empty-state copy (single source of truth). */
export const CUSTOMERS_PAGE_TITLE = 'Pelanggan';
export const CUSTOMERS_PAGE_SUBTITLE = 'Kelola data pelanggan';
export const CUSTOMERS_EMPTY_TITLE = 'Pelanggan belum tersedia';
export const CUSTOMERS_EMPTY_DESCRIPTION = 'Belum ada data pelanggan pada bisnis ini.';
export const CUSTOMERS_ADD_ACTION_LABEL = 'Tambah Pelanggan';

/** Default message when the request fails without a readable backend message. */
export const CUSTOMERS_FETCH_FALLBACK = 'Terjadi kesalahan saat mengambil data pelanggan.';

/** Fallback message for pagination requests failing without a backend message. */
export const CUSTOMERS_PAGE_FALLBACK = 'Terjadi kesalahan.';

export type CustomerRole = 'OWNER' | 'CASHIER' | null;

/** Only OWNER can create customers (edit/delete pages are OWNER-only too). */
export function canAddCustomer(role: CustomerRole): boolean {
  return role === 'OWNER';
}

/**
 * Inclusive 1-based range of rows currently shown.
 * e.g. total=42, offset=20, pageSize=20 -> { start: 21, end: 40 }
 */
export function getPaginationRange(
  total: number,
  offset: number,
  pageSize: number
): { start: number; end: number } {
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + pageSize, total);
  return { start, end };
}

/** "Menampilkan X–Y dari Z pelanggan" */
export function formatRangeLabel(total: number, offset: number, pageSize: number): string {
  const { start, end } = getPaginationRange(total, offset, pageSize);
  return `Menampilkan ${start}–${end} dari ${total} pelanggan`;
}

export function isPreviousDisabled(loading: boolean, offset: number): boolean {
  return loading || offset === 0;
}

export function isNextDisabled(loading: boolean, hasMore: boolean): boolean {
  return loading || !hasMore;
}

export function shouldShowSkeleton(loading: boolean): boolean {
  return loading;
}

export function shouldShowError(loading: boolean, error: string | null): boolean {
  return !loading && error !== null;
}

export function shouldShowEmpty(
  loading: boolean,
  error: string | null,
  customerCount: number
): boolean {
  return !loading && error === null && customerCount === 0;
}

export function shouldShowTable(
  loading: boolean,
  error: string | null,
  customerCount: number
): boolean {
  return !loading && error === null && customerCount > 0;
}

export interface ApiErrorInfo {
  message: string;
  requestId: string | null;
}

/**
 * Extract a human-readable message (never a stack trace) and the X-Request-Id
 * from a failed request. Falls back to `fallback` for non-axios errors or
 * empty backend messages.
 */
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

/** Cell display for nullable fields: value or the "-" placeholder. */
export function formatNullableCell(value: string | null): string {
  return value ?? '-';
}

/** Existing id-ID date formatting convention for table Dibuat/Diperbarui cells. */
export function formatCustomerDate(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
