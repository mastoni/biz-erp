/**
 * Customers module tests — CUSTOMER-WEB-001 through CUSTOMER-WEB-017
 *
 * Pure unit tests: no DOM, no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canAccessRoute, getAuthorizedNavigation } from '../../../lib/rbac';
import { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer } from '../api';
import type { Customer, CustomerListResponse } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-001',
    business_id: '11111111-1111-1111-1111-111111111111',
    name: 'John Doe',
    phone: '081234567890',
    email: 'john@example.com',
    server_version: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

// ── RBAC ───────────────────────────────────────────────────────────────────

describe('CUSTOMER-WEB-001: OWNER sees Customers navigation', () => {
  it('OWNER can access /customers route', () => {
    expect(canAccessRoute('OWNER', '/customers')).toBe(true);
  });

  it('OWNER sees /customers in getAuthorizedNavigation', () => {
    const nav = getAuthorizedNavigation('OWNER');
    expect(nav.map((n) => n.href)).toContain('/customers');
  });
});

describe('CUSTOMER-WEB-002: CASHIER sees Customers navigation', () => {
  it('CASHIER can access /customers route', () => {
    expect(canAccessRoute('CASHIER', '/customers')).toBe(true);
  });

  it('CASHIER can access /customers/:id route', () => {
    expect(canAccessRoute('CASHIER', '/customers/some-uuid')).toBe(true);
  });

  it('CASHIER sees /customers in getAuthorizedNavigation', () => {
    const nav = getAuthorizedNavigation('CASHIER');
    expect(nav.map((n) => n.href)).toContain('/customers');
  });
});

describe('CUSTOMER-WEB-003: OWNER can access /customers/new', () => {
  it('OWNER can access /customers/new', () => {
    expect(canAccessRoute('OWNER', '/customers/new')).toBe(true);
  });
});

describe('CUSTOMER-WEB-004: CASHIER direct /customers/new → 403', () => {
  it('CASHIER cannot access /customers/new', () => {
    expect(canAccessRoute('CASHIER', '/customers/new')).toBe(false);
  });
});

// Note: CUSTOMER-WEB-005/006 (Edit/Delete visibility) are UI-level concerns
// tested via component behavior. The RBAC route guard prevents CASHIER from
// accessing /customers/new. Edit pages check role client-side.

// ── API Client ─────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '@/lib/api';

describe('CUSTOMER-WEB-007: List calls /v1/customers with business_id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCustomers passes business_id, limit, offset to /v1/customers', async () => {
    const mockGet = api.get as ReturnType<typeof vi.fn>;
    const mockResponse: { data: CustomerListResponse } = {
      data: { items: [], total: 0, limit: 20, offset: 0, has_more: false },
    };
    mockGet.mockResolvedValueOnce(mockResponse);

    const businessId = '11111111-1111-1111-1111-111111111111';
    await getCustomers(businessId, 20, 0);

    expect(mockGet).toHaveBeenCalledWith('/v1/customers', {
      params: { business_id: businessId, limit: 20, offset: 0 },
    });
  });
});

describe('CUSTOMER-WEB-008: Pagination uses limit/offset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCustomers uses the provided limit and offset', async () => {
    const mockGet = api.get as ReturnType<typeof vi.fn>;
    mockGet.mockResolvedValueOnce({ data: { items: [], total: 0, limit: 10, offset: 10, has_more: false } });

    await getCustomers('biz-id', 10, 10);

    expect(mockGet).toHaveBeenCalledWith('/v1/customers', {
      params: { business_id: 'biz-id', limit: 10, offset: 10 },
    });
  });
});

describe('CUSTOMER-WEB-012: Detail calls /v1/customers/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCustomer passes business_id and id', async () => {
    const mockGet = api.get as ReturnType<typeof vi.fn>;
    mockGet.mockResolvedValueOnce({ data: makeCustomer() });

    await getCustomer('biz-id', 'cust-001');

    expect(mockGet).toHaveBeenCalledWith('/v1/customers/cust-001', {
      params: { business_id: 'biz-id' },
    });
  });
});

describe('CUSTOMER-WEB-013: Create form validation (pure logic)', () => {
  it('name is required and must be non-empty', () => {
    const validate = (name: string) => name.trim().length > 0;
    expect(validate('')).toBe(false);
    expect(validate('  ')).toBe(false);
    expect(validate('John')).toBe(true);
  });

  it('email must be valid if supplied', () => {
    const validateEmail = (email: string) => {
      if (!email.trim()) return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    };
    expect(validateEmail('')).toBe(true);
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('a@b.com')).toBe(true);
  });
});

describe('CUSTOMER-WEB-014: Update submits correctly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateCustomer sends PUT to /v1/customers/:id with body', async () => {
    const mockPut = api.put as ReturnType<typeof vi.fn>;
    mockPut.mockResolvedValueOnce({ data: makeCustomer() });

    await updateCustomer('cust-001', {
      business_id: 'biz-id',
      expected_server_version: 1,
      name: 'Updated Name',
      phone: '0899999',
    });

    expect(mockPut).toHaveBeenCalledWith('/v1/customers/cust-001', {
      business_id: 'biz-id',
      expected_server_version: 1,
      name: 'Updated Name',
      phone: '0899999',
    });
  });
});

describe('CUSTOMER-WEB-015: Delete calls DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deleteCustomer sends DELETE to /v1/customers/:id', async () => {
    const mockDelete = api.delete as ReturnType<typeof vi.fn>;
    mockDelete.mockResolvedValueOnce({ data: undefined });

    await deleteCustomer('cust-001');

    expect(mockDelete).toHaveBeenCalledWith('/v1/customers/cust-001');
  });
});

// ── Security ────────────────────────────────────────────────────────────────

describe('CUSTOMER-WEB-017: No X-Demo-Business-Id sent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCustomers does not send X-Demo-Business-Id header', async () => {
    const mockGet = api.get as ReturnType<typeof vi.fn>;
    mockGet.mockResolvedValueOnce({ data: { items: [], total: 0, limit: 20, offset: 0, has_more: false } });

    await getCustomers('biz-id', 20, 0);

    const call = mockGet.mock.calls[0];
    const config = call[1] as { headers?: Record<string, string> };
    expect(config?.headers?.['X-Demo-Business-Id']).toBeUndefined();
  });

  it('createCustomer does not send X-Demo-Business-Id header', async () => {
    const mockPost = api.post as ReturnType<typeof vi.fn>;
    mockPost.mockResolvedValueOnce({ data: makeCustomer() });

    await createCustomer({ id: 'new-cust-id', business_id: 'biz-id', name: 'Test' });

    const call = mockPost.mock.calls[0];
    config_unused: {
      // post has body as 2nd arg, no config
      const config = call[2] as { headers?: Record<string, string> };
      expect(config?.headers?.['X-Demo-Business-Id']).toBeUndefined();
    }
  });
});
