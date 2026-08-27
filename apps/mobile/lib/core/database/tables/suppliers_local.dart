import 'package:drift/drift.dart';

class SuppliersLocal extends Table {
  TextColumn get id => text()();
  TextColumn get businessId => text()();
  TextColumn get code => text().nullable()();
  TextColumn get name => text()();
  TextColumn get contact => text().nullable()();
  TextColumn get phone => text().nullable()();
  TextColumn get email => text().nullable()();
  TextColumn get category => text().nullable()();
  TextColumn get term => text().withDefault(const Constant('tunai'))();
  TextColumn get localStatus =>
      text().withDefault(const Constant('synced'))(); // synced|dirty|deleted
  IntColumn get isActive => integer().withDefault(const Constant(1))();
  IntColumn get serverVersion => integer().withDefault(const Constant(0))();
  IntColumn get createdAt => integer().withDefault(const Constant(0))();
  IntColumn get updatedAt => integer().withDefault(const Constant(0))();
  IntColumn get deletedAt => integer().nullable()();
  IntColumn get lastSyncedAt => integer().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
