// ignore_for_file: avoid_print
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_config.dart';
import 'package:biz_erp_mobile/core/sync/http_sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_engine.dart';
import 'package:biz_erp_mobile/core/sync/sync_meta_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/sales/data/sales_sync_repository.dart';
import 'package:biz_erp_mobile/customers/data/customer_repository.dart';
import 'package:biz_erp_mobile/suppliers/data/supplier_repository.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('E2E-003: Android pulls product from PostgreSQL via API', (tester) async {
    // 1. Setup isolated in-memory database
    final db = AppDatabase.memory();

    // 2. Setup repositories
    final productRepo = ProductRepository(db);
    final syncMetaRepo = SyncMetaRepository(db);
    final syncOutboxRepo = SyncOutboxRepository(db);
    final salesSyncRepo = SalesSyncRepository(db);

    // 3. Setup API client pointing to Android emulator host
    final baseUrl = SyncConfig.baseUrl;
    print('SyncConfig.baseUrl: $baseUrl');
    final apiClient = HttpSyncApiClient(baseUrl: baseUrl);

    final businessId = '11111111-1111-4111-8111-111111111111';
    final productId = '1f3cbd39-de66-492a-92a0-5836dffb1c2f';

    // 4. Verify no products locally before sync
    final initialProducts = await productRepo.listAllProducts(businessId);
    print('Initial local products count: ${initialProducts.length}');
    expect(initialProducts.isEmpty, isTrue, reason: 'Local DB harus kosong sebelum sync');

    // 5. Run SyncEngine
    final syncEngine = SyncEngine(
      outbox: syncOutboxRepo,
      meta: syncMetaRepo,
      api: apiClient,
      products: productRepo,
      salesSync: salesSyncRepo,
      customers: CustomerRepository(db),
      suppliers: SupplierRepository(db),
      businessId: businessId,
    );

    print('Running syncNow()...');
    final summary = await syncEngine.syncNow();
    print('SyncSummary: reachable=${summary.reachable}, pulledProducts=${summary.pulledProducts}');

    expect(summary.reachable, isTrue, reason: 'API harus reachable');
    expect(summary.pulledProducts, greaterThan(0), reason: 'Harus ada produk yang di-pull');

    // 6. Verify product is now in local DB
    final pulledProduct = await productRepo.getProductById(productId, businessId);
    expect(pulledProduct, isNotNull, reason: 'Product harus ditemukan di local DB setelah sync');

    print('Pulled Product: id=${pulledProduct!.id}, name=${pulledProduct.name}, priceMinor=${pulledProduct.priceMinor}, serverVersion=${pulledProduct.serverVersion}');

    expect(pulledProduct.id, productId);
    expect(pulledProduct.name, 'Product 1f3cbd39');
    expect(pulledProduct.priceMinor, 10000);
    expect(pulledProduct.serverVersion, 1);
    expect(pulledProduct.isActive, isTrue);
    expect(pulledProduct.businessId, businessId);

    // Cleanup
    apiClient.close();
    await db.close();

    print('E2E-003 Product Pull PASSED!');
  });
}
