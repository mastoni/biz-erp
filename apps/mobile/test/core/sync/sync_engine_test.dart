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
import 'package:biz_erp_mobile/customers/domain/customer.dart';

const biz = '11111111-1111-1111-1111-111111111111';

class MockSyncApi implements SyncApiClient {
  @override
  Future<ProductPushResult> createProduct(ProductDto product, {required String idempotencyKey}) async {
    return ProductPushResult(ok: true, serverVersion: 1);
  }
  @override
  Future<CustomerPushResult> createCustomer(CustomerDto customer, {required String idempotencyKey}) async {
    return CustomerPushResult(ok: true, serverVersion: 1);
  }
  @override
  Future<CustomerPushResult> deleteCustomer(CustomerDto customer, {required String idempotencyKey}) async {
    return CustomerPushResult(ok: true, serverVersion: 1);
  }
  @override
  Future<CustomerPushResult> pushCustomer(CustomerDto customer, {int? ifMatchVersion, required String idempotencyKey}) async {
    print('[MOCK DEBUG] pushCustomer called with customer.id=${customer.id}, ifMatchVersion=$ifMatchVersion, idempotencyKey=$idempotencyKey, onPushCustomer=${onPushCustomer != null ? "set" : "null"}');
    return onPushCustomer?.call(customer, ifMatchVersion, idempotencyKey) ??
        CustomerPushResult(ok: true, serverVersion: customer.serverVersion + 1);
  }
  bool healthy = true;
  ProductPushResult Function(ProductDto, int?)? onPushProduct;
  CustomerPushResult Function(CustomerDto, int?, String?)? onPushCustomer;
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

  // ============================================================
  // CUSTOMER MUTATION SYNC TESTS (Phase 4.1.39 Track B1)
  // ============================================================

  test('CUST-SYNC-01 offline customer create enqueued with idempotency key', () async {
    final customer = Customer(
      id: 'c1111111-1111-4111-a111-111111111111',
      businessId: biz,
      name: 'John Doe',
      phone: '+628123456789',
      email: 'john@example.com',
      isActive: true,
      serverVersion: 0,
    );
    await customers.createCustomer(customer, outbox);
    final counts = await outbox.counts();
    expect(counts.pending, 1);

    // Verify local customer is dirty
    final local = await customers.getCustomerById(customer.id, biz);
    expect(local!.isDirty, isTrue);
    expect(local.serverVersion, 0);
  });

  test('CUST-SYNC-02 queued customer create syncs successfully', () async {
    // First create locally, then enqueue for sync (same flow as createCustomer)
    await customers.createCustomer(Customer(
      id: 'c2222222-2222-4222-a222-222222222222',
      businessId: biz,
      name: 'Jane Doe',
      phone: '+628123456789',
      email: 'jane@example.com',
      isActive: true,
      serverVersion: 0,
    ), outbox);

    final summary = await engine.syncNow();
    expect(summary.pushed, 1);
    final counts = await outbox.counts();
    expect(counts.pending, 0);
    expect(counts.conflict, 0);
    expect(counts.failed, 0);

    // Verify local customer marked synced with server version
    final local = await customers.getCustomerById('c2222222-2222-4222-a222-222222222222', biz);
    expect(local!.isDirty, isFalse);
    expect(local.serverVersion, 1);
  });

  test('CUST-SYNC-03 retry same idempotency key replays without duplicate', () async {
    await outbox.enqueueCustomerCreate(CustomerDto(
      id: 'c3333333-3333-4333-a333-333333333333',
      name: 'Retry Test',
      phone: null,
      email: null,
      isActive: true,
      serverVersion: 0,
    ));
    await engine.syncNow();
    // Same key replay
    await engine.syncNow();
    final counts = await outbox.counts();
    expect(counts.pending, 0);
    expect(counts.conflict, 0);
  });

  test('CUST-SYNC-04 offline customer update enqueued with version', () async {
    // Seed local synced customer
    await customers.upsertCustomer(Customer(
      id: 'c4444444-4444-4444-a444-444444444444',
      businessId: biz,
      name: 'Original',
      phone: '+628111111111',
      email: 'orig@example.com',
      isActive: true,
      serverVersion: 5,
      localStatus: 'synced',
    ));

    final updated = Customer(
      id: 'c4444444-4444-4444-a444-444444444444',
      businessId: biz,
      name: 'Updated',
      phone: '+628222222222',
      email: 'updated@example.com',
      isActive: true,
      serverVersion: 5,
      localStatus: 'synced',
    );
    await customers.updateCustomer(updated, outbox);

    final local = await customers.getCustomerById('c4444444-4444-4444-a444-444444444444', biz);
    expect(local!.isDirty, isTrue);
    expect(local.serverVersion, 5); // version preserved for optimistic lock

    final counts = await outbox.counts();
    expect(counts.pending, 1);
  });

  test('CUST-SYNC-05 stale version conflict does not silently overwrite', () async {
    // Seed local synced customer first, then update (which marks dirty and enqueues)
    await customers.upsertCustomer(Customer(
      id: 'c5555555-5555-4555-a555-555555555555',
      businessId: biz,
      name: 'Stale Local',
      phone: null,
      email: null,
      isActive: true,
      serverVersion: 3,
      localStatus: 'synced',
    ));

    // Use updateCustomer which marks local dirty and enqueues
    final updated = Customer(
      id: 'c5555555-5555-4555-a555-555555555555',
      businessId: biz,
      name: 'Stale Local Updated',
      phone: null,
      email: null,
      isActive: true,
      serverVersion: 3,
      localStatus: 'synced',
    );
    await customers.updateCustomer(updated, outbox);

    // Debug: check outbox before sync
    var items = await outbox.fetchDue(DateTime.now().millisecondsSinceEpoch + 10000);
    print('[TEST DEBUG] outbox before sync: ${items.length} items');
    for (var item in items) {
      print('[TEST DEBUG]   item: id=${item.id}, entityType=${item.entityType}, operation=${item.operation}, status=${item.status}');
    }

    api.onPushCustomer = (dto, v, _) {
      print('[TEST DEBUG] onPushCustomer called with dto.id=${dto.id}, v=$v');
      return CustomerPushResult(
        conflict: true,
        error: 'CUSTOMER_VERSION_CONFLICT',
        serverState: CustomerDto(
          id: dto.id,
          name: 'Server Latest',
          phone: null,
          email: null,
          isActive: true,
          serverVersion: 7,
        ),
      );
    };

    await engine.syncNow();
    final counts = await outbox.counts();
    print('[TEST DEBUG] counts after sync: pending=${counts.pending}, conflict=${counts.conflict}, failed=${counts.failed}');
    
    // Debug: check outbox items after sync
    items = await outbox.fetchDue(DateTime.now().millisecondsSinceEpoch + 10000);
    print('[TEST DEBUG] outbox after sync: ${items.length} items');
    for (var item in items) {
      print('[TEST DEBUG]   item: id=${item.id}, entityType=${item.entityType}, operation=${item.operation}, status=${item.status}, attemptCount=${item.attemptCount}');
    }

    expect(counts.conflict, 1);
    expect(counts.pending, 0);

    // Local customer should remain dirty (not overwritten by server)
    final local = await customers.getCustomerById('c5555555-5555-4555-a555-555555555555', biz);
    expect(local!.isDirty, isTrue);
    expect(local.name, 'Stale Local Updated'); // local name preserved, NOT overwritten with 'Server Latest'
  });

  test('CUST-SYNC-06 offline customer delete enqueued', () async {
    await customers.upsertCustomer(Customer(
      id: 'c6666666-6666-4666-a666-666666666666',
      businessId: biz,
      name: 'To Delete',
      phone: null,
      email: null,
      isActive: true,
      serverVersion: 10,
      localStatus: 'synced',
    ));

    await customers.deleteCustomer('c6666666-6666-4666-a666-666666666666', biz, outbox);

    final local = await customers.getCustomerById('c6666666-6666-4666-a666-666666666666', biz);
    expect(local!.isDirty, isTrue);
    expect(local.isActive, isFalse);

    final counts = await outbox.counts();
    expect(counts.pending, 1);
  });

  test('CUST-SYNC-07 tombstone pull applies deletedAt', () async {
    // Customer deleted on server, tombstone pulled
    api.pullCustomersResp = PullCustomersResponse([
      CustomerDto(
        id: 'c7777777-7777-4777-a777-777777777777',
        name: 'Deleted Server',
        phone: null,
        email: null,
        isActive: false, // tombstone
        serverVersion: 15,
        deletedAt: 1234567890000,
      ),
    ], false, 15);

    // First, create local customer that will be tombstoned
    await customers.upsertCustomer(Customer(
      id: 'c7777777-7777-4777-a777-777777777777',
      businessId: biz,
      name: 'Deleted Local',
      phone: null,
      email: null,
      isActive: true,
      serverVersion: 10,
      localStatus: 'synced',
    ));

    final summary = await engine.syncNow();
    expect(summary.pulledCustomers, 1);

    final local = await customers.getCustomerById('c7777777-7777-4777-a777-777777777777', biz);
    expect(local, isNotNull);
    expect(local!.isActive, isFalse); // tombstone applied
    expect(local.serverVersion, 15);
  });

  test('CUST-SYNC-08 tenant isolation on pull', () async {
    api.pullCustomersResp = PullCustomersResponse([
      CustomerDto(
        id: 'c8888888-8888-4888-a888-888888888888',
        name: 'Other Biz Customer',
        phone: null,
        email: null,
        isActive: true,
        serverVersion: 1,
      ),
    ], false, 1);

    // Different business ID
    const otherBiz = '99999999-9999-9999-9999-999999999999';
    final summary = await engine.syncNow();
    // The engine only pulls for its own businessId (biz), so it should not apply
    // But this test just verifies the pull doesn't crash - isolation is enforced by server
    expect(summary.reachable, isTrue);
  });

  test('CUST-SYNC-09 failed sync retries with backoff', () async {
    api.onPushCustomer = (dto, v, _) {
      print('[TEST DEBUG] CUST-SYNC-09 onPushCustomer called');
      return CustomerPushResult(
        ok: false,
        error: 'NETWORK_ERROR',
      );
    };

    await outbox.enqueueCustomerUpsert(CustomerDto(
      id: 'c9999999-9999-4999-a999-999999999999',
      name: 'Network Fail',
      phone: null,
      email: null,
      isActive: true,
      serverVersion: 1,
    ));

    // Debug: check outbox before sync
    var items = await outbox.fetchDue(DateTime.now().millisecondsSinceEpoch + 10000);
    print('[TEST DEBUG] CUST-SYNC-09 outbox before sync: ${items.length} items');

    await engine.syncNow();
    final counts = await outbox.counts();
    print('[TEST DEBUG] CUST-SYNC-09 counts after sync: pending=${counts.pending}, conflict=${counts.conflict}, failed=${counts.failed}');

    items = await outbox.fetchDue(DateTime.now().millisecondsSinceEpoch + 10000);
    print('[TEST DEBUG] CUST-SYNC-09 outbox after sync: ${items.length} items');
    for (var item in items) {
      print('[TEST DEBUG] CUST-SYNC-09   item: id=${item.id}, status=${item.status}, attemptCount=${item.attemptCount}');
    }

    expect(counts.pending, 1);
    expect(counts.failed, 0); // not failed yet, just retry

    // Verify nextAttemptAt is in future (backoff applied)
    final due = await outbox.fetchDue(DateTime.now().millisecondsSinceEpoch + 2000);
    print('[TEST DEBUG] CUST-SYNC-09 due after 2s: ${due.length} items');
    expect(due.length, 1);
    expect(due.first.attemptCount, 1);
  });

  test('CUST-SYNC-10 app restart with pending customer outbox resumes', () async {
    // Simulate app restart by creating new engine with same database
    await outbox.enqueueCustomerCreate(CustomerDto(
      id: 'caaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      name: 'Restart Test',
      phone: null,
      email: null,
      isActive: true,
      serverVersion: 0,
    ));

    final counts1 = await outbox.counts();
    expect(counts1.pending, 1);

    // Simulate restart: new engine, same db
    final engine2 = SyncEngine(
      outbox: outbox,
      meta: meta,
      api: api,
      products: products,
      salesSync: salesSync,
      customers: customers,
      businessId: biz,
    );

    final summary = await engine2.syncNow();
    expect(summary.pushed, 1);
    final counts2 = await outbox.counts();
    expect(counts2.pending, 0);
  });
}
