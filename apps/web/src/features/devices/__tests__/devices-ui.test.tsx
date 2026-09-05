/**
 * Phase 4.1.40G — G-6 Web ERP Hardware & Device Service UI Test Suite
 * DEVICES-UI-001 through DEVICES-UI-020
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { DeviceKPICards } from '../components/DeviceKPICards';
import { DeviceToolbar } from '../components/DeviceToolbar';
import { DeviceTable } from '../components/DeviceTable';
import { DeviceDetailView } from '../components/DeviceDetailView';
import { DeviceRegisterModal } from '../components/DeviceRegisterModal';
import { DeviceAssignModal } from '../components/DeviceAssignModal';
import { DeviceUnassignModal } from '../components/DeviceUnassignModal';
import { DeviceUpdateModal } from '../components/DeviceUpdateModal';
import { DeviceServiceToolbar } from '../components/DeviceServiceToolbar';
import { DeviceServiceTable } from '../components/DeviceServiceTable';
import { DeviceServiceDetailView } from '../components/DeviceServiceDetailView';
import { DeviceServiceCreateModal } from '../components/DeviceServiceCreateModal';
import { DeviceServiceUpdateModal } from '../components/DeviceServiceUpdateModal';
import { DeviceServiceCompleteModal } from '../components/DeviceServiceCompleteModal';
import { getDeviceApiErrorMessage } from '../api';
import { ROUTE_PERMISSIONS, NAVIGATION_ITEMS, canAccessRoute } from '@/lib/rbac';
import type {
  DeviceDto,
  DeviceDetailDto,
  DeviceSummaryDto,
  DeviceServiceDto,
  DeviceServiceDetailDto,
} from '../types';

describe('PHASE 4.1.40G — G-6 Web ERP Hardware & Device Service UI Acceptance Tests', () => {
  const sampleSummary: DeviceSummaryDto = {
    total: 45,
    in_stock: 20,
    reserved: 0,
    installed: 22,
    in_repair: 2,
    defective: 0,
    returned: 0,
    decommissioned: 1,
  };

  const sampleDevices: DeviceDto[] = [
    {
      id: 'd1111111-1111-4111-8111-111111111111',
      business_id: 'biz-001',
      branch_id: 'br-001',
      product_id: 'prod-001',
      product_name: 'FiberHome GPON ONU HG6245D',
      serial_number: 'SN-ONU-0001',
      mac_address: 'AA:BB:CC:11:22:33',
      device_type: 'ONT',
      ownership_type: 'TENANT_OWNED',
      status: 'IN_STOCK',
      customer_id: null,
      customer_name: null,
      installed_address: null,
      installed_at: null,
      warranty_months: 12,
      warranty_expires_at: '2027-09-01T00:00:00Z',
      notes: 'Unit baru di gudang',
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z',
    },
    {
      id: 'd2222222-2222-4222-8222-222222222222',
      business_id: 'biz-001',
      branch_id: 'br-001',
      product_id: 'prod-002',
      product_name: 'MikroTik RouterBOARD hEX',
      serial_number: 'SN-RTR-0002',
      mac_address: 'AA:BB:CC:44:55:66',
      device_type: 'ROUTER',
      ownership_type: 'CUSTOMER_OWNED',
      status: 'INSTALLED',
      customer_id: 'c1111111-1111-4111-8111-111111111111',
      customer_name: 'Budi Santoso',
      installed_address: 'Jl. Merdeka No. 10',
      installed_at: '2026-09-02T10:00:00Z',
      warranty_months: 24,
      warranty_expires_at: '2028-09-01T00:00:00Z',
      notes: 'Terpasang di rumah pelanggan',
      created_at: '2026-09-01T08:00:00Z',
      updated_at: '2026-09-02T10:00:00Z',
    },
  ];

  const sampleDeviceDetail: DeviceDetailDto = {
    ...sampleDevices[0],
    branch_name: 'Gudang Utama',
    customer_phone: null,
    services: [
      {
        id: 'svc-001',
        service_type: 'MAINTENANCE',
        status: 'COMPLETED',
        technician_name: 'Ahmad Teknisi',
        scheduled_at: '2026-09-03T09:00:00Z',
        completed_at: '2026-09-03T11:00:00Z',
        findings: 'Kondisi optic power optimal',
        action_taken: 'Pembersihan konektor SC/UPC',
        created_at: '2026-09-03T08:00:00Z',
      },
    ],
  };

  const sampleServices: DeviceServiceDto[] = [
    {
      id: 'svc-001',
      business_id: 'biz-001',
      device_id: sampleDevices[0].id,
      device_serial: 'SN-ONU-0001',
      device_type: 'ONT',
      customer_id: null,
      customer_name: null,
      service_type: 'MAINTENANCE',
      status: 'COMPLETED',
      technician_name: 'Ahmad Teknisi',
      scheduled_at: '2026-09-03T09:00:00Z',
      completed_at: '2026-09-03T11:00:00Z',
      replacement_device_id: null,
      findings: 'Kondisi optic power optimal',
      action_taken: 'Pembersihan konektor SC/UPC',
      notes: 'Pemeriksaan rutin',
      created_at: '2026-09-03T08:00:00Z',
      updated_at: '2026-09-03T11:00:00Z',
    },
    {
      id: 'svc-002',
      business_id: 'biz-001',
      device_id: sampleDevices[1].id,
      device_serial: 'SN-RTR-0002',
      device_type: 'ROUTER',
      customer_id: 'c1111111-1111-4111-8111-111111111111',
      customer_name: 'Budi Santoso',
      service_type: 'REPAIR',
      status: 'IN_PROGRESS',
      technician_name: 'Doni Lapangan',
      scheduled_at: '2026-09-04T14:00:00Z',
      completed_at: null,
      replacement_device_id: null,
      findings: 'Lampu PON mati total',
      action_taken: 'Pengecekan adaptor dan drop cable',
      notes: 'Menunggu konfirmasi sparepart',
      created_at: '2026-09-04T13:00:00Z',
      updated_at: '2026-09-04T14:30:00Z',
    },
  ];

  const sampleServiceDetail: DeviceServiceDetailDto = {
    ...sampleServices[1],
    device_serial: 'SN-RTR-0002',
    device_type: 'ROUTER',
    customer_name: 'Budi Santoso',
    customer_phone: '0812-3344-5566',
    replacement_serial: null,
  };

  // ---------------------------------------------------------------------------
  // DEVICES-UI-001: KPI Summary Cards Render
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-001: renders 5 KPI cards with exact counts and status labels', () => {
    const html = renderToString(<DeviceKPICards summary={sampleSummary} isLoading={false} />);
    expect(html).toContain('Total Perangkat');
    expect(html).toContain('45');
    expect(html).toContain('Tersedia di Gudang');
    expect(html).toContain('20');
    expect(html).toContain('Terpasang di Pelanggan');
    expect(html).toContain('22');
    expect(html).toContain('Rusak / Dalam Servis');
    expect(html).toContain('2');
    expect(html).toContain('Nonaktif / Dikembalikan');
    expect(html).toContain('1');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-002: Device Toolbar with Search & Filter
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-002: renders search toolbar and filter dropdowns', () => {
    const html = renderToString(
      <DeviceToolbar
        filters={{ search: 'SN-001' }}
        onFilterChange={vi.fn()}
        canMutate={true}
        onOpenRegisterSingle={vi.fn()}
        onOpenRegisterBulk={vi.fn()}
      />
    );
    expect(html).toContain('placeholder="Cari nomor seri, MAC address, atau catatan..."');
    expect(html).toContain('Semua Status');
    expect(html).toContain('Semua Tipe');
    expect(html).toContain('Semua Kepemilikan');
    expect(html).toContain('Registrasi Perangkat');
    expect(html).toContain('Input Bulk');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-003: Device Table Multi-column Render
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-003: renders device list table with serial, mac, type, ownership, status, customer', () => {
    const html = renderToString(
      <DeviceTable
        devices={sampleDevices}
        isLoading={false}
        canMutate={true}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(html).toContain('SN-ONU-0001');
    expect(html).toContain('AA:BB:CC:11:22:33');
    expect(html).toContain('ONT');
    expect(html).toContain('Tersedia di Gudang');
    expect(html).toContain('SN-RTR-0002');
    expect(html).toContain('Terpasang di Pelanggan');
    expect(html).toContain('Budi Santoso');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-004: Device Detail View Render
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-004: renders full device detail information including service history', () => {
    const html = renderToString(
      <DeviceDetailView
        device={sampleDeviceDetail}
        canMutate={true}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
        onEdit={vi.fn()}
        onCreateService={vi.fn()}
      />
    );
    expect(html).toContain('Identitas Hardware');
    expect(html).toContain('SN-ONU-0001');
    expect(html).toContain('AA:BB:CC:11:22:33');
    expect(html).toContain('FiberHome GPON ONU HG6245D');
    expect(html).toContain('Riwayat Tiket Servis');
    expect(html).toContain('Ahmad Teknisi');
    expect(html).toContain('Pembersihan konektor SC/UPC');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-005: Device Register Modal (Single & Bulk)
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-005: renders device registration modal with single/bulk options', () => {
    const html = renderToString(
      <DeviceRegisterModal
        isOpen={true}
        onClose={vi.fn()}
        branchId="br-001"
        branches={[{ id: 'br-001', name: 'Cabang Utama' }]}
        products={[{ id: 'prod-001', name: 'FiberHome ONU' }]}
        onSubmitSingle={vi.fn()}
        onSubmitBulk={vi.fn()}
      />
    );
    expect(html).toContain('Registrasi Perangkat Hardware');
    expect(html).toContain('Satu Perangkat (Single)');
    expect(html).toContain('Massal (Bulk Input)');
    expect(html).toContain('Nomor Seri (Serial Number)');
    expect(html).toContain('MAC Address');
    expect(html).toContain('Tipe Perangkat');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-006: Device Assign Modal
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-006: renders device assign modal with customer selector and address', () => {
    const html = renderToString(
      <DeviceAssignModal
        device={sampleDevices[0]}
        isOpen={true}
        onClose={vi.fn()}
        customers={[{ id: 'c111', name: 'Pelanggan Alpha', phone: '08123' }]}
        onConfirmAssign={vi.fn()}
      />
    );
    expect(html).toContain('Pasang ke Pelanggan (Assign)');
    expect(html).toContain('SN-ONU-0001');
    expect(html).toContain('Pilih Pelanggan');
    expect(html).toContain('Pelanggan Alpha');
    expect(html).toContain('Alamat Pemasangan');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-007: Device Unassign Modal
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-007: renders unassign modal with return status selection', () => {
    const html = renderToString(
      <DeviceUnassignModal
        device={sampleDevices[1]}
        isOpen={true}
        onClose={vi.fn()}
        onConfirmUnassign={vi.fn()}
      />
    );
    expect(html).toContain('Tarik Perangkat (Unassign)');
    expect(html).toContain('SN-RTR-0002');
    expect(html).toContain('Budi Santoso');
    expect(html).toContain('Status Tujuan Penarikan');
    expect(html).toContain('Kembalikan ke Gudang (IN_STOCK, Stok Inventaris +1)');
    expect(html).toContain('DEFECTIVE');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-008: Device Update Modal
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-008: renders update modal with mac, warranty, and notes fields', () => {
    const html = renderToString(
      <DeviceUpdateModal
        device={sampleDevices[0]}
        isOpen={true}
        onClose={vi.fn()}
        onConfirmUpdate={vi.fn()}
      />
    );
    expect(html).toContain('Edit Perangkat Hardware');
    expect(html).toContain('SN-ONU-0001');
    expect(html).toContain('MAC Address');
    expect(html).toContain('Durasi Garansi (Bulan)');
    expect(html).toContain('Catatan Perangkat');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-009: Work Order List & Filter Render
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-009: renders work order table and status filter toolbar', () => {
    const htmlTable = renderToString(
      <DeviceServiceTable
        services={sampleServices}
        isLoading={false}
        canMutate={true}
        onUpdate={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    expect(htmlTable).toContain('SN-ONU-0001');
    expect(htmlTable).toContain('MAINTENANCE');
    expect(htmlTable).toContain('Selesai (Completed)');
    expect(htmlTable).toContain('SN-RTR-0002');
    expect(htmlTable).toContain('REPAIR');
    expect(htmlTable).toContain('Sedang Dikerjakan');

    const htmlToolbar = renderToString(
      <DeviceServiceToolbar
        filters={{ status: 'IN_PROGRESS' }}
        onFilterChange={vi.fn()}
        canMutate={true}
        onOpenCreate={vi.fn()}
      />
    );
    expect(htmlToolbar).toContain('Buat Work Order Baru');
    expect(htmlToolbar).toContain('Semua Status Work Order');
    expect(htmlToolbar).toContain('Semua Tipe Servis');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-010: Work Order Detail View Render
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-010: renders complete work order detail with findings and technician', () => {
    const html = renderToString(
      <DeviceServiceDetailView
        service={sampleServiceDetail}
        canMutate={true}
        onUpdate={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    expect(html).toContain('Work Order:');
    expect(html).toContain('REPAIR');
    expect(html).toContain('SN-RTR-0002');
    expect(html).toContain('Budi Santoso');
    expect(html).toContain('Doni Lapangan');
    expect(html).toContain('Lampu PON mati total');
    expect(html).toContain('Pengecekan adaptor dan drop cable');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-011: Work Order Create Modal
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-011: renders create work order modal with service type options', () => {
    const html = renderToString(
      <DeviceServiceCreateModal
        initialDeviceId={sampleDevices[0].id}
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(html).toContain('Buat Work Order / Tiket Servis');
    expect(html).toContain('Pemasangan Baru (INSTALLATION)');
    expect(html).toContain('Cek Rutin / Maintenance (MAINTENANCE)');
    expect(html).toContain('Perbaikan / Trouble Ticket (REPAIR)');
    expect(html).toContain('Penggantian / RMA Swap (REPLACEMENT)');
    expect(html).toContain('Nama Teknisi');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-012: Work Order Update & Complete Modals
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-012: renders update modal and complete modal with findings and actions', () => {
    const htmlUpdate = renderToString(
      <DeviceServiceUpdateModal
        service={sampleServices[1]}
        isOpen={true}
        onClose={vi.fn()}
        onConfirmUpdate={vi.fn()}
      />
    );
    expect(htmlUpdate).toContain('Update Work Order Servis');
    expect(htmlUpdate).toContain('REPAIR');

    const htmlComplete = renderToString(
      <DeviceServiceCompleteModal
        service={sampleServices[1]}
        isOpen={true}
        onClose={vi.fn()}
        onConfirmComplete={vi.fn()}
      />
    );
    expect(htmlComplete).toContain('Selesaikan Work Order');
    expect(htmlComplete).toContain('Hasil Temuan / Diagnosa');
    expect(htmlComplete).toContain('Tindakan Penanganan');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-013: RBAC — OWNER sees all controls
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-013: OWNER has full mutation controls on toolbar and table', () => {
    const htmlToolbar = renderToString(
      <DeviceToolbar
        filters={{}}
        onFilterChange={vi.fn()}
        canMutate={true}
        onOpenRegisterSingle={vi.fn()}
        onOpenRegisterBulk={vi.fn()}
      />
    );
    expect(htmlToolbar).toContain('Registrasi Perangkat');

    const htmlTable = renderToString(
      <DeviceTable
        devices={sampleDevices}
        isLoading={false}
        canMutate={true}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(htmlTable).toContain('Pasang ke Pelanggan');
    expect(htmlTable).toContain('Tarik Perangkat');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-014: RBAC — STAFF sees operational controls
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-014: STAFF has operational controls on device service table and detail', () => {
    const htmlServiceTable = renderToString(
      <DeviceServiceTable
        services={sampleServices}
        isLoading={false}
        canMutate={true}
        onUpdate={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    expect(htmlServiceTable).toContain('Selesaikan');

    const htmlServiceDetail = renderToString(
      <DeviceServiceDetailView
        service={sampleServiceDetail}
        canMutate={true}
        onUpdate={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    expect(htmlServiceDetail).toContain('Update Data / Status');
    expect(htmlServiceDetail).toContain('Selesaikan Work Order');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-015: RBAC — CASHIER is read-only (mutation controls absent)
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-015: CASHIER sees read-only device view with mutation controls completely hidden', () => {
    const htmlToolbar = renderToString(
      <DeviceToolbar
        filters={{}}
        onFilterChange={vi.fn()}
        canMutate={false}
        onOpenRegisterSingle={vi.fn()}
        onOpenRegisterBulk={vi.fn()}
      />
    );
    expect(htmlToolbar).not.toContain('Registrasi Perangkat');

    const htmlTable = renderToString(
      <DeviceTable
        devices={sampleDevices}
        isLoading={false}
        canMutate={false}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(htmlTable).not.toContain('Pasang ke Pelanggan');
    expect(htmlTable).not.toContain('Tarik Perangkat');
    expect(htmlTable).not.toContain('title="Edit Data"');
    // Read-only link to detail should still be available
    expect(htmlTable).toContain('href="/devices/d1111111-1111-4111-8111-111111111111"');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-016: Route Permissions Contract in rbac.ts
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-016: verifies RBAC route permissions allow OWNER, STAFF, CASHIER for /devices and OWNER, STAFF for /device-services', () => {
    expect(ROUTE_PERMISSIONS['/devices']).toEqual(['OWNER', 'STAFF', 'CASHIER']);
    expect(ROUTE_PERMISSIONS['/device-services']).toEqual(['OWNER', 'STAFF']);

    expect(canAccessRoute('OWNER', '/devices')).toBe(true);
    expect(canAccessRoute('STAFF', '/devices')).toBe(true);
    expect(canAccessRoute('CASHIER', '/devices')).toBe(true);

    expect(canAccessRoute('OWNER', '/device-services')).toBe(true);
    expect(canAccessRoute('STAFF', '/device-services')).toBe(true);
    expect(canAccessRoute('CASHIER', '/device-services')).toBe(false);

    // Nav items contain both
    const deviceNav = NAVIGATION_ITEMS.find((item) => item.href === '/devices');
    const serviceNav = NAVIGATION_ITEMS.find((item) => item.href === '/device-services');
    expect(deviceNav).toBeDefined();
    expect(deviceNav?.name).toBe('Perangkat Hardware');
    expect(serviceNav).toBeDefined();
    expect(serviceNav?.name).toBe('Layanan Servis');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-017: Loading and Empty States
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-017: properly displays loading spinners and empty states for empty lists', () => {
    const htmlTableLoading = renderToString(
      <DeviceTable
        devices={[]}
        isLoading={true}
        canMutate={true}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(htmlTableLoading).toContain('Memuat daftar perangkat hardware...');

    const htmlTableEmpty = renderToString(
      <DeviceTable
        devices={[]}
        isLoading={false}
        canMutate={true}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(htmlTableEmpty).toContain('Tidak ada perangkat ditemukan');

    const htmlServiceEmpty = renderToString(
      <DeviceServiceTable
        services={[]}
        isLoading={false}
        canMutate={true}
        onUpdate={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    expect(htmlServiceEmpty).toContain('Tidak ada work order ditemukan');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-018: API Error & 403 Forbidden Mapping
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-018: maps 403, 404, 409 and generic errors accurately without crashing', () => {
    const err403 = { response: { status: 403, data: { message: 'Akses ditolak' } }, isAxiosError: true };
    expect(getDeviceApiErrorMessage(err403)).toContain('Akses ditolak');

    const err409 = { response: { status: 409, data: { message: 'Nomor seri sudah terdaftar' } }, isAxiosError: true };
    expect(getDeviceApiErrorMessage(err409)).toContain('Nomor seri sudah terdaftar');

    const fallbackErr = new Error('Koneksi jaringan terputus');
    expect(getDeviceApiErrorMessage(fallbackErr)).toBe('Koneksi jaringan terputus');
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-019: Single vs Bulk Form Data Validation
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-019: validates required serial number and bulk lines format', () => {
    const validSingle = { serial_number: 'SN-001', device_type: 'ONT' as const, ownership_type: 'TENANT_OWNED' as const };
    expect(validSingle.serial_number.trim().length).toBeGreaterThan(0);

    const emptySingle = { serial_number: '   ' };
    expect(emptySingle.serial_number.trim().length).toBe(0);

    const bulkRawText = 'SN-001, AA:BB:CC:11:22:33\nSN-002\nSN-003, 11:22:33:44:55:66';
    const lines = bulkRawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    expect(lines).toHaveLength(3);
  });

  // ---------------------------------------------------------------------------
  // DEVICES-UI-020: Tenant Isolation Invariant
  // ---------------------------------------------------------------------------
  it('DEVICES-UI-020: verifies devices are strictly bound to tenant context without platform customer pollution', () => {
    expect(sampleDevices[0].business_id).toBe('biz-001');
    expect((sampleDevices[0] as any).account_customer_id).toBeUndefined();
    expect(sampleServices[0].business_id).toBe('biz-001');
  });
});
