import 'package:drift/drift.dart';

/// Local encrypted catalog cache.
/// Server is the source of truth (D1).
/// Products are soft-deleted via is_active = 0 (never physically deleted).
class ProductsLocal extends Table {
  /// Server-generated globally unique UUID (ASSUMPTION-PROD-001)
  TextColumn get id => text()();

  TextColumn get businessId => text()();
  TextColumn get name => text()();
  TextColumn get description => text().nullable()();
  TextColumn get barcode => text().nullable()();
  TextColumn get localStatus =>
      text().withDefault(const Constant('synced'))(); // synced|dirty|deleted

  /// Price in minor units (INTEGER, no floating point)
  IntColumn get priceMinor =>
      integer().check(const CustomExpression('price_minor >= 0'))();

  TextColumn get category => text().nullable()();

  /// Soft delete flag. 1 = active, 0 = inactive.
  /// Inactive products remain in DB for historical reference.
  IntColumn get isActive => integer().withDefault(const Constant(1))();

  /// Sync version tracking for Phase 3 Sync Engine
  IntColumn get serverVersion => integer().withDefault(const Constant(0))();

  /// Last sync timestamp (epoch ms)
  IntColumn get lastSyncedAt => integer().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
