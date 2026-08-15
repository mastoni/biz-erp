import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../database/app_database.dart';
import 'sync_models.dart';

class SyncOutboxRepository {
  SyncOutboxRepository(this._db);
  final AppDatabase _db;
  final _uuid = const Uuid();

  Future<String> enqueueProductUpsert(ProductDto product) async {
    final id = _uuid.v4();
    await _db
        .into(_db.syncOutbox)
        .insert(
          SyncOutboxCompanion.insert(
            id: id,
            entityType: 'product',
            operation: 'upsert',
            payloadJson: jsonEncode(product.toJson()),
            idempotencyKey: Value(product.id), // <-- TAMBAHKAN BARIS INI
            nextAttemptAt: 0,
            createdAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
    return id;
  }

  Future<String> enqueueSale(SaleDto sale) async {
    final id = _uuid.v4();
    await _db
        .into(_db.syncOutbox)
        .insert(
          SyncOutboxCompanion.insert(
            id: id,
            entityType: 'sale',
            operation: 'create',
            payloadJson: jsonEncode(sale.toJson()),
            idempotencyKey: Value(sale.idempotencyKey),
            nextAttemptAt: 0,
            createdAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
    return id;
  }

  Future<List<SyncOutboxItem>> fetchDue(
    int now, {
    int limit = kBatchSize,
  }) async {
    final rows =
        await (_db.select(_db.syncOutbox)
              ..where(
                (t) =>
                    t.status.equals('pending') &
                    t.nextAttemptAt.isSmallerOrEqualValue(now),
              )
              ..orderBy([(t) => OrderingTerm.asc(t.createdAt)])
              ..limit(limit))
            .get();
    return rows
        .map(
          (r) => SyncOutboxItem(
            id: r.id,
            entityType: r.entityType,
            operation: r.operation,
            payloadJson: r.payloadJson,
            idempotencyKey: r.idempotencyKey,
            attemptCount: r.attemptCount,
            nextAttemptAt: r.nextAttemptAt,
            lastError: r.lastError,
            status: r.status,
            createdAt: r.createdAt,
          ),
        )
        .toList();
  }

  Future<void> markSynced(String id) async {
    await (_db.update(_db.syncOutbox)..where((t) => t.id.equals(id))).write(
      const SyncOutboxCompanion(status: Value('synced')),
    );
  }

  Future<void> markRetry(String id, int now, String error) async {
    final row = await (_db.select(
      _db.syncOutbox,
    )..where((t) => t.id.equals(id))).getSingle();
    final attempts = row.attemptCount + 1;
    if (attempts >= kMaxSyncAttempts) {
      await (_db.update(_db.syncOutbox)..where((t) => t.id.equals(id))).write(
        SyncOutboxCompanion(
          status: const Value('failed'),
          attemptCount: Value(attempts),
          lastError: Value(error),
        ),
      );
    } else {
      await (_db.update(_db.syncOutbox)..where((t) => t.id.equals(id))).write(
        SyncOutboxCompanion(
          attemptCount: Value(attempts),
          nextAttemptAt: Value(now + backoffMillis(attempts)),
          lastError: Value(error),
        ),
      );
    }
  }

  Future<void> markConflict(
    String id,
    String serverStateJson,
    String error,
  ) async {
    await (_db.update(_db.syncOutbox)..where((t) => t.id.equals(id))).write(
      SyncOutboxCompanion(
        status: const Value('conflict'),
        lastError: Value(error),
        payloadJson: Value(serverStateJson),
      ),
    );
  }

  Future<SyncCounts> counts() async {
    final rows = await _db.select(_db.syncOutbox).get();
    return SyncCounts(
      rows.where((r) => r.status == 'pending').length,
      rows.where((r) => r.status == 'conflict').length,
      rows.where((r) => r.status == 'failed').length,
    );
  }

  Future<List<SyncOutboxItem>> getConflicts() async {
    final rows =
        await (_db.select(_db.syncOutbox)
              ..where((t) => t.status.equals('conflict'))
              ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
            .get();
    return rows
        .map(
          (r) => SyncOutboxItem(
            id: r.id,
            entityType: r.entityType,
            operation: r.operation,
            payloadJson: r.payloadJson,
            idempotencyKey: r.idempotencyKey,
            attemptCount: r.attemptCount,
            nextAttemptAt: r.nextAttemptAt,
            lastError: r.lastError,
            status: r.status,
            createdAt: r.createdAt,
          ),
        )
        .toList();
  }

  Future<void> discardConflict(String outboxId) async {
    final row = await (_db.select(
      _db.syncOutbox,
    )..where((t) => t.id.equals(outboxId))).getSingleOrNull();
    if (row != null && row.status == 'conflict') {
      await (_db.delete(
        _db.syncOutbox,
      )..where((t) => t.id.equals(outboxId))).go();
    }
  }

  Future<String> enqueueProductCreate(ProductDto product) async {
    final id = _uuid.v4();
    await _db.into(_db.syncOutbox).insert(
      SyncOutboxCompanion.insert(
        id: id, entityType: 'product', operation: 'create',
        payloadJson: jsonEncode(product.toJson()), idempotencyKey: Value(product.id),
        nextAttemptAt: 0, createdAt: DateTime.now().millisecondsSinceEpoch,
      ),
    );
    return id;
  }

  Future<void> markFailed(String id, String error) async {
    await (_db.update(_db.syncOutbox)..where((t) => t.id.equals(id))).write(
      SyncOutboxCompanion(status: const Value('failed'), lastError: Value(error)),
    );
  }
}
