// apps/mobile/test/core/sync/store_settings_test.dart

import 'dart:convert';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/store_settings_models.dart';
import 'package:biz_erp_mobile/core/sync/store_settings_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/hardware/printing/bluetooth_printer_adapter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_device.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_preferences.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_formatter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_data.dart';
import 'package:biz_erp_mobile/core/hardware/scanning/scanner_service.dart';
import 'package:biz_erp_mobile/core/hardware/scanning/scan_buffer.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';

const businessAId = '11111111-1111-4111-8111-111111111111';
const businessBId = '22222222-2222-4222-8222-222222222222';
const branchAId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const branchBId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

StoreSettingsDto testSettings({
  String businessId = businessAId,
  String branchId = branchAId,
  String storeName = 'SKM Mart',
  String address = 'Jl. Melati No. 12, Yogyakarta',
  String phone = '0274-556-810',
  int taxRateBps = 1100,
  String receiptFooter = 'Barang dapat ditukar dalam 1x24 jam.',
  PaymentMethodsConfig? paymentMethods,
  PrinterConfig? printerConfig,
  DrawerConfig? drawerConfig,
  ScannerConfig? scannerConfig,
  BarcodeConfig? barcodeConfig,
}) {
  return StoreSettingsDto(
    id: 'settings-1',
    businessId: businessId,
    branchId: branchId,
    storeName: storeName,
    address: address,
    phone: phone,
    taxRateBps: taxRateBps,
    receiptFooter: receiptFooter,
    paymentMethods: paymentMethods ??
        const PaymentMethodsConfig(cash: true, qris: true, debit: true),
    printerConfig: printerConfig ??
        const PrinterConfig(
          model: 'Epson TM-T82',
          paper: '80mm',
          copies: 1,
          autoCut: true,
          printLogo: true,
          autoPrint: true,
          connectionType: 'USB',
        ),
    drawerConfig: drawerConfig ??
        const DrawerConfig(
          openOnPayment: true,
          openOnShift: false,
          delayMs: 300,
        ),
    scannerConfig: scannerConfig ??
        const ScannerConfig(
          type: 'USB HID',
          autoEnter: true,
          sound: true,
        ),
    barcodeConfig: barcodeConfig ??
        const BarcodeConfig(
          format: 'CODE128',
          prefix: '2891',
          autoGenerate: true,
          labelSize: 'sedang',
          showPrice: true,
        ),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  );
}

class _FakeSettingsApi implements SyncApiClient {
  StoreSettingsDto? settings;
  bool throwOnFetch = false;
  String? lastBusinessId;
  String? lastBranchId;

  @override
  Future<StoreSettingsDto?> getStoreSettings({
    required String businessId,
    required String branchId,
  }) async {
    lastBusinessId = businessId;
    lastBranchId = branchId;
    if (throwOnFetch) {
      throw Exception('Network unavailable');
    }
    return settings;
  }

  @override
  Future<bool> health() async => true;

  @override
  Future<PullBranchesResponse> pullBranches({
    required String businessId,
  }) async =>
      const PullBranchesResponse([]);

  @override
  Future<PullProductsResponse> pullProducts({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async =>
      const PullProductsResponse([], false, 0);

  @override
  Future<PullCustomersResponse> pullCustomers({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async =>
      const PullCustomersResponse([], false, 0);

  @override
  Future<PullSalesResponse> pullSales({
    required String businessId,
    required int sinceMs,
    int limit = 100,
  }) async =>
      const PullSalesResponse([], false);

  @override
  Future<ProductPushResult> pushProduct(
    ProductDto product, {
    int? ifMatchVersion,
  }) async =>
      const ProductPushResult(ok: true);

  @override
  Future<ProductPushResult> createProduct(
    ProductDto product, {
    required String idempotencyKey,
  }) async =>
      const ProductPushResult(ok: true);

  @override
  Future<List<SalePushResultItem>> pushSalesBatch(List<SaleDto> sales) async =>
      [];

  @override
  Future<CustomerPushResult> pushCustomer(
    CustomerDto customer, {
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async =>
      const CustomerPushResult(ok: true);

  @override
  Future<CustomerPushResult> createCustomer(
    CustomerDto customer, {
    required String idempotencyKey,
  }) async =>
      const CustomerPushResult(ok: true);

  @override
  Future<CustomerPushResult> deleteCustomer(
    CustomerDto customer, {
    required String idempotencyKey,
  }) async =>
      const CustomerPushResult(ok: true);

  @override
  Future<PullSuppliersResponse> pullSuppliers({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async =>
      const PullSuppliersResponse([], false, 0);

  @override
  Future<SupplierPushResult> pushSupplier(
    SupplierDto supplier, {
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async =>
      const SupplierPushResult(ok: true);

  @override
  Future<SupplierPushResult> createSupplier(SupplierDto supplier, {required String idempotencyKey}) async =>
      const SupplierPushResult(ok: true);

  @override
  Future<SupplierPushResult> deleteSupplier(SupplierDto supplier, {required String idempotencyKey}) async =>
      const SupplierPushResult(ok: true);

  @override
  Future<PullPurchasesResponse> pullPurchases({
    required String businessId,
    required String branchId,
    required int sinceVersion,
    int limit = 500,
  }) async => const PullPurchasesResponse([], false, 0);

  @override
  Future<PurchasePushResult> createPurchaseDraft(
    PurchaseDto purchase, {
    required String idempotencyKey,
  }) async => PurchasePushResult(ok: true);

  @override
  Future<PurchasePushResult> updatePurchaseDraft(
    PurchaseDto purchase, {
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async => PurchasePushResult(ok: true);

  @override
  Future<PurchaseDto> getPurchase({
    required String id,
  }) async => throw UnimplementedError();

  @override
  Future<PurchasePushResult> sendPurchase({
    required String id,
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async => PurchasePushResult(ok: true);

  @override
  Future<PurchasePushResult> receivePurchase({
    required String id,
    required String businessId,
    required List<Map<String, dynamic>> items,
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async => PurchasePushResult(ok: true);

  @override
  Future<PurchasePushResult> payPurchase({
    required String id,
    required String businessId,
    required int amountMinor,
    required String method,
    String? reference,
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async => PurchasePushResult(ok: true);

  @override
  Future<PurchasePushResult> cancelPurchase({
    required String id,
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async => PurchasePushResult(ok: true);

  @override
  Future<PurchasePushResult> deleteDraftPurchase({
    required String id,
  }) async => PurchasePushResult(ok: true);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AppDatabase db;
  late _FakeSettingsApi api;
  late StoreSettingsRepository repo;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    api = _FakeSettingsApi();
    repo = StoreSettingsRepository(db, api);
  });

  tearDown(() async => await db.close());

  group('STORE-SYNC', () {
    test('MOBILE-SETTINGS-001: backend → local mapping', () async {
      final dto = testSettings();
      api.settings = dto;

      final result = await repo.fetchAndCache(
        businessId: businessAId,
        branchId: branchAId,
      );

      expect(result.storeName, 'SKM Mart');
      expect(result.address, 'Jl. Melati No. 12, Yogyakarta');
      expect(result.phone, '0274-556-810');
      expect(result.receiptFooter, 'Barang dapat ditukar dalam 1x24 jam.');
      expect(result.businessId, businessAId);
      expect(result.branchId, branchAId);

      final cached = await repo.getCached(
        businessId: businessAId,
        branchId: branchAId,
      );
      expect(cached, isNotNull);
      expect(cached!.settings.storeName, 'SKM Mart');
      expect(cached.settings.address, 'Jl. Melati No. 12, Yogyakarta');
      expect(cached.settings.phone, '0274-556-810');
      expect(
        cached.settings.receiptFooter,
        'Barang dapat ditukar dalam 1x24 jam.',
      );
    });

    test('MOBILE-SETTINGS-002: tax rate mapping', () async {
      final dto = testSettings(taxRateBps: 1200);
      api.settings = dto;

      await repo.fetchAndCache(businessId: businessAId, branchId: branchAId);

      final cached = await repo.getCached(
        businessId: businessAId,
        branchId: branchAId,
      );
      expect(cached, isNotNull);
      expect(cached!.settings.taxRateBps, 1200);

      // Also verify scalar column is updated
      final row = await (db.select(db.businessSettingsLocal)
            ..where((t) => t.id.equals('${businessAId}_$branchAId')))
          .getSingle();
      expect(row.taxRateBps, 1200);

      // 0% edge case
      api.settings = testSettings(taxRateBps: 0);
      await repo.fetchAndCache(businessId: businessAId, branchId: branchAId);
      final cached0 = await repo.getCached(
        businessId: businessAId,
        branchId: branchAId,
      );
      expect(cached0!.settings.taxRateBps, 0);
    });

    test('MOBILE-SETTINGS-003: payment methods mapping', () async {
      final dto = testSettings(
        paymentMethods: const PaymentMethodsConfig(
          cash: true,
          qris: false,
          debit: true,
        ),
      );
      api.settings = dto;

      await repo.fetchAndCache(businessId: businessAId, branchId: branchAId);

      final cached = await repo.getCached(
        businessId: businessAId,
        branchId: branchAId,
      );
      expect(cached, isNotNull);
      expect(cached!.settings.paymentMethods.cash, isTrue);
      expect(cached.settings.paymentMethods.qris, isFalse);
      expect(cached.settings.paymentMethods.debit, isTrue);

      // Verify it round-trips through JSON
      final json = cached.settings.paymentMethods.toJson();
      expect(json['cash'], isTrue);
      expect(json['qris'], isFalse);
      expect(json['debit'], isTrue);
    });

    test('MOBILE-SETTINGS-004: printer preferences mapping', () async {
      final dto = testSettings(
        printerConfig: const PrinterConfig(
          model: 'Epson TM-T88VI',
          paper: '58mm',
          copies: 2,
          autoCut: false,
          printLogo: false,
          autoPrint: true,
          connectionType: 'Bluetooth',
        ),
      );
      api.settings = dto;

      await repo.fetchAndCache(businessId: businessAId, branchId: branchAId);

      final cached = await repo.getCached(
        businessId: businessAId,
        branchId: branchAId,
      );
      expect(cached, isNotNull);
      final pc = cached!.settings.printerConfig;
      expect(pc.model, 'Epson TM-T88VI');
      expect(pc.paper, '58mm');
      expect(pc.copies, 2);
      expect(pc.autoCut, isFalse);
      expect(pc.printLogo, isFalse);
      expect(pc.autoPrint, isTrue);
      expect(pc.connectionType, 'Bluetooth');
    });

    test('MOBILE-SETTINGS-005: drawer preferences mapping', () async {
      final dto = testSettings(
        drawerConfig: const DrawerConfig(
          openOnPayment: false,
          openOnShift: true,
          delayMs: 500,
        ),
      );
      api.settings = dto;

      await repo.fetchAndCache(businessId: businessAId, branchId: branchAId);

      final cached = await repo.getCached(
        businessId: businessAId,
        branchId: branchAId,
      );
      expect(cached, isNotNull);
      final dc = cached!.settings.drawerConfig;
      expect(dc.openOnPayment, isFalse);
      expect(dc.openOnShift, isTrue);
      expect(dc.delayMs, 500);
    });

    test('MOBILE-SETTINGS-006: scanner preferences mapping', () async {
      final dto = testSettings(
        scannerConfig: const ScannerConfig(
          type: 'Bluetooth',
          autoEnter: false,
          sound: false,
        ),
      );
      api.settings = dto;

      await repo.fetchAndCache(businessId: businessAId, branchId: branchAId);

      final cached = await repo.getCached(
        businessId: businessAId,
        branchId: branchAId,
      );
      expect(cached, isNotNull);
      final sc = cached!.settings.scannerConfig;
      expect(sc.type, 'Bluetooth');
      expect(sc.autoEnter, isFalse);
      expect(sc.sound, isFalse);
    });

    test('MOBILE-SETTINGS-007: barcode preferences mapping', () async {
      final dto = testSettings(
        barcodeConfig: const BarcodeConfig(
          format: 'EAN-13',
          prefix: '12345',
          autoGenerate: false,
          labelSize: 'kecil',
          showPrice: false,
        ),
      );
      api.settings = dto;

      await repo.fetchAndCache(businessId: businessAId, branchId: branchAId);

      final cached = await repo.getCached(
        businessId: businessAId,
        branchId: branchAId,
      );
      expect(cached, isNotNull);
      final bc = cached!.settings.barcodeConfig;
      expect(bc.format, 'EAN-13');
      expect(bc.prefix, '12345');
      expect(bc.autoGenerate, isFalse);
      expect(bc.labelSize, 'kecil');
      expect(bc.showPrice, isFalse);
    });

    test('MOBILE-SETTINGS-008: branch switch reloads settings', () async {
      // Seed settings for branch A
      api.settings = testSettings(businessId: businessAId, branchId: branchAId);
      await repo.fetchAndCache(
        businessId: businessAId,
        branchId: branchAId,
      );

      // Verify branch A settings exist
      final cachedA = await repo.getCached(
        businessId: businessAId,
        branchId: branchAId,
      );
      expect(cachedA, isNotNull);
      expect(cachedA!.settings.storeName, 'SKM Mart');

      // Clear old branch settings (as changeBranch does)
      await repo.clearBranchSettings(
        businessId: businessAId,
        branchId: branchAId,
      );

      // Old settings should be gone
      final cleared = await repo.getCached(
        businessId: businessAId,
        branchId: branchAId,
      );
      expect(cleared, isNull);

      // Fetch new branch B settings
      api.settings = testSettings(
        businessId: businessAId,
        branchId: branchBId,
        storeName: 'Branch B Store',
      );
      await repo.fetchAndCache(
        businessId: businessAId,
        branchId: branchBId,
      );

      // New settings should exist, old should be gone
      final cachedB = await repo.getCached(
        businessId: businessAId,
        branchId: branchBId,
      );
      expect(cachedB, isNotNull);
      expect(cachedB!.settings.storeName, 'Branch B Store');

      final staleA = await repo.getCached(
        businessId: businessAId,
        branchId: branchAId,
      );
      expect(staleA, isNull);
    });

    test('MOBILE-SETTINGS-009: tenant switch clears settings', () async {
      // Seed settings for business A
      api.settings = testSettings(businessId: businessAId, branchId: branchAId);
      await repo.fetchAndCache(
        businessId: businessAId,
        branchId: branchAId,
      );

      // Seed settings for business B
      api.settings = testSettings(
        businessId: businessBId,
        branchId: branchBId,
        storeName: 'Business B Store',
      );
      await repo.fetchAndCache(
        businessId: businessBId,
        branchId: branchBId,
      );

      // Both should have cached settings
      expect(await repo.getCached(businessId: businessAId, branchId: branchAId), isNotNull);
      expect(await repo.getCached(businessId: businessBId, branchId: branchBId), isNotNull);

      // Tenant switch: clear business A
      await repo.clearAllForBusiness(businessAId);

      // Business A settings gone
      expect(
        await repo.getCached(businessId: businessAId, branchId: branchAId),
        isNull,
      );

      // Business B settings must remain untouched
      final cachedB = await repo.getCached(
        businessId: businessBId,
        branchId: branchBId,
      );
      expect(cachedB, isNotNull);
      expect(cachedB!.settings.storeName, 'Business B Store');
    });

    test('MOBILE-SETTINGS-010: offline uses last valid cached settings', () async {
      // Pre-cache settings
      api.settings = testSettings();
      await repo.fetchAndCache(businessId: businessAId, branchId: branchAId);

      // Simulate offline: API throws
      api.throwOnFetch = true;

      // getSettings should fall back to cache
      final result = await repo.getSettings(
        businessId: businessAId,
        branchId: branchAId,
      );

      expect(result.storeName, 'SKM Mart');
      expect(result.taxRateBps, 1100);
    });

    test('MOBILE-SETTINGS-011: tenant isolation — no cross-tenant leakage', () async {
      // Cache settings for business A, branch A
      api.settings = testSettings(
        businessId: businessAId,
        branchId: branchAId,
        storeName: 'Business A Store',
        taxRateBps: 1100,
      );
      await repo.fetchAndCache(
        businessId: businessAId,
        branchId: branchAId,
      );

      // Cache settings for business B, branch B
      api.settings = testSettings(
        businessId: businessBId,
        branchId: branchBId,
        storeName: 'Business B Store',
        taxRateBps: 1200,
      );
      await repo.fetchAndCache(
        businessId: businessBId,
        branchId: branchBId,
      );

      // Business A cached settings must return business A values
      final cachedA = await repo.getCached(
        businessId: businessAId,
        branchId: branchAId,
      );
      expect(cachedA!.settings.storeName, 'Business A Store');
      expect(cachedA.settings.taxRateBps, 1100);
      expect(cachedA.settings.businessId, businessAId);

      // Business B cached settings must return business B values
      final cachedB = await repo.getCached(
        businessId: businessBId,
        branchId: branchBId,
      );
      expect(cachedB!.settings.storeName, 'Business B Store');
      expect(cachedB.settings.taxRateBps, 1200);
      expect(cachedB.settings.businessId, businessBId);

      // Cross-query: business A branch B should be null
      final cross = await repo.getCached(
        businessId: businessAId,
        branchId: branchBId,
      );
      expect(cross, isNull);
    });

    test('MOBILE-SETTINGS-012: no duplicate settings source', () async {
      // The ONLY source of tax rate is the backend settings JSON
      // stored in settings_json column. The scalar tax_rate_bps
      // column is a derived cache, not a second source.
      final dto = testSettings(taxRateBps: 700);
      api.settings = dto;
      await repo.fetchAndCache(
        businessId: businessAId,
        branchId: branchAId,
      );

      // Read from DB: verify settings_json is the source of truth
      final id = '${businessAId}_$branchAId';
      final row = await (db.select(db.businessSettingsLocal)
            ..where((t) => t.id.equals(id)))
          .getSingle();

      final jsonFromDb = jsonDecode(row.settingsJson) as Map<String, dynamic>;
      expect(jsonFromDb['tax_rate_bps'], 700);
      expect(jsonFromDb['store_name'], 'SKM Mart');
      expect(jsonFromDb['receipt_footer'],
          'Barang dapat ditukar dalam 1x24 jam.');
      expect(jsonFromDb['business_id'], businessAId);
      expect(jsonFromDb['branch_id'], branchAId);

      // The scalar column (derived) must match the JSON (source of truth)
      expect(row.taxRateBps, jsonFromDb['tax_rate_bps'] as int);
      expect(row.updatedAt, greaterThan(0));
    });
  });

  group('STORE-HARDWARE-COMPAT', () {
    test('MOBILE-SETTINGS-013: existing printer adapter remains compatible', () async {
      // Verify the StoreSettingsDto printer config maps to
      // the existing printing infrastructure without breaking it.
      final dto = testSettings(
        printerConfig: const PrinterConfig(
          model: 'Epson TM-T82',
          paper: '80mm',
          copies: 1,
          autoCut: true,
          printLogo: true,
          autoPrint: true,
          connectionType: 'USB',
        ),
      );

      // The printer config from settings
      final pc = dto.printerConfig;
      expect(pc.model, 'Epson TM-T82');
      expect(pc.paper, '80mm');

      // Existing BluetoothPrinterAdapter can still be constructed
      final adapter = BluetoothPrinterAdapter();
      expect(adapter, isNotNull);

      // Existing PrinterDevice model is unchanged
      final device = PrinterDevice(name: pc.model, address: '00:11:21:00:55:44');
      expect(device.name, 'Epson TM-T82');
      expect(device.address, '00:11:21:00:55:44');

      // Existing ReceiptFormatter can still format receipts
      const formatter = ReceiptFormatter();
      final receiptData = ReceiptData(
        receiptNumber: 'R-001',
        businessName: dto.storeName,
        branchName: 'Main',
        cashierId: 'CASHIER-001',
        createdAtEpochMs: DateTime.now().millisecondsSinceEpoch,
        subtotalMinor: 10000,
        discountMinor: 0,
        taxMinor: 1100,
        totalMinor: 11100,
        cashReceivedMinor: 20000,
        changeMinor: 8900,
        items: [
          ReceiptItemData(
            productId: 'p1',
            displayName: 'Product 1',
            quantity: 1,
            unitPriceMinor: 10000,
          ),
        ],
      );
      final bytes = formatter.format(receiptData);
      expect(bytes, isNotEmpty);

      // Existing PrintingService constructor signature unchanged
      // (requires adapter + prefs; verify it can be created with dummies)
      final printingService = PrintingService(
        adapter: BluetoothPrinterAdapter(),
        prefs: _StubPrinterPreferences(),
        formatter: formatter,
      );
      expect(printingService, isNotNull);
      expect(printingService.status, PrinterStatus.disconnected);
    });

    test('MOBILE-SETTINGS-014: existing scanner service remains compatible', () async {
      // Verify ScannerService API is unchanged and settings
      // scanner config can populate ScannerService.
      final dto = testSettings(
        scannerConfig: const ScannerConfig(
          type: 'USB HID',
          autoEnter: true,
          sound: true,
        ),
      );

      final sc = dto.scannerConfig;
      expect(sc.type, 'USB HID');
      expect(sc.autoEnter, isTrue);
      expect(sc.sound, isTrue);

      // Existing ScannerService can be constructed with its dependencies.
      // Uses an in-memory DB for the ProductRepository.
      final testDb = AppDatabase(NativeDatabase.memory());
      final productRepo = ProductRepository(testDb);

      final scannerService = ScannerService(
        productRepo: productRepo,
        businessId: businessAId,
        addToCart: (productId) async {},
      );

      expect(scannerService, isNotNull);
      expect(scannerService.duplicateDebounce,
          const Duration(milliseconds: 500));

      // ScannerService.start/stop are callable (no change needed)
      scannerService.start();
      scannerService.stop();

      // Verify scanner config values are usable types
      // type is a string enum: 'USB HID' | 'Bluetooth'
      expect(sc.type == 'USB HID' || sc.type == 'Bluetooth', isTrue);
      expect(sc.autoEnter, isA<bool>());
      expect(sc.sound, isA<bool>());

      await testDb.close();
    });
  });
}

class _StubPrinterPreferences implements PrinterPreferences {
  @override
  Future<PrinterDevice?> loadLastPrinter() async => null;

  @override
  Future<void> saveLastPrinter(PrinterDevice device) async {}

  @override
  Future<void> clearLastPrinter() async {}
}
