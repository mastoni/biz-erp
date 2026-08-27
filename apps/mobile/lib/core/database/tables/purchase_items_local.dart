import 'package:drift/drift.dart';

class PurchaseItemsLocal extends Table {
  TextColumn get id => text()();
  TextColumn get purchaseId => text()();
  TextColumn get productId => text().nullable()();
  TextColumn get productName => text()();
  IntColumn get orderedQty => integer()();
  IntColumn get receivedQty => integer().withDefault(const Constant(0))();
  IntColumn get unitCostMinor => integer()();
  IntColumn get subtotalMinor => integer()();

  @override
  Set<Column> get primaryKey => {id};
}
