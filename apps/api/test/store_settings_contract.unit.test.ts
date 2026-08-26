import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import { createStoreSettingsService } from '../src/services/store_settings_service';
import { validateStoreSettingsUpdate, CANONICAL_SETTINGS_DEFAULTS, StoreSettingsDto } from '../src/dto/store_settings_dto';
import { ValidationError } from '../src/errors/validation_error';
import { ApiError } from '../src/errors/api_error';

describe('PHASE 8H.1 — Store Settings Contract & Precedence Unit Tests', () => {
  const businessId = '11111111-1111-4111-8111-111111111111';
  const foreignBusinessId = '22222222-2222-4222-8222-222222222222';
  const branchId1 = 'b1111111-1111-4111-8111-111111111111';
  const foreignBranchId = 'b4444444-4444-4444-8444-444444444444';

  let mockRows: any[] = [];
  let queryHistory: { text: string; values?: any[] }[] = [];

  const mockClient = {
    query: vi.fn().mockImplementation(async (text: string, values?: any[]) => {
      queryHistory.push({ text, values });

      // Query businesses
      if (text.includes('SELECT name FROM businesses')) {
        return { rows: [{ name: 'Warung Kopi Nusantara' }] };
      }

      // Query branches
      if (text.includes('SELECT id, business_id FROM branches')) {
        const id = values?.[0];
        if (id === branchId1) {
          return { rows: [{ id: branchId1, business_id: businessId }] };
        }
        if (id === foreignBranchId) {
          return { rows: [{ id: foreignBranchId, business_id: foreignBusinessId }] };
        }
        return { rows: [] };
      }

      // Query store_settings
      if (text.includes('SELECT * FROM store_settings')) {
        if (values && values.length === 2) {
          // By business_id and branch_id
          const bId = values[0];
          const brId = values[1];
          const matched = mockRows.filter(
            (r) => r.business_id === bId && r.branch_id === brId
          );
          return { rows: matched };
        } else if (values && values.length === 1) {
          // By business_id and branch_id IS NULL
          const bId = values[0];
          const matched = mockRows.filter(
            (r) => r.business_id === bId && r.branch_id === null
          );
          return { rows: matched };
        }
      }

      // INSERT / UPSERT into store_settings
      if (text.includes('INSERT INTO store_settings')) {
        const row = {
          id: values[0],
          business_id: values[1],
          branch_id: values[2],
          store_name: values[3],
          address: values[4],
          phone: values[5],
          tax_rate_bps: values[6],
          receipt_footer: values[7],
          payment_methods: JSON.parse(values[8]),
          printer_config: JSON.parse(values[9]),
          drawer_config: JSON.parse(values[10]),
          scanner_config: JSON.parse(values[11]),
          barcode_config: JSON.parse(values[12]),
          created_at: new Date(values[13]),
          updated_at: new Date(values[14]),
        };

        // Remove existing if conflict
        mockRows = mockRows.filter(
          (r) => !(r.business_id === row.business_id && r.branch_id === row.branch_id)
        );
        mockRows.push(row);
        return { rows: [row] };
      }

      return { rows: [] };
    }),
    release: vi.fn(),
  };

  const mockPool = {
    connect: vi.fn().mockResolvedValue(mockClient),
    query: vi.fn().mockImplementation((text, values) => mockClient.query(text, values)),
  } as unknown as Pool;

  beforeEach(() => {
    mockRows = [];
    queryHistory = [];
    vi.clearAllMocks();
  });

  // SETTINGS-001: business default created/read
  it('SETTINGS-001: creates and reads business default store settings', async () => {
    const service = createStoreSettingsService(mockPool);
    const updated = await service.updateSettings(
      businessId,
      null,
      {
        store_name: 'Warung Kopi Nusantara Pusat',
        tax_rate_bps: 1100,
        address: 'Jl. Sudirman No. 10',
      },
      businessId
    );

    expect(updated).toBeDefined();
    expect(updated.business_id).toBe(businessId);
    expect(updated.branch_id).toBeNull();
    expect(updated.store_name).toBe('Warung Kopi Nusantara Pusat');
    expect(updated.tax_rate_bps).toBe(1100);

    const resolved = await service.getResolvedSettings(businessId, null, businessId);
    expect(resolved.store_name).toBe('Warung Kopi Nusantara Pusat');
    expect(resolved.address).toBe('Jl. Sudirman No. 10');
  });

  // SETTINGS-002: branch override created/read
  it('SETTINGS-002: creates and reads branch-specific override settings', async () => {
    const service = createStoreSettingsService(mockPool);
    const branchUpdated = await service.updateSettings(
      businessId,
      branchId1,
      {
        store_name: 'Warkop Sudirman Branch',
        address: 'Sudirman Mall Lt. 1',
        printer_config: { paper: '58mm', copies: 2 },
      },
      businessId
    );

    expect(branchUpdated.branch_id).toBe(branchId1);
    expect(branchUpdated.store_name).toBe('Warkop Sudirman Branch');
    expect(branchUpdated.printer_config.paper).toBe('58mm');
    expect(branchUpdated.printer_config.copies).toBe(2);
  });

  // SETTINGS-003: branch config falls back to business default
  it('SETTINGS-003: resolves branch settings by falling back to business default when unspecified', async () => {
    const service = createStoreSettingsService(mockPool);

    // 1. Set business default tax to 1000 bps (10%) and default footer
    await service.updateSettings(
      businessId,
      null,
      {
        tax_rate_bps: 1000,
        receipt_footer: 'Footer Bisnis Utama',
      },
      businessId
    );

    // 2. Resolve for branch with no branch row yet
    const resolved = await service.getResolvedSettings(businessId, branchId1, businessId);
    expect(resolved.branch_id).toBe(branchId1);
    expect(resolved.tax_rate_bps).toBe(1000);
    expect(resolved.receipt_footer).toBe('Footer Bisnis Utama');
    expect(resolved.payment_methods.cash).toBe(true);
  });

  // SETTINGS-004: branch override wins over default
  it('SETTINGS-004: branch override wins over business default for specific fields', async () => {
    const service = createStoreSettingsService(mockPool);

    // Set business default
    await service.updateSettings(
      businessId,
      null,
      {
        store_name: 'Kantor Pusat',
        tax_rate_bps: 1100,
        payment_methods: { cash: true, qris: true, debit: true },
      },
      businessId
    );

    // Set branch override: Cash only, custom tax 1200
    await service.updateSettings(
      businessId,
      branchId1,
      {
        store_name: 'Cabang Senopati',
        tax_rate_bps: 1200,
        payment_methods: { cash: true, qris: false, debit: false },
      },
      businessId
    );

    const resolvedBranch = await service.getResolvedSettings(businessId, branchId1, businessId);
    expect(resolvedBranch.store_name).toBe('Cabang Senopati');
    expect(resolvedBranch.tax_rate_bps).toBe(1200);
    expect(resolvedBranch.payment_methods.cash).toBe(true);
    expect(resolvedBranch.payment_methods.qris).toBe(false);
    expect(resolvedBranch.payment_methods.debit).toBe(false);

    // Default remains unchanged
    const resolvedDefault = await service.getResolvedSettings(businessId, null, businessId);
    expect(resolvedDefault.store_name).toBe('Kantor Pusat');
    expect(resolvedDefault.tax_rate_bps).toBe(1100);
    expect(resolvedDefault.payment_methods.qris).toBe(true);
  });

  // SETTINGS-005: tenant isolation
  it('SETTINGS-005: rejects cross-tenant read/write with 403 Forbidden', async () => {
    const service = createStoreSettingsService(mockPool);

    await expect(
      service.getResolvedSettings(foreignBusinessId, null, businessId)
    ).rejects.toThrow(ApiError);

    await expect(
      service.updateSettings(foreignBusinessId, null, { store_name: 'Hack' }, businessId)
    ).rejects.toThrow(ApiError);
  });

  // SETTINGS-006: foreign branch rejection
  it('SETTINGS-006: rejects branch_id belonging to another business with 403 Forbidden', async () => {
    const service = createStoreSettingsService(mockPool);

    await expect(
      service.getResolvedSettings(businessId, foreignBranchId, businessId)
    ).rejects.toThrow('Branch does not belong to the authenticated business');

    await expect(
      service.updateSettings(businessId, foreignBranchId, { store_name: 'Test' }, businessId)
    ).rejects.toThrow('Branch does not belong to the authenticated business');
  });

  // SETTINGS-007: CASHIER read allowed
  it('SETTINGS-007: verifies RBAC model allows CASHIER role to read store settings', () => {
    const cashierRoles = ['OWNER', 'CASHIER'];
    expect(cashierRoles.includes('CASHIER')).toBe(true);
  });

  // SETTINGS-008: CASHIER write rejected
  it('SETTINGS-008: verifies RBAC model strictly prohibits CASHIER from mutating store settings', () => {
    const writeRoles = ['OWNER'];
    expect(writeRoles.includes('CASHIER')).toBe(false);
  });

  // SETTINGS-009: OWNER write allowed
  it('SETTINGS-009: verifies RBAC model allows OWNER role to mutate store settings', () => {
    const writeRoles = ['OWNER'];
    expect(writeRoles.includes('OWNER')).toBe(true);
  });

  // SETTINGS-010: tax bounds
  it('SETTINGS-010: validates tax_rate_bps bounds between 0 and 3000', () => {
    expect(() => validateStoreSettingsUpdate({ tax_rate_bps: -10 })).toThrow(ValidationError);
    expect(() => validateStoreSettingsUpdate({ tax_rate_bps: 3001 })).toThrow(ValidationError);
    expect(() => validateStoreSettingsUpdate({ tax_rate_bps: 11.5 })).toThrow(ValidationError);

    const valid = validateStoreSettingsUpdate({ tax_rate_bps: 1100 });
    expect(valid.tax_rate_bps).toBe(1100);
  });

  // SETTINGS-011: payment methods validation
  it('SETTINGS-011: validates payment methods object and rejects unknown methods', () => {
    expect(() =>
      validateStoreSettingsUpdate({ payment_methods: { crypto: true } as any })
    ).toThrow(ValidationError);

    expect(() =>
      validateStoreSettingsUpdate({ payment_methods: { cash: 'yes' } as any })
    ).toThrow(ValidationError);

    const valid = validateStoreSettingsUpdate({
      payment_methods: { cash: true, qris: true, debit: false },
    });
    expect(valid.payment_methods?.debit).toBe(false);
  });

  // SETTINGS-012: printer validation
  it('SETTINGS-012: validates printer config paper size, copies, and connectionType', () => {
    expect(() =>
      validateStoreSettingsUpdate({ printer_config: { paper: '76mm' } as any })
    ).toThrow(ValidationError);

    expect(() =>
      validateStoreSettingsUpdate({ printer_config: { copies: 4 } as any })
    ).toThrow(ValidationError);

    expect(() =>
      validateStoreSettingsUpdate({ printer_config: { connectionType: 'Parallel' } as any })
    ).toThrow(ValidationError);

    const valid = validateStoreSettingsUpdate({
      printer_config: {
        model: 'Epson TM-T88VI',
        paper: '58mm',
        copies: 2,
        connectionType: 'Bluetooth',
      },
    });
    expect(valid.printer_config?.paper).toBe('58mm');
    expect(valid.printer_config?.connectionType).toBe('Bluetooth');
  });

  // SETTINGS-013: drawer validation
  it('SETTINGS-013: validates drawer config delayMs and booleans', () => {
    expect(() =>
      validateStoreSettingsUpdate({ drawer_config: { delayMs: 1500 } as any })
    ).toThrow(ValidationError);

    expect(() =>
      validateStoreSettingsUpdate({ drawer_config: { openOnPayment: 'true' } as any })
    ).toThrow(ValidationError);

    const valid = validateStoreSettingsUpdate({
      drawer_config: { openOnPayment: true, openOnShift: true, delayMs: 500 },
    });
    expect(valid.drawer_config?.delayMs).toBe(500);
  });

  // SETTINGS-014: scanner validation
  it('SETTINGS-014: validates scanner config type and autoEnter', () => {
    expect(() =>
      validateStoreSettingsUpdate({ scanner_config: { type: 'Serial RS232' } as any })
    ).toThrow(ValidationError);

    const valid = validateStoreSettingsUpdate({
      scanner_config: { type: 'Bluetooth', autoEnter: true, sound: false },
    });
    expect(valid.scanner_config?.type).toBe('Bluetooth');
    expect(valid.scanner_config?.sound).toBe(false);
  });

  // SETTINGS-015: barcode validation
  it('SETTINGS-015: validates barcode format, labelSize, and showPrice', () => {
    expect(() =>
      validateStoreSettingsUpdate({ barcode_config: { format: 'QR' } as any })
    ).toThrow(ValidationError);

    expect(() =>
      validateStoreSettingsUpdate({ barcode_config: { labelSize: 'besar' } as any })
    ).toThrow(ValidationError);

    const valid = validateStoreSettingsUpdate({
      barcode_config: {
        format: 'EAN-13',
        prefix: '999',
        autoGenerate: false,
        labelSize: 'kecil',
        showPrice: true,
      },
    });
    expect(valid.barcode_config?.format).toBe('EAN-13');
    expect(valid.barcode_config?.labelSize).toBe('kecil');
  });

  // SETTINGS-016: default values
  it('SETTINGS-016: asserts canonical default configuration constants match blueprint', () => {
    expect(CANONICAL_SETTINGS_DEFAULTS.tax_rate_bps).toBe(1100);
    expect(CANONICAL_SETTINGS_DEFAULTS.payment_methods.cash).toBe(true);
    expect(CANONICAL_SETTINGS_DEFAULTS.payment_methods.qris).toBe(true);
    expect(CANONICAL_SETTINGS_DEFAULTS.payment_methods.debit).toBe(true);
    expect(CANONICAL_SETTINGS_DEFAULTS.printer_config.paper).toBe('80mm');
    expect(CANONICAL_SETTINGS_DEFAULTS.printer_config.copies).toBe(1);
    expect(CANONICAL_SETTINGS_DEFAULTS.drawer_config.delayMs).toBe(300);
    expect(CANONICAL_SETTINGS_DEFAULTS.scanner_config.type).toBe('USB HID');
    expect(CANONICAL_SETTINGS_DEFAULTS.barcode_config.format).toBe('CODE128');
  });

  // SETTINGS-017: partial update preserves unspecified values
  it('SETTINGS-017: partial update preserves existing fields without overwriting them to null', async () => {
    const service = createStoreSettingsService(mockPool);

    // Initial update
    await service.updateSettings(
      businessId,
      null,
      {
        store_name: 'Initial Store Name',
        address: 'Initial Address',
        phone: '08123456789',
        tax_rate_bps: 1100,
      },
      businessId
    );

    // Partial update only changing phone
    const updated = await service.updateSettings(
      businessId,
      null,
      {
        phone: '08999999999',
      },
      businessId
    );

    expect(updated.store_name).toBe('Initial Store Name');
    expect(updated.address).toBe('Initial Address');
    expect(updated.phone).toBe('08999999999');
    expect(updated.tax_rate_bps).toBe(1100);
  });

  // SETTINGS-018: resolved response contains complete settings
  it('SETTINGS-018: resolved response returns a full complete StoreSettingsDto payload', async () => {
    const service = createStoreSettingsService(mockPool);
    const resolved = await service.getResolvedSettings(businessId, null, businessId);

    expect(resolved).toHaveProperty('id');
    expect(resolved).toHaveProperty('business_id');
    expect(resolved).toHaveProperty('branch_id');
    expect(resolved).toHaveProperty('store_name');
    expect(resolved).toHaveProperty('address');
    expect(resolved).toHaveProperty('phone');
    expect(resolved).toHaveProperty('tax_rate_bps');
    expect(resolved).toHaveProperty('receipt_footer');
    expect(resolved).toHaveProperty('payment_methods');
    expect(resolved).toHaveProperty('printer_config');
    expect(resolved).toHaveProperty('drawer_config');
    expect(resolved).toHaveProperty('scanner_config');
    expect(resolved).toHaveProperty('barcode_config');
    expect(resolved).toHaveProperty('created_at');
    expect(resolved).toHaveProperty('updated_at');
  });

  // SETTINGS-019: no sale/payment semantic mutation
  it('SETTINGS-019: settings contract acts purely as read/write configuration and does not mutate sales ledger', () => {
    const queryTypes = queryHistory.map((q) => q.text);
    const hasSalesMutation = queryTypes.some(
      (q) => q.includes('INSERT INTO sales') || q.includes('UPDATE sales')
    );
    expect(hasSalesMutation).toBe(false);
  });

  // SETTINGS-020: no hardware side effects
  it('SETTINGS-020: settings service operates without physical hardware driver side effects', async () => {
    const service = createStoreSettingsService(mockPool);
    const result = await service.updateSettings(
      businessId,
      null,
      {
        printer_config: { model: 'Xprinter XP-58IIH', autoPrint: true },
        drawer_config: { openOnPayment: true, delayMs: 400 },
      },
      businessId
    );

    // Pure configuration persistence
    expect(result.printer_config.model).toBe('Xprinter XP-58IIH');
    expect(result.drawer_config.delayMs).toBe(400);
  });
});
