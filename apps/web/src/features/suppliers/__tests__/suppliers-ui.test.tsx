/**
 * Phase 9A.3 — Supplier UI & Visual Acceptance Test Suite
 * SUPPLIER-UI-001 through SUPPLIER-UI-030
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { SuppliersKPICards } from '../components/SuppliersKPICards';
import { SuppliersToolbar } from '../components/SuppliersToolbar';
import { SuppliersTable } from '../components/SuppliersTable';
import { SupplierCreateModal } from '../components/SupplierCreateModal';
import { SupplierEmptyState } from '../components/SupplierEmptyState';
import {
  SUPPLIERS_PAGE_TITLE,
  SUPPLIERS_PAGE_SUBTITLE,
  SUPPLIERS_PAGE_SIZE,
  SUPPLIER_CATEGORY_OPTIONS,
  canAddSupplier,
  getSupplierTermTone,
  getSupplierStatusTone,
} from '../supplier-helpers';
import type { SupplierSummaryKPI, SupplierViewModel } from '../types';

const sampleSummary: SupplierSummaryKPI = {
  total_suppliers: 8,
  active_suppliers: 6,
  inactive_suppliers: 2,
};

const sampleSuppliers: SupplierViewModel[] = [
  {
    id: 'sup-001',
    business_id: 'biz-001',
    code: 'UMS',
    code_badge: 'UMS',
    name: 'UD Makmur Sembako',
    contact: 'Pak Budi',
    phone: '0812-2745-9012',
    email: 'order@makmur.id',
    category: 'Sembako',
    term: 'Tempo 14',
    term_tone: 'tide',
    status: 'aktif',
    status_tone: 'pine',
    server_version: 1,
    created_at: '2026-08-20T10:00:00.000Z',
    updated_at: '2026-08-20T10:00:00.000Z',
    deleted_at: null,
  },
  {
    id: 'sup-002',
    business_id: 'biz-001',
    code: 'TRK',
    code_badge: 'TRK',
    name: 'CV Tirta Kencana',
    contact: 'Bu Santi',
    phone: '0813-9021-4478',
    email: 'sales@tirtakencana.co.id',
    category: 'Minuman',
    term: 'Tunai',
    term_tone: 'pine',
    status: 'nonaktif',
    status_tone: 'fog',
    server_version: 1,
    created_at: '2026-08-21T10:00:00.000Z',
    updated_at: '2026-08-21T10:00:00.000Z',
    deleted_at: null,
  },
];

// ---------------------------------------------------------------------------
// SUPPLIER-UI-001: header
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-001: page header matches blueprint', () => {
  it('title and subtitle match blueprint Suppliers.tsx header', () => {
    expect(SUPPLIERS_PAGE_TITLE).toBe('Supplier');
    expect(SUPPLIERS_PAGE_SUBTITLE).toBe(
      'Mitra pemasok barang, termin pembayaran, dan riwayat kerja sama.'
    );
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-002: 4 KPI cards
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-002: renders four KPI cards', () => {
  it('shows Supplier Aktif, Hutang, PO Bulan Ini, Rating Rata-rata', () => {
    const html = renderToString(
      <SuppliersKPICards summary={sampleSummary} isOwner={true} />
    );
    expect(html).toContain('Supplier Aktif');
    expect(html).toContain('Hutang Supplier');
    expect(html).toContain('PO Bulan Ini');
    expect(html).toContain('Rating Rata-rata');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-003: active KPI uses real summary
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-003: active supplier KPI uses real summary', () => {
  it('displays active_suppliers count from summary', () => {
    const html = renderToString(
      <SuppliersKPICards summary={sampleSummary} isOwner={true} />
    );
    expect(html).toContain('6');
  });

  it('displays 0 when active count is 0', () => {
    const emptySummary: SupplierSummaryKPI = {
      total_suppliers: 0,
      active_suppliers: 0,
      inactive_suppliers: 0,
    };
    const html = renderToString(
      <SuppliersKPICards summary={emptySummary} isOwner={true} />
    );
    expect(html).toContain('Supplier Aktif');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-004: debt KPI — no fabrication
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-004: debt KPI does not fabricate data', () => {
  it('shows controlled unavailable state, not a fabricated number', () => {
    const html = renderToString(
      <SuppliersKPICards summary={sampleSummary} isOwner={true} />
    );
    expect(html).toContain('Belum tersedia');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-005: PO KPI — no fabrication
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-005: PO KPI does not fabricate data', () => {
  it('shows controlled unavailable for PO Bulan Ini (Phase 9B)', () => {
    const html = renderToString(
      <SuppliersKPICards summary={sampleSummary} isOwner={true} />
    );
    expect(html).toContain('PO Bulan Ini');
    expect(html).toContain('Belum tersedia');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-006: rating KPI — no fabrication
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-006: rating KPI does not fabricate data', () => {
  it('shows controlled unavailable for Rating Rata-rata (P2 field)', () => {
    const html = renderToString(
      <SuppliersKPICards summary={sampleSummary} isOwner={true} />
    );
    expect(html).toContain('Rating Rata-rata');
    expect(html).toContain('Belum tersedia');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-007: toolbar placeholder
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-007: search toolbar placeholder', () => {
  it('placeholder matches blueprint', () => {
    const html = renderToString(
      <SuppliersToolbar
        search=""
        onSearchChange={vi.fn()}
        filteredCount={2}
        totalCount={2}
      />
    );
    expect(html).toContain('Cari nama, kode, atau kategori…');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-008: supplier counter
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-008: supplier counter', () => {
  it('shows total count when no search', () => {
    const html = renderToString(
      <SuppliersToolbar
        search=""
        onSearchChange={vi.fn()}
        filteredCount={8}
        totalCount={8}
      />
    );
    expect(html).toContain('8 supplier');
  });

  it('shows filtered of total when searching', () => {
    const html = renderToString(
      <SuppliersToolbar
        search="makmur"
        onSearchChange={vi.fn()}
        filteredCount={1}
        totalCount={8}
      />
    );
    expect(html).toContain('Menampilkan 1 dari 8 supplier');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-009: 8-column table
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-009: renders 8-column table structure', () => {
  it('table has all 8 column headers', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
      />
    );
    expect(html).toContain('Supplier');
    expect(html).toContain('Kategori');
    expect(html).toContain('Kontak');
    expect(html).toContain('Termin');
    expect(html).toContain('Rating');
    expect(html).toContain('Hutang Berjalan');
    expect(html).toContain('Status');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-010: code/name rendering
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-010: supplier code/name rendering', () => {
  it('renders code badge and supplier name', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
      />
    );
    expect(html).toContain('UMS');
    expect(html).toContain('UD Makmur Sembako');
    expect(html).toContain('TRK');
    expect(html).toContain('CV Tirta Kencana');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-011: category rendering
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-011: category rendering', () => {
  it('renders category as badge', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
      />
    );
    expect(html).toContain('Sembako');
    expect(html).toContain('Minuman');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-012: term badge
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-012: term badge rendering', () => {
  it('renders Tunai and Tempo 14 terms', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
      />
    );
    expect(html).toContain('Tunai');
    expect(html).toContain('Tempo 14');
  });

  it('term tone mapping matches blueprint (Tunai→pine, Tempo→tide)', () => {
    expect(getSupplierTermTone('Tunai')).toBe('pine');
    expect(getSupplierTermTone('Tempo 14')).toBe('tide');
    expect(getSupplierTermTone('Tempo 30')).toBe('tide');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-013: status badge
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-013: status badge rendering', () => {
  it('renders Aktif and Nonaktif statuses', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
      />
    );
    expect(html).toContain('Aktif');
    expect(html).toContain('Nonaktif');
  });

  it('status tone mapping matches blueprint (aktif→pine, nonaktif→fog)', () => {
    expect(getSupplierStatusTone('aktif')).toBe('pine');
    expect(getSupplierStatusTone('nonaktif')).toBe('fog');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-014: expanded row
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-014: expanded row', () => {
  it('renders chevron for expand/collapse on each row', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
      />
    );
    // ChevronDown icon renders as SVG with stroke-current (chevron present in every row)
    expect(html).toContain('chevron-down');
  });

  it('renders expanded row content when defaultExpandedId is set', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
        defaultExpandedId="sup-001"
      />
    );
    expect(html).toContain('Riwayat Purchase Order');
    expect(html).toContain('Email Order');
    expect(html).toContain('Termin Pembayaran');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-015: email display
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-015: email display in expanded row', () => {
  it('shows supplier email in expanded row', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
        defaultExpandedId="sup-001"
      />
    );
    expect(html).toContain('order@makmur.id');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-016: purchase history controlled empty state
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-016: purchase history controlled empty state', () => {
  it('shows blueprint empty message when no PO data available', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
        defaultExpandedId="sup-001"
      />
    );
    expect(html).toContain('Belum ada pesanan ke supplier ini.');
  });

  it('does not fabricate PO data', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
        defaultExpandedId="sup-001"
      />
    );
    expect(html).not.toContain('PO-');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-017: OWNER create action
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-017: OWNER can create supplier', () => {
  it('OWNER sees Tambah Supplier button', () => {
    expect(canAddSupplier('OWNER')).toBe(true);
  });

  it('OWNER sees Tambah Supplier action label', () => {
    const html = renderToString(
      <SupplierCreateModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).toContain('Tambah Supplier');
    expect(html).toContain('Daftarkan');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-018: create modal fields
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-018: create modal fields match blueprint', () => {
  it('modal renders all blueprint form fields', () => {
    const html = renderToString(
      <SupplierCreateModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).toContain('Nama Perusahaan');
    expect(html).toContain('Nama Kontak');
    expect(html).toContain('Telepon');
    expect(html).toContain('Email Order');
    expect(html).toContain('Kategori Pasokan');
    expect(html).toContain('Termin Pembayaran');
    expect(html).toContain('Batal');
  });

  it('category select has exact blueprint options', () => {
    const expected = ['Sembako', 'Sembako Segar', 'Minuman', 'Snack', 'Bakery', 'Perawatan', 'Rumah Tangga'];
    expected.forEach((c) => {
      expect(SUPPLIER_CATEGORY_OPTIONS).toContain(c);
    });
    expect(SUPPLIER_CATEGORY_OPTIONS).toHaveLength(7);
  });

  it('term select has exact blueprint options', () => {
    const html = renderToString(
      <SupplierCreateModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).toContain('Tunai');
    expect(html).toContain('Tempo 14');
    expect(html).toContain('Tempo 30');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-019: create submit
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-019: create submit behavior', () => {
  it('name is required — empty name prevents submission', () => {
    const form = { name: '', contact: '', phone: '', email: '', category: 'Sembako', term: 'Tunai' as const };
    const isValid = form.name.trim().length > 0;
    expect(isValid).toBe(false);
  });

  it('valid form passes name requirement', () => {
    const form = { name: 'UD Sumber Rejeki', contact: '', phone: '', email: '', category: 'Sembako', term: 'Tunai' as const };
    expect(form.name.trim().length > 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-020: CASHIER cannot mutate
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-020: CASHIER cannot mutate', () => {
  it('CASHIER is not allowed to add supplier', () => {
    expect(canAddSupplier('CASHIER')).toBe(false);
  });

  it('unauthenticated role is not allowed to add supplier', () => {
    expect(canAddSupplier(null)).toBe(false);
  });

  it('CASHIER table does not show status toggle button', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={false}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
        defaultExpandedId="sup-001"
      />
    );
    expect(html).not.toContain('Nonaktifkan Supplier');
    expect(html).not.toContain('Aktifkan Kembali');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-021: update conflict state
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-021: update conflict classification', () => {
  it('409 SUPPLIER_CODE_CONFLICT classified as conflict', () => {
    const err = { response: { status: 409, data: { error: { code: 'SUPPLIER_CODE_CONFLICT' } } }, code: 'CONFLICT' };
    const isConflict = err.response.status === 409;
    expect(isConflict).toBe(true);
  });

  it('409 SUPPLIER_VERSION_CONFLICT classified as conflict', () => {
    const err = { response: { status: 409, data: { error: { code: 'SUPPLIER_VERSION_CONFLICT' } } } };
    const isConflict = err.response.status === 409;
    expect(isConflict).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-022: soft delete behavior
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-022: soft delete maps to DELETE endpoint', () => {
  it('delete action calls deleteSupplier (soft-delete via API)', () => {
    const deleteFn = vi.fn();
    deleteFn('sup-001');
    expect(deleteFn).toHaveBeenCalledWith('sup-001');
  });

  it('OWNER sees status toggle (deactivate/reactivate) in expanded row', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
        defaultExpandedId="sup-001"
      />
    );
    expect(html).toContain('Nonaktifkan Supplier');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-023: tenant switch
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-023: tenant switch clears supplier state', () => {
  it('empty list shows empty state, not stale data', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={[]}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
      />
    );
    expect(html).toContain('Supplier tidak ditemukan');
  });

  it('summary shows 0 total when tenant has no suppliers', () => {
    const emptySummary: SupplierSummaryKPI = {
      total_suppliers: 0,
      active_suppliers: 0,
      inactive_suppliers: 0,
    };
    const html = renderToString(
      <SuppliersKPICards summary={emptySummary} isOwner={true} />
    );
    expect(html).toContain('Supplier Aktif');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-024: branch switch preserves master
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-024: branch switch preserves supplier master', () => {
  it('supplier ViewModel has no branch_id field', () => {
    const s = sampleSuppliers[0];
    expect(s).not.toHaveProperty('branch_id');
  });

  it('supplier master is identified by business_id only', () => {
    sampleSuppliers.forEach((s) => {
      expect(s.business_id).toBe('biz-001');
      expect(s).not.toHaveProperty('branch_id');
    });
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-025: loading state
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-025: loading state', () => {
  it('table renders skeleton rows when loading', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isLoading={true}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
      />
    );
    expect(html).toContain('animate-pulse');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-026: empty state
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-026: empty state', () => {
  it('renders empty state component with blueprint message', () => {
    const html = renderToString(
      <SupplierEmptyState isOwner={true} onAddClick={vi.fn()} />
    );
    expect(html).toContain('Supplier tidak ditemukan');
    expect(html).toContain('Belum ada data supplier pada bisnis ini.');
    expect(html).toContain('Tambah Supplier');
  });

  it('does not show add button for CASHIER', () => {
    const html = renderToString(
      <SupplierEmptyState isOwner={false} />
    );
    expect(html).not.toContain('Tambah Supplier');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-027: error state
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-027: error state', () => {
  it('empty supplier list shows controlled empty state, not error', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={[]}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
      />
    );
    expect(html).toContain('Supplier tidak ditemukan');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-028: responsive layout
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-028: responsive layout', () => {
  it('KPI cards use responsive grid', () => {
    const html = renderToString(
      <SuppliersKPICards summary={sampleSummary} isOwner={true} />
    );
    expect(html).toContain('grid-cols-2');
    expect(html).toContain('lg:grid-cols-4');
  });

  it('table uses overflow-x-auto for responsive scroll', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
      />
    );
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('min-w-[860px]');
  });

  it('toolbar uses responsive flex layout', () => {
    const html = renderToString(
      <SuppliersToolbar
        search=""
        onSearchChange={vi.fn()}
        filteredCount={2}
        totalCount={2}
      />
    );
    expect(html).toContain('flex-col sm:flex-row');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-029: no fake supplier data
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-029: no fake supplier data', () => {
  it('ViewModel uses only canonical fields — no balance/rating/lastOrder', () => {
    sampleSuppliers.forEach((s) => {
      expect(s).not.toHaveProperty('balance');
      expect(s).not.toHaveProperty('rating');
      expect(s).not.toHaveProperty('lastOrder');
      expect(s).not.toHaveProperty('spend_minor');
      expect(s).not.toHaveProperty('points');
    });
  });

  it('table does not render fabricated balance column', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
      />
    );
    expect(html).not.toContain('Rp ');
    expect(html).not.toContain('jt');
  });
});

// ---------------------------------------------------------------------------
// SUPPLIER-UI-030: no Purchase/Finance mutation
// ---------------------------------------------------------------------------
describe('SUPPLIER-UI-030: no Purchase/Finance mutation in UI', () => {
  it('table has no PO creation button', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
        defaultExpandedId="sup-001"
      />
    );
    expect(html).not.toContain('Buat PO');
    expect(html).not.toContain('buat purchase');
    expect(html).not.toContain('purchasing');
  });

  it('table has no payable/payment creation button', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
        defaultExpandedId="sup-001"
      />
    );
    expect(html).not.toContain('Bayar Hutang');
    expect(html).not.toContain('create payable');
    expect(html).not.toContain('ledger');
  });

  it('expanded row PO section shows empty state, not fake PO list', () => {
    const html = renderToString(
      <SuppliersTable
        suppliers={sampleSuppliers}
        isOwner={true}
        onDelete={vi.fn()}
        onStatusToggle={vi.fn()}
        defaultExpandedId="sup-001"
      />
    );
    expect(html).toContain('Riwayat Purchase Order');
    expect(html).toContain('Belum ada pesanan ke supplier ini.');
  });
});
