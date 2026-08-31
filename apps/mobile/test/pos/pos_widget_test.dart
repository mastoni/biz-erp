import 'package:biz_erp_mobile/core/sync/branch_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/store_settings_models.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/cart/data/cart_repository.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';
import 'package:biz_erp_mobile/sales/domain/checkout/checkout_models.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_controller.dart';
import 'package:biz_erp_mobile/customers/data/customer_repository.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_screen.dart';
import 'package:biz_erp_mobile/core/hardware/printing/bluetooth_printer_adapter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_preferences.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_device.dart';

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
  late AppDatabase db;
  late PosController controller;

  setUp(() async {
    db = AppDatabase(NativeDatabase.memory());
    final prodRepo = ProductRepository(db);
    final cartRepo = CartRepository(db);
    final outbox = SyncOutboxRepository(db);
    final checkoutService = CheckoutService(db, SaleCalculationEngine(), outbox, prodRepo);

    // Seed 1 product
    await prodRepo.upsertProduct(
      Product(
        id: 'a1111111-1111-1111-1111-111111111111',
        businessId: 'test-business-id',
        name: 'Test Product',
        priceMinor: 10000,
        isActive: true,
        serverVersion: 1,
      ),
    );

    final printingService = PrintingService(
      adapter: BluetoothPrinterAdapter(),
      prefs: _DummyPrefs(),
    );

    controller = PosController(
      businessId: 'test-business-id',
      branchId: 'BRANCH-001',
      branchRepo: _MockBranchRepo(),
      productRepo: prodRepo,
      cartRepo: cartRepo,
      calcEngine: SaleCalculationEngine(),
      checkoutService: checkoutService,
      printingService: printingService,
      customerRepo: CustomerRepository(db),
    );
    await controller.init();
  });

  tearDown(() async {
    await db.close();
  });

  Widget buildTestScreen() =>
      MaterialApp(home: PosScreen(controller: controller));

  testWidgets('UI-001: Product grid shows active products', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    expect(find.text('Test Product'), findsOneWidget);
  });

  testWidgets('UI-002: Tap product adds to cart', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    await tester.tap(find.text('Test Product'));
    await tester.pumpAndSettle();
    expect(find.text('1'), findsOneWidget); // Qty 1 in cart
  });

  testWidgets('UI-003: Cart panel calculates total correctly', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    await tester.tap(find.text('Test Product'));
    await tester.pumpAndSettle();
    expect(find.text('Rp 10.000'), findsWidgets); // Subtotal & Total
  });

  testWidgets('UI-004: Payment dialog validates cash < total', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    await tester.tap(find.text('Test Product'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('BAYAR SEKARANG'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '5000');
    await tester.pump();

    // Tap confirm meskipun cash kurang
    await tester.tap(find.text('KONFIRMASI'));
    await tester.pumpAndSettle();

    // Dialog pembayaran harus tetap terbuka (silent reject)
    expect(find.text('Pilih Pembayaran'), findsOneWidget);
    // Struk tidak boleh muncul
    expect(find.text('Transaksi Sukses'), findsNothing);
  });
  testWidgets('UI-005: Checkout completes and shows receipt', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    await tester.tap(find.text('Test Product'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('BAYAR SEKARANG'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '20000');
    await tester.pump();

    await tester.tap(find.text('KONFIRMASI'));
    await tester.pumpAndSettle();

    expect(find.text('Transaksi Sukses'), findsOneWidget);
    expect(find.text('Test Product'), findsOneWidget);
  });

  testWidgets('UI-006: Checkout failure preserves cart', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    await tester.tap(find.text('Test Product'));
    await tester.pumpAndSettle();

    // Simulate checkout failure by not entering cash
    await tester.tap(find.text('BAYAR SEKARANG'));
    await tester.pumpAndSettle();

    // Tap confirm with empty cash
    await tester.tap(find.text('KONFIRMASI'));
    await tester.pumpAndSettle();

    // Cart should still have item
    expect(find.text('Test Product'), findsOneWidget);
  });

  testWidgets('UI-007: Checkout success creates new cart', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    await tester.tap(find.text('Test Product'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('BAYAR SEKARANG'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '20000');
    await tester.pump();

    await tester.tap(find.text('KONFIRMASI'));
    await tester.pumpAndSettle();

    // Close receipt dialog
    await tester.tap(find.text('TUTUP'));
    await tester.pumpAndSettle();

    // Cart should be empty (new cart created)
    expect(find.text('0'), findsOneWidget);
  });
}