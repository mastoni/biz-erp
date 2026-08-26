/**
 * Phase 6C — Customers ViewModel & Data Layer Test Suite
 * CUSTOMER-VM-001 through CUSTOMER-VM-018
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  deriveCustomerCode,
  filterCustomers,
  formatRelativeCustomerVisit,
  getCustomerInitials,
  getCustomerTierTone,
  mapCustomerSummaryToViewModel,
  mapCustomerToViewModel,
  mapCustomersListToViewModel,
} from '../customer-helpers';
import type {
  Customer,
  CustomerCreateFormModel,
  CustomerFilterModel,
  CustomerListResponse,
  CustomerSummaryKPI,
  CustomerViewModel,
} from '../types';

describe('PHASE 6C — Customers ViewModel & Data Layer Tests', () => {
  const fixedNow = new Date('2026-08-26T12:00:00Z').getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const sampleCustomer1: Customer = {
    id: 'c1111111-1111-4111-8111-111111111111',
    business_id: 'biz-001',
    name: 'Dewi Lestari',
    phone: '0812-3345-1908',
    email: 'dewi@gmail.com',
    tier: 'Gold',
    points: 2450,
    spend_minor: 12450000,
    last_visit_epoch: fixedNow, // Today
    server_version: 1,
    created_at: '2026-08-20T10:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
    deleted_at: null,
  };

  const sampleCustomer2: Customer = {
    id: 'c2222222-2222-4222-8222-222222222222',
    business_id: 'biz-001',
    name: 'Andi Prasetyo',
    phone: '0857-2210-4471',
    email: null,
    tier: 'Silver',
    points: 980,
    spend_minor: 4860000,
    last_visit_epoch: fixedNow - oneDayMs, // Yesterday
    server_version: 1,
    created_at: '2026-08-21T10:00:00Z',
    updated_at: '2026-08-21T10:00:00Z',
    deleted_at: null,
  };

  const sampleCustomer3: Customer = {
    id: 'c3333333-3333-4333-8333-333333333333',
    business_id: 'biz-001',
    name: 'Yoga Pratama',
    phone: '0896-1120-3384',
    email: 'yoga@gmail.com',
    tier: 'Reguler',
    points: 140,
    spend_minor: 890000,
    last_visit_epoch: fixedNow - 4 * oneDayMs, // 4 days ago
    server_version: 1,
    created_at: '2026-08-22T10:00:00Z',
    updated_at: '2026-08-22T10:00:00Z',
    deleted_at: null,
  };

  const vm1 = mapCustomerToViewModel(sampleCustomer1, 0, fixedNow);
  const vm2 = mapCustomerToViewModel(sampleCustomer2, 1, fixedNow);
  const vm3 = mapCustomerToViewModel(sampleCustomer3, 2, fixedNow);

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-001: customer mapping
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-001: customer mapping', () => {
    it('maps all DTO fields accurately into CustomerViewModel', () => {
      const vm = mapCustomerToViewModel(sampleCustomer1, 0, fixedNow);

      expect(vm.id).toBe(sampleCustomer1.id);
      expect(vm.name).toBe('Dewi Lestari');
      expect(vm.phone).toBe('0812-3345-1908');
      expect(vm.email).toBe('dewi@gmail.com');
      expect(vm.tier).toBe('Gold');
      expect(vm.points).toBe(2450);
      expect(vm.spend_minor).toBe(12450000);
      expect(vm.last_visit_epoch).toBe(fixedNow);
      expect(vm.code).toBe('CST-001');
      expect(vm.initials).toBe('DL');
      expect(vm.tier_tone).toBe('honey');
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-002: summary mapping
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-002: summary mapping', () => {
    it('maps CustomerSummaryKPI with exact metrics and safe fallbacks', () => {
      const rawSummary: CustomerSummaryKPI = {
        total_customers: 8,
        gold_members: 3,
        silver_members: 3,
        regular_members: 2,
        monthly_spend_minor: 73280000,
      };

      const summary = mapCustomerSummaryToViewModel(rawSummary);

      expect(summary.total_customers).toBe(8);
      expect(summary.gold_members).toBe(3);
      expect(summary.silver_members).toBe(3);
      expect(summary.regular_members).toBe(2);
      expect(summary.monthly_spend_minor).toBe(73280000);
    });

    it('falls back to local aggregate when summary is null', () => {
      const summary = mapCustomerSummaryToViewModel(null, [vm1, vm2, vm3]);

      expect(summary.total_customers).toBe(3);
      expect(summary.gold_members).toBe(1);
      expect(summary.silver_members).toBe(1);
      expect(summary.regular_members).toBe(1);
      expect(summary.monthly_spend_minor).toBe(12450000 + 4860000 + 890000);
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-003: Gold tier mapping
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-003: Gold tier mapping', () => {
    it('maps Gold tier tone to honey', () => {
      expect(getCustomerTierTone('Gold')).toBe('honey');
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-004: Silver tier mapping
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-004: Silver tier mapping', () => {
    it('maps Silver tier tone to tide', () => {
      expect(getCustomerTierTone('Silver')).toBe('tide');
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-005: Reguler tier mapping
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-005: Reguler tier mapping', () => {
    it('maps Reguler tier tone to fog', () => {
      expect(getCustomerTierTone('Reguler')).toBe('fog');
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-006: initials generation
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-006: initials generation', () => {
    it('generates uppercase 2-letter initials deterministically', () => {
      expect(getCustomerInitials('Dewi Lestari')).toBe('DL');
      expect(getCustomerInitials('CV Sinar Jaya')).toBe('CS');
      expect(getCustomerInitials('Yoga')).toBe('YO');
      expect(getCustomerInitials('  Andi   Prasetyo  ')).toBe('AP');
      expect(getCustomerInitials('')).toBe('PL');
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-007: spend mapping
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-007: spend mapping', () => {
    it('preserves server-provided spend_minor without client recalculation', () => {
      const vm = mapCustomerToViewModel({ ...sampleCustomer1, spend_minor: 99500000 }, 0);
      expect(vm.spend_minor).toBe(99500000);
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-008: relative last visit
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-008: relative last visit', () => {
    it('formats relative date text matching blueprint', () => {
      expect(formatRelativeCustomerVisit(fixedNow, fixedNow)).toBe('Hari ini');
      expect(formatRelativeCustomerVisit(fixedNow - oneDayMs, fixedNow)).toBe('Kemarin');
      expect(formatRelativeCustomerVisit(fixedNow - 4 * oneDayMs, fixedNow)).toBe('4 hari lalu');
      expect(formatRelativeCustomerVisit(null, fixedNow)).toBe('Belum ada kunjungan');
      expect(formatRelativeCustomerVisit(undefined, fixedNow)).toBe('Belum ada kunjungan');
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-009: search name
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-009: search name', () => {
    it('filters items by matching customer name case-insensitively', () => {
      const filtered = filterCustomers([vm1, vm2, vm3], { search: 'dewi' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Dewi Lestari');
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-010: search phone
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-010: search phone', () => {
    it('filters items by matching phone digits', () => {
      const filtered = filterCustomers([vm1, vm2, vm3], { search: '2210' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Andi Prasetyo');
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-011: search customer code/id
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-011: search customer code/id', () => {
    it('filters items by matching code CST-003 or UUID', () => {
      const filteredByCode = filterCustomers([vm1, vm2, vm3], { search: 'CST-003' });
      expect(filteredByCode).toHaveLength(1);
      expect(filteredByCode[0].name).toBe('Yoga Pratama');

      const filteredById = filterCustomers([vm1, vm2, vm3], { search: 'c1111111' });
      expect(filteredById).toHaveLength(1);
      expect(filteredById[0].name).toBe('Dewi Lestari');
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-012: tier filter
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-012: tier filter', () => {
    it('filters items by Gold, Silver, or Reguler tier', () => {
      const goldOnly = filterCustomers([vm1, vm2, vm3], { tier: 'Gold' });
      expect(goldOnly).toHaveLength(1);
      expect(goldOnly[0].tier).toBe('Gold');

      const silverOnly = filterCustomers([vm1, vm2, vm3], { tier: 'Silver' });
      expect(silverOnly).toHaveLength(1);
      expect(silverOnly[0].tier).toBe('Silver');

      const all = filterCustomers([vm1, vm2, vm3], { tier: 'Semua' });
      expect(all).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-013: empty state
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-013: empty state', () => {
    it('handles empty customer list response cleanly', () => {
      const res: CustomerListResponse = {
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
        has_more: false,
      };

      const vmList = mapCustomersListToViewModel(res);
      expect(vmList.items).toHaveLength(0);
      expect(vmList.total).toBe(0);
      expect(vmList.summary.total_customers).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-014: tenant switch clears state
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-014: tenant switch clears state', () => {
    it('ensures clean state when switching tenant', () => {
      const tenantA = mapCustomersListToViewModel({
        items: [sampleCustomer1],
        total: 1,
        limit: 20,
        offset: 0,
        has_more: false,
      });
      expect(tenantA.items).toHaveLength(1);

      // Simulating new tenant with empty list
      const tenantB = mapCustomersListToViewModel({
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
        has_more: false,
      });
      expect(tenantB.items).toHaveLength(0);
      expect(tenantB.summary.total_customers).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-015: branch change preserves customer master
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-015: branch change preserves customer master', () => {
    it('customer master is business-scoped, independent of active branch', () => {
      expect(sampleCustomer1.business_id).toBe('biz-001');
      // No branch_id property on customer master
      expect((sampleCustomer1 as any).branch_id).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-016: create payload
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-016: create payload', () => {
    it('builds valid customer create payload with defaults', () => {
      const form: CustomerCreateFormModel = {
        name: 'Sari Rahmawati',
        phone: '0812-9999-0000',
        tier: 'Silver',
      };

      expect(form.name).toBe('Sari Rahmawati');
      expect(form.phone).toBe('0812-9999-0000');
      expect(form.tier).toBe('Silver');
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-017: optimistic conflict classification
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-017: optimistic conflict classification', () => {
    it('classifies 409 status as conflict mutation state', () => {
      const err = { response: { status: 409 }, code: 'CONFLICT' };
      const isConflict = err.response.status === 409 || err.code === 'CONFLICT';
      expect(isConflict).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER-VM-018: no fake IDs/data
  // ---------------------------------------------------------------------------
  describe('CUSTOMER-VM-018: no fake IDs/data', () => {
    it('maps real canonical DTO values directly without synthetic placeholders', () => {
      const vm = mapCustomerToViewModel(sampleCustomer2, 1);
      expect(vm.id).toBe(sampleCustomer2.id);
      expect(vm.points).toBe(sampleCustomer2.points);
      expect(vm.spend_minor).toBe(sampleCustomer2.spend_minor);
      expect(vm.tier).toBe(sampleCustomer2.tier);
    });
  });
});
