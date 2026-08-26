/**
 * Store & POS Settings Types
 */

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

export interface StoreSettings {
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

export interface StoreSettingsViewModel {
  id: string;
  businessId: string;
  branchId: string | null;
  storeName: string;
  address: string;
  phone: string;
  taxRateBps: number;
  taxRatePercent: number;
  receiptFooter: string;
  paymentMethods: PaymentMethodsConfig;
  printer: PrinterConfig;
  drawer: DrawerConfig;
  scanner: ScannerConfig;
  barcode: BarcodeConfig;
}

export interface StoreSettingsUpdatePayload {
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

export type SettingsDataState = 'loading' | 'ready' | 'empty' | 'error';
export type SettingsSaveState = 'idle' | 'saving' | 'saved' | 'error' | 'forbidden';

export interface DeviceStatusItem {
  id: string;
  name: string;
  port: string;
  status: 'terhubung' | 'offline';
}
