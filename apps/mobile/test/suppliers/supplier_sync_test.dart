// ignore_for_file: avoid_print
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_engine.dart';
import 'package:biz_erp_mobile/core/sync/sync_meta_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/store_settings_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/sales/data/sales_sync_repository.dart';
import 'package:biz_erp_mobile/customers/data/customer_repository.dart';
import 'package:biz_erp_mobile/suppliers/data/supplier_repository.dart';
import 'package:biz_erp_mobile/suppliers/domain/supplier.dart';

const biz = '11111111-1111-4111-a111-111111111111';

class MockSyncApi implements SyncApiClient {
  bool healthy = true;

  PullSuppliersResponse pullSuppliersResp = const PullSuppliersResponse(
    [],
    false,
    0,
  );
  SupplierPushResult Function(SupplierDto, int?, String?)? onPushSupplier;
  SupplierPushResult Function(SupplierDto, String)? onCreateSupplier;
  SupplierPushResult Function(SupplierDto, String)? onDeleteSupplier;

  @override
  Future<bool> health() async => healthy;

  @override
  Future<PullBranchesResponse> pullBranches({required String businessId}) async {
    return const PullBranchesResponse([]);
  }

  @override
  Future<PullProductsResponse> pullProducts({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async => const PullProductsResponse([], false, 0);

  @override
  Future<PullCustomersResponse> pullCustomers({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async => const PullCustomersResponse([], false, 0);

  @override
  Future<PullSuppliersResponse> pullSuppliers({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async => pullSuppliersResp;

  @override
  Future<PullSalesResponse> pullSales({
    required String businessId,
    required int sinceMs,
    int limit = 100,
  }) async => const PullSalesResponse([], false);

  @override
  Future<StoreSettingsDto?> getStoreSettings({
    required String businessId,
    required String branchId,
  }) async => null;

  @override
  Future<ProductPushResult> pushProduct(ProductDto product, {int? ifMatchVersion}) async =>
      const ProductPushResult(ok: true, serverVersion: 1);

  @override
  Future<ProductPushResult> createProduct(ProductDto product, {required String idempotencyKey}) async =>
      const ProductPushResult(ok: true, serverVersion: 1);

  @override
  Future<List<SalePushResultItem>> pushSalesBatch(List<SaleDto> sales) async => [];

  @override
  Future<CustomerPushResult> pushCustomer(CustomerDto customer, {int? ifMatchVersion, required String idempotencyKey}) async =>
      const CustomerPushResult(ok: true, serverVersion: 1);

  @override
  Future<CustomerPushResult> createCustomer(CustomerDto customer, {required String idempotencyKey}) async =>
      const CustomerPushResult(ok: true, serverVersion: 1);

  @override
  Future<CustomerPushResult> deleteCustomer(CustomerDto customer, {required String idempotencyKey}) async =>
      const CustomerPushResult(ok: true, serverVersion: 1);

  @override
  Future<SupplierPushResult> pushSupplier(
    SupplierDto supplier, {
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async =>
      onPushSupplier?.call(supplier, ifMatchVersion, idempotencyKey) ??
      SupplierPushResult(ok: true, serverVersion: supplier.serverVersion + 1);

  @override
  Future<SupplierPushResult> createSupplier(SupplierDto supplier, {required String idempotencyKey}) async {
    if (onCreateSupplier != null) return onCreateSupplier!(supplier, idempotencyKey);
    return const SupplierPushResult(ok: true, serverVersion: 1);
  }

  @override
  Future<SupplierPushResult> deleteSupplier(SupplierDto supplier, {required String idempotencyKey}) async =>
      onDeleteSupplier?.call(supplier, idempotencyKey) ??
      SupplierPushResult(ok: true, serverVersion: supplier.serverVersion + 1);
}

void main() {
  late AppDatabase db;
  late SyncOutboxRepository outbox;
  late SyncMetaRepository meta;
  late ProductRepository products;
  late SalesSyncRepository salesSync;
  late CustomerRepository customers;
  late SupplierRepository suppliers;
  late MockSyncApi api;
  late SyncEngine engine;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    outbox = SyncOutboxRepository(db);
    meta = SyncMetaRepository(db);
    products = ProductRepository(db);
    salesSync = SalesSyncRepository(db);
    customers = CustomerRepository(db);
    suppliers = SupplierRepository(db);
    api = MockSyncApi();
    engine = SyncEngine(
      outbox: outbox,
      meta: meta,
      api: api,
      products: products,
      salesSync: salesSync,
      customers: customers,
      suppliers: suppliers,
      businessId: biz,
    );
  });
  tearDown(() async => await db.close());

  // MOBILE-SUPPLIER-006: incremental sync
  test('MOBILE-SUPPLIER-006: incremental sync pulls only after maxServerVersion', () async {
    // Seed a local supplier with serverVersion 5
    await suppliers.upsertSupplier(Supplier(
      id: 's6',
      businessId: biz,
      name: 'Local Supplier',
      category: '',
      term: 'tunai',
      isActive: true,
      serverVersion: 5,
      localStatus: 'synced',
    ));

    // Server returns new supplier with version 6
    api.pullSuppliersResp = PullSuppliersResponse([
      SupplierDto(
        id: 's6b',
        name: 'Server New Supplier',
        category: 'Sembako',
        term: 'tunai',
        isActive: true,
        serverVersion: 6,
      ),
    ], false, 6);

    final summary = await engine.syncNow();
    expect(summary.pulledSuppliers, 1);

    final local = await suppliers.getSupplierById('s6b', biz);
    expect(local, isNotNull);
    expect(local!.name, 'Server New Supplier');
    expect(local.category, 'Sembako');
  });

  // MOBILE-SUPPLIER-007: outbox create
  test('MOBILE-SUPPLIER-007: createSupplier enqueues outbox with entity_type supplier, operation create', () async {
    final supplier = Supplier(
      id: 's7',
      businessId: biz,
      name: 'New Supplier',
      category: 'Sembako',
      term: 'tunai',
      isActive: true,
      serverVersion: 0,
    );

    await suppliers.createSupplier(supplier, outbox);

    final counts = await outbox.counts();
    expect(counts.pending, 1);

    final due = await outbox.fetchDue(DateTime.now().millisecondsSinceEpoch + 10000);
    expect(due.length, 1);
    expect(due.first.entityType, 'supplier');
    expect(due.first.operation, 'create');

    final local = await suppliers.getSupplierById('s7', biz);
    expect(local!.isDirty, isTrue);
    expect(local.serverVersion, 0);
  });

  // MOBILE-SUPPLIER-008: outbox update
  test('MOBILE-SUPPLIER-008: updateSupplier enqueues outbox with entity_type supplier, operation upsert', () async {
    await suppliers.upsertSupplier(Supplier(
      id: 's8',
      businessId: biz,
      name: 'Original',
      category: '',
      term: 'tunai',
      isActive: true,
      serverVersion: 5,
      localStatus: 'synced',
    ));

    final updated = Supplier(
      id: 's8',
      businessId: biz,
      name: 'Updated Name',
      category: 'Minuman',
      term: 'tempo_30',
      isActive: true,
      serverVersion: 5,
    );
    await suppliers.updateSupplier(updated, outbox);

    final counts = await outbox.counts();
    expect(counts.pending, 1);

    final due = await outbox.fetchDue(DateTime.now().millisecondsSinceEpoch + 10000);
    expect(due.length, 1);
    expect(due.first.entityType, 'supplier');
    expect(due.first.operation, 'upsert');

    final local = await suppliers.getSupplierById('s8', biz);
    expect(local!.isDirty, isTrue);
    expect(local.serverVersion, 5);
    expect(local.name, 'Updated Name');
  });

  // MOBILE-SUPPLIER-014: optimistic conflict
  test('MOBILE-SUPPLIER-014: stale version conflict does not silently overwrite local', () async {
    await suppliers.upsertSupplier(Supplier(
      id: 's14',
      businessId: biz,
      name: 'Original',
      category: '',
      term: 'tunai',
      isActive: true,
      serverVersion: 3,
      localStatus: 'synced',
    ));

    final updated = Supplier(
      id: 's14',
      businessId: biz,
      name: 'Stale Local Updated',
      category: '',
      term: 'tunai',
      isActive: true,
      serverVersion: 3,
    );
    await suppliers.updateSupplier(updated, outbox);

    api.onPushSupplier = (dto, v, _) {
      return SupplierPushResult(
        conflict: true,
        error: 'VERSION_CONFLICT',
        serverState: SupplierDto(
          id: dto.id,
          name: 'Server Latest',
          category: '',
          term: 'tunai',
          isActive: true,
          serverVersion: 7,
        ),
      );
    };

    await engine.syncNow();
    final counts = await outbox.counts();
    expect(counts.conflict, 1);
    expect(counts.pending, 0);

    final local = await suppliers.getSupplierById('s14', biz);
    expect(local!.isDirty, isTrue);
    expect(local.name, 'Stale Local Updated'); // local preserved, NOT overwritten
  });
}
