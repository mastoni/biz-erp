import 'package:drift/drift.dart' hide isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_engine.dart';
import 'package:biz_erp_mobile/core/sync/sync_meta_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/sales/data/sales_sync_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/customers/data/customer_repository.dart';

const biz = '11111111-1111-1111-1111-111111111111';

class MockSyncApi implements SyncApiClient {
  @override
  Future<ProductPushResult> createProduct(ProductDto product, {required String idempotencyKey}) async {
    return ProductPushResult(ok: true, serverVersion: 1);
  }
  bool healthy = true;
  ProductPushResult Function(ProductDto, int?)? onPushProduct;
  List<SalePushResultItem> Function(List<SaleDto>)? onPushSales;
  PullProductsResponse pullProductsResp = const PullProductsResponse(
    [],
    false,
    0,
  );
  PullCustomersResponse pullCustomersResp = const PullCustomersResponse(
    [],
    false,
    0,
  );
  PullSalesResponse pullSalesResp = const PullSalesResponse([], false);

  @override
  Future<bool> health() async => healthy;
  @override
  Future<PullProductsResponse> pullProducts({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async => pullProductsResp;
  @override
  Future<PullCustomersResponse> pullCustomers({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async => pullCustomersResp;
  @override
  Future<PullSalesResponse> pullSales({
    required String businessId,
    required int sinceMs,
    int limit = 100,
  }) async => pullSalesResp;
  @override
  Future<ProductPushResult> pushProduct(
    ProductDto product, {
    int? ifMatchVersion,
  }) async =>
      onPushProduct?.call(product, ifMatchVersion) ??
      const ProductPushResult(ok: true, serverVersion: 1);
  @override
  Future<List<SalePushResultItem>> pushSalesBatch(List<SaleDto> sales) async =>
      onPushSales?.call(sales) ??
      [
        for (final s in sales)
          SalePushResultItem(s.idempotencyKey, 'created', saleId: s.id),
      ];
}

void main() {
  late AppDatabase db;
  late SyncOutboxRepository outbox;
  late SyncMetaRepository meta;
  late ProductRepository products;
  late SalesSyncRepository salesSync;
  late CustomerRepository customers;
  late MockSyncApi api;
  late SyncEngine engine;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    outbox = SyncOutboxRepository(db);
    meta = SyncMetaRepository(db);
    products = ProductRepository(db);
    salesSync = SalesSyncRepository(db);
    customers = CustomerRepository(db);
    api = MockSyncApi();
    engine = SyncEngine(
      outbox: outbox,
      meta: meta,
      api: api,
      products: products,
      salesSync: salesSync,
      customers: customers,
      businessId: biz,
    );
  });
  tearDown(() async => await db.close());

  test('SYNC-005 push product sukses menandai synced', () async {
    await outbox.enqueueProductUpsert(
      ProductDto(
        id: 'a1111111-1111-4111-a111-111111111111',
        name: 'Kopi',
        priceMinor: 18000,
        isActive: true,
        serverVersion: 0,
      ),
    );
    final summary = await engine.syncNow();
    expect(summary.reachable, isTrue);
    expect(summary.pushed, 1);
    final counts = await outbox.counts();
    expect(counts.pending, 0);
  });

  test(
    'SYNC-006 push product conflict â†’ status conflict, local dipertahankan',
    () async {
      api.onPushProduct = (dto, v) => ProductPushResult(
        conflict: true,
        error: 'VERSION_CONFLICT',
        serverState: ProductDto(
          id: dto.id,
          name: 'Server',
          priceMinor: 999,
          isActive: true,
          serverVersion: 5,
        ),
      );
      await outbox.enqueueProductUpsert(
        ProductDto(
          id: 'a1111111-1111-4111-a111-111111111111',
          name: 'Kopi Lokal',
          priceMinor: 18000,
          isActive: true,
          serverVersion: 3,
        ),
      );
      await engine.syncNow();
      final counts = await outbox.counts();
      expect(counts.conflict, 1);
      expect(counts.pending, 0); // tidak retry otomatis
    },
  );

  test('SYNC-007 push sales batch created/duplicate â†’ synced', () async {
    final sale = SaleDto(
      id: 's1',
      idempotencyKey: 'key-1',
      receiptNumber: 'R-001',
      subtotalMinor: 18000,
      discountMinor: 0,
      taxMinor: 1980,
      grandTotalMinor: 19980,
      paymentMethod: 'cash',
      cashReceivedMinor: 20000,
      changeMinor: 20,
      clientCreatedAt: 1000,
      items: const [],
    );
    await outbox.enqueueSale(sale);
    api.onPushSales = (sales) => [
      SalePushResultItem('key-1', 'duplicate', saleId: 's1'),
    ];
    await engine.syncNow();
    final counts = await outbox.counts();
    expect(counts.pending, 0);
  });

  test('SYNC-008 pull products skip local dirty', () async {
    // seed local dirty
    await products.upsertProduct(
      Product(
        id: 'a1111111-1111-4111-a111-111111111111',
        businessId: biz,
        name: 'Lokal',
        priceMinor: 1,
        isActive: true,
        serverVersion: 1,
      ),
    );
    await products.markDirty('a1111111-1111-4111-a111-111111111111');

    api.pullProductsResp = PullProductsResponse(
      [
        ProductDto(
          id: 'a1111111-1111-4111-a111-111111111111',
          name: 'Server',
          priceMinor: 2,
          isActive: true,
          serverVersion: 2,
        ),
      ],
      false,
      2,
    );

    final summary = await engine.syncNow();
    expect(summary.pulledProducts, 0); // dirty dipertahankan
  });

  test('SYNC-009 pull sales tidak overwrite lokal + cursor maju', () async {
    api.pullSalesResp = PullSalesResponse([
      SaleDto(
        id: 'srv-1',
        idempotencyKey: 'k1',
        receiptNumber: 'R-9',
        subtotalMinor: 100,
        discountMinor: 0,
        taxMinor: 0,
        grandTotalMinor: 100,
        paymentMethod: 'cash',
        cashReceivedMinor: 100,
        changeMinor: 0,
        clientCreatedAt: 5000,
        serverCreatedAt: 6000,
        items: const [],
      ),
    ], false);

    final s1 = await engine.syncNow();
    expect(s1.pulledSales, 1);

    // pull kedua: sale sama tidak di-insert ulang
    final s2 = await engine.syncNow();
    expect(s2.pulledSales, 0);

    final cursor = await meta.getInt('sales_pull_cursor');
    expect(cursor, 6000);
  });

  test('SYNC-010 unreachable â†’ tidak push, counts tetap pending', () async {
    api.healthy = false;
    await outbox.enqueueProductUpsert(
      ProductDto(
        id: 'a1111111-1111-4111-a111-111111111111',
        name: 'Kopi',
        priceMinor: 18000,
        isActive: true,
        serverVersion: 0,
      ),
    );
    final summary = await engine.syncNow();
    expect(summary.reachable, isFalse);
    expect(summary.pushed, 0);
    expect(summary.counts.pending, 1);
  });

  test('SYNC-011 receipt_conflict marks outbox failed and bumps sequence', () async {
    final sale = SaleDto(
      id: 's1',
      idempotencyKey: 'key-receipt-conflict',
      receiptNumber: 'BRANCH-001-20260822-0001',
      subtotalMinor: 10000,
      discountMinor: 0,
      taxMinor: 0,
      grandTotalMinor: 10000,
      paymentMethod: 'cash',
      cashReceivedMinor: 10000,
      changeMinor: 0,
      cashierId: 'cashier-1',
      customerId: null,
      clientCreatedAt: 1000,
      items: const [],
    );
    
    // Insert local sale first (as checkout would do)
    await db.into(db.salesLocal).insert(
      SalesLocalCompanion.insert(
        clientTransactionId: sale.idempotencyKey,
        businessId: biz,
        branchId: 'BRANCH-001',
        cashierId: sale.cashierId ?? 'UNKNOWN',
        customerId: const Value(null),
        receiptNumber: Value(sale.receiptNumber),
        receiptSequence: const Value(1),
        receiptDate: const Value('20260822'),
        status: 'PENDING_SYNC',
        subtotalMinor: sale.subtotalMinor,
        discountMinor: Value(sale.discountMinor),
        taxMinor: Value(sale.taxMinor),
        totalMinor: sale.grandTotalMinor,
        currencyCode: 'IDR',
        currencyMinorUnits: 0,
        deviceId: 'DEVICE-001',
        createdAt: sale.clientCreatedAt,
        updatedAt: sale.clientCreatedAt,
      ),
    );
    
    await outbox.enqueueSale(sale);
    api.onPushSales = (sales) => [
      SalePushResultItem('key-receipt-conflict', 'receipt_conflict', receiptNumber: 'BRANCH-001-20260822-0001'),
    ];

    final summary = await engine.syncNow();
    expect(summary.reachable, isTrue);
    expect(summary.pushed, 1);

    final counts = await outbox.counts();
    expect(counts.failed, 1);
    expect(counts.pending, 0);

    final localSale = await db.select(db.salesLocal).getSingleOrNull();
    expect(localSale, isNotNull);
    expect(localSale!.status, 'RECEIPT_CONFLICT');

    final seqRow = await db.select(db.receiptSequencesLocal).getSingleOrNull();
    expect(seqRow, isNotNull);
    expect(seqRow!.lastSequence, 1);
  });

  test('SYNC-012 same idempotency key replay still works after receipt conflict on different key', () async {
    final sale1 = SaleDto(
      id: 's1',
      idempotencyKey: 'key-ok',
      receiptNumber: 'BRANCH-001-20260822-0001',
      subtotalMinor: 10000,
      discountMinor: 0,
      taxMinor: 0,
      grandTotalMinor: 10000,
      paymentMethod: 'cash',
      cashReceivedMinor: 10000,
      changeMinor: 0,
      cashierId: 'cashier-1',
      customerId: null,
      clientCreatedAt: 1000,
      items: const [],
    );
    final sale2 = SaleDto(
      id: 's2',
      idempotencyKey: 'key-conflict',
      receiptNumber: 'BRANCH-001-20260822-0001',
      subtotalMinor: 10000,
      discountMinor: 0,
      taxMinor: 0,
      grandTotalMinor: 10000,
      paymentMethod: 'cash',
      cashReceivedMinor: 10000,
      changeMinor: 0,
      cashierId: 'cashier-1',
      customerId: null,
      clientCreatedAt: 1000,
      items: const [],
    );
    await outbox.enqueueSale(sale1);
    await outbox.enqueueSale(sale2);
    api.onPushSales = (sales) => [
      SalePushResultItem('key-ok', 'created', saleId: 's1'),
      SalePushResultItem('key-conflict', 'receipt_conflict', receiptNumber: 'BRANCH-001-20260822-0001'),
    ];

    final summary = await engine.syncNow();
    expect(summary.pushed, 2);

    final counts = await outbox.counts();
    expect(counts.failed, 1);
    expect(counts.pending, 0);

    // Replay sale1 again
    await outbox.enqueueSale(sale1);
    api.onPushSales = (sales) => [
      SalePushResultItem('key-ok', 'duplicate', saleId: 's1'),
    ];
    final summary2 = await engine.syncNow();
    expect(summary2.pushed, 1);
    expect(counts.failed, 1);
  });
}
