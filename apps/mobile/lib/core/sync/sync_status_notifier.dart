import 'dart:async';
import 'package:flutter/foundation.dart';
import 'network_monitor.dart';
import 'sync_engine.dart';
import 'sync_outbox_repository.dart';
import 'sync_models.dart';

enum SyncState {
  offline,
  syncing,
  failed,
  pending,
  synced,
}

class SyncStatusNotifier extends ChangeNotifier {
  SyncStatusNotifier({
    required this.networkMonitor,
    required this.syncEngine,
    required this.outbox,
  }) {
    _init();
  }

  final NetworkMonitor networkMonitor;
  final SyncEngine syncEngine;
  final SyncOutboxRepository outbox;

  StreamSubscription<bool>? _connectivitySub;

  bool _isOnline = false;
  bool _isSyncing = false;
  SyncCounts _counts = SyncCounts(0, 0, 0);

  void _init() {
    syncEngine.addListener(_onEngineChanged);
    _connectivitySub = networkMonitor.onConnectivityChanged.listen((isOnline) {
      _isOnline = isOnline;
      _evaluateState();
    });

    networkMonitor.apiReachable().then((reachable) {
      _isOnline = reachable;
      _evaluateState();
    });
    outbox.counts().then((c) {
      _counts = c;
      _evaluateState();
    });
  }

  void _onEngineChanged() {
    outbox.counts().then((c) {
      _counts = c;
      _isSyncing = false;
      _evaluateState();
    });
  }

  SyncState get currentState {
    if (!_isOnline) return SyncState.offline;
    if (_isSyncing) return SyncState.syncing;
    if ((_counts.failed + _counts.conflict) > 0) return SyncState.failed;
    if (_counts.pending > 0) return SyncState.pending;
    return SyncState.synced;
  }

  int get pendingCount => _counts.pending;
  int get failedCount => _counts.failed + _counts.conflict;
  bool get isOnline => _isOnline;

  Future<void> syncNow() async {
    if (_isSyncing) return;
    _isSyncing = true;
    _evaluateState();

    try {
      await syncEngine.syncNow();
    } finally {
      _isSyncing = false;
      _counts = await outbox.counts();
      _evaluateState();
    }
  }

  void _evaluateState() {
    notifyListeners();
  }

  @override
  void dispose() {
    syncEngine.removeListener(_onEngineChanged);
    _connectivitySub?.cancel();
    super.dispose();
  }
}
