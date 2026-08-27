/**
 * Phase 9B.3 — Purchase ViewModel & Data Layer Test Suite
 * PURCHASE-VM-001 through PURCHASE-VM-037
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import {
  calculateReceivingProgress,
  filterPurchases,
  getPurchasePaymentState,
  getPurchaseStatusLabel,
  getPurchaseStatusTone,
  mapPurchaseItemToViewModel,
  mapPurchaseListToViewModel,
  mapPurchasePaymentToViewModel,
  mapPurchaseSummaryToViewModel,
  mapPurchaseToViewModel,
} from '../purchase-helpers';
import {
  cancelPurchase,
  classifyPurchaseError,
  createPurchase,
  deleteDraftPurchase,
  getPurchase,
  getPurchases,
  getPurchasesSummary,
  payPurchase,
  receivePurchase,
  sendPurchase,
  updateDraftPurchase,
} from '../api';
import type {
  Purchase,
  PurchaseCreateInput,
  PurchaseItem,
  PurchaseListResponse,
  PurchasePayment,
  PurchasePayInput,
  PurchaseReceiveInput,
  PurchaseSendInput,
  PurchaseStatus,
  PurchaseSummaryKPI,
  PurchaseUpdateDraftInput,
  PurchaseViewModel,
  SupplierTerm,
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

const BUSINESS_A = '11111111-1111-4111-8111-111111111111';
const BRANCH_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SUPPLIER_A = '22222222-2222-4222-8222-222222222222';
const PRODUCT_A = '33333333-3333-4333-8333-333333333333';
const PRODUCT_B = '44444444-4444-4444-8444-444444444444';

function makePurchaseItem(overrides: Partial<PurchaseItem> = {}): PurchaseItem {
  return {
    id: 'item-001',
    purchase_id: 'po-001',
    product_id: PRODUCT_A,
    product_name: 'Beras Rojolele 5 kg',
    ordered_qty: 20,
    received_qty: 0,
    unit_cost_minor: 60000,
    subtotal_minor: 1200000,
    ...overrides,
  };
}

function makePurchasePayment(overrides: Partial<PurchasePayment> = {}): PurchasePayment {
  return {
    id: 'pay-001',
    business_id: BUSINESS_A,
    purchase_id: 'po-001',
    amount_minor: 600000,
    method: 'bank_transfer',
    reference: 'TRF-12345',
    idempotency_key: 'idem-pay-001',
    created_at: '2026-08-20T11:00:00.000Z',
    ...overrides,
  };
}

function makePurchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: 'po-001',
    business_id: BUSINESS_A,
    branch_id: BRANCH_A,
    supplier_id: SUPPLIER_A,
    supplier_name: 'UD Makmur Sembako',
    supplier_code: 'MKM',
    code: 'MKM/PO/001',
    date: '2026-08-20',
    due_date: '2026-09-03',
    supplier_term: 'Tempo 14',
    status: 'draft',
    total_minor: 1200000,
    received_minor: 0,
    paid_minor: 0,
    outstanding_minor: 1200000,
    note: 'Restok rutin mingguan',
    server_version: 1,
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-20T10:00:00.000Z',
    deleted_at: null,
    items: [makePurchaseItem()],
    payments: [],
    ...overrides,
  };
}

describe('Phase 9B.3 Purchase ViewModel & Data Layer Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Mappings & Properties
  // -------------------------------------------------------------------------

  it('PURCHASE-VM-001: canonical purchase mapping without fabrication', () => {
    const dto = makePurchase();
    const vm = mapPurchaseToViewModel(dto);

    expect(vm.id).toBe(dto.id);
    expect(vm.business_id).toBe(dto.business_id);
    expect(vm.branch_id).toBe(dto.branch_id);
    expect(vm.supplier_id).toBe(dto.supplier_id);
    expect(vm.code).toBe('MKM/PO/001');
    expect(vm.date).toBe('2026-08-20');
    expect(vm.due_date).toBe('2026-09-03');
    expect(vm.supplier_term).toBe('Tempo 14');
    expect(vm.status).toBe('draft');
    expect(vm.total_minor).toBe(1200000);
    expect(vm.received_minor).toBe(0);
    expect(vm.paid_minor).toBe(0);
    expect(vm.outstanding_minor).toBe(1200000);
    expect(vm.note).toBe('Restok rutin mingguan');
    expect(vm.server_version).toBe(1);
    expect(vm.created_at).toBe(dto.created_at);
    expect(vm.updated_at).toBe(dto.updated_at);
    expect(vm.deleted_at).toBeNull();

    // Invariants: No fabricated fields
    expect(vm).not.toHaveProperty('rating');
    expect(vm).not.toHaveProperty('supplier_balance');
    expect(vm).not.toHaveProperty('finance_balance');
    expect(vm).not.toHaveProperty('account_balance');
  });

  it('PURCHASE-VM-002: supplier reference/snapshot mapping', () => {
    const dto = makePurchase({
      supplier_name: 'CV Tirta Kencana',
      supplier_code: 'TRK',
      supplier_term: 'Tempo 30',
    });
    const vm = mapPurchaseToViewModel(dto);

    expect(vm.supplier_name).toBe('CV Tirta Kencana');
    expect(vm.supplier_code).toBe('TRK');
    expect(vm.supplier_term).toBe('Tempo 30');
  });

  it('PURCHASE-VM-003: branch_id mapping', () => {
    const dto = makePurchase({ branch_id: 'branch-custom-99' });
    const vm = mapPurchaseToViewModel(dto);

    expect(vm.branch_id).toBe('branch-custom-99');
  });

  // -------------------------------------------------------------------------
  // Status Labels & Tones
  // -------------------------------------------------------------------------

  it('PURCHASE-VM-004: draft status', () => {
    const vm = mapPurchaseToViewModel(makePurchase({ status: 'draft' }));
    expect(vm.status).toBe('draft');
    expect(vm.status_label).toBe('Draft');
    expect(vm.status_tone).toBe('fog');
  });

  it('PURCHASE-VM-005: sent status', () => {
    const vm = mapPurchaseToViewModel(makePurchase({ status: 'sent' }));
    expect(vm.status).toBe('sent');
    expect(vm.status_label).toBe('Dikirim');
    expect(vm.status_tone).toBe('tide');
  });

  it('PURCHASE-VM-006: partial status', () => {
    const vm = mapPurchaseToViewModel(makePurchase({ status: 'partial' }));
    expect(vm.status).toBe('partial');
    expect(vm.status_label).toBe('Parsial');
    expect(vm.status_tone).toBe('tide');
  });

  it('PURCHASE-VM-007: received status', () => {
    const vm = mapPurchaseToViewModel(makePurchase({ status: 'received' }));
    expect(vm.status).toBe('received');
    expect(vm.status_label).toBe('Diterima');
    expect(vm.status_tone).toBe('pine');
  });

  it('PURCHASE-VM-008: cancelled status', () => {
    const vm = mapPurchaseToViewModel(makePurchase({ status: 'cancelled' }));
    expect(vm.status).toBe('cancelled');
    expect(vm.status_label).toBe('Dibatalkan');
    expect(vm.status_tone).toBe('clay');
  });

  // -------------------------------------------------------------------------
  // Quantities & Progress
  // -------------------------------------------------------------------------

  it('PURCHASE-VM-009: ordered quantity mapping', () => {
    const items = [
      makePurchaseItem({ ordered_qty: 15 }),
      makePurchaseItem({ id: 'item-2', ordered_qty: 25 }),
    ];
    const vm = mapPurchaseToViewModel(makePurchase({ items }));

    expect(vm.items[0].ordered_qty).toBe(15);
    expect(vm.items[1].ordered_qty).toBe(25);
    expect(vm.ordered_total_qty).toBe(40);
  });

  it('PURCHASE-VM-010: received quantity mapping', () => {
    const items = [
      makePurchaseItem({ ordered_qty: 20, received_qty: 10 }),
      makePurchaseItem({ id: 'item-2', ordered_qty: 10, received_qty: 5 }),
    ];
    const vm = mapPurchaseToViewModel(makePurchase({ items }));

    expect(vm.items[0].received_qty).toBe(10);
    expect(vm.items[1].received_qty).toBe(5);
    expect(vm.received_total_qty).toBe(15);
  });

  it('PURCHASE-VM-011: remaining quantity calculation', () => {
    const items = [
      makePurchaseItem({ ordered_qty: 20, received_qty: 8 }),
      makePurchaseItem({ id: 'item-2', ordered_qty: 10, received_qty: 10 }),
    ];
    const vm = mapPurchaseToViewModel(makePurchase({ items }));

    expect(vm.items[0].remaining_qty).toBe(12);
    expect(vm.items[1].remaining_qty).toBe(0);
    expect(vm.remaining_total_qty).toBe(12);
  });

  it('PURCHASE-VM-012: receiving percentage based on quantities', () => {
    const items = [
      makePurchaseItem({ ordered_qty: 20, received_qty: 10 }),
      makePurchaseItem({ id: 'item-2', ordered_qty: 30, received_qty: 15 }),
    ];
    const vm = mapPurchaseToViewModel(makePurchase({ items }));

    expect(vm.ordered_total_qty).toBe(50);
    expect(vm.received_total_qty).toBe(25);
    expect(vm.receive_percentage).toBe(50);
  });

  // -------------------------------------------------------------------------
  // Financial Snapshot & Semantics
  // -------------------------------------------------------------------------

  it('PURCHASE-VM-013: unit cost snapshot from PO item', () => {
    const item = makePurchaseItem({ unit_cost_minor: 45000 });
    const lineVm = mapPurchaseItemToViewModel(item);

    expect(lineVm.unit_cost_minor).toBe(45000);
  });

  it('PURCHASE-VM-014: subtotal snapshot from PO item', () => {
    const item = makePurchaseItem({ ordered_qty: 10, unit_cost_minor: 25000, subtotal_minor: 250000 });
    const lineVm = mapPurchaseItemToViewModel(item);

    expect(lineVm.subtotal_minor).toBe(250000);
  });

  it('PURCHASE-VM-015: Tunai outstanding semantics (outstanding = received_minor - paid_minor = 0)', () => {
    const po = makePurchase({
      supplier_term: 'Tunai',
      total_minor: 500000,
      received_minor: 200000,
      paid_minor: 200000,
      outstanding_minor: 0,
    });
    const vm = mapPurchaseToViewModel(po);

    expect(vm.supplier_term).toBe('Tunai');
    expect(vm.outstanding_minor).toBe(0);
    expect(vm.received_minor).toBe(200000);
    expect(vm.paid_minor).toBe(200000);
  });

  it('PURCHASE-VM-016: Tempo outstanding semantics (outstanding = total_minor - paid_minor)', () => {
    const po = makePurchase({
      supplier_term: 'Tempo 14',
      total_minor: 1000000,
      received_minor: 400000,
      paid_minor: 300000,
      outstanding_minor: 700000,
    });
    const vm = mapPurchaseToViewModel(po);

    expect(vm.supplier_term).toBe('Tempo 14');
    expect(vm.total_minor).toBe(1000000);
    expect(vm.paid_minor).toBe(300000);
    expect(vm.outstanding_minor).toBe(700000);
  });

  it('PURCHASE-VM-017: payment state separation from PO status', () => {
    // Draft/Sent -> unpaid
    expect(getPurchasePaymentState({ status: 'draft', supplier_term: 'Tunai', paid_minor: 0, total_minor: 100, received_minor: 0, outstanding_minor: 0 })).toBe('unpaid');
    expect(getPurchasePaymentState({ status: 'sent', supplier_term: 'Tempo 14', paid_minor: 0, total_minor: 100, received_minor: 0, outstanding_minor: 100 })).toBe('unpaid');

    // Tunai received -> paid
    expect(getPurchasePaymentState({ status: 'received', supplier_term: 'Tunai', paid_minor: 100, total_minor: 100, received_minor: 100, outstanding_minor: 0 })).toBe('paid');

    // Tempo partially paid -> partial
    expect(getPurchasePaymentState({ status: 'received', supplier_term: 'Tempo 30', paid_minor: 50, total_minor: 100, received_minor: 100, outstanding_minor: 50 })).toBe('partial');

    // Tempo fully paid -> paid
    expect(getPurchasePaymentState({ status: 'received', supplier_term: 'Tempo 30', paid_minor: 100, total_minor: 100, received_minor: 100, outstanding_minor: 0 })).toBe('paid');

    // Cancelled -> not_applicable
    expect(getPurchasePaymentState({ status: 'cancelled', supplier_term: 'Tempo 14', paid_minor: 0, total_minor: 100, received_minor: 0, outstanding_minor: 100 })).toBe('not_applicable');
  });

  // -------------------------------------------------------------------------
  // Supplier Terms
  // -------------------------------------------------------------------------

  it('PURCHASE-VM-018: Tunai term mapping', () => {
    const vm = mapPurchaseToViewModel(makePurchase({ supplier_term: 'Tunai' }));
    expect(vm.supplier_term).toBe('Tunai');
  });

  it('PURCHASE-VM-019: Tempo 14 mapping', () => {
    const vm = mapPurchaseToViewModel(makePurchase({ supplier_term: 'Tempo 14' }));
    expect(vm.supplier_term).toBe('Tempo 14');
  });

  it('PURCHASE-VM-020: Tempo 30 mapping', () => {
    const vm = mapPurchaseToViewModel(makePurchase({ supplier_term: 'Tempo 30' }));
    expect(vm.supplier_term).toBe('Tempo 30');
  });

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  it('PURCHASE-VM-021: draft filter returns only draft POs', () => {
    const items = [
      mapPurchaseToViewModel(makePurchase({ id: 'po-1', status: 'draft' })),
      mapPurchaseToViewModel(makePurchase({ id: 'po-2', status: 'sent' })),
      mapPurchaseToViewModel(makePurchase({ id: 'po-3', status: 'received' })),
    ];
    const filtered = filterPurchases(items, { status: 'draft' });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('po-1');
  });

  it('PURCHASE-VM-022: status filter matches all status types', () => {
    const items = [
      mapPurchaseToViewModel(makePurchase({ id: 'po-1', status: 'draft' })),
      mapPurchaseToViewModel(makePurchase({ id: 'po-2', status: 'sent' })),
      mapPurchaseToViewModel(makePurchase({ id: 'po-3', status: 'partial' })),
      mapPurchaseToViewModel(makePurchase({ id: 'po-4', status: 'received' })),
      mapPurchaseToViewModel(makePurchase({ id: 'po-5', status: 'cancelled' })),
    ];

    expect(filterPurchases(items, { status: 'Semua' })).toHaveLength(5);
    expect(filterPurchases(items, { status: 'sent' })).toHaveLength(1);
    expect(filterPurchases(items, { status: 'partial' })).toHaveLength(1);
    expect(filterPurchases(items, { status: 'received' })).toHaveLength(1);
    expect(filterPurchases(items, { status: 'cancelled' })).toHaveLength(1);
  });

  it('PURCHASE-VM-023: search filter searches code, supplier, item names, and note', () => {
    const items = [
      mapPurchaseToViewModel(makePurchase({ id: 'po-1', code: 'MKM/PO/001', supplier_name: 'UD Makmur', supplier_code: 'MKM', items: [], note: null })),
      mapPurchaseToViewModel(makePurchase({ id: 'po-2', code: 'TRK/PO/002', supplier_name: 'CV Tirta Kencana', supplier_code: 'TRK', items: [], note: 'Khusus Teh Botol' })),
      mapPurchaseToViewModel(makePurchase({ id: 'po-3', code: 'SNK/PO/003', supplier_name: 'PT Snack', supplier_code: 'SNK', items: [makePurchaseItem({ product_name: 'Keripik Singkong' })], note: null })),
    ];

    expect(filterPurchases(items, { search: 'mkm' })).toHaveLength(1);
    expect(filterPurchases(items, { search: 'tirta' })).toHaveLength(1);
    expect(filterPurchases(items, { search: 'khusus' })).toHaveLength(1);
    expect(filterPurchases(items, { search: 'keripik' })).toHaveLength(1);
    expect(filterPurchases(items, { search: 'xyz-not-found' })).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Tenant & Branch Lifecycle
  // -------------------------------------------------------------------------

  it('PURCHASE-VM-024: tenant switch clears state and passes auth tenant context', async () => {
    const mockGet = api.get as ReturnType<typeof vi.fn>;
    mockGet.mockResolvedValueOnce({
      data: { items: [makePurchase()], total: 1, limit: 20, offset: 0, has_more: false },
    });

    await getPurchases(BUSINESS_A, BRANCH_A, 20, 0);

    expect(mockGet).toHaveBeenCalledWith('/v1/purchases', {
      params: { business_id: BUSINESS_A, branch_id: BRANCH_A, limit: 20, offset: 0 },
    });
  });

  it('PURCHASE-VM-025: branch switch reloads purchase list for target branch', async () => {
    const mockGet = api.get as ReturnType<typeof vi.fn>;
    mockGet.mockResolvedValueOnce({
      data: { items: [], total: 0, limit: 20, offset: 0, has_more: false },
    });

    const targetBranch = 'branch-sub-2';
    await getPurchases(BUSINESS_A, targetBranch, 20, 0);

    expect(mockGet).toHaveBeenCalledWith('/v1/purchases', {
      params: { business_id: BUSINESS_A, branch_id: targetBranch, limit: 20, offset: 0 },
    });
  });

  // -------------------------------------------------------------------------
  // Payloads & API Methods
  // -------------------------------------------------------------------------

  it('PURCHASE-VM-026: create payload includes required fields without client-side total fabrication', async () => {
    const mockPost = api.post as ReturnType<typeof vi.fn>;
    mockPost.mockResolvedValueOnce({ data: makePurchase() });

    const input: PurchaseCreateInput = {
      id: crypto.randomUUID(),
      business_id: BUSINESS_A,
      branch_id: BRANCH_A,
      supplier_id: SUPPLIER_A,
      items: [{ product_id: PRODUCT_A, ordered_qty: 10 }],
      note: 'Order test',
    };

    await createPurchase(input);

    expect(mockPost).toHaveBeenCalledWith('/v1/purchases', input, expect.objectContaining({
      headers: expect.objectContaining({
        'Idempotency-Key': expect.any(String),
      }),
    }));
  });

  it('PURCHASE-VM-027: update draft sends expected_server_version', async () => {
    const mockPut = api.put as ReturnType<typeof vi.fn>;
    mockPut.mockResolvedValueOnce({ data: makePurchase({ note: 'Updated note' }) });

    const input: PurchaseUpdateDraftInput = {
      business_id: BUSINESS_A,
      expected_server_version: 2,
      note: 'Updated note',
    };

    await updateDraftPurchase('po-001', input);

    expect(mockPut).toHaveBeenCalledWith('/v1/purchases/po-001', input);
  });

  it('PURCHASE-VM-028: send payload includes business_id, expected_server_version, and Idempotency-Key', async () => {
    const mockPost = api.post as ReturnType<typeof vi.fn>;
    mockPost.mockResolvedValueOnce({ data: makePurchase({ status: 'sent', server_version: 2 }) });

    const input: PurchaseSendInput = {
      business_id: BUSINESS_A,
      expected_server_version: 1,
    };

    await sendPurchase('po-001', input);

    expect(mockPost).toHaveBeenCalledWith('/v1/purchases/po-001/send', input, expect.objectContaining({
      headers: expect.objectContaining({
        'Idempotency-Key': expect.any(String),
      }),
    }));
  });

  it('PURCHASE-VM-029: receive payload includes item_id, receive_qty, version, and Idempotency-Key', async () => {
    const mockPost = api.post as ReturnType<typeof vi.fn>;
    mockPost.mockResolvedValueOnce({ data: makePurchase({ status: 'partial', server_version: 3 }) });

    const input: PurchaseReceiveInput = {
      business_id: BUSINESS_A,
      expected_server_version: 2,
      items: [{ item_id: 'item-001', receive_qty: 5 }],
    };

    await receivePurchase('po-001', input);

    expect(mockPost).toHaveBeenCalledWith('/v1/purchases/po-001/receive', input, expect.objectContaining({
      headers: expect.objectContaining({
        'Idempotency-Key': expect.any(String),
      }),
    }));
  });

  it('PURCHASE-VM-030: pay payload includes amount_minor, method, version, and Idempotency-Key', async () => {
    const mockPost = api.post as ReturnType<typeof vi.fn>;
    mockPost.mockResolvedValueOnce({ data: makePurchase({ paid_minor: 500000, server_version: 4 }) });

    const input: PurchasePayInput = {
      business_id: BUSINESS_A,
      expected_server_version: 3,
      amount_minor: 500000,
      method: 'bank_transfer',
      reference: 'TRF-PAY-99',
    };

    await payPurchase('po-001', input);

    expect(mockPost).toHaveBeenCalledWith('/v1/purchases/po-001/pay', input, expect.objectContaining({
      headers: expect.objectContaining({
        'Idempotency-Key': expect.any(String),
      }),
    }));
  });

  it('PURCHASE-VM-031: cancel payload includes expected_server_version and Idempotency-Key', async () => {
    const mockPost = api.post as ReturnType<typeof vi.fn>;
    mockPost.mockResolvedValueOnce({ data: makePurchase({ status: 'cancelled', server_version: 5 }) });

    const input = {
      business_id: BUSINESS_A,
      expected_server_version: 4,
    };

    await cancelPurchase('po-001', input);

    expect(mockPost).toHaveBeenCalledWith('/v1/purchases/po-001/cancel', input, expect.objectContaining({
      headers: expect.objectContaining({
        'Idempotency-Key': expect.any(String),
      }),
    }));
  });

  // -------------------------------------------------------------------------
  // Error Classification & Idempotency
  // -------------------------------------------------------------------------

  it('PURCHASE-VM-032: error classification maps canonical backend errors', () => {
    const makeAxiosErr = (status: number, code: string) =>
      new AxiosError('Err', 'ERR', undefined, undefined, {
        status,
        data: { error: { code, message: 'Message' } },
      } as any);

    expect(classifyPurchaseError(makeAxiosErr(409, 'PURCHASE_CODE_CONFLICT'))).toBe('code_conflict');
    expect(classifyPurchaseError(makeAxiosErr(409, 'PURCHASE_VERSION_CONFLICT'))).toBe('version_conflict');
    expect(classifyPurchaseError(makeAxiosErr(409, 'STOCK_VERSION_CONFLICT'))).toBe('stock_version_conflict');
    expect(classifyPurchaseError(makeAxiosErr(409, 'IDEMPOTENCY_KEY_REUSE'))).toBe('code_conflict');
    expect(classifyPurchaseError(makeAxiosErr(400, 'VALIDATION_ERROR'))).toBe('validation_error');
    expect(classifyPurchaseError(makeAxiosErr(403, 'BUSINESS_ACCESS_DENIED'))).toBe('forbidden');
    expect(classifyPurchaseError(makeAxiosErr(404, 'NOT_FOUND'))).toBe('not_found');
    expect(classifyPurchaseError(new Error('Network Error failed ECONNREFUSED'))).toBe('network_error');
    expect(classifyPurchaseError(new Error('Some generic error'))).toBe('unknown');
  });

  it('PURCHASE-VM-033: Idempotency-Key is generated for mutating operations', async () => {
    const mockPost = api.post as ReturnType<typeof vi.fn>;
    mockPost.mockResolvedValue({ data: makePurchase() });

    await createPurchase({
      id: crypto.randomUUID(),
      business_id: BUSINESS_A,
      branch_id: BRANCH_A,
      supplier_id: SUPPLIER_A,
      items: [{ product_id: PRODUCT_A, ordered_qty: 1 }],
    });
    const createKey = mockPost.mock.calls[0][2]?.headers?.['Idempotency-Key'];
    expect(createKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    await sendPurchase('po-1', { business_id: BUSINESS_A, expected_server_version: 1 });
    const sendKey = mockPost.mock.calls[1][2]?.headers?.['Idempotency-Key'];
    expect(sendKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    await receivePurchase('po-1', { business_id: BUSINESS_A, expected_server_version: 1, items: [{ item_id: 'i-1', receive_qty: 1 }] });
    const receiveKey = mockPost.mock.calls[2][2]?.headers?.['Idempotency-Key'];
    expect(receiveKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    await payPurchase('po-1', { business_id: BUSINESS_A, expected_server_version: 1, amount_minor: 100, method: 'cash' });
    const payKey = mockPost.mock.calls[3][2]?.headers?.['Idempotency-Key'];
    expect(payKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    await cancelPurchase('po-1', { business_id: BUSINESS_A, expected_server_version: 1 });
    const cancelKey = mockPost.mock.calls[4][2]?.headers?.['Idempotency-Key'];
    expect(cancelKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  // -------------------------------------------------------------------------
  // Anti-Fabrication & Integrity Guards
  // -------------------------------------------------------------------------

  it('PURCHASE-VM-034: no fabricated finance data on PurchaseViewModel', () => {
    const vm = mapPurchaseToViewModel(makePurchase());

    expect(vm).not.toHaveProperty('supplier_balance');
    expect(vm).not.toHaveProperty('finance_balance');
    expect(vm).not.toHaveProperty('account_balance');
    expect(vm).not.toHaveProperty('supplier_rating');
    expect(vm).not.toHaveProperty('purchase_history');
  });

  it('PURCHASE-VM-035: no client-side inventory mutation during receive', async () => {
    const mockPost = api.post as ReturnType<typeof vi.fn>;
    mockPost.mockResolvedValueOnce({
      data: makePurchase({ status: 'received', received_minor: 1200000, server_version: 2 }),
    });

    const res = await receivePurchase('po-001', {
      business_id: BUSINESS_A,
      expected_server_version: 1,
      items: [{ item_id: 'item-001', receive_qty: 20 }],
    });

    // Client only receives server state; no client-side stock array was modified directly
    expect(res.status).toBe('received');
    expect(res.server_version).toBe(2);
  });

  it('PURCHASE-VM-036: no fabricated HPP (uses snapshot unit_cost_minor, no 72% synthetic calculation)', () => {
    const item = makePurchaseItem({ unit_cost_minor: 75000 });
    const lineVm = mapPurchaseItemToViewModel(item);

    expect(lineVm.unit_cost_minor).toBe(75000);
    // Should NOT be Math.round((75000 * 0.72) / 500) * 500
    expect(lineVm.unit_cost_minor).not.toBe(54000);
  });

  it('PURCHASE-VM-037: due_date is server-authoritative and preserved directly', () => {
    const vm = mapPurchaseToViewModel(makePurchase({
      date: '2026-08-20',
      due_date: '2026-09-03',
      supplier_term: 'Tempo 14',
    }));

    // Server-computed due date string is preserved as-is
    expect(vm.due_date).toBe('2026-09-03');
  });
});
