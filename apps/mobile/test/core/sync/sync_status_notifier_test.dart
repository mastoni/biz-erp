import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/foundation.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';
import 'package:biz_erp_mobile/core/sync/network_monitor.dart';
import 'package:biz_erp_mobile/core/sync/sync_engine.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';

class FakeNetworkMonitor implements NetworkMonitor {
  final StreamController<bool> controller = StreamController<bool>.broadcast();
  bool reachable = true;
  @override
  Stream<bool> get onConnectivityChanged => controller.stream;
  @override
  Future<bool> apiReachable() async => reachable;
}

class FakeSyncOutboxRepository implements SyncOutboxRepository {
  @override
  Future<String> enqueueProductCreate(ProductDto product) async => '';
  @override
  Future<void> markFailed(String id, String error) async {}
  SyncCounts currentCounts = SyncCounts(0, 0, 0);
  List<SyncOutboxItem> conflicts = [];

  @override
  Future<SyncCounts> counts() async => currentCounts;

  @override
  Future<List<SyncOutboxItem>> getConflicts() async => conflicts;

  @override
  Future<void> discardConflict(String outboxId) async {
    final before = conflicts.length;
    conflicts.removeWhere((c) => c.id == outboxId);
    final after = conflicts.length;
    if (before != after) {
      currentCounts = SyncCounts(currentCounts.pending, currentCounts.conflict - 1, currentCounts.failed);
    }
  }

  @override
  Future<String> enqueueProductUpsert(ProductDto product) async => 'id';
  @override
  Future<String> enqueueSale(SaleDto sale) async => 'id';
  @override
  Future<List<SyncOutboxItem>> fetchDue(int now, {int limit = 100}) async => [];
  @override
  Future<void> markConflict(String id, String serverStateJson, String error) async {}
  @override
  Future<void> markRetry(String id, int now, String error) async {}
  @override
  Future<void> markSynced(String id) async {}
}

class FakeProductRepository implements ProductRepository {
  @override
  Future<Product?> getProductById(String id, String businessId) async => null;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeSyncEngine extends ChangeNotifier implements SyncEngine {
  int syncNowCallCount = 0;
  @override
  Future<SyncSummary> syncNow() async {
    syncNowCallCount++;
    await Future.delayed(const Duration(milliseconds: 10));
    notifyListeners();
    return SyncSummary(reachable: true, pushed: 0, pulledProducts: 0, pulledSales: 0, counts: SyncCounts(0,0,0));
  }
}

void main() {
  late SyncStatusNotifier notifier;
  late FakeNetworkMonitor fakeNetwork;
  late FakeSyncEngine fakeEngine;
  late FakeSyncOutboxRepository fakeOutbox;
  late FakeProductRepository fakeProductRepo;

  setUp(() {
    fakeNetwork = FakeNetworkMonitor();
    fakeEngine = FakeSyncEngine();
    fakeOutbox = FakeSyncOutboxRepository();
    fakeProductRepo = FakeProductRepository();

    fakeNetwork.reachable = true;
    fakeOutbox.currentCounts = SyncCounts(0, 0, 0);
    fakeOutbox.conflicts = [];

    notifier = SyncStatusNotifier(
      networkMonitor: fakeNetwork,
      syncEngine: fakeEngine,
      outbox: fakeOutbox,
      productRepository: fakeProductRepo,
      businessId: 'test-biz',
    );
  });

  tearDown(() {
    fakeNetwork.controller.close();
    notifier.dispose();
  });

  test('Initial state evaluates correctly when online and empty', () async {
    await Future.delayed(const Duration(milliseconds: 50));
    expect(notifier.currentState, SyncState.synced);
    expect(notifier.isOnline, isTrue);
    expect(notifier.conflicts, isEmpty);
  });

  test('Priority: OFFLINE > SYNCING > FAILED > PENDING > SYNCED', () async {
    await Future.delayed(const Duration(milliseconds: 50));

    fakeOutbox.currentCounts = SyncCounts(5, 0, 0);
    fakeEngine.notifyListeners();
    await Future.delayed(const Duration(milliseconds: 50));
    expect(notifier.currentState, SyncState.pending);
    expect(notifier.pendingCount, 5);

    fakeOutbox.currentCounts = SyncCounts(5, 1, 2);
    fakeEngine.notifyListeners();
    await Future.delayed(const Duration(milliseconds: 50));
    expect(notifier.currentState, SyncState.failed);
    expect(notifier.failedCount, 3);

    fakeNetwork.controller.add(false);
    await Future.delayed(const Duration(milliseconds: 50));
    expect(notifier.currentState, SyncState.offline);
    expect(notifier.isOnline, isFalse);
  });

  test('Manual syncNow delegates to SyncEngine and shows SYNCING state', () async {
    await Future.delayed(const Duration(milliseconds: 50));
    expect(notifier.currentState, SyncState.synced);

    final syncFuture = notifier.syncNow();
    await Future.delayed(const Duration(milliseconds: 5));
    expect(notifier.currentState, SyncState.syncing);

    await syncFuture;
    expect(fakeEngine.syncNowCallCount, 1);
    expect(notifier.currentState, SyncState.synced);
  });

  test('Conflicts are exposed and refresh after dismiss', () async {
    await Future.delayed(const Duration(milliseconds: 50));
    expect(notifier.conflicts, isEmpty);

    fakeOutbox.conflicts = [
      SyncOutboxItem(
        id: 'outbox-1',
        entityType: 'product',
        operation: 'upsert',
        payloadJson: '{}',
        idempotencyKey: 'prod-1',
        attemptCount: 1,
        nextAttemptAt: 0,
        lastError: 'VERSION_CONFLICT',
        status: 'conflict',
        createdAt: DateTime.now().millisecondsSinceEpoch,
      )
    ];
    fakeOutbox.currentCounts = SyncCounts(0, 1, 0);
    fakeEngine.notifyListeners();
    await Future.delayed(const Duration(milliseconds: 50));

    expect(notifier.conflicts.length, 1);
    expect(notifier.conflicts.first.outboxId, 'outbox-1');
    expect(notifier.currentState, SyncState.failed);

    await notifier.discardConflict('outbox-1');
    await Future.delayed(const Duration(milliseconds: 50));
    expect(notifier.conflicts, isEmpty);
    expect(notifier.currentState, SyncState.synced);
  });
}
