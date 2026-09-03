// MOB-INV-009: SyncEngine inventory pull integration

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_engine.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_meta_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/inventory/data/stock_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/sales/data/sales_sync_repository.dart';
import 'package:biz_erp_mobile/customers/data/customer_repository.dart';
import 'package:biz_erp_mobile/suppliers/data/supplier_repository.dart';

const biz = '11111111-1111-4111-a111-111111111111';
const branch = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

class _InventoryMockApi implements SyncApiClient {
  final PullStocksResponse stocksResp;
  final StockMovementPaginatedResponse movementsResp;

  _InventoryMockApi({required this.stocksResp, required this.movementsResp});

  @override
  Future<PullBranchesResponse> pullBranches({required String businessId}) async =>
      const PullBranchesResponse([]);

  @override
  Future<PullProductsResponse> pullProducts({required String businessId, required int sinceVersion, int limit = 500}) async =>
      const PullProductsResponse([], false, 0);

  @override
  Future<PullCustomersResponse> pullCustomers({required String businessId, required int sinceVersion, int limit = 500}) async =>
      const PullCustomersResponse([], false, 0);

  @override
  Future<PullSuppliersResponse> pullSuppliers({required String businessId, required int sinceVersion, int limit = 500}) async =>
      const PullSuppliersResponse([], false, 0);

  @override
  Future<PullSalesResponse> pullSales({required String businessId, required int sinceMs, int limit = 100}) async =>
      const PullSalesResponse([], false);

  @override
  Future<PullStocksResponse> pullStocks({required String businessId, required String branchId}) async => stocksResp;

  @override
  Future<StockMovementPaginatedResponse> pullStockMovements({
    required String businessId,
    required String branchId,
    String? productId,
    int? sinceMs,
    int limit = 50,
    int offset = 0,
  }) async => movementsResp;

  @override
  Future<bool> health() async => true;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late AppDatabase db;
  late StockRepository stockRepo;
  late SyncEngine engine;
  late _InventoryMockApi api;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    stockRepo = StockRepository(db);
    api = _InventoryMockApi(
      stocksResp: PullStocksResponse([
        StockWithProductDto(
          id: 'stock-1',
          businessId: biz,
          branchId: branch,
          productId: 'prod-1',
          productName: 'Test Product',
          priceMinor: 10000,
          costMinor: 7000,
          quantity: 50,
          serverVersion: 1,
        ),
      ], false),
      movementsResp: StockMovementPaginatedResponse(
        items: [
          StockMovementDto(
            id: 'mov-1',
            businessId: biz,
            branchId: branch,
            productId: 'prod-1',
            quantity: 50,
            movementType: 'STOCK_IN',
            actor: 'owner-1',
          ),
        ],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      ),
    );
    engine = SyncEngine(
      outbox: SyncOutboxRepository(db),
      meta: SyncMetaRepository(db),
      api: api,
      products: ProductRepository(db),
      salesSync: SalesSyncRepository(db),
      customers: CustomerRepository(db),
      suppliers: SupplierRepository(db),
      stocks: stockRepo,
      branchId: branch,
      businessId: biz,
    );
  });

  tearDown(() async => await db.close());

  test('MOB-INV-009: SyncEngine._pull fetches stocks and movements into local cache', () async {
    final summary = await engine.syncNow();
    expect(summary.reachable, isTrue);
    expect(summary.pulledStocks, 1);

    final stocks = await stockRepo.listStocks(biz, branch);
    expect(stocks.length, 1);
    expect(stocks.first.productId, 'prod-1');
    expect(stocks.first.quantity, 50);

    final movements = await stockRepo.listMovements(biz, branch, productId: 'prod-1');
    expect(movements.length, 1);
    expect(movements.first.movementType, 'STOCK_IN');
  });

  test('MOB-INV-010: SyncEngine._pull skips inventory when branch not set (no crash)', () async {
    engine = SyncEngine(
      outbox: SyncOutboxRepository(db),
      meta: SyncMetaRepository(db),
      api: api,
      products: ProductRepository(db),
      salesSync: SalesSyncRepository(db),
      customers: CustomerRepository(db),
      suppliers: SupplierRepository(db),
      stocks: stockRepo,
      branchId: null,
      businessId: biz,
    );

    final summary = await engine.syncNow();
    expect(summary.reachable, isTrue);
    expect(summary.pulledStocks, 0);

    final stocks = await stockRepo.listStocks(biz, branch);
    expect(stocks, isEmpty);
  });
}
