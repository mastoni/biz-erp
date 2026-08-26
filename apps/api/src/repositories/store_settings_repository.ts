import { PoolClient } from 'pg';
import {
  StoreSettingsDto,
  PaymentMethodsConfig,
  PrinterConfig,
  DrawerConfig,
  ScannerConfig,
  BarcodeConfig,
  CANONICAL_SETTINGS_DEFAULTS,
} from '../dto/store_settings_dto';

export interface StoreSettingsRow {
  id: string;
  business_id: string;
  branch_id: string | null;
  store_name: string | null;
  address: string | null;
  phone: string | null;
  tax_rate_bps: number;
  receipt_footer: string | null;
  payment_methods: PaymentMethodsConfig;
  printer_config: PrinterConfig;
  drawer_config: DrawerConfig;
  scanner_config: ScannerConfig;
  barcode_config: BarcodeConfig;
  created_at: Date;
  updated_at: Date;
}

function mapRowToDto(row: StoreSettingsRow): StoreSettingsDto {
  return {
    id: row.id,
    business_id: row.business_id,
    branch_id: row.branch_id,
    store_name: row.store_name ?? CANONICAL_SETTINGS_DEFAULTS.store_name,
    address: row.address ?? CANONICAL_SETTINGS_DEFAULTS.address,
    phone: row.phone ?? CANONICAL_SETTINGS_DEFAULTS.phone,
    tax_rate_bps: row.tax_rate_bps,
    receipt_footer: row.receipt_footer ?? CANONICAL_SETTINGS_DEFAULTS.receipt_footer,
    payment_methods: row.payment_methods ?? CANONICAL_SETTINGS_DEFAULTS.payment_methods,
    printer_config: row.printer_config ?? CANONICAL_SETTINGS_DEFAULTS.printer_config,
    drawer_config: row.drawer_config ?? CANONICAL_SETTINGS_DEFAULTS.drawer_config,
    scanner_config: row.scanner_config ?? CANONICAL_SETTINGS_DEFAULTS.scanner_config,
    barcode_config: row.barcode_config ?? CANONICAL_SETTINGS_DEFAULTS.barcode_config,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export const storeSettingsRepository = {
  async findByBusinessAndBranch(
    client: PoolClient,
    businessId: string,
    branchId: string | null
  ): Promise<StoreSettingsDto | null> {
    const query = branchId
      ? 'SELECT * FROM store_settings WHERE business_id = $1 AND branch_id = $2'
      : 'SELECT * FROM store_settings WHERE business_id = $1 AND branch_id IS NULL';
    const params = branchId ? [businessId, branchId] : [businessId];

    const result = await client.query<StoreSettingsRow>(query, params);
    if (result.rows.length === 0) return null;
    return mapRowToDto(result.rows[0]);
  },

  async findByBusinessDefault(client: PoolClient, businessId: string): Promise<StoreSettingsDto | null> {
    const result = await client.query<StoreSettingsRow>(
      'SELECT * FROM store_settings WHERE business_id = $1 AND branch_id IS NULL',
      [businessId]
    );
    if (result.rows.length === 0) return null;
    return mapRowToDto(result.rows[0]);
  },

  async upsert(client: PoolClient, settings: StoreSettingsDto): Promise<StoreSettingsDto> {
    // If branch_id is null, use the partial unique index condition
    const query = settings.branch_id
      ? `
        INSERT INTO store_settings (
          id, business_id, branch_id, store_name, address, phone,
          tax_rate_bps, receipt_footer, payment_methods, printer_config,
          drawer_config, scanner_config, barcode_config, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        ON CONFLICT (business_id, branch_id) WHERE branch_id IS NOT NULL
        DO UPDATE SET
          store_name = EXCLUDED.store_name,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          tax_rate_bps = EXCLUDED.tax_rate_bps,
          receipt_footer = EXCLUDED.receipt_footer,
          payment_methods = EXCLUDED.payment_methods,
          printer_config = EXCLUDED.printer_config,
          drawer_config = EXCLUDED.drawer_config,
          scanner_config = EXCLUDED.scanner_config,
          barcode_config = EXCLUDED.barcode_config,
          updated_at = EXCLUDED.updated_at
        RETURNING *;
      `
      : `
        INSERT INTO store_settings (
          id, business_id, branch_id, store_name, address, phone,
          tax_rate_bps, receipt_footer, payment_methods, printer_config,
          drawer_config, scanner_config, barcode_config, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        ON CONFLICT (business_id) WHERE branch_id IS NULL
        DO UPDATE SET
          store_name = EXCLUDED.store_name,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          tax_rate_bps = EXCLUDED.tax_rate_bps,
          receipt_footer = EXCLUDED.receipt_footer,
          payment_methods = EXCLUDED.payment_methods,
          printer_config = EXCLUDED.printer_config,
          drawer_config = EXCLUDED.drawer_config,
          scanner_config = EXCLUDED.scanner_config,
          barcode_config = EXCLUDED.barcode_config,
          updated_at = EXCLUDED.updated_at
        RETURNING *;
      `;

    const params = [
      settings.id,
      settings.business_id,
      settings.branch_id,
      settings.store_name,
      settings.address,
      settings.phone,
      settings.tax_rate_bps,
      settings.receipt_footer,
      JSON.stringify(settings.payment_methods),
      JSON.stringify(settings.printer_config),
      JSON.stringify(settings.drawer_config),
      JSON.stringify(settings.scanner_config),
      JSON.stringify(settings.barcode_config),
      settings.created_at,
      settings.updated_at,
    ];

    const result = await client.query<StoreSettingsRow>(query, params);
    return mapRowToDto(result.rows[0]);
  },

  async delete(client: PoolClient, businessId: string, branchId: string | null): Promise<boolean> {
    const query = branchId
      ? 'DELETE FROM store_settings WHERE business_id = $1 AND branch_id = $2'
      : 'DELETE FROM store_settings WHERE business_id = $1 AND branch_id IS NULL';
    const params = branchId ? [businessId, branchId] : [businessId];
    const result = await client.query(query, params);
    return (result.rowCount ?? 0) > 0;
  },
};
