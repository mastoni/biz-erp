import 'package:drift/drift.dart';

/// Local cache of branch stock levels joined with product info.
/// Server (PostgreSQL) is the source of truth.
/// Mobile cache is read-only: stock levels are mutated only via the backend
/// Inventory Adjustment API. No dirty/local-edit state is tracked here.
class StocksLocal extends Table {
  /// Server-generated UUID (stocks.id)
  TextColumn get id => text()();

  /// Tenant isolation
  TextColumn get businessId => text()();

  /// Branch scope
  TextColumn get branchId => text()();

  /// Product identifier
  TextColumn get productId => text()();

  /// Product display fields (denormalized from products join)
  TextColumn get productName => text()();
  TextColumn get sku => text().nullable()();
  TextColumn get category => text().nullable()();
  TextColumn get barcode => text().nullable()();

  /// Price and cost in minor units (INTEGER, no floating point)
  IntColumn get priceMinor => integer()();
  IntColumn get costMinor => integer().nullable()();

  /// Current on-hand quantity (server-authoritative, INTEGER >= 0)
  IntColumn get quantity => integer()();

  /// Optimistic-lock version for stock adjustments (STOCK_VERSION_CONFLICT)
  IntColumn get serverVersion => integer().withDefault(const Constant(0))();

  /// Server timestamps (epoch ms)
  IntColumn get createdAt => integer().nullable()();
  IntColumn get updatedAt => integer().nullable()();

  /// Local sync metadata (epoch ms)
  IntColumn get cachedAt => integer().nullable()();

  @override
  Set<Column> get primaryKey => {id};

  @override
  List<String> get customConstraints => [
    'UNIQUE(business_id, branch_id, product_id)',
  ];
}
