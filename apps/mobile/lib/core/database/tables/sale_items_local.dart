import 'package:drift/drift.dart';
import 'sales_local.dart';

/// Sale line items.
///
/// Quantity is INTEGER >= 1 (never fractional, never coerced).
/// Money fields use INTEGER minor units.
class SaleItemsLocal extends Table {
  /// UUID — primary key
  TextColumn get id => text()();

  /// FK → sales_local.client_transaction_id
  TextColumn get clientTransactionId =>
      text().references(SalesLocal, #clientTransactionId)();

  TextColumn get productId => text()();

  /// Quantity — INTEGER >= 1, never fractional
  IntColumn get quantity =>
      integer().check(const CustomExpression('quantity >= 1'))();

  /// Unit price — INTEGER minor units
  IntColumn get unitPriceMinor =>
      integer().check(const CustomExpression('unit_price_minor >= 0'))();

  /// Line discount — INTEGER minor units
  IntColumn get discountMinor => integer()
      .withDefault(const Constant(0))
      .check(const CustomExpression('discount_minor >= 0'))();

  /// Epoch milliseconds
  IntColumn get createdAt => integer()();

  @override
  Set<Column> get primaryKey => {id};
}
