import 'package:drift/drift.dart';

class CustomersLocal extends Table {
  TextColumn get id => text()();
  TextColumn get businessId => text()();
  TextColumn get name => text()();
  TextColumn get phone => text().nullable()();
  TextColumn get email => text().nullable()();
  TextColumn get localStatus => text().withDefault(const Constant('synced'))();
  IntColumn get isActive => integer().withDefault(const Constant(1))();
  IntColumn get serverVersion => integer().withDefault(const Constant(0))();
  IntColumn get lastSyncedAt => integer().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
