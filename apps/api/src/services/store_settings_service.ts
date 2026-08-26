import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { ApiError } from '../errors/api_error';
import { ValidationError } from '../errors/validation_error';
import { withTransaction } from '../db/transaction';
import { isUuid } from '../utils/uuid';
import {
  StoreSettingsDto,
  StoreSettingsUpdateRequest,
  CANONICAL_SETTINGS_DEFAULTS,
  validateStoreSettingsUpdate,
} from '../dto/store_settings_dto';
import { storeSettingsRepository } from '../repositories/store_settings_repository';

function assertTenant(businessId: string, tenantId: string): void {
  if (tenantId.toLowerCase() !== businessId.toLowerCase()) {
    throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Business identity mismatch');
  }
}

export function createStoreSettingsService(pool: Pool) {
  async function validateBranchOwnership(client: any, businessId: string, branchId: string): Promise<void> {
    if (!isUuid(branchId)) {
      throw new ValidationError('Invalid branch_id UUID format');
    }
    const branchRes = await client.query('SELECT id, business_id FROM branches WHERE id = $1', [branchId]);
    if (branchRes.rows.length === 0 || branchRes.rows[0].business_id.toLowerCase() !== businessId.toLowerCase()) {
      throw new ApiError(403, 'BUSINESS_ACCESS_DENIED', 'Branch does not belong to the authenticated business');
    }
  }

  return {
    async getResolvedSettings(
      businessId: string,
      branchId: string | null | undefined,
      tenantId: string
    ): Promise<StoreSettingsDto> {
      assertTenant(businessId, tenantId);

      const targetBranchId = branchId && branchId.trim().length > 0 ? branchId.trim() : null;

      return withTransaction(pool, async (client) => {
        if (targetBranchId) {
          await validateBranchOwnership(client, businessId, targetBranchId);
        }

        // Fetch business name for store_name fallback
        const bizRes = await client.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
        const businessName = bizRes.rows.length > 0 ? bizRes.rows[0].name : '';

        // 1. Fetch branch override if branchId is specified
        const branchOverride = targetBranchId
          ? await storeSettingsRepository.findByBusinessAndBranch(client, businessId, targetBranchId)
          : null;

        // 2. Fetch business default
        const businessDefault = await storeSettingsRepository.findByBusinessDefault(client, businessId);

        // Precedence: Branch Override > Business Default > Canonical Default
        const baseStoreName = businessDefault?.store_name || businessName || CANONICAL_SETTINGS_DEFAULTS.store_name;
        const baseAddress = businessDefault?.address ?? CANONICAL_SETTINGS_DEFAULTS.address;
        const basePhone = businessDefault?.phone ?? CANONICAL_SETTINGS_DEFAULTS.phone;
        const baseTaxRate = businessDefault?.tax_rate_bps ?? CANONICAL_SETTINGS_DEFAULTS.tax_rate_bps;
        const baseFooter = businessDefault?.receipt_footer ?? CANONICAL_SETTINGS_DEFAULTS.receipt_footer;
        const basePayment = businessDefault?.payment_methods ?? CANONICAL_SETTINGS_DEFAULTS.payment_methods;
        const basePrinter = businessDefault?.printer_config ?? CANONICAL_SETTINGS_DEFAULTS.printer_config;
        const baseDrawer = businessDefault?.drawer_config ?? CANONICAL_SETTINGS_DEFAULTS.drawer_config;
        const baseScanner = businessDefault?.scanner_config ?? CANONICAL_SETTINGS_DEFAULTS.scanner_config;
        const baseBarcode = businessDefault?.barcode_config ?? CANONICAL_SETTINGS_DEFAULTS.barcode_config;

        const resolved: StoreSettingsDto = {
          id: branchOverride?.id ?? businessDefault?.id ?? randomUUID(),
          business_id: businessId,
          branch_id: targetBranchId,
          store_name: branchOverride?.store_name || baseStoreName,
          address: branchOverride?.address || baseAddress,
          phone: branchOverride?.phone || basePhone,
          tax_rate_bps: branchOverride?.tax_rate_bps ?? baseTaxRate,
          receipt_footer: branchOverride?.receipt_footer || baseFooter,
          payment_methods: {
            cash: branchOverride?.payment_methods?.cash ?? basePayment.cash,
            qris: branchOverride?.payment_methods?.qris ?? basePayment.qris,
            debit: branchOverride?.payment_methods?.debit ?? basePayment.debit,
          },
          printer_config: {
            model: branchOverride?.printer_config?.model || basePrinter.model,
            paper: branchOverride?.printer_config?.paper || basePrinter.paper,
            copies: branchOverride?.printer_config?.copies ?? basePrinter.copies,
            autoCut: branchOverride?.printer_config?.autoCut ?? basePrinter.autoCut,
            printLogo: branchOverride?.printer_config?.printLogo ?? basePrinter.printLogo,
            autoPrint: branchOverride?.printer_config?.autoPrint ?? basePrinter.autoPrint,
            connectionType: branchOverride?.printer_config?.connectionType || basePrinter.connectionType,
          },
          drawer_config: {
            openOnPayment: branchOverride?.drawer_config?.openOnPayment ?? baseDrawer.openOnPayment,
            openOnShift: branchOverride?.drawer_config?.openOnShift ?? baseDrawer.openOnShift,
            delayMs: branchOverride?.drawer_config?.delayMs ?? baseDrawer.delayMs,
          },
          scanner_config: {
            type: branchOverride?.scanner_config?.type || baseScanner.type,
            autoEnter: branchOverride?.scanner_config?.autoEnter ?? baseScanner.autoEnter,
            sound: branchOverride?.scanner_config?.sound ?? baseScanner.sound,
          },
          barcode_config: {
            format: branchOverride?.barcode_config?.format || baseBarcode.format,
            prefix: branchOverride?.barcode_config?.prefix || baseBarcode.prefix,
            autoGenerate: branchOverride?.barcode_config?.autoGenerate ?? baseBarcode.autoGenerate,
            labelSize: branchOverride?.barcode_config?.labelSize || baseBarcode.labelSize,
            showPrice: branchOverride?.barcode_config?.showPrice ?? baseBarcode.showPrice,
          },
          created_at: branchOverride?.created_at ?? businessDefault?.created_at ?? new Date().toISOString(),
          updated_at: branchOverride?.updated_at ?? businessDefault?.updated_at ?? new Date().toISOString(),
        };

        return resolved;
      });
    },

    async updateSettings(
      businessId: string,
      branchId: string | null | undefined,
      payload: unknown,
      tenantId: string
    ): Promise<StoreSettingsDto> {
      assertTenant(businessId, tenantId);

      const targetBranchId = branchId && branchId.trim().length > 0 ? branchId.trim() : null;
      const validated = validateStoreSettingsUpdate(payload);

      return withTransaction(pool, async (client) => {
        if (targetBranchId) {
          await validateBranchOwnership(client, businessId, targetBranchId);
        }

        // Fetch business name for store_name fallback
        const bizRes = await client.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
        const businessName = bizRes.rows.length > 0 ? bizRes.rows[0].name : '';

        // Check if existing record exists for this exact (business_id, branch_id) target
        const existing = await storeSettingsRepository.findByBusinessAndBranch(client, businessId, targetBranchId);

        // If target is branch override and no existing record exists yet, inherit from business default
        const businessDefault = targetBranchId
          ? await storeSettingsRepository.findByBusinessDefault(client, businessId)
          : null;

        const baseStoreName = existing?.store_name ?? businessDefault?.store_name ?? businessName ?? CANONICAL_SETTINGS_DEFAULTS.store_name;
        const baseAddress = existing?.address ?? businessDefault?.address ?? CANONICAL_SETTINGS_DEFAULTS.address;
        const basePhone = existing?.phone ?? businessDefault?.phone ?? CANONICAL_SETTINGS_DEFAULTS.phone;
        const baseTaxRate = existing?.tax_rate_bps ?? businessDefault?.tax_rate_bps ?? CANONICAL_SETTINGS_DEFAULTS.tax_rate_bps;
        const baseFooter = existing?.receipt_footer ?? businessDefault?.receipt_footer ?? CANONICAL_SETTINGS_DEFAULTS.receipt_footer;
        const basePayment = existing?.payment_methods ?? businessDefault?.payment_methods ?? CANONICAL_SETTINGS_DEFAULTS.payment_methods;
        const basePrinter = existing?.printer_config ?? businessDefault?.printer_config ?? CANONICAL_SETTINGS_DEFAULTS.printer_config;
        const baseDrawer = existing?.drawer_config ?? businessDefault?.drawer_config ?? CANONICAL_SETTINGS_DEFAULTS.drawer_config;
        const baseScanner = existing?.scanner_config ?? businessDefault?.scanner_config ?? CANONICAL_SETTINGS_DEFAULTS.scanner_config;
        const baseBarcode = existing?.barcode_config ?? businessDefault?.barcode_config ?? CANONICAL_SETTINGS_DEFAULTS.barcode_config;

        const updatedSettings: StoreSettingsDto = {
          id: existing?.id ?? randomUUID(),
          business_id: businessId,
          branch_id: targetBranchId,
          store_name: validated.store_name !== undefined ? validated.store_name : baseStoreName,
          address: validated.address !== undefined ? validated.address : baseAddress,
          phone: validated.phone !== undefined ? validated.phone : basePhone,
          tax_rate_bps: validated.tax_rate_bps !== undefined ? validated.tax_rate_bps : baseTaxRate,
          receipt_footer: validated.receipt_footer !== undefined ? validated.receipt_footer : baseFooter,
          payment_methods: {
            cash: validated.payment_methods?.cash !== undefined ? validated.payment_methods.cash : basePayment.cash,
            qris: validated.payment_methods?.qris !== undefined ? validated.payment_methods.qris : basePayment.qris,
            debit: validated.payment_methods?.debit !== undefined ? validated.payment_methods.debit : basePayment.debit,
          },
          printer_config: {
            model: validated.printer_config?.model !== undefined ? validated.printer_config.model : basePrinter.model,
            paper: validated.printer_config?.paper !== undefined ? validated.printer_config.paper : basePrinter.paper,
            copies: validated.printer_config?.copies !== undefined ? validated.printer_config.copies : basePrinter.copies,
            autoCut: validated.printer_config?.autoCut !== undefined ? validated.printer_config.autoCut : basePrinter.autoCut,
            printLogo: validated.printer_config?.printLogo !== undefined ? validated.printer_config.printLogo : basePrinter.printLogo,
            autoPrint: validated.printer_config?.autoPrint !== undefined ? validated.printer_config.autoPrint : basePrinter.autoPrint,
            connectionType: validated.printer_config?.connectionType !== undefined ? validated.printer_config.connectionType : basePrinter.connectionType,
          },
          drawer_config: {
            openOnPayment: validated.drawer_config?.openOnPayment !== undefined ? validated.drawer_config.openOnPayment : baseDrawer.openOnPayment,
            openOnShift: validated.drawer_config?.openOnShift !== undefined ? validated.drawer_config.openOnShift : baseDrawer.openOnShift,
            delayMs: validated.drawer_config?.delayMs !== undefined ? validated.drawer_config.delayMs : baseDrawer.delayMs,
          },
          scanner_config: {
            type: validated.scanner_config?.type !== undefined ? validated.scanner_config.type : baseScanner.type,
            autoEnter: validated.scanner_config?.autoEnter !== undefined ? validated.scanner_config.autoEnter : baseScanner.autoEnter,
            sound: validated.scanner_config?.sound !== undefined ? validated.scanner_config.sound : baseScanner.sound,
          },
          barcode_config: {
            format: validated.barcode_config?.format !== undefined ? validated.barcode_config.format : baseBarcode.format,
            prefix: validated.barcode_config?.prefix !== undefined ? validated.barcode_config.prefix : baseBarcode.prefix,
            autoGenerate: validated.barcode_config?.autoGenerate !== undefined ? validated.barcode_config.autoGenerate : baseBarcode.autoGenerate,
            labelSize: validated.barcode_config?.labelSize !== undefined ? validated.barcode_config.labelSize : baseBarcode.labelSize,
            showPrice: validated.barcode_config?.showPrice !== undefined ? validated.barcode_config.showPrice : baseBarcode.showPrice,
          },
          created_at: existing?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const saved = await storeSettingsRepository.upsert(client, updatedSettings);
        return saved;
      });
    },
  };
}
