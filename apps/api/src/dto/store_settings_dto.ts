import { ValidationError } from '../errors/validation_error';

export interface PaymentMethodsConfig {
  cash: boolean;
  qris: boolean;
  debit: boolean;
}

export interface PrinterConfig {
  model: string;
  paper: '58mm' | '80mm';
  copies: number;
  autoCut: boolean;
  printLogo: boolean;
  autoPrint: boolean;
  connectionType?: 'USB' | 'Bluetooth' | 'Network' | 'Browser';
}

export interface DrawerConfig {
  openOnPayment: boolean;
  openOnShift: boolean;
  delayMs: number;
}

export interface ScannerConfig {
  type: 'USB HID' | 'Bluetooth';
  autoEnter: boolean;
  sound: boolean;
}

export interface BarcodeConfig {
  format: 'CODE128' | 'EAN-13';
  prefix: string;
  autoGenerate: boolean;
  labelSize: 'kecil' | 'sedang';
  showPrice: boolean;
}

export interface StoreSettingsDto {
  id: string;
  business_id: string;
  branch_id: string | null;
  store_name: string;
  address: string;
  phone: string;
  tax_rate_bps: number;
  receipt_footer: string;
  payment_methods: PaymentMethodsConfig;
  printer_config: PrinterConfig;
  drawer_config: DrawerConfig;
  scanner_config: ScannerConfig;
  barcode_config: BarcodeConfig;
  created_at: string;
  updated_at: string;
}

export interface StoreSettingsUpdateRequest {
  store_name?: string;
  address?: string;
  phone?: string;
  tax_rate_bps?: number;
  receipt_footer?: string;
  payment_methods?: Partial<PaymentMethodsConfig>;
  printer_config?: Partial<PrinterConfig>;
  drawer_config?: Partial<DrawerConfig>;
  scanner_config?: Partial<ScannerConfig>;
  barcode_config?: Partial<BarcodeConfig>;
}

export const CANONICAL_SETTINGS_DEFAULTS = {
  store_name: '',
  address: '',
  phone: '',
  tax_rate_bps: 1100, // 11%
  receipt_footer: 'Barang yang sudah dibeli tidak dapat ditukar · terima kasih',
  payment_methods: {
    cash: true,
    qris: true,
    debit: true,
  },
  printer_config: {
    model: 'Epson TM-T82',
    paper: '80mm' as const,
    copies: 1,
    autoCut: true,
    printLogo: true,
    autoPrint: true,
    connectionType: 'USB' as const,
  },
  drawer_config: {
    openOnPayment: true,
    openOnShift: false,
    delayMs: 300,
  },
  scanner_config: {
    type: 'USB HID' as const,
    autoEnter: true,
    sound: true,
  },
  barcode_config: {
    format: 'CODE128' as const,
    prefix: '2891',
    autoGenerate: true,
    labelSize: 'sedang' as const,
    showPrice: true,
  },
};

const ALLOWED_PAPER = new Set(['58mm', '80mm']);
const ALLOWED_CONNECTION = new Set(['USB', 'Bluetooth', 'Network', 'Browser']);
const ALLOWED_SCANNER_TYPE = new Set(['USB HID', 'Bluetooth']);
const ALLOWED_BARCODE_FORMAT = new Set(['CODE128', 'EAN-13']);
const ALLOWED_LABEL_SIZE = new Set(['kecil', 'sedang']);

export function validateStoreSettingsUpdate(input: unknown): StoreSettingsUpdateRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Request body must be a valid JSON object');
  }

  const obj = input as Record<string, unknown>;
  const result: StoreSettingsUpdateRequest = {};

  if (obj.store_name !== undefined) {
    if (typeof obj.store_name !== 'string') {
      throw new ValidationError('store_name must be a string');
    }
    result.store_name = obj.store_name.trim();
  }

  if (obj.address !== undefined) {
    if (typeof obj.address !== 'string') {
      throw new ValidationError('address must be a string');
    }
    result.address = obj.address.trim();
  }

  if (obj.phone !== undefined) {
    if (typeof obj.phone !== 'string') {
      throw new ValidationError('phone must be a string');
    }
    result.phone = obj.phone.trim();
  }

  if (obj.tax_rate_bps !== undefined) {
    if (typeof obj.tax_rate_bps !== 'number' || !Number.isInteger(obj.tax_rate_bps)) {
      throw new ValidationError('tax_rate_bps must be an integer');
    }
    if (obj.tax_rate_bps < 0 || obj.tax_rate_bps > 3000) {
      throw new ValidationError('tax_rate_bps must be between 0 and 3000 (0% to 30%)');
    }
    result.tax_rate_bps = obj.tax_rate_bps;
  }

  if (obj.receipt_footer !== undefined) {
    if (typeof obj.receipt_footer !== 'string') {
      throw new ValidationError('receipt_footer must be a string');
    }
    result.receipt_footer = obj.receipt_footer.trim();
  }

  if (obj.payment_methods !== undefined) {
    if (!obj.payment_methods || typeof obj.payment_methods !== 'object' || Array.isArray(obj.payment_methods)) {
      throw new ValidationError('payment_methods must be an object');
    }
    const pm = obj.payment_methods as Record<string, unknown>;
    const allowedKeys = new Set(['cash', 'qris', 'debit']);
    for (const key of Object.keys(pm)) {
      if (!allowedKeys.has(key)) {
        throw new ValidationError(`Unknown payment method key: ${key}`);
      }
      if (typeof pm[key] !== 'boolean') {
        throw new ValidationError(`payment_methods.${key} must be a boolean`);
      }
    }
    result.payment_methods = {
      cash: pm.cash as boolean | undefined,
      qris: pm.qris as boolean | undefined,
      debit: pm.debit as boolean | undefined,
    };
  }

  if (obj.printer_config !== undefined) {
    if (!obj.printer_config || typeof obj.printer_config !== 'object' || Array.isArray(obj.printer_config)) {
      throw new ValidationError('printer_config must be an object');
    }
    const pr = obj.printer_config as Record<string, unknown>;
    const validatedPrinter: Partial<PrinterConfig> = {};

    if (pr.model !== undefined) {
      if (typeof pr.model !== 'string') {
        throw new ValidationError('printer_config.model must be a string');
      }
      validatedPrinter.model = pr.model.trim();
    }

    if (pr.paper !== undefined) {
      if (typeof pr.paper !== 'string' || !ALLOWED_PAPER.has(pr.paper)) {
        throw new ValidationError('printer_config.paper must be "58mm" or "80mm"');
      }
      validatedPrinter.paper = pr.paper as '58mm' | '80mm';
    }

    if (pr.copies !== undefined) {
      if (typeof pr.copies !== 'number' || !Number.isInteger(pr.copies) || pr.copies < 1 || pr.copies > 3) {
        throw new ValidationError('printer_config.copies must be an integer between 1 and 3');
      }
      validatedPrinter.copies = pr.copies;
    }

    if (pr.autoCut !== undefined) {
      if (typeof pr.autoCut !== 'boolean') {
        throw new ValidationError('printer_config.autoCut must be a boolean');
      }
      validatedPrinter.autoCut = pr.autoCut;
    }

    if (pr.printLogo !== undefined) {
      if (typeof pr.printLogo !== 'boolean') {
        throw new ValidationError('printer_config.printLogo must be a boolean');
      }
      validatedPrinter.printLogo = pr.printLogo;
    }

    if (pr.autoPrint !== undefined) {
      if (typeof pr.autoPrint !== 'boolean') {
        throw new ValidationError('printer_config.autoPrint must be a boolean');
      }
      validatedPrinter.autoPrint = pr.autoPrint;
    }

    if (pr.connectionType !== undefined) {
      if (typeof pr.connectionType !== 'string' || !ALLOWED_CONNECTION.has(pr.connectionType)) {
        throw new ValidationError('printer_config.connectionType must be one of: USB, Bluetooth, Network, Browser');
      }
      validatedPrinter.connectionType = pr.connectionType as 'USB' | 'Bluetooth' | 'Network' | 'Browser';
    }

    result.printer_config = validatedPrinter;
  }

  if (obj.drawer_config !== undefined) {
    if (!obj.drawer_config || typeof obj.drawer_config !== 'object' || Array.isArray(obj.drawer_config)) {
      throw new ValidationError('drawer_config must be an object');
    }
    const dr = obj.drawer_config as Record<string, unknown>;
    const validatedDrawer: Partial<DrawerConfig> = {};

    if (dr.openOnPayment !== undefined) {
      if (typeof dr.openOnPayment !== 'boolean') {
        throw new ValidationError('drawer_config.openOnPayment must be a boolean');
      }
      validatedDrawer.openOnPayment = dr.openOnPayment;
    }

    if (dr.openOnShift !== undefined) {
      if (typeof dr.openOnShift !== 'boolean') {
        throw new ValidationError('drawer_config.openOnShift must be a boolean');
      }
      validatedDrawer.openOnShift = dr.openOnShift;
    }

    if (dr.delayMs !== undefined) {
      if (typeof dr.delayMs !== 'number' || !Number.isInteger(dr.delayMs) || dr.delayMs < 0 || dr.delayMs > 1000) {
        throw new ValidationError('drawer_config.delayMs must be an integer between 0 and 1000');
      }
      validatedDrawer.delayMs = dr.delayMs;
    }

    result.drawer_config = validatedDrawer;
  }

  if (obj.scanner_config !== undefined) {
    if (!obj.scanner_config || typeof obj.scanner_config !== 'object' || Array.isArray(obj.scanner_config)) {
      throw new ValidationError('scanner_config must be an object');
    }
    const sc = obj.scanner_config as Record<string, unknown>;
    const validatedScanner: Partial<ScannerConfig> = {};

    if (sc.type !== undefined) {
      if (typeof sc.type !== 'string' || !ALLOWED_SCANNER_TYPE.has(sc.type)) {
        throw new ValidationError('scanner_config.type must be "USB HID" or "Bluetooth"');
      }
      validatedScanner.type = sc.type as 'USB HID' | 'Bluetooth';
    }

    if (sc.autoEnter !== undefined) {
      if (typeof sc.autoEnter !== 'boolean') {
        throw new ValidationError('scanner_config.autoEnter must be a boolean');
      }
      validatedScanner.autoEnter = sc.autoEnter;
    }

    if (sc.sound !== undefined) {
      if (typeof sc.sound !== 'boolean') {
        throw new ValidationError('scanner_config.sound must be a boolean');
      }
      validatedScanner.sound = sc.sound;
    }

    result.scanner_config = validatedScanner;
  }

  if (obj.barcode_config !== undefined) {
    if (!obj.barcode_config || typeof obj.barcode_config !== 'object' || Array.isArray(obj.barcode_config)) {
      throw new ValidationError('barcode_config must be an object');
    }
    const bc = obj.barcode_config as Record<string, unknown>;
    const validatedBarcode: Partial<BarcodeConfig> = {};

    if (bc.format !== undefined) {
      if (typeof bc.format !== 'string' || !ALLOWED_BARCODE_FORMAT.has(bc.format)) {
        throw new ValidationError('barcode_config.format must be "CODE128" or "EAN-13"');
      }
      validatedBarcode.format = bc.format as 'CODE128' | 'EAN-13';
    }

    if (bc.prefix !== undefined) {
      if (typeof bc.prefix !== 'string') {
        throw new ValidationError('barcode_config.prefix must be a string');
      }
      validatedBarcode.prefix = bc.prefix.trim();
    }

    if (bc.autoGenerate !== undefined) {
      if (typeof bc.autoGenerate !== 'boolean') {
        throw new ValidationError('barcode_config.autoGenerate must be a boolean');
      }
      validatedBarcode.autoGenerate = bc.autoGenerate;
    }

    if (bc.labelSize !== undefined) {
      if (typeof bc.labelSize !== 'string' || !ALLOWED_LABEL_SIZE.has(bc.labelSize)) {
        throw new ValidationError('barcode_config.labelSize must be "kecil" or "sedang"');
      }
      validatedBarcode.labelSize = bc.labelSize as 'kecil' | 'sedang';
    }

    if (bc.showPrice !== undefined) {
      if (typeof bc.showPrice !== 'boolean') {
        throw new ValidationError('barcode_config.showPrice must be a boolean');
      }
      validatedBarcode.showPrice = bc.showPrice;
    }

    result.barcode_config = validatedBarcode;
  }

  return result;
}
