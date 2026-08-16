import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';

import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_config.dart';
import 'package:biz_erp_mobile/core/sync/http_sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_engine.dart';
import 'package:biz_erp_mobile/core/sync/sync_meta_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/sales/data/sales_sync_repository.dart';
import 'package:biz_erp_mobile/core/auth/auth_secure_storage.dart';
import 'package:biz_erp_mobile/core/auth/auth_api_client.dart';
import 'package:biz_erp_mobile/core/auth/auth_repository.dart';
import 'package:biz_erp_mobile/core/auth/auth_state_notifier.dart';
import 'package:biz_erp_mobile/core/auth/auth_models.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const uuid = Uuid();

  testWidgets('E2E-003C: Full Sync Pull Validation', (tester) async {
    final db = AppDatabase.memory();
    final productRepo = ProductRepository(db);
    final syncMetaRepo = SyncMetaRepository(db);
    final syncOutboxRepo = SyncOutboxRepository(db);
    final salesSyncRepo = SalesSyncRepository(db);

    final baseUrl = 'http://10.0.2.2:8080';
    final businessId = '11111111-1111-1111-1111-111111111111';
    final productId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

    print('E2E BASE URL IS: $baseUrl');

    // 0. Authenticate E2E User
    final authStorage = AuthSecureStorage();
    final authApiClient = AuthApiClient(baseUrl: baseUrl);
    final authRepository = AuthRepository(storage: authStorage, apiClient: authApiClient);
    final authStateNotifier = AuthStateNotifier(repository: authRepository);
    await authStateNotifier.init();

    await authStateNotifier.login('e2e@test.local', 'E2eTestPassword123!', businessId);
    expect(authStateNotifier.status, AuthStatus.authenticated);
    expect(authStateNotifier.session, isNotNull);
    final accessToken = authStateNotifier.session!.accessToken;

    final apiClient = HttpSyncApiClient(
      baseUrl: baseUrl,
      businessId: businessId,
      tokenProvider: () => authStateNotifier.session?.accessToken,
      onRefresh: authStateNotifier.refresh,
    );

    // PRECONDITION: Push a sale to backend so we have something to pull
    final saleIdempotencyKey = uuid.v4();
    final saleId = uuid.v4();
    final pushPayload = {
      'business_id': businessId,
      'items': [
        {
          'idempotency_key': saleIdempotencyKey,
          'request_hash': 'test-hash-123',
          'sale': {
            'id': saleId,
            'receipt_number': 'REC-TEST-001',
            'total_minor': 15000,
            'payment_method': 'CASH',
            'paid_minor': 20000,
            'change_minor': 5000,
            'client_created_at': DateTime.now().toUtc().toIso8601String(),
          },
          'sale_items': [
            {
              'product_id': productId,
              'product_name': 'E2E Deterministic Product',
              'quantity': 1,
              'unit_price_minor': 10000,
              'subtotal_minor': 10000,
            }
          ]
        }
      ]
    };

    print('Pushing test sale to backend...');
    final pushResponse = await http.post(
      Uri.parse('${baseUrl}/v1/sync/sales/batch'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken'
      },
      body: jsonEncode(pushPayload),
    );
    print('Push Sale Status: ${pushResponse.statusCode}');
    expect(pushResponse.statusCode, 200);

    final syncEngine = SyncEngine(
      outbox: syncOutboxRepo,
      meta: syncMetaRepo,
      api: apiClient,
      products: productRepo,
      salesSync: salesSyncRepo,
      businessId: businessId,
    );

    // TEST 1, 2, 3: First Sync
    print('--- FIRST SYNC ---');
    final summary1 = await syncEngine.syncNow();
    print('Sync 1: reachable=${summary1.reachable}, pulledP=${summary1.pulledProducts}, pulledS=${summary1.pulledSales}');
    expect(summary1.reachable, isTrue);
    expect(summary1.pulledProducts, greaterThanOrEqualTo(1));
    expect(summary1.pulledSales, 1);

    // Verify Product
    final pulledProduct = await productRepo.getProductById(productId, businessId);
    expect(pulledProduct, isNotNull);
    expect(pulledProduct!.name, 'E2E Deterministic Product');
    expect(pulledProduct.serverVersion, 1);

    // Verify Sale & Items
    final saleQuery = await db.select(db.salesLocal).get();
    expect(saleQuery.length, 1);
    final localSale = saleQuery.first;
    expect(localSale.clientTransactionId, saleIdempotencyKey); // IDEMPOTENCY KEY MAPPING
    expect(localSale.totalMinor, 15000);
    expect(localSale.status, 'SYNCED');

    final itemQuery = await db.select(db.saleItemsLocal).get();
    expect(itemQuery.length, 1);
    expect(itemQuery.first.clientTransactionId, saleIdempotencyKey);
    expect(itemQuery.first.productId, productId);

    // TEST 5 & 7: Second Sync (Cursor Advance & Incremental Pull)
    print('--- SECOND SYNC ---');
    final cursorBefore = await syncMetaRepo.getInt('sales_pull_cursor');
    print('Cursor before sync 2: $cursorBefore');
    expect(cursorBefore, greaterThan(0));

    final summary2 = await syncEngine.syncNow();
    print('Sync 2: reachable=${summary2.reachable}, pulledP=${summary2.pulledProducts}, pulledS=${summary2.pulledSales}');

    expect(summary2.pulledProducts, 0); // No new products
    expect(summary2.pulledSales, 0); // No new sales

    final saleQuery2 = await db.select(db.salesLocal).get();
    expect(saleQuery2.length, 1); // Duplicate protection

    // TEST 6: Tenant Isolation
    print('--- TENANT ISOLATION ---');
    final otherBusinessId = '22222222-2222-4222-8222-222222222222';

    try {
      // Mismatch: header=businessId, query=otherBusinessId
      final res = await http.get(
        Uri.parse('${baseUrl}/v1/sync/products?business_id=$otherBusinessId&after_version=0&limit=100'),
        headers: {'Authorization': 'Bearer $accessToken'}
      );
      expect(res.statusCode, 403);
      print('Tenant Isolation PASS: ${res.statusCode}');
    } catch (e) {
      print('Tenant Isolation Error: $e');
      fail('Tenant Isolation failed');
    }

    apiClient.close();
    await db.close();
    print('E2E-003C PASSED!');
  });
}
