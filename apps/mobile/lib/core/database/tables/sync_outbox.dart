import 'package:drift/drift.dart';

class SyncOutbox extends Table {
  TextColumn get id => text()();
  TextColumn get entityType => text()(); // 'product' | 'sale'
  TextColumn get operation => text()(); // 'upsert' | 'create'
  TextColumn get payloadJson => text()();
  TextColumn get idempotencyKey => text().nullable()();
  IntColumn get attemptCount => integer().withDefault(const Constant(0))();
  IntColumn get nextAttemptAt => integer()();
  TextColumn get lastError => text().nullable()();
  TextColumn get status => text().withDefault(
    const Constant('pending'),
  )(); // pending|synced|conflict|failed
  IntColumn get createdAt => integer()();

  @override
  Set<Column> get primaryKey => {id};
}
