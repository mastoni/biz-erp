import 'package:biz_erp_mobile/core/sync/branch_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/store_settings_models.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/cart/data/cart_repository.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/hardware/printing/bluetooth_printer_adapter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_device.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_preferences.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/scanning/scanner_service.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_controller.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_screen.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';
import 'package:biz_erp_mobile/customers/data/customer_repository.dart';

class _DummyPrefs implements PrinterPreferences {
  @override
  Future<PrinterDevice?> loadLastPrinter() async => null;
  @override
  Future<void> saveLastPrinter(PrinterDevice device) async {}
  @override
  Future<void> clearLastPrinter() async {}
}

class _MockBranchRepo extends BranchRepository {
  _MockBranchRepo() : super(AppDatabase(NativeDatabase.memory()), _MockSyncApi());

  @override
  Future<List<BranchDto>> getCachedBranches(String businessId) async {
    return [
      BranchDto(
        id: 'BRANCH-001',
        businessId: businessId,
        name: 'Test Branch',
        status: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      ),
    ];
  }

  @override
  Future<void> setActiveBranch(String businessId, String branchId) async {}

  @override
  Future<String?> getSelectedBranchId(String businessId) async => 'BRANCH-001';
}

class _MockSyncApi implements SyncApiClient {
  Future<bool> health() async => true;

  Future<PullProductsResponse> pullProducts({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async => const PullProductsResponse([], false, 0);

  Future<PullCustomersResponse> pullCustomers({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async => const PullCustomersResponse([], false, 0);

  Future<PullSalesResponse> pullSales({
    required String businessId,
    required int sinceMs,
    int limit = 100,
  }) async => const PullSalesResponse([], false);

  Future<PullBranchesResponse> pullBranches({
    required String businessId,
  }) async => const PullBranchesResponse([]);

  Future<ProductPushResult> pushProduct(ProductDto product, {int? ifMatchVersion}) async =>
      ProductPushResult(ok: true);

  Future<ProductPushResult> createProduct(ProductDto product, {required String idempotencyKey}) async =>
      ProductPushResult(ok: true);

  Future<List<SalePushResultItem>> pushSalesBatch(List<SaleDto> sales) async =>
      [];

  Future<CustomerPushResult> pushCustomer(
    CustomerDto customer, {
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async =>
      CustomerPushResult(ok: true);

  Future<CustomerPushResult> createCustomer(
    CustomerDto customer, {
    required String idempotencyKey,
  }) async =>
      CustomerPushResult(ok: true);

  Future<CustomerPushResult> deleteCustomer(
    CustomerDto customer, {
    required String idempotencyKey,
  }) async =>
      CustomerPushResult(ok: true);

  @override
  Future<PullSuppliersResponse> pullSuppliers({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async => const PullSuppliersResponse([], false, 0);

  @override
  Future<SupplierPushResult> pushSupplier(
    SupplierDto supplier, {
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async => SupplierPushResult(ok: true);

  @override
  Future<SupplierPushResult> createSupplier(SupplierDto supplier, {required String idempotencyKey}) async =>
      SupplierPushResult(ok: true);

  @override
  Future<SupplierPushResult> deleteSupplier(SupplierDto supplier, {required String idempotencyKey}) async =>
      SupplierPushResult(ok: true);

  @override
  Future<StoreSettingsDto?> getStoreSettings({
    required String businessId,
    required String branchId,
  }) async =>
      null;
}

void main() {
  const biz = '11111111-1111-1111-1111-111111111111';

  testWidgets('UI-SCAN snackbar sukses & not-found', (tester) async {
    final db = AppDatabase(NativeDatabase.memory());
    final repo = ProductRepository(db);
    final cartRepo = CartRepository(db);
    final outbox = SyncOutboxRepository(db);

    await repo.upsertProduct(
      Product(
        id: '10000000-0000-4000-a000-000000000001',
        businessId: biz,
        name: 'Kopi',
        priceMinor: 18000,
        isActive: true,
        serverVersion: 1,
        barcode: '8991002123456',
      ),
    );

    final controller = PosController(
      businessId: biz,
      branchId: 'BRANCH-001',
      branchRepo: _MockBranchRepo(),
      productRepo: repo,
      cartRepo: cartRepo,
      calcEngine: SaleCalculationEngine(),
      checkoutService: CheckoutService(db, SaleCalculationEngine(), outbox, repo),
      printingService: PrintingService(
        adapter: BluetoothPrinterAdapter(),
        prefs: _DummyPrefs(),
      ),
      customerRepo: CustomerRepository(db),
    );
    await controller.init();

    final service = ScannerService(
      productRepo: repo,
      businessId: biz,
      addToCart: (pid) => controller.addToCart(pid),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: PosScreen(controller: controller, scannerService: service),
      ),
    );
    await tester.pumpAndSettle();

    // Scan 1: sukses
    await service.processBarcode('8991002123456');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('+ Kopi'), findsOneWidget);

    // TUNGGU SNACKBAR PERTAMA HILANG (default 2 detik di kode + buffer)
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();

    // Scan 2: not-found
    await service.processBarcode('9999999999999');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();

    expect(find.textContaining('Produk tidak ditemukan'), findsOneWidget);

    await db.close();
  });
}