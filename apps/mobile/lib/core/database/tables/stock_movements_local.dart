import 'package:drift/drift.dart';

/// Local cache of stock movement history (append-only read-only audit trail).
/// Movements are created server-side by the Inventory Adjustment API.
/// Mobile never writes to this table directly.
class StockMovementsLocal extends Table {
  /// Server-generated UUID (stock_movements.id)
  TextColumn get id => text()();

  /// Tenant isolation
  TextColumn get businessId => text()();

  /// Branch scope
  TextColumn get branchId => text()();

  /// Product identifier
  TextColumn get productId => text()();

  /// Signed quantity delta (positive for STOCK_IN/ADJUSTMENT, negative for STOCK_OUT)
  IntColumn get quantity => integer()();

  /// Movement type: STOCK_IN | STOCK_OUT | ADJUSTMENT
  TextColumn get movementType => text()();

  /// Optional reference (e.g., adjustment reason, purchase order number)
  TextColumn get reference => text().nullable()();

  /// Actor user identifier (server-side user who performed the action)
  TextColumn get actor => text()();

  /// Event timestamp (epoch ms)
  IntColumn get timestamp => integer().nullable()();

  /// Local sync metadata (epoch ms)
  IntColumn get cachedAt => integer().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
