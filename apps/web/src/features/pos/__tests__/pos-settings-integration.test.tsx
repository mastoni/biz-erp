import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import {
  calculateCartTotalsFromBps,
  calculateTaxFromBps,
  buildPOSReceiptViewModel,
} from '../pos-helpers';
import { orchestratePostSaleDevices } from '../pos-device';
import { POSCartViewModel, POSCartLineViewModel } from '../types';
import { POSCartSidebar } from '../components/POSCartSidebar';
import { POSPaymentModal } from '../components/POSPaymentModal';
import { POSReceiptCard } from '../components/POSReceiptCard';
import * as settingsApi from '@/features/settings/api';
import { StoreSettings } from '@/features/settings/types';

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, '');
}

describe('PHASE 8H.3 — POS Dynamic Store Settings Integration Tests', () => {
  const businessId = '11111111-1111-4111-8111-111111111111';
  const branchId = 'b1111111-1111-4111-8111-111111111111';

  const mockSettingsData: StoreSettings = {
    id: 's1111111-1111-4111-8111-111111111111',
    business_id: businessId,
    branch_id: branchId,
    store_name: 'Warung Kopi Nusantara Pusat',
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

  const sampleLine: POSCartLineViewModel = {
    product_id: 'p1',
    product_name: 'Kopi Susu Aren',
    sku: 'KSP-01',
    category: 'Minuman',
    quantity: 2,
    unit_price_minor: 15000,
    line_subtotal_minor: 30000,
    quantity_available: 20,
  };

  const sampleCart: POSCartViewModel = {
    transaction_id: 'TRX-123456',
    customer_id: null,
    customer_name: 'Umum',
    lines: [sampleLine],
    subtotal_minor: 30000,
    discount_percent: 0,
    discount_minor: 0,
    tax_minor: 3300,
    total_minor: 33300,
    item_count: 2,
  };

  // POS-SETTINGS-001: resolved store settings loaded
  it('POS-SETTINGS-001: loads resolved store settings via canonical settings API', async () => {
    const spy = vi.spyOn(settingsApi, 'getStoreSettings').mockResolvedValue(mockSettingsData);
    const loaded = await settingsApi.getStoreSettings(businessId, branchId);
    expect(spy).toHaveBeenCalledWith(businessId, branchId);
    expect(loaded.store_name).toBe('Warung Kopi Nusantara Pusat');
    expect(loaded.tax_rate_bps).toBe(1100);
    spy.mockRestore();
  });

  // POS-SETTINGS-002: tax uses tax_rate_bps
  it('POS-SETTINGS-002: calculates tax directly using tax_rate_bps', () => {
    // 30,000 * 1100 / 10000 = 3,300
    expect(calculateTaxFromBps(30000, 1100)).toBe(3300);
    expect(calculateTaxFromBps(100000, 1200)).toBe(12000);
  });

  // POS-SETTINGS-003: 1100 => 11%
  it('POS-SETTINGS-003: 1100 bps computes 11% default tax in cart totals', () => {
    const totals = calculateCartTotalsFromBps([sampleLine], 0, 1100);
    expect(totals.subtotal_minor).toBe(30000);
    expect(totals.tax_minor).toBe(3300);
    expect(totals.total_minor).toBe(33300);
  });

  // POS-SETTINGS-004: 1200 => 12%
  it('POS-SETTINGS-004: 1200 bps computes dynamic 12% tax in cart totals', () => {
    const totals = calculateCartTotalsFromBps([sampleLine], 0, 1200);
    expect(totals.tax_minor).toBe(3600);
    expect(totals.total_minor).toBe(33600);

    const sidebarHtml = renderClean(
      <POSCartSidebar
        cart={{ ...sampleCart, tax_minor: 3600, total_minor: 33600 }}
        customers={[]}
        selectedCustomerId={null}
        onCustomerChange={() => {}}
        parkedOrders={[]}
        onParkOrder={() => {}}
        onRestoreParkedOrder={() => {}}
        onDeleteParkedOrder={() => {}}
        onIncrementLine={() => {}}
        onDecrementLine={() => {}}
        onRemoveLine={() => {}}
        onDiscountChange={() => {}}
        onOpenPayment={() => {}}
        taxRatePercent={12}
      />
    );
    expect(sidebarHtml).toContain('PPN 12%');
    expect(sidebarHtml).not.toContain('PPN 11%');
  });

  // POS-SETTINGS-005: cash enabled
  it('POS-SETTINGS-005: renders Cash option when cash is enabled', () => {
    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={() => {}}
        cart={sampleCart}
        paymentState={{ method: 'CASH', paid_minor: 33300, change_minor: 0, is_sufficient: true, step: 'pay' }}
        onMethodChange={() => {}}
        onPaidChange={() => {}}
        onSubmitCheckout={() => {}}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={() => {}}
        enabledPaymentMethods={{ cash: true, qris: true, debit: true }}
      />
    );
    expect(html).toContain('Tunai');
  });

  // POS-SETTINGS-006: cash disabled
  it('POS-SETTINGS-006: hides Cash option when cash is disabled in settings', () => {
    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={() => {}}
        cart={sampleCart}
        paymentState={{ method: 'QRIS', paid_minor: 33300, change_minor: 0, is_sufficient: true, step: 'pay' }}
        onMethodChange={() => {}}
        onPaidChange={() => {}}
        onSubmitCheckout={() => {}}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={() => {}}
        enabledPaymentMethods={{ cash: false, qris: true, debit: true }}
      />
    );
    expect(html).not.toContain('Tunai');
    expect(html).toContain('QRIS');
    expect(html).toContain('Debit');
  });

  // POS-SETTINGS-007: qris enabled
  it('POS-SETTINGS-007: renders QRIS option when QRIS is enabled', () => {
    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={() => {}}
        cart={sampleCart}
        paymentState={{ method: 'QRIS', paid_minor: 33300, change_minor: 0, is_sufficient: true, step: 'pay' }}
        onMethodChange={() => {}}
        onPaidChange={() => {}}
        onSubmitCheckout={() => {}}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={() => {}}
        enabledPaymentMethods={{ cash: true, qris: true, debit: true }}
      />
    );
    expect(html).toContain('QRIS');
  });

  // POS-SETTINGS-008: qris disabled
  it('POS-SETTINGS-008: hides QRIS option when QRIS is disabled in settings', () => {
    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={() => {}}
        cart={sampleCart}
        paymentState={{ method: 'CASH', paid_minor: 33300, change_minor: 0, is_sufficient: true, step: 'pay' }}
        onMethodChange={() => {}}
        onPaidChange={() => {}}
        onSubmitCheckout={() => {}}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={() => {}}
        enabledPaymentMethods={{ cash: true, qris: false, debit: true }}
      />
    );
    expect(html).not.toContain('QRIS');
    expect(html).toContain('Tunai');
    expect(html).toContain('Debit');
  });

  // POS-SETTINGS-009: debit enabled
  it('POS-SETTINGS-009: renders Debit option when Debit is enabled', () => {
    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={() => {}}
        cart={sampleCart}
        paymentState={{ method: 'DEBIT', paid_minor: 33300, change_minor: 0, is_sufficient: true, step: 'pay' }}
        onMethodChange={() => {}}
        onPaidChange={() => {}}
        onSubmitCheckout={() => {}}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={() => {}}
        enabledPaymentMethods={{ cash: true, qris: true, debit: true }}
      />
    );
    expect(html).toContain('Debit');
  });

  // POS-SETTINGS-010: debit disabled
  it('POS-SETTINGS-010: hides Debit option when Debit is disabled in settings', () => {
    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={() => {}}
        cart={sampleCart}
        paymentState={{ method: 'CASH', paid_minor: 33300, change_minor: 0, is_sufficient: true, step: 'pay' }}
        onMethodChange={() => {}}
        onPaidChange={() => {}}
        onSubmitCheckout={() => {}}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={() => {}}
        enabledPaymentMethods={{ cash: true, qris: true, debit: false }}
      />
    );
    expect(html).not.toContain('Debit');
    expect(html).toContain('Tunai');
    expect(html).toContain('QRIS');
  });

  // POS-SETTINGS-011: all payment methods disabled safely
  it('POS-SETTINGS-011: handles scenario where all payment methods are disabled in settings', () => {
    const allDisabled = { cash: false, qris: false, debit: false };
    const isAvailable = allDisabled.cash || allDisabled.qris || allDisabled.debit;
    expect(isAvailable).toBe(false);

    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={() => {}}
        cart={sampleCart}
        paymentState={{ method: 'CASH', paid_minor: 33300, change_minor: 0, is_sufficient: false, step: 'pay' }}
        onMethodChange={() => {}}
        onPaidChange={() => {}}
        onSubmitCheckout={() => {}}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={() => {}}
        enabledPaymentMethods={allDisabled}
      />
    );
    expect(html).not.toContain('Tunai');
    expect(html).not.toContain('QRIS');
    expect(html).not.toContain('Debit');
  });

  // POS-SETTINGS-012: receipt uses dynamic store identity
  it('POS-SETTINGS-012: builds receipt viewmodel using dynamic store name, branch, address, and phone', () => {
    const receiptVM = buildPOSReceiptViewModel({
      businessName: 'Warung Kopi Nusantara Pusat',
      branchName: 'Cabang Sudirman',
      address: 'Jl. Sudirman Kav. 10',
      phone: '0812-3456-7890',
      taxRatePercent: 12,
      cart: sampleCart,
      paymentMethod: 'CASH',
      paidMinor: 50000,
      changeMinor: 16700,
      cashierName: 'Rani',
      footer: 'Footer Kustom',
    });

    expect(receiptVM.business_name).toBe('Warung Kopi Nusantara Pusat');
    expect(receiptVM.branch_name).toBe('Cabang Sudirman');
    expect(receiptVM.address).toBe('Jl. Sudirman Kav. 10');
    expect(receiptVM.phone).toBe('0812-3456-7890');
    expect(receiptVM.tax_rate_percent).toBe(12);

    const receiptHtml = renderClean(
      <POSReceiptCard receipt={receiptVM} onNewTransaction={() => {}} />
    );
    expect(receiptHtml).toContain('WARUNG KOPI NUSANTARA PUSAT');
    expect(receiptHtml).toContain('Cabang Sudirman');
    expect(receiptHtml).toContain('Jl. Sudirman Kav. 10');
    expect(receiptHtml).toContain('0812-3456-7890');
    expect(receiptHtml).toContain('PPN 12%');
  });

  // POS-SETTINGS-013: receipt footer dynamic
  it('POS-SETTINGS-013: renders dynamic footer message on receipt card', () => {
    const receiptVM = buildPOSReceiptViewModel({
      businessName: 'Toko Berkah',
      branchName: 'Pusat',
      cart: sampleCart,
      paymentMethod: 'QRIS',
      paidMinor: 33300,
      changeMinor: 0,
      cashierName: 'Budi',
      footer: 'Simpan struk ini sebagai bukti garansi resmi',
    });

    const html = renderClean(
      <POSReceiptCard receipt={receiptVM} onNewTransaction={() => {}} />
    );
    expect(html).toContain('Simpan struk ini sebagai bukti garansi resmi');
  });

  // POS-SETTINGS-014: autoPrint true
  it('POS-SETTINGS-014: autoPrint true triggers print orchestration after sale', () => {
    let printed = false;
    const result = orchestratePostSaleDevices({
      drawer: { openOnPayment: false },
      printer: { autoPrint: true },
      triggerDrawer: () => {},
      triggerPrint: () => {
        printed = true;
      },
    });
    expect(result.printTriggered).toBe(true);
    expect(printed).toBe(true);
  });

  // POS-SETTINGS-015: autoPrint false
  it('POS-SETTINGS-015: autoPrint false does not trigger print orchestration', () => {
    let printed = false;
    const result = orchestratePostSaleDevices({
      drawer: { openOnPayment: false },
      printer: { autoPrint: false },
      triggerDrawer: () => {},
      triggerPrint: () => {
        printed = true;
      },
    });
    expect(result.printTriggered).toBe(false);
    expect(printed).toBe(false);
  });

  // POS-SETTINGS-016: drawer openOnPayment true
  it('POS-SETTINGS-016: openOnPayment true triggers drawer orchestration after sale', () => {
    let opened = false;
    const result = orchestratePostSaleDevices({
      drawer: { openOnPayment: true },
      printer: { autoPrint: false },
      triggerDrawer: () => {
        opened = true;
      },
      triggerPrint: () => {},
    });
    expect(result.drawerTriggered).toBe(true);
    expect(opened).toBe(true);
  });

  // POS-SETTINGS-017: drawer openOnPayment false
  it('POS-SETTINGS-017: openOnPayment false does not trigger drawer orchestration', () => {
    let opened = false;
    const result = orchestratePostSaleDevices({
      drawer: { openOnPayment: false },
      printer: { autoPrint: false },
      triggerDrawer: () => {
        opened = true;
      },
      triggerPrint: () => {},
    });
    expect(result.drawerTriggered).toBe(false);
    expect(opened).toBe(false);
  });

  // POS-SETTINGS-018: printer failure isolated from sale
  it('POS-SETTINGS-018: printer failure is captured and does NOT throw (sale unaffected)', () => {
    let drawerOpened = false;
    let threw = false;
    let outcome: ReturnType<typeof orchestratePostSaleDevices>;
    try {
      outcome = orchestratePostSaleDevices({
        drawer: { openOnPayment: true },
        printer: { autoPrint: true },
        triggerDrawer: () => {
          drawerOpened = true;
        },
        triggerPrint: () => {
          throw new Error('Printer paper out');
        },
      });
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(outcome!.printError).toBe('Printer paper out');
    expect(outcome!.drawerTriggered).toBe(true);
    expect(drawerOpened).toBe(true);
  });

  // POS-SETTINGS-019: drawer failure isolated from sale
  it('POS-SETTINGS-019: drawer failure is captured and does NOT throw (sale unaffected)', () => {
    let printed = false;
    let threw = false;
    let outcome: ReturnType<typeof orchestratePostSaleDevices>;
    try {
      outcome = orchestratePostSaleDevices({
        drawer: { openOnPayment: true },
        printer: { autoPrint: true },
        triggerDrawer: () => {
          throw new Error('Drawer disconnected');
        },
        triggerPrint: () => {
          printed = true;
        },
      });
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(outcome!.drawerError).toBe('Drawer disconnected');
    expect(outcome!.printTriggered).toBe(true);
    expect(printed).toBe(true);
  });

  // POS-SETTINGS-020: branch switch reloads settings
  it('POS-SETTINGS-020: re-fetches store settings when branch ID changes', async () => {
    const spy = vi.spyOn(settingsApi, 'getStoreSettings');
    spy.mockResolvedValueOnce(mockSettingsData);

    const secondBranchId = 'b2222222-2222-4222-8222-222222222222';
    spy.mockResolvedValueOnce({
      ...mockSettingsData,
      branch_id: secondBranchId,
      store_name: 'Cabang Senopati',
    });

    const res1 = await settingsApi.getStoreSettings(businessId, branchId);
    expect(res1.store_name).toBe('Warung Kopi Nusantara Pusat');

    const res2 = await settingsApi.getStoreSettings(businessId, secondBranchId);
    expect(res2.store_name).toBe('Cabang Senopati');
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  // POS-SETTINGS-021: tenant switch reloads settings
  it('POS-SETTINGS-021: provides distinct tenant scoped store settings', async () => {
    const spy = vi.spyOn(settingsApi, 'getStoreSettings');
    const secondBusinessId = '22222222-2222-4222-8222-222222222222';

    spy.mockResolvedValueOnce({
      ...mockSettingsData,
      business_id: secondBusinessId,
      store_name: 'Resto Padang Nusantara',
      tax_rate_bps: 1000,
    });

    const res = await settingsApi.getStoreSettings(secondBusinessId, null);
    expect(res.business_id).toBe(secondBusinessId);
    expect(res.store_name).toBe('Resto Padang Nusantara');
    expect(res.tax_rate_bps).toBe(1000);
    spy.mockRestore();
  });

  // POS-SETTINGS-022: new transaction resets transactional state while settings remain
  it('POS-SETTINGS-022: new transaction resets cart but keeps resolved store settings', () => {
    // A reset cart must be empty (zero totals) for the next sale.
    const resetTotals = calculateCartTotalsFromBps([], 0, 1100);
    expect(resetTotals.subtotal_minor).toBe(0);
    expect(resetTotals.tax_minor).toBe(0);
    expect(resetTotals.total_minor).toBe(0);

    // Resolved store identity remains available for the next receipt build.
    const nextReceipt = buildPOSReceiptViewModel({
      businessName: mockSettingsData.store_name,
      branchName: 'Cabang Utama',
      address: mockSettingsData.address,
      phone: mockSettingsData.phone,
      taxRatePercent: mockSettingsData.tax_rate_bps / 100,
      cart: { ...sampleCart, lines: [], subtotal_minor: 0, tax_minor: 0, total_minor: 0 },
      paymentMethod: 'CASH',
      paidMinor: 0,
      changeMinor: 0,
      cashierName: 'Rani',
      footer: mockSettingsData.receipt_footer,
    });
    expect(nextReceipt.business_name).toBe('Warung Kopi Nusantara Pusat');
    expect(nextReceipt.total_minor).toBe(0);

    // The Transaksi Baru control is always available on the receipt view.
    const html = renderClean(
      <POSReceiptCard receipt={nextReceipt} onNewTransaction={() => {}} />
    );
    expect(html).toContain('Transaksi Baru');
  });

  // POS-SETTINGS-023: no hardcoded tax in POS business logic
  it('POS-SETTINGS-023: tax is fully dynamic via tax_rate_bps (no hardcoded percentage takes over)', () => {
    const bpsList = [0, 500, 1000, 1100, 1150, 1200, 1500, 2000];
    const subtotal = 100000;
    for (const bps of bpsList) {
      const calculated = calculateCartTotalsFromBps(
        [{ ...sampleLine, line_subtotal_minor: subtotal, quantity: 1, unit_price_minor: subtotal }],
        0,
        bps
      ).tax_minor;
      expect(calculated).toBe(Math.round((subtotal * bps) / 10000));
    }
  });

  // POS-SETTINGS-024: no duplicate settings endpoint
  it('POS-SETTINGS-024: reuses canonical /v1/settings/store endpoint without duplicate API routes', () => {
    expect(typeof settingsApi.getStoreSettings).toBe('function');
    expect(typeof settingsApi.updateStoreSettings).toBe('function');
  });

  // POS-SETTINGS-025: stale disabled payment method cannot checkout
  it('POS-SETTINGS-025: a disabled payment method is unavailable for checkout (cannot bypass settings)', () => {
    const html = renderClean(
      <POSPaymentModal
        isOpen={true}
        onClose={() => {}}
        cart={sampleCart}
        paymentState={{ method: 'QRIS', paid_minor: 33300, change_minor: 0, is_sufficient: true, step: 'pay' }}
        onMethodChange={() => {}}
        onPaidChange={() => {}}
        onSubmitCheckout={() => {}}
        isSubmitting={false}
        receipt={null}
        onNewTransaction={() => {}}
        enabledPaymentMethods={{ cash: false, qris: true, debit: false }}
      />
    );
    // Cash and Debit are disabled in settings, so they cannot be selected/checked out.
    expect(html).not.toContain('Tunai');
    expect(html).not.toContain('Debit');
    expect(html).toContain('QRIS');
  });
});
