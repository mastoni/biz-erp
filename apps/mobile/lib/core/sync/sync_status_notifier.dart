import 'sync_conflict_models.dart';
import '../../products/data/product_repository.dart';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'network_monitor.dart';
import 'sync_engine.dart';
import 'sync_outbox_repository.dart';
import 'sync_models.dart';

import '../auth/auth_state_notifier.dart';
import '../auth/auth_models.dart';

enum SyncState { offline, syncing, failed, pending, synced }

class SyncStatusNotifier extends ChangeNotifier {
  SyncStatusNotifier({
    required this.networkMonitor,
    required this.syncEngine,
    required this.outbox,
    required this.productRepository,
    required this.businessId,
    required this.authStateNotifier,
  }) {
    _init();
  }

  final NetworkMonitor networkMonitor;
  final SyncEngine syncEngine;
  final SyncOutboxRepository outbox;
  final ProductRepository productRepository;
  final String businessId;
  final AuthStateNotifier authStateNotifier;

  StreamSubscription<bool>? _connectivitySub;

  bool _isOnline = false;
  bool _isSyncing = false;
  SyncCounts _counts = SyncCounts(0, 0, 0);
  List<SyncConflictInfo> _conflicts = [];
  List<SyncConflictInfo> get conflicts => _conflicts;

  void _init() {
    syncEngine.addListener(_onEngineChanged);
    authStateNotifier.addListener(_onAuthChanged);
    _connectivitySub = networkMonitor.onConnectivityChanged.listen((isOnline) {
      _isOnline = isOnline;
      _evaluateState();
    });

    networkMonitor.apiReachable().then((reachable) async {
      _isOnline = reachable;
      await _refreshConflicts();
      _evaluateState();
      if (reachable &&
          authStateNotifier.status == AuthStatus.authenticated &&
          !_isSyncing) {
        syncNow();
      }
    });
    outbox.counts().then((c) async {
      _counts = c;
      await _refreshConflicts();
      _evaluateState();
    });
  }

  void _onEngineChanged() {
    outbox.counts().then((c) async {
      _counts = c;
      await _refreshConflicts();
      _evaluateState();
    });
  }

  void _onAuthChanged() {
    if (authStateNotifier.status == AuthStatus.authenticated) {
      if (_isOnline && !_isSyncing) {
        syncNow();
      }
    }
  }

  Future<void> _refreshConflicts() async {
    final conflictItems = await outbox.getConflicts();
    final infos = <SyncConflictInfo>[];
    for (final item in conflictItems) {
      dynamic localProduct;
      if (item.entityType == 'product' && item.idempotencyKey != null) {
        try {
          localProduct = await productRepository.getProductById(
            item.idempotencyKey!,
            businessId,
          );
        } catch (_) {}
      }
      infos.add(SyncConflictInfo.fromOutboxAndLocal(item, localProduct));
    }
    _conflicts = infos;
  }

  Future<void> discardConflict(String outboxId) async {
    await outbox.discardConflict(outboxId);
    await _refreshConflicts();
    _counts = await outbox.counts();
    _evaluateState();
  }

  void _evaluateState() {
    notifyListeners();
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
    if (authStateNotifier.status != AuthStatus.authenticated) return;
    if (_isSyncing) return;
    _isSyncing = true;
    _evaluateState();

    try {
      await syncEngine.syncNow();
    } finally {
      _isSyncing = false;
      _counts = await outbox.counts();
      await _refreshConflicts();
      _evaluateState();
    }
  }

  @override
  void dispose() {
    syncEngine.removeListener(_onEngineChanged);
    authStateNotifier.removeListener(_onAuthChanged);
    _connectivitySub?.cancel();
    super.dispose();
  }

  Future<void> acceptServerConflict(
    String outboxId,
    ProductDto serverProduct,
  ) async {
    // Step 1: Overwrite local product (atomic-ish: if this fails, outbox remains)
    await productRepository.forceAcceptServerProduct(serverProduct, businessId);

    // Step 2: Remove conflict from outbox
    await outbox.discardConflict(outboxId);

    // Step 3: Refresh state
    await _refreshConflicts();
    _counts = await outbox.counts();
    _evaluateState();
  }
}
