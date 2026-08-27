import 'package:drift/drift.dart';

class PurchasesLocal extends Table {
  TextColumn get id => text()();
  TextColumn get businessId => text()();
  TextColumn get branchId => text()();
  TextColumn get supplierId => text()();
  TextColumn get supplierName => text().nullable()();
  TextColumn get supplierCode => text().nullable()();
  TextColumn get code => text()();
  TextColumn get date => text()();
  TextColumn get dueDate => text()();
  TextColumn get supplierTerm =>
      text().withDefault(const Constant('Tunai'))(); // Tunai | Tempo 14 | Tempo 30
  TextColumn get status =>
      text().withDefault(const Constant('draft'))(); // draft | sent | partial | received | cancelled
  IntColumn get totalMinor => integer().withDefault(const Constant(0))();
  IntColumn get receivedMinor => integer().withDefault(const Constant(0))();
  IntColumn get paidMinor => integer().withDefault(const Constant(0))();
  IntColumn get outstandingMinor => integer().withDefault(const Constant(0))();
  TextColumn get note => text().nullable()();
  IntColumn get serverVersion => integer().withDefault(const Constant(1))();
  TextColumn get localStatus =>
      text().withDefault(const Constant('synced'))(); // synced | dirty
  IntColumn get createdAt => integer().withDefault(const Constant(0))();
  IntColumn get updatedAt => integer().withDefault(const Constant(0))();
  IntColumn get deletedAt => integer().nullable()();
  IntColumn get lastSyncedAt => integer().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
