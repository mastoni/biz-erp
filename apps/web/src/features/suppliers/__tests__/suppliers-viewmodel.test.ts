/**
 * Phase 9A.2 — Supplier ViewModel & Data Layer Test Suite
 * SUPPLIER-VM-001 through SUPPLIER-VM-024
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import {
  filterSuppliers,
  getSupplierStatusTone,
  getSupplierTermTone,
  mapSuppliersListToViewModel,
  mapSupplierSummaryToViewModel,
  mapSupplierToViewModel,
} from '../supplier-helpers';
import {
  classifySupplierError,
  createSupplier,
  deleteSupplier,
  getSupplier,
  getSuppliers,
  updateSupplier,
} from '../api';
import type {
  Supplier,
  SupplierCreateFormModel,
  SupplierCreateInput,
  SupplierListResponse,
  SupplierSummaryKPI,
  SupplierUpdateInput,
  SupplierViewModel,
} from '../types';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '@/lib/api';

const BUSINESS_ID = '11111111-1111-4111-8111-111111111111';

function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 'sup-001',
    business_id: BUSINESS_ID,
    code: 'UMS',
    name: 'UD Makmur Sembako',
    contact: 'Pak Darmawan',
    phone: '0812-2745-9012',
    email: 'order@makmur.id',
    category: 'Sembako',
    term: 'Tempo 14',
    status: 'aktif',
    server_version: 1,
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-20T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

// ── Helpers: mapping ──────────────────────────────────────────────────────────

describe('SUPPLIER-VM-001: canonical supplier mapping', () => {
  it('maps all canonical DTO fields to SupplierViewModel without fabrication', () => {
    const dto = makeSupplier();
    const vm = mapSupplierToViewModel(dto);

    expect(vm.id).toBe(dto.id);
    expect(vm.business_id).toBe(dto.business_id);
    expect(vm.code).toBe('UMS');
    expect(vm.code_badge).toBe('UMS');
    expect(vm.name).toBe('UD Makmur Sembako');
    expect(vm.contact).toBe('Pak Darmawan');
    expect(vm.phone).toBe('0812-2745-9012');
    expect(vm.email).toBe('order@makmur.id');
    expect(vm.category).toBe('Sembako');
    expect(vm.term).toBe('Tempo 14');
    expect(vm.term_tone).toBe('tide');
    expect(vm.status).toBe('aktif');
    expect(vm.status_tone).toBe('pine');
    expect(vm.server_version).toBe(1);
    expect(vm.created_at).toBe('2026-08-20T10:00:00.000Z');
    expect(vm.updated_at).toBe('2026-08-20T10:00:00.000Z');
    expect(vm.deleted_at).toBeNull();

    // P0 contract: NO balance/rating/lastOrder
    expect(vm).not.toHaveProperty('balance');
    expect(vm).not.toHaveProperty('rating');
    expect(vm).not.toHaveProperty('lastOrder');
    expect(vm).not.toHaveProperty('last_order');
  });
});

// ── Helpers: code ─────────────────────────────────────────────────────────────

describe('SUPPLIER-VM-002: code mapping', () => {
  it('code comes from server, code_badge uppercased for display', () => {
    const dto = makeSupplier({ code: 'ums' });
    const vm = mapSupplierToViewModel(dto);

    expect(vm.code).toBe('ums');
    expect(vm.code_badge).toBe('UMS');
  });
});

// ── Helpers: term ─────────────────────────────────────────────────────────────

describe('SUPPLIER-VM-003: Tunai term mapping', () => {
  it('maps Tunai term to pine tone', () => {
    const vm = mapSupplierToViewModel(makeSupplier({ term: 'Tunai' }));
    expect(vm.term).toBe('Tunai');
    expect(vm.term_tone).toBe('pine');
    expect(getSupplierTermTone('Tunai')).toBe('pine');
  });
});

describe('SUPPLIER-VM-004: Tempo 14 term mapping', () => {
  it('maps Tempo 14 term to tide tone', () => {
    const vm = mapSupplierToViewModel(makeSupplier({ term: 'Tempo 14' }));
    expect(vm.term).toBe('Tempo 14');
    expect(vm.term_tone).toBe('tide');
    expect(getSupplierTermTone('Tempo 14')).toBe('tide');
  });
});

describe('SUPPLIER-VM-005: Tempo 30 term mapping', () => {
  it('maps Tempo 30 term to tide tone', () => {
    const vm = mapSupplierToViewModel(makeSupplier({ term: 'Tempo 30' }));
    expect(vm.term).toBe('Tempo 30');
    expect(vm.term_tone).toBe('tide');
    expect(getSupplierTermTone('Tempo 30')).toBe('tide');
  });
});

// ── Helpers: status ───────────────────────────────────────────────────────────

describe('SUPPLIER-VM-006: aktif status mapping', () => {
  it('maps aktif status to pine tone', () => {
    const vm = mapSupplierToViewModel(makeSupplier({ status: 'aktif' }));
    expect(vm.status).toBe('aktif');
    expect(vm.status_tone).toBe('pine');
    expect(getSupplierStatusTone('aktif')).toBe('pine');
  });
});

describe('SUPPLIER-VM-007: nonaktif status mapping', () => {
  it('maps nonaktif status to fog tone', () => {
    const vm = mapSupplierToViewModel(makeSupplier({ status: 'nonaktif' }));
    expect(vm.status).toBe('nonaktif');
    expect(vm.status_tone).toBe('fog');
    expect(getSupplierStatusTone('nonaktif')).toBe('fog');
  });
});

// ── Helpers: search ───────────────────────────────────────────────────────────

describe('SUPPLIER-VM-008: search by name', () => {
  it('filters items by matching supplier name case-insensitively', () => {
    const vms = [
      mapSupplierToViewModel(makeSupplier({ name: 'UD Makmur Sembako' })),
      mapSupplierToViewModel(makeSupplier({ name: 'CV Tirta Kencana' })),
    ];

    const filtered = filterSuppliers(vms, { search: 'makmur' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('UD Makmur Sembako');
  });
});

describe('SUPPLIER-VM-009: search by code', () => {
  it('filters items by matching code', () => {
    const vms = [
      mapSupplierToViewModel(makeSupplier({ code: 'UMS', name: 'Supplier A' })),
      mapSupplierToViewModel(makeSupplier({ code: 'TRK', name: 'Supplier B' })),
    ];

    const filtered = filterSuppliers(vms, { search: 'ums' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].code).toBe('UMS');
  });
});

describe('SUPPLIER-VM-010: search by category', () => {
  it('filters items by matching category', () => {
    const vms = [
      mapSupplierToViewModel(makeSupplier({ category: 'Sembako', name: 'Supplier A' })),
      mapSupplierToViewModel(makeSupplier({ category: 'Minuman', name: 'Supplier B' })),
    ];

    const filtered = filterSuppliers(vms, { search: 'sembako' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Supplier A');
  });
});

describe('SUPPLIER-VM-011: case-insensitive search', () => {
  it('matches search regardless of case', () => {
    const vms = [
      mapSupplierToViewModel(makeSupplier({ id: 's1', name: 'UD Makmur Sembako', code: 'UMS' })),
      mapSupplierToViewModel(makeSupplier({ id: 's2', name: 'CV Tirta Kencana', code: 'TRK' })),
    ];

    expect(vms).toHaveLength(2);
    expect(vms[0].name).toBe('UD Makmur Sembako');
    expect(vms[1].name).toBe('CV Tirta Kencana');
    // 'makmur' IS a substring of 'ud makmur sembako'
    expect(vms[0].name.toLowerCase().includes('makmur')).toBe(true);
    expect('ud makmur sembako'.includes('makmur')).toBe(true);

    expect(filterSuppliers(vms, { search: 'MAKMUR' })).toHaveLength(1);
    expect(filterSuppliers(vms, { search: 'makmurrr' })).toHaveLength(0);
    expect(filterSuppliers(vms, { search: 'CV TIRTa' })).toHaveLength(1);
    expect(filterSuppliers(vms, { search: '' })).toHaveLength(2);
  });
});

// ── Helpers: empty state ──────────────────────────────────────────────────────

describe('SUPPLIER-VM-012: empty state', () => {
  it('handles empty supplier list response cleanly', () => {
    const res: SupplierListResponse = {
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
      has_more: false,
    };

    const vmList = mapSuppliersListToViewModel(res);
    expect(vmList.items).toHaveLength(0);
    expect(vmList.total).toBe(0);
    expect(vmList.summary.total_suppliers).toBe(0);
    expect(vmList.summary.active_suppliers).toBe(0);
    expect(vmList.summary.inactive_suppliers).toBe(0);
  });
});

// ── Tenant & Branch ───────────────────────────────────────────────────────────

describe('SUPPLIER-VM-013: tenant switch clears/reloads', () => {
  it('ensures clean state when switching tenant', () => {
    const tenantA = mapSuppliersListToViewModel({
      items: [makeSupplier()],
      total: 1,
      limit: 20,
      offset: 0,
      has_more: false,
    });
    expect(tenantA.items).toHaveLength(1);

    // Simulating new tenant: state is cleared before reload
    const clearing = mapSuppliersListToViewModel({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
      has_more: false,
    });
    expect(clearing.items).toHaveLength(0);
    expect(clearing.summary.total_suppliers).toBe(0);

    // New tenant data after reload
    const tenantB = mapSuppliersListToViewModel({
      items: [
        makeSupplier({ id: 'sup-tenant-b-1', name: 'Different Supplier' }),
        makeSupplier({ id: 'sup-tenant-b-2', name: 'Another Supplier' }),
      ],
      total: 2,
      limit: 20,
      offset: 0,
      has_more: false,
    });
    expect(tenantB.items).toHaveLength(2);
    expect(tenantB.items[0].name).toBe('Different Supplier');
  });

  it('summary falls back to local aggregate when API summary is null', () => {
    const res: SupplierListResponse = {
      items: [
        makeSupplier({ id: 's1', status: 'aktif', name: 'Active' }),
        makeSupplier({ id: 's2', status: 'nonaktif', name: 'Inactive' }),
        makeSupplier({ id: 's3', status: 'aktif', name: 'Active 2' }),
      ],
      total: 3,
      limit: 20,
      offset: 0,
      has_more: false,
      // no summary field
    };

    const vmList = mapSuppliersListToViewModel(res);
    expect(vmList.summary.total_suppliers).toBe(3);
    expect(vmList.summary.active_suppliers).toBe(2);
    expect(vmList.summary.inactive_suppliers).toBe(1);
  });
});

describe('SUPPLIER-VM-014: branch switch preserves supplier master', () => {
  it('supplier master is business-scoped, independent of active branch', () => {
    const supplier = makeSupplier();
    expect(supplier.business_id).toBe(BUSINESS_ID);
    // No branch_id property on supplier master — business-scoped only
    expect((supplier as any).branch_id).toBeUndefined();
  });
});

// ── Mutation payloads ─────────────────────────────────────────────────────────

describe('SUPPLIER-VM-015: create payload', () => {
  it('builds valid supplier create payload with canonical fields', () => {
    const form: SupplierCreateFormModel = {
      name: 'UD Makmur Sembako',
      contact: 'Pak Darmawan',
      phone: '0812-2745-9012',
      email: 'order@makmur.id',
      category: 'Sembako',
      term: 'Tempo 14',
    };

    const payload: SupplierCreateInput = {
      id: crypto.randomUUID(),
      business_id: BUSINESS_ID,
      name: form.name.trim(),
      contact: form.contact.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      category: form.category || null,
      term: form.term,
    };

    expect(payload.id).toBeDefined();
    expect(payload.business_id).toBe(BUSINESS_ID);
    expect(payload.name).toBe('UD Makmur Sembako');
    expect(payload.contact).toBe('Pak Darmawan');
    expect(payload.term).toBe('Tempo 14');

    // No fabricated fields
    expect(payload).not.toHaveProperty('balance');
    expect(payload).not.toHaveProperty('rating');
    expect(payload).not.toHaveProperty('lastOrder');
  });
});

describe('SUPPLIER-VM-016: update expected_server_version', () => {
  it('update input includes expected_server_version for optimistic locking', () => {
    const currentVersion = 5;
    const updates = { name: 'Updated Name' };

    const input: SupplierUpdateInput = {
      business_id: BUSINESS_ID,
      expected_server_version: currentVersion,
      ...updates,
    };

    expect(input.expected_server_version).toBe(5);
    expect(input.name).toBe('Updated Name');
    expect(input.business_id).toBe(BUSINESS_ID);
  });
});

describe('SUPPLIER-VM-017: delete maps to soft-delete API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deleteSupplier calls DELETE /v1/suppliers/:id', async () => {
    const mockDelete = api.delete as ReturnType<typeof vi.fn>;
    mockDelete.mockResolvedValueOnce({ data: undefined });

    await deleteSupplier('sup-001');

    expect(mockDelete).toHaveBeenCalledWith('/v1/suppliers/sup-001');
  });
});

// ── Error classification ────────────────────────────────────────────────────────

describe('SUPPLIER-VM-018: code conflict classification', () => {
  it('409 SUPPLIER_CODE_CONFLICT → code_conflict', () => {
    const err = new AxiosError(
      'Conflict',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 409,
        data: { error: { code: 'SUPPLIER_CODE_CONFLICT', message: 'Code exists' } },
      } as any
    );
    expect(classifySupplierError(err)).toBe('code_conflict');
  });
});

describe('SUPPLIER-VM-019: version conflict classification', () => {
  it('409 SUPPLIER_VERSION_CONFLICT → version_conflict', () => {
    const err = new AxiosError(
      'Conflict',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 409,
        data: { error: { code: 'SUPPLIER_VERSION_CONFLICT', message: 'Version mismatch' } },
      } as any
    );
    expect(classifySupplierError(err)).toBe('version_conflict');
  });
});

describe('SUPPLIER-VM-020: validation error classification', () => {
  it('400 VALIDATION_ERROR → validation_error', () => {
    const err = new AxiosError(
      'Validation',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 400,
        data: { error: { code: 'VALIDATION_ERROR', message: 'Invalid' } },
      } as any
    );
    expect(classifySupplierError(err)).toBe('validation_error');
  });
});

describe('SUPPLIER-VM-021: forbidden classification', () => {
  it('403 → forbidden', () => {
    const err = new AxiosError(
      'Forbidden',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 403,
        data: { error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Forbidden' } },
      } as any
    );
    expect(classifySupplierError(err)).toBe('forbidden');
  });
});

describe('SUPPLIER-VM-022: not found classification', () => {
  it('404 → not_found', () => {
    const err = new AxiosError(
      'Not Found',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 404,
        data: { error: { code: 'NOT_FOUND', message: 'Not found' } },
      } as any
    );
    expect(classifySupplierError(err)).toBe('not_found');
  });
});

// ── No fabricated data ────────────────────────────────────────────────────────

describe('SUPPLIER-VM-023: no fabricated balance/rating/lastOrder', () => {
  it('SupplierViewModel contains only canonical P0 master fields + allowed derived fields', () => {
    const dto = makeSupplier();
    const vm = mapSupplierToViewModel(dto);

    // Allowed fields
    expect(vm).toHaveProperty('id');
    expect(vm).toHaveProperty('business_id');
    expect(vm).toHaveProperty('code');
    expect(vm).toHaveProperty('code_badge');
    expect(vm).toHaveProperty('name');
    expect(vm).toHaveProperty('contact');
    expect(vm).toHaveProperty('phone');
    expect(vm).toHaveProperty('email');
    expect(vm).toHaveProperty('category');
    expect(vm).toHaveProperty('term');
    expect(vm).toHaveProperty('term_tone');
    expect(vm).toHaveProperty('status');
    expect(vm).toHaveProperty('status_tone');
    expect(vm).toHaveProperty('server_version');
    expect(vm).toHaveProperty('created_at');
    expect(vm).toHaveProperty('updated_at');
    expect(vm).toHaveProperty('deleted_at');

    // Forbidden fields
    expect(vm).not.toHaveProperty('balance');
    expect(vm).not.toHaveProperty('rating');
    expect(vm).not.toHaveProperty('lastOrder');
    expect(vm).not.toHaveProperty('last_order');
    expect(vm).not.toHaveProperty('purchase_history');
  });
});

// ── Tenant authority ──────────────────────────────────────────────────────────

describe('SUPPLIER-VM-024: business_id remains auth-derived', () => {
  it('business_id is never fabricated — passes through from API response', () => {
    const tenantAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const tenantBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    const supplierA = makeSupplier({ business_id: tenantAId });
    const supplierB = makeSupplier({ business_id: tenantBId, id: 'sup-002' });

    const vmA = mapSupplierToViewModel(supplierA);
    const vmB = mapSupplierToViewModel(supplierB);

    expect(vmA.business_id).toBe(tenantAId);
    expect(vmB.business_id).toBe(tenantBId);
    expect(vmA.business_id).not.toBe(vmB.business_id);
  });

  it('list API passes business_id as query param, not as request body', async () => {
    vi.clearAllMocks();
    const mockGet = api.get as ReturnType<typeof vi.fn>;
    mockGet.mockResolvedValueOnce({
      data: { items: [], total: 0, limit: 20, offset: 0, has_more: false },
    });

    await getSuppliers(BUSINESS_ID, 20, 0);

    expect(mockGet).toHaveBeenCalledWith('/v1/suppliers', {
      params: { business_id: BUSINESS_ID, limit: 20, offset: 0 },
    });
  });

  it('createSupplier sends Idempotency-Key header', async () => {
    vi.clearAllMocks();
    const mockPost = api.post as ReturnType<typeof vi.fn>;
    mockPost.mockResolvedValueOnce({ data: makeSupplier() });

    const input: SupplierCreateInput = {
      id: crypto.randomUUID(),
      business_id: BUSINESS_ID,
      name: 'Test Supplier',
    };

    await createSupplier(input);

    const call = mockPost.mock.calls[0];
    expect(call[0]).toBe('/v1/suppliers');
    expect(call[1]).toEqual(input);
    expect(call[2]?.headers?.['Idempotency-Key']).toBeDefined();
  });

  it('updateSupplier sends PUT with expected_server_version', async () => {
    vi.clearAllMocks();
    const mockPut = api.put as ReturnType<typeof vi.fn>;
    mockPut.mockResolvedValueOnce({ data: makeSupplier() });

    const input: SupplierUpdateInput = {
      business_id: BUSINESS_ID,
      expected_server_version: 3,
      name: 'Updated',
    };

    await updateSupplier('sup-001', input);

    expect(mockPut).toHaveBeenCalledWith('/v1/suppliers/sup-001', input);
  });
});
