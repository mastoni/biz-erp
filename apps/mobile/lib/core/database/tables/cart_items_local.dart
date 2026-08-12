import 'package:drift/drift.dart';
import 'cart_local.dart';
import 'products_local.dart';

/// Cart line items with frozen price snapshot.
class CartItemsLocal extends Table {
  TextColumn get id => text()();

  TextColumn get cartId => text().references(CartLocal, #id)();
  TextColumn get productId => text().references(ProductsLocal, #id)();

  /// Quantity >= 1 (INTEGER)
  IntColumn get quantity =>
      integer().check(const CustomExpression('quantity >= 1'))();

  /// Frozen price snapshot at time of add to cart.
  /// Does NOT update when catalog refreshes.
  IntColumn get unitPriceMinor =>
      integer().check(const CustomExpression('unit_price_minor >= 0'))();

  IntColumn get addedAt => integer()();
  IntColumn get updatedAt => integer()();

  @override
  Set<Column> get primaryKey => {id};
}
