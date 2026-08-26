import {
  StoreSettings,
  StoreSettingsViewModel,
  StoreSettingsUpdatePayload,
} from './types';

export const PRINTER_MODELS = [
  'Epson TM-T82',
  'Epson TM-T88VI',
  'TPPOS TP-80C',
  'Xprinter XP-58IIH',
  'Bluebam BTP-R580',
];

export const CANONICAL_SETTINGS_DEFAULTS: StoreSettingsViewModel = {
  id: '',
  businessId: '',
  branchId: null,
  storeName: '',
  address: '',
  phone: '',
  taxRateBps: 1100,
  taxRatePercent: 11,
  receiptFooter: 'Barang yang sudah dibeli tidak dapat ditukar · terima kasih',
  paymentMethods: {
    cash: true,
    qris: true,
    debit: true,
  },
  printer: {
    model: 'Epson TM-T82',
    paper: '80mm',
    copies: 1,
    autoCut: true,
    printLogo: true,
    autoPrint: true,
    connectionType: 'USB',
  },
  drawer: {
    openOnPayment: true,
    openOnShift: false,
    delayMs: 300,
  },
  scanner: {
    type: 'USB HID',
    autoEnter: true,
    sound: true,
  },
  barcode: {
    format: 'CODE128',
    prefix: '2891',
    autoGenerate: true,
    labelSize: 'sedang',
    showPrice: true,
  },
};

export function mapSettingsToViewModel(raw: StoreSettings): StoreSettingsViewModel {
  const taxRateBps = raw.tax_rate_bps ?? 1100;
  return {
    id: raw.id,
    businessId: raw.business_id,
    branchId: raw.branch_id,
    storeName: raw.store_name ?? '',
    address: raw.address ?? '',
    phone: raw.phone ?? '',
    taxRateBps,
    taxRatePercent: Number((taxRateBps / 100).toFixed(2)),
    receiptFooter: raw.receipt_footer ?? CANONICAL_SETTINGS_DEFAULTS.receiptFooter,
    paymentMethods: {
      cash: raw.payment_methods?.cash ?? true,
      qris: raw.payment_methods?.qris ?? true,
      debit: raw.payment_methods?.debit ?? true,
    },
    printer: {
      model: raw.printer_config?.model ?? 'Epson TM-T82',
      paper: raw.printer_config?.paper ?? '80mm',
      copies: raw.printer_config?.copies ?? 1,
      autoCut: raw.printer_config?.autoCut ?? true,
      printLogo: raw.printer_config?.printLogo ?? true,
      autoPrint: raw.printer_config?.autoPrint ?? true,
      connectionType: raw.printer_config?.connectionType ?? 'USB',
    },
    drawer: {
      openOnPayment: raw.drawer_config?.openOnPayment ?? true,
      openOnShift: raw.drawer_config?.openOnShift ?? false,
      delayMs: raw.drawer_config?.delayMs ?? 300,
    },
    scanner: {
      type: raw.scanner_config?.type ?? 'USB HID',
      autoEnter: raw.scanner_config?.autoEnter ?? true,
      sound: raw.scanner_config?.sound ?? true,
    },
    barcode: {
      format: raw.barcode_config?.format ?? 'CODE128',
      prefix: raw.barcode_config?.prefix ?? '2891',
      autoGenerate: raw.barcode_config?.autoGenerate ?? true,
      labelSize: raw.barcode_config?.labelSize ?? 'sedang',
      showPrice: raw.barcode_config?.showPrice ?? true,
    },
  };
}

export function mapViewModelToUpdatePayload(vm: StoreSettingsViewModel): StoreSettingsUpdatePayload {
  const taxRateBps = Math.max(0, Math.min(3000, Math.round(vm.taxRatePercent * 100)));
  return {
    store_name: vm.storeName,
    address: vm.address,
    phone: vm.phone,
    tax_rate_bps: taxRateBps,
    receipt_footer: vm.receiptFooter,
    payment_methods: {
      cash: vm.paymentMethods.cash,
      qris: vm.paymentMethods.qris,
      debit: vm.paymentMethods.debit,
    },
    printer_config: {
      model: vm.printer.model,
      paper: vm.printer.paper,
      copies: vm.printer.copies,
      autoCut: vm.printer.autoCut,
      printLogo: vm.printer.printLogo,
      autoPrint: vm.printer.autoPrint,
      connectionType: vm.printer.connectionType,
    },
    drawer_config: {
      openOnPayment: vm.drawer.openOnPayment,
      openOnShift: vm.drawer.openOnShift,
      delayMs: vm.drawer.delayMs,
    },
    scanner_config: {
      type: vm.scanner.type,
      autoEnter: vm.scanner.autoEnter,
      sound: vm.scanner.sound,
    },
    barcode_config: {
      format: vm.barcode.format,
      prefix: vm.barcode.prefix,
      autoGenerate: vm.barcode.autoGenerate,
      labelSize: vm.barcode.labelSize,
      showPrice: vm.barcode.showPrice,
    },
  };
}
