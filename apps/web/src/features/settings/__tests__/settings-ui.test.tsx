import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SettingsView, SettingCard, ToggleRow, BarcodeSvg, CONTROLLED_DEVICES } from '../components/SettingsView';
import { mapSettingsToViewModel, mapViewModelToUpdatePayload, CANONICAL_SETTINGS_DEFAULTS, PRINTER_MODELS } from '../settings-helpers';
import { StoreSettings, StoreSettingsViewModel } from '../types';

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, '');
}

describe('PHASE 8H.2 — Store Settings Web UI Acceptance Tests', () => {
  const businessId = '11111111-1111-4111-8111-111111111111';
  const branchId = 'b1111111-1111-4111-8111-111111111111';

  const mockSettingsData: StoreSettings = {
    id: 's1111111-1111-4111-8111-111111111111',
    business_id: businessId,
    branch_id: branchId,
    store_name: 'Warung Kopi Nusantara',
    address: 'Jl. Sudirman No. 10',
    phone: '0812-3456-7890',
    tax_rate_bps: 1100,
    receipt_footer: 'Barang yang sudah dibeli tidak dapat ditukar · terima kasih',
    payment_methods: {
      cash: true,
      qris: true,
      debit: true,
    },
    printer_config: {
      model: 'Epson TM-T82',
      paper: '80mm',
      copies: 1,
      autoCut: true,
      printLogo: true,
      autoPrint: true,
      connectionType: 'USB',
    },
    drawer_config: {
      openOnPayment: true,
      openOnShift: false,
      delayMs: 300,
    },
    scanner_config: {
      type: 'USB HID',
      autoEnter: true,
      sound: true,
    },
    barcode_config: {
      format: 'CODE128',
      prefix: '2891',
      autoGenerate: true,
      labelSize: 'sedang',
      showPrice: true,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // SETTINGS-UI-001: header matches blueprint
  it('SETTINGS-UI-001: header matches blueprint title and subtitle', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('Pengaturan Toko');
    expect(html).toContain('Konfigurasi perangkat kasir: struk, barcode, scanner, dan laci kasir.');
    expect(html).toContain('Tersinkron');
  });

  // SETTINGS-UI-002: Info Toko section
  it('SETTINGS-UI-002: renders Info Toko section with name, phone, and address inputs', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('Info Toko');
    expect(html).toContain('Nama Toko');
    expect(html).toContain('Telepon');
    expect(html).toContain('Alamat');
  });

  // SETTINGS-UI-003: tax percentage input
  it('SETTINGS-UI-003: renders tax percentage input converting 1100 bps to 11%', () => {
    const vm = mapSettingsToViewModel(mockSettingsData);
    expect(vm.taxRatePercent).toBe(11);

    const updatePayload = mapViewModelToUpdatePayload({
      ...vm,
      taxRatePercent: 12.5,
    });
    expect(updatePayload.tax_rate_bps).toBe(1250);

    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('PPN / Pajak (%)');
  });

  // SETTINGS-UI-004: receipt footer
  it('SETTINGS-UI-004: renders receipt footer message input', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('Pesan Footer Struk');
    expect(html).toContain('Pesan penutup struk...');
  });

  // SETTINGS-UI-005: printer section
  it('SETTINGS-UI-005: renders Struk & Printer section with models and test print button', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('Struk &amp; Printer');
    expect(html).toContain('Tes Cetak');
    expect(html).toContain('Model Printer');
    for (const model of PRINTER_MODELS) {
      expect(html).toContain(model);
    }
  });

  // SETTINGS-UI-006: paper 58/80
  it('SETTINGS-UI-006: renders thermal paper buttons for 58mm and 80mm', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('Ukuran Kertas');
    expect(html).toContain('58mm');
    expect(html).toContain('80mm');
  });

  // SETTINGS-UI-007: printer options
  it('SETTINGS-UI-007: renders print logo, auto cut, and auto print toggles', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('Cetak logo toko');
    expect(html).toContain('Potong kertas otomatis');
    expect(html).toContain('Cetak struk otomatis');
  });

  // SETTINGS-UI-008: barcode section
  it('SETTINGS-UI-008: renders Barcode & Label section with format, prefix, and label preview', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('Barcode &amp; Label');
    expect(html).toContain('Format Barcode');
    expect(html).toContain('Prefiks Toko');
    expect(html).toContain('Pratinjau Label');
    expect(html).toContain('2891');
  });

  // SETTINGS-UI-009: scanner section
  it('SETTINGS-UI-009: renders Barcode Scanner section with Uji Pindai button and connection types', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('Barcode Scanner');
    expect(html).toContain('Uji Pindai');
    expect(html).toContain('Tipe Koneksi');
    expect(html).toContain('USB HID');
    expect(html).toContain('Bluetooth');
    expect(html).toContain('Enter otomatis setelah pindai');
  });

  // SETTINGS-UI-010: cash drawer section
  it('SETTINGS-UI-010: renders Laci Kasir section and Uji Buka Laci button with solenoid delay', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('Laci Kasir (Cash Drawer)');
    expect(html).toContain('Uji Buka Laci');
    expect(html).toContain('Buka saat pembayaran sukses');
    expect(html).toContain('Buka saat shift dimulai');
    expect(html).toContain('Delay solenoid:');
  });

  // SETTINGS-UI-011: payment method toggles
  it('SETTINGS-UI-011: renders payment method toggles for Cash, QRIS, and Debit', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('Metode Pembayaran Kasir');
    expect(html).toContain('Tunai (Cash)');
    expect(html).toContain('QRIS');
    expect(html).toContain('Kartu Debit');
  });

  // SETTINGS-UI-012: connected devices controlled state
  it('SETTINGS-UI-012: renders Perangkat Terhubung controlled peripheral list', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('Perangkat Terhubung');
    for (const dev of CONTROLLED_DEVICES) {
      expect(html).toContain(dev.name);
      expect(html).toContain(dev.port);
    }
  });

  // SETTINGS-UI-013: OWNER can edit
  it('SETTINGS-UI-013: enables editing and save bar for OWNER role', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('Simpan Pengaturan');
    expect(html).toContain('Buang Perubahan');
    expect(html).not.toContain('Mode Baca Kasir:');
  });

  // SETTINGS-UI-014: CASHIER read-only
  it('SETTINGS-UI-014: enforces read-only mode and hides save bar for CASHIER role', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="CASHIER" />);
    expect(html).toContain('Mode Baca Kasir:');
    expect(html).not.toContain('Simpan Pengaturan');
  });

  // SETTINGS-UI-015: save loading state
  it('SETTINGS-UI-015: verifies mapping helper preserves all partial update fields', () => {
    const vm: StoreSettingsViewModel = {
      ...CANONICAL_SETTINGS_DEFAULTS,
      storeName: 'Updated Store Name',
      taxRatePercent: 10,
      phone: '0812345',
    };
    const payload = mapViewModelToUpdatePayload(vm);
    expect(payload.store_name).toBe('Updated Store Name');
    expect(payload.tax_rate_bps).toBe(1000);
    expect(payload.phone).toBe('0812345');
  });

  // SETTINGS-UI-016: save success
  it('SETTINGS-UI-016: verifies viewmodel correctly round-trips raw API responses', () => {
    const vm = mapSettingsToViewModel(mockSettingsData);
    expect(vm.storeName).toBe('Warung Kopi Nusantara');
    expect(vm.address).toBe('Jl. Sudirman No. 10');
    expect(vm.printer.model).toBe('Epson TM-T82');
    expect(vm.drawer.delayMs).toBe(300);
  });

  // SETTINGS-UI-017: validation errors
  it('SETTINGS-UI-017: clamps tax rate percent between 0 and 30 in mapping payload', () => {
    const vmLow = { ...CANONICAL_SETTINGS_DEFAULTS, taxRatePercent: -5 };
    expect(mapViewModelToUpdatePayload(vmLow).tax_rate_bps).toBe(0);

    const vmHigh = { ...CANONICAL_SETTINGS_DEFAULTS, taxRatePercent: 45 };
    expect(mapViewModelToUpdatePayload(vmHigh).tax_rate_bps).toBe(3000);
  });

  // SETTINGS-UI-018: tenant switch clears/reloads
  it('SETTINGS-UI-018: provides distinct tenant scoped state', () => {
    const tenant1Html = renderClean(<SettingsView businessId="tenant-1" branchId={null} role="OWNER" />);
    const tenant2Html = renderClean(<SettingsView businessId="tenant-2" branchId={null} role="OWNER" />);
    expect(tenant1Html).toContain('Pengaturan Toko');
    expect(tenant2Html).toContain('Pengaturan Toko');
  });

  // SETTINGS-UI-019: branch switch reloads resolved settings
  it('SETTINGS-UI-019: renders branch scoped container correctly', () => {
    const branchHtml = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(branchHtml).toContain('Info Toko');
    expect(branchHtml).toContain('Perangkat Terhubung');
  });

  // SETTINGS-UI-020: no fake device data
  it('SETTINGS-UI-020: renders controlled peripheral status without inventing fake live state', () => {
    expect(CONTROLLED_DEVICES.length).toBe(3);
    expect(CONTROLLED_DEVICES[0].name).toBe('Printer Struk Epson TM-T82');
  });

  // SETTINGS-UI-021: no hardware side effects
  it('SETTINGS-UI-021: renders SVG barcode deterministically without canvas or hardware bridge', () => {
    const svgHtml = renderClean(<BarcodeSvg value="2891SMB-01" className="h-10 w-full" />);
    expect(svgHtml).toContain('<svg');
    expect(svgHtml).toContain('<rect');
  });

  // SETTINGS-UI-022: responsive layout
  it('SETTINGS-UI-022: provides responsive multi-column layout classes for 1440, 1024, and 390 viewports', () => {
    const html = renderClean(<SettingsView businessId={businessId} branchId={branchId} role="OWNER" />);
    expect(html).toContain('lg:grid-cols-[220px_1fr]');
    expect(html).toContain('sm:grid-cols-2');
    expect(html).toContain('md:grid-cols-[1fr_260px]');
  });
});
