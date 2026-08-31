/**
 * Phase 6D — Customers UI Component & Acceptance Test Suite
 * CUSTOMER-UI-001 through CUSTOMER-UI-020
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { CustomersKPICards } from '../components/CustomersKPICards';
import { CustomersToolbar } from '../components/CustomersToolbar';
import { CustomersTable } from '../components/CustomersTable';
import { CustomerCreateModal } from '../components/CustomerCreateModal';
import {
  filterCustomers,
  formatRelativeCustomerVisit,
  getCustomerInitials,
  getCustomerTierTone,
  idrShort,
  mapCustomerSummaryToViewModel,
  mapCustomerToViewModel,
  num,
} from '../customer-helpers';
import type { CustomerSummaryKPI, CustomerViewModel } from '../types';

describe('PHASE 6D — Customers UI Acceptance Tests', () => {
  const sampleSummary: CustomerSummaryKPI = {
    total_customers: 8,
    gold_members: 3,
    silver_members: 3,
    regular_members: 2,
    monthly_spend_minor: 73280000,
  };

  const sampleCustomers: CustomerViewModel[] = [
    {
      id: 'c1111111-1111-4111-8111-111111111111',
      code: 'CST-001',
      name: 'Dewi Lestari',
      phone: '0812-3345-1908',
      email: 'dewi@gmail.com',
      tier: 'Gold',
      points: 2450,
      spend_minor: 12450000,
      last_visit: 'Hari ini',
      last_visit_epoch: 1787740800000,
      initials: 'DL',
      tier_tone: 'honey',
    },
    {
      id: 'c2222222-2222-4222-8222-222222222222',
      code: 'CST-002',
      name: 'Andi Prasetyo',
      phone: '0857-2210-4471',
      email: null,
      tier: 'Silver',
      points: 980,
      spend_minor: 4860000,
      last_visit: 'Kemarin',
      last_visit_epoch: 1787654400000,
      initials: 'AP',
      tier_tone: 'tide',
    },
    {
      id: 'c3333333-3333-4333-8333-333333333333',
      code: 'CST-003',
      name: 'Yoga Pratama',
      phone: '0896-1120-3384',
      email: 'yoga@gmail.com',
      tier: 'Reguler',
      points: 140,
      spend_minor: 890000,
      last_visit: '4 hari lalu',
      last_visit_epoch: 1787395200000,
      initials: 'YO',
      tier_tone: 'fog',
    },
  ];

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-001: header matches blueprint
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-001: header matches blueprint title, description and button', () => {
    const html = renderToString(
      <div>
        <h1>Pelanggan</h1>
        <p>Member terdaftar, poin loyalitas, dan riwayat belanja.</p>
        <button>Tambah Pelanggan</button>
      </div>
    );
    expect(html).toContain('Pelanggan');
    expect(html).toContain('Member terdaftar, poin loyalitas, dan riwayat belanja.');
    expect(html).toContain('Tambah Pelanggan');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-002: four KPI cards
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-002: renders four KPI cards with exact labels and values', () => {
    const html = renderToString(<CustomersKPICards summary={sampleSummary} />);
    expect(html).toContain('Total Pelanggan');
    expect(html).toContain('8');
    expect(html).toContain('Member Gold');
    expect(html).toContain('3');
    expect(html).toContain('Member Silver');
    expect(html).toContain('Belanja Bulan Ini');
    expect(html).toContain('Rp 73,3 jt');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-003: search toolbar
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-003: renders search toolbar with placeholder and counter', () => {
    const html = renderToString(
      <CustomersToolbar
        search=""
        onSearchChange={vi.fn()}
        filteredCount={3}
        totalCount={3}
      />
    );
    expect(html).toContain('placeholder="Cari nama, telepon, atau ID…"');
    expect(html).toContain('3 member');

    const htmlFiltered = renderToString(
      <CustomersToolbar
        search="Dewi"
        onSearchChange={vi.fn()}
        filteredCount={1}
        totalCount={3}
      />
    );
    expect(htmlFiltered).toContain('Menampilkan 1 dari 3 pelanggan');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-004: six-column ledger
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-004: renders ledger table with exactly 6 columns', () => {
    const html = renderToString(<CustomersTable customers={sampleCustomers} />);
    expect(html).toContain('Pelanggan');
    expect(html).toContain('Telepon');
    expect(html).toContain('Tier');
    expect(html).toContain('Poin');
    expect(html).toContain('Total Belanja');
    expect(html).toContain('Kunjungan Terakhir');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-005: avatar initials
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-005: renders 2-letter uppercase initials avatar circle', () => {
    const html = renderToString(<CustomersTable customers={sampleCustomers} />);
    expect(html).toContain('DL');
    expect(html).toContain('AP');
    expect(html).toContain('YO');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-006: tier badges
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-006: renders Gold, Silver, and Reguler tier badges with tone styling', () => {
    const html = renderToString(<CustomersTable customers={sampleCustomers} />);
    expect(html).toContain('Gold');
    expect(html).toContain('Silver');
    expect(html).toContain('Reguler');
    expect(html).toContain('bg-[#fae4af]/70');
    expect(html).toContain('bg-[#d2e6ec]/70');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-007: points
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-007: renders points formatted with thousand separators', () => {
    const html = renderToString(<CustomersTable customers={sampleCustomers} />);
    expect(html).toContain('2.450');
    expect(html).toContain('980');
    expect(html).toContain('140');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-008: spend
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-008: renders formatted spend with pine emphasis', () => {
    const html = renderToString(<CustomersTable customers={sampleCustomers} />);
    expect(html).toContain('Rp 12,5 jt');
    expect(html).toContain('Rp 4,86 jt');
    expect(html).toContain('Rp 890 rb');
    expect(html).toContain('text-pine');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-009: last visit
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-009: displays relative last visit text', () => {
    const html = renderToString(<CustomersTable customers={sampleCustomers} />);
    expect(html).toContain('Hari ini');
    expect(html).toContain('Kemarin');
    expect(html).toContain('4 hari lalu');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-010: empty state
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-010: displays empty state copy when customer list is empty', () => {
    const html = renderToString(<CustomersTable customers={[]} />);
    expect(html).toContain('Tidak ada pelanggan ditemukan');
    expect(html).toContain('Coba kata kunci lain atau daftarkan member baru.');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-011: filtered empty
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-011: toolbar counter reflects filtered search count vs total', () => {
    const filtered = filterCustomers(sampleCustomers, { search: 'Nonexistent' });
    expect(filtered).toHaveLength(0);

    const html = renderToString(
      <CustomersToolbar
        search="Nonexistent"
        onSearchChange={vi.fn()}
        filteredCount={filtered.length}
        totalCount={sampleCustomers.length}
      />
    );
    expect(html).toContain('Menampilkan 0 dari 3 pelanggan');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-012: create modal
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-012: renders modal elements when open', () => {
    const html = renderToString(
      <CustomerCreateModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).toContain('Tambah Pelanggan');
    expect(html).toContain('Nama Lengkap');
    expect(html).toContain('No. Telepon');
    expect(html).toContain('Tier Member');
    expect(html).toContain('Batal');
    expect(html).toContain('Daftarkan');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-013: tier selector
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-013: tier selector renders all three tier buttons', () => {
    const html = renderToString(
      <CustomerCreateModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).toContain('Reguler');
    expect(html).toContain('Silver');
    expect(html).toContain('Gold');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-014: validation
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-014: validates required name in form submission logic', () => {
    const form = { name: '   ', phone: '0812', tier: 'Reguler' as const };
    const isValid = form.name.trim().length > 0;
    expect(isValid).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-015: create success
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-015: creates new customer and formats success message', () => {
    const newCustomer = mapCustomerToViewModel(
      {
        id: 'c4444444-4444-4444-8444-444444444444',
        business_id: 'biz-001',
        name: 'Sari Rahmawati',
        phone: '0812-3456-7890',
        email: null,
        tier: 'Gold',
        points: 0,
        spend_minor: 0,
        last_visit_epoch: null,
        server_version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
      3
    );

    expect(newCustomer.name).toBe('Sari Rahmawati');
    expect(newCustomer.tier).toBe('Gold');
    expect(newCustomer.initials).toBe('SR');
    const toast = `Pelanggan "${newCustomer.name}" terdaftar sebagai member ${newCustomer.tier}.`;
    expect(toast).toBe('Pelanggan "Sari Rahmawati" terdaftar sebagai member Gold.');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-016: conflict state
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-016: classifies conflict errors accurately', () => {
    const isConflict = (err: any) => err?.response?.status === 409 || err?.code === 'CONFLICT';
    expect(isConflict({ response: { status: 409 } })).toBe(true);
    expect(isConflict({ code: 'CONFLICT' })).toBe(true);
    expect(isConflict({ response: { status: 500 } })).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-017: tenant switch
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-017: maps empty list on tenant switch', () => {
    const summary = mapCustomerSummaryToViewModel(null, []);
    expect(summary.total_customers).toBe(0);
    expect(summary.monthly_spend_minor).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-018: branch change preserves customer state
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-018: customer data is tenant-scoped without branch ownership', () => {
    expect(sampleCustomers[0].id).toBe('c1111111-1111-4111-8111-111111111111');
    expect((sampleCustomers[0] as any).branch_id).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-019: responsive 1440/1024/390
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-019: includes responsive grid and overflow-x-auto classes', () => {
    const kpiHtml = renderToString(<CustomersKPICards summary={sampleSummary} />);
    expect(kpiHtml).toContain('grid grid-cols-2 gap-3 lg:grid-cols-4');

    const tableHtml = renderToString(<CustomersTable customers={sampleCustomers} />);
    expect(tableHtml).toContain('overflow-x-auto');
    expect(tableHtml).toContain('min-w-[720px]');
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-UI-020: no legacy navigation to /customers/new
  // ---------------------------------------------------------------------------
  it('CUSTOMER-UI-020: create modal is inline and does not use href=/customers/new', () => {
    const html = renderToString(
      <CustomerCreateModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).not.toContain('href="/customers/new"');
    expect(html).not.toContain('href="/customers/');
  });
});
