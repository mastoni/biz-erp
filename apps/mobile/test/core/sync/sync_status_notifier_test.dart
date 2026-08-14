import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/foundation.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';
import 'package:biz_erp_mobile/core/sync/network_monitor.dart';
import 'package:biz_erp_mobile/core/sync/sync_engine.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';

class FakeNetworkMonitor implements NetworkMonitor {
  final StreamController<bool> controller = StreamController<bool>.broadcast();
  bool reachable = true;
  @override
  Stream<bool> get onConnectivityChanged => controller.stream;
  @override
  Future<bool> apiReachable() async => reachable;
}

class FakeSyncOutboxRepository implements SyncOutboxRepository {
  SyncCounts currentCounts = SyncCounts(0, 0, 0);
  @override
  Future<SyncCounts> counts() async => currentCounts;

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

  setUp(() {
    fakeNetwork = FakeNetworkMonitor();
    fakeEngine = FakeSyncEngine();
    fakeOutbox = FakeSyncOutboxRepository();

    fakeNetwork.reachable = true;
    fakeOutbox.currentCounts = SyncCounts(0, 0, 0);

    notifier = SyncStatusNotifier(
      networkMonitor: fakeNetwork,
      syncEngine: fakeEngine,
      outbox: fakeOutbox,
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
  });

  test('Priority: OFFLINE > SYNCING > FAILED > PENDING > SYNCED', () async {
    await Future.delayed(const Duration(milliseconds: 50));

    // 1. PENDING
    fakeOutbox.currentCounts = SyncCounts(5, 0, 0);
    fakeEngine.notifyListeners();
    await Future.delayed(const Duration(milliseconds: 50));
    expect(notifier.currentState, SyncState.pending);
    expect(notifier.pendingCount, 5);

    // 2. FAILED overrides PENDING
    fakeOutbox.currentCounts = SyncCounts(5, 1, 2);
    fakeEngine.notifyListeners();
    await Future.delayed(const Duration(milliseconds: 50));
    expect(notifier.currentState, SyncState.failed);
    expect(notifier.failedCount, 3);

    // 3. OFFLINE overrides FAILED
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
}
