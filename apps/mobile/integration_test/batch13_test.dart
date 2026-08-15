import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_config.dart';
import 'package:biz_erp_mobile/core/sync/http_sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_engine.dart';
import 'package:biz_erp_mobile/core/sync/sync_meta_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/sales/data/sales_sync_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/network_monitor.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Batch 13: Conflict Regression (Dismiss & Accept Server)', (tester) async {
    final db = AppDatabase.memory();
    final productRepo = ProductRepository(db);
    final syncMetaRepo = SyncMetaRepository(db);
    final syncOutboxRepo = SyncOutboxRepository(db);
    final salesSyncRepo = SalesSyncRepository(db);
    final businessId = '11111111-1111-1111-1111-111111111111';
    final apiClient = HttpSyncApiClient(baseUrl: SyncConfig.baseUrl, businessId: businessId);
    final productAId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'; // From seed
    final productBId = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'; // Created manually
    
    final syncEngine = SyncEngine(
      outbox: syncOutboxRepo,
      meta: syncMetaRepo,
      api: apiClient,
      products: productRepo,
      salesSync: salesSyncRepo,
      businessId: businessId,
    );

    final networkMonitor = NetworkMonitor(api: apiClient);
    final syncStatusNotifier = SyncStatusNotifier(
      networkMonitor: networkMonitor,
      syncEngine: syncEngine,
      outbox: syncOutboxRepo,
      productRepository: productRepo,
      businessId: businessId,
    );

    print('Initial Pull Sync...');
    await syncEngine.syncNow();
    
    final pA_initial = await productRepo.getProductById(productAId, businessId);
    final pB_initial = await productRepo.getProductById(productBId, businessId);
    expect(pA_initial, isNotNull);
    expect(pB_initial, isNotNull);
    
    print('Product A: ${pA_initial!.name} v${pA_initial.serverVersion}');
    print('Product B: ${pB_initial!.name} v${pB_initial.serverVersion}');

    // Simulate SERVER modification (Another device pushes)
    final serverClient = HttpSyncApiClient(baseUrl: SyncConfig.baseUrl, businessId: businessId);
    
    final modifiedA = ProductDto(
      id: pA_initial.id,
      name: 'Server A Mod',
      description: pA_initial.description,
      barcode: pA_initial.barcode,
      priceMinor: 50000,
      category: pA_initial.category,
      isActive: pA_initial.isActive,
      serverVersion: pA_initial.serverVersion,
    );
    await serverClient.pushProduct(modifiedA, ifMatchVersion: pA_initial.serverVersion);

    final modifiedB = ProductDto(
      id: pB_initial.id,
      name: 'Server B Mod',
      description: pB_initial.description,
      barcode: pB_initial.barcode,
      priceMinor: 60000,
      category: pB_initial.category,
      isActive: pB_initial.isActive,
      serverVersion: pB_initial.serverVersion,
    );
    await serverClient.pushProduct(modifiedB, ifMatchVersion: pB_initial.serverVersion);
    serverClient.close();

    // Now locally edit them on our device, keeping old server_version (Stale)
    final localA = Product(
      id: pA_initial.id, businessId: businessId, name: 'Local A Mod', description: pA_initial.description, priceMinor: 15000, category: pA_initial.category, isActive: pA_initial.isActive, serverVersion: pA_initial.serverVersion, barcode: pA_initial.barcode, localStatus: 'dirty'
    );
    await productRepo.updateProduct(localA, syncOutboxRepo);

    final localB = Product(
      id: pB_initial.id, businessId: businessId, name: 'Local B Mod', description: pB_initial.description, priceMinor: 25000, category: pB_initial.category, isActive: pB_initial.isActive, serverVersion: pB_initial.serverVersion, barcode: pB_initial.barcode, localStatus: 'dirty'
    );
    await productRepo.updateProduct(localB, syncOutboxRepo);

    // Run Sync -> Should produce conflicts
    print('Syncing local dirty data -> Expecting conflicts');
    final summary = await syncEngine.syncNow();
    print('Sync Summary: ${summary.pushed} pushed, ${summary.pulledProducts} pulled');
    
    await Future.delayed(const Duration(milliseconds: 100));
    
    final conflicts = syncStatusNotifier.conflicts;
    print('Conflicts found: ${conflicts.length}');
    expect(conflicts.length, 2, reason: 'Harus ada 2 konflik');

    final conflictA = conflicts.firstWhere((c) => c.productId == productAId);
    final conflictB = conflicts.firstWhere((c) => c.productId == productBId);
    
    expect(conflictA.serverProduct, isNotNull);
    expect(conflictA.serverProduct!.name, 'Server A Mod');
    
    expect(conflictB.serverProduct, isNotNull);
    expect(conflictB.serverProduct!.name, 'Server B Mod');

    // SCENARIO A: DISMISS
    print('Scenario A: Dismiss Conflict A');
    await syncStatusNotifier.discardConflict(conflictA.outboxId);
    
    // Verify conflict removed
    await Future.delayed(const Duration(milliseconds: 100));
    expect(syncStatusNotifier.conflicts.any((c) => c.productId == productAId), isFalse);
    
    // Verify local data remains dirty and unchanged
    final currentA = await productRepo.getProductById(productAId, businessId);
    expect(currentA!.name, 'Local A Mod');
    expect(currentA.localStatus, 'dirty');
    print('Scenario A PASS');

    // SCENARIO B: ACCEPT SERVER
    print('Scenario B: Accept Server B');
    await syncStatusNotifier.acceptServerConflict(conflictB.outboxId, conflictB.serverProduct!);

    // Verify conflict removed
    await Future.delayed(const Duration(milliseconds: 100));
    expect(syncStatusNotifier.conflicts.any((c) => c.productId == productBId), isFalse);
    
    // Verify local data equals server data and synced
    final currentB = await productRepo.getProductById(productBId, businessId);
    expect(currentB!.name, 'Server B Mod');
    expect(currentB.priceMinor, 60000);
    expect(currentB.localStatus, 'synced');
    expect(currentB.serverVersion, pB_initial.serverVersion + 1);
    print('Scenario B PASS');

    // Verify subsequent sync doesn't push it again
    final due = await syncOutboxRepo.fetchDue(DateTime.now().millisecondsSinceEpoch);
    expect(due.any((i) => i.idempotencyKey == productBId), isFalse);

    final summaryFinal = await syncEngine.syncNow();
    expect(summaryFinal.pushed, 0, reason: 'Tidak ada yg perlu dipush lagi untuk B');
    
    apiClient.close();
    await db.close();
    print('ALL SCENARIOS PASS');
  });
}
