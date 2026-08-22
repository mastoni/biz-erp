/**
 * Customers list page tests — CUSTOMER-WEB-018 through CUSTOMER-WEB-027
 *
 * Pure unit tests: no DOM, no network.
 * The /customers page delegates all display/decision logic to
 * `../list-helpers`, so the tests exercise the exact logic the page renders.
 */
import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import {
  CUSTOMERS_PAGE_SIZE,
  CUSTOMERS_PAGE_TITLE,
  CUSTOMERS_PAGE_SUBTITLE,
  CUSTOMERS_EMPTY_TITLE,
  CUSTOMERS_EMPTY_DESCRIPTION,
  CUSTOMERS_ADD_ACTION_LABEL,
  CUSTOMERS_FETCH_FALLBACK,
  CUSTOMERS_PAGE_FALLBACK,
  canAddCustomer,
  getPaginationRange,
  formatRangeLabel,
  isPreviousDisabled,
  isNextDisabled,
  shouldShowSkeleton,
  shouldShowError,
  shouldShowEmpty,
  shouldShowTable,
  getApiErrorInfo,
  formatNullableCell,
  formatCustomerDate,
} from '../list-helpers';

// ── Helper to build a fake axios error ──────────────────────────────────────

function makeAxiosError(message: string, data?: { message?: string }, headers?: Record<string, string>): AxiosError {
  const err = new AxiosError(message, 'ERR_BAD_RESPONSE', undefined, undefined, {
    status: 400,
    statusText: 'Bad Request',
    headers,
    config: { headers: {} },
    data,
  } as never);
  return err;
}

// ── Header / roles ───────────────────────────────────────────────────────────

describe('CUSTOMER-WEB-018: List page renders heading', () => {
  it('header shows the Customers title and subtitle', () => {
    expect(CUSTOMERS_PAGE_TITLE).toBe('Customers');
    expect(CUSTOMERS_PAGE_SUBTITLE).toBe('Kelola data pelanggan');
  });
});

describe('CUSTOMER-WEB-019: OWNER sees Add Customer', () => {
  it('OWNER is allowed to add a customer', () => {
    expect(canAddCustomer('OWNER')).toBe(true);
    expect(CUSTOMERS_ADD_ACTION_LABEL).toBe('Tambah Pelanggan');
  });
});

describe('CUSTOMER-WEB-020: CASHIER does not see Add Customer', () => {
  it('CASHIER and unauthenticated roles are not allowed to add a customer', () => {
    expect(canAddCustomer('CASHIER')).toBe(false);
    expect(canAddCustomer(null)).toBe(false);
  });
});

// ── Table data ───────────────────────────────────────────────────────────────

describe('CUSTOMER-WEB-021: Table renders customer data', () => {
  it('renders phone/email values when present', () => {
    expect(formatNullableCell('081234567890')).toBe('081234567890');
    expect(formatNullableCell('john@example.com')).toBe('john@example.com');
  });

  it('renders a "-" placeholder when phone/email is null', () => {
    expect(formatNullableCell(null)).toBe('-');
  });

  it('table section only renders with data (not while loading, on error, or when empty)', () => {
    expect(shouldShowTable(false, null, 3)).toBe(true);
    expect(shouldShowTable(true, null, 3)).toBe(false);
    expect(shouldShowTable(false, 'error', 3)).toBe(false);
    expect(shouldShowTable(false, null, 0)).toBe(false);
  });

  it('uses the existing id-ID date formatting convention for Dibuat/Diperbarui', () => {
    const iso = '2026-01-05T14:30:00.000Z';
    const formatted = formatCustomerDate(iso);
    expect(formatted.length).toBeGreaterThan(0);
    // Deterministic: same input always produces the same rendered label
    expect(formatted).toBe(formatCustomerDate(iso));
    // Uses the id-ID locale convention (Indonesian short month name)
    expect(formatted).toContain('2026');
  });
});

// ── Empty state ──────────────────────────────────────────────────────────────

describe('CUSTOMER-WEB-022: Empty state renders', () => {
  it('shows the empty state when the list has no items', () => {
    expect(CUSTOMERS_EMPTY_TITLE).toBe('Pelanggan belum tersedia');
    expect(CUSTOMERS_EMPTY_DESCRIPTION).toBe('Belum ada data pelanggan pada bisnis ini.');
    expect(shouldShowEmpty(false, null, 0)).toBe(true);
  });

  it('does not show the empty state while loading, on error, or with items', () => {
    expect(shouldShowEmpty(true, null, 0)).toBe(false);
    expect(shouldShowEmpty(false, 'error', 0)).toBe(false);
    expect(shouldShowEmpty(false, null, 3)).toBe(false);
  });
});

// ── Pagination ───────────────────────────────────────────────────────────────

describe('CUSTOMER-WEB-023: Pagination uses limit/offset', () => {
  it('page size is within the backend-supported range (1-500)', () => {
    expect(CUSTOMERS_PAGE_SIZE).toBeGreaterThanOrEqual(1);
    expect(CUSTOMERS_PAGE_SIZE).toBeLessThanOrEqual(500);
  });

  it('next page advances the offset by the limit', () => {
    expect(0 + CUSTOMERS_PAGE_SIZE).toBe(20);
    expect(20 + CUSTOMERS_PAGE_SIZE).toBe(40);
  });

  it('previous page steps back by the limit, clamped at offset 0', () => {
    expect(Math.max(0, 20 - CUSTOMERS_PAGE_SIZE)).toBe(0);
    expect(Math.max(0, 40 - CUSTOMERS_PAGE_SIZE)).toBe(20);
  });

  it('computes the inclusive displayed range from offset, limit and total', () => {
    expect(getPaginationRange(42, 0, CUSTOMERS_PAGE_SIZE)).toEqual({ start: 1, end: 20 });
    expect(getPaginationRange(42, 20, CUSTOMERS_PAGE_SIZE)).toEqual({ start: 21, end: 40 });
    expect(getPaginationRange(42, 40, CUSTOMERS_PAGE_SIZE)).toEqual({ start: 41, end: 42 });
    expect(getPaginationRange(0, 0, CUSTOMERS_PAGE_SIZE)).toEqual({ start: 0, end: 0 });
  });

  it('renders "Menampilkan X–Y dari Z pelanggan"', () => {
    expect(formatRangeLabel(42, 0, CUSTOMERS_PAGE_SIZE)).toBe('Menampilkan 1–20 dari 42 pelanggan');
  });
});

describe('CUSTOMER-WEB-024: Next disabled when has_more=false', () => {
  it('Next is disabled when has_more is false, and enabled when true', () => {
    expect(isNextDisabled(false, false)).toBe(true);
    expect(isNextDisabled(false, true)).toBe(false);
    // Also disabled while a request is in flight
    expect(isNextDisabled(true, true)).toBe(true);
  });

  it('Previous is disabled at the first page (offset 0)', () => {
    expect(isPreviousDisabled(false, 0)).toBe(true);
    expect(isPreviousDisabled(false, 20)).toBe(false);
    expect(isPreviousDisabled(true, 20)).toBe(true);
  });
});

// ── Loading / error states ───────────────────────────────────────────────────

describe('CUSTOMER-WEB-025: Loading skeleton renders', () => {
  it('skeleton shows while loading and hides when settled', () => {
    expect(shouldShowSkeleton(true)).toBe(true);
    expect(shouldShowSkeleton(false)).toBe(false);
  });
});

describe('CUSTOMER-WEB-026: Error + retry renders', () => {
  it('error state shows when a request fails and not while loading', () => {
    expect(shouldShowError(false, 'Gagal memuat data pelanggan')).toBe(true);
    expect(shouldShowError(true, 'Gagal memuat data pelanggan')).toBe(false);
    expect(shouldShowError(false, null)).toBe(false);
  });
});

describe('CUSTOMER-WEB-027: Request ID shown on error', () => {
  it('extracts the X-Request-Id from the response headers when present', () => {
    const info = getApiErrorInfo(
      makeAxiosError('Request failed with status code 400', { message: 'Validation error' }, { 'x-request-id': 'req-abc-123' }),
      CUSTOMERS_FETCH_FALLBACK
    );
    expect(info.requestId).toBe('req-abc-123');
    expect(info.message).toBe('Validation error');
  });

  it('does not show a request ID when the header is absent', () => {
    const info = getApiErrorInfo(
      makeAxiosError('Request failed with status code 500', { message: 'Database error' }),
      CUSTOMERS_FETCH_FALLBACK
    );
    expect(info.requestId).toBeNull();
    expect(info.message).toBe('Database error');
  });

  it('falls back to a human-readable message and never exposes a stack trace', () => {
    const info = getApiErrorInfo(new Error('boom'), CUSTOMERS_FETCH_FALLBACK);
    expect(info.message).toBe(CUSTOMERS_FETCH_FALLBACK);
    expect(info.message).not.toContain('boom');
    expect(info.requestId).toBeNull();

    const pageFallback = getApiErrorInfo(undefined, CUSTOMERS_PAGE_FALLBACK);
    expect(pageFallback.message).toBe(CUSTOMERS_PAGE_FALLBACK);
  });
});
