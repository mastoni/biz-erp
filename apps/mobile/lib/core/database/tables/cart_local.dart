import 'package:drift/drift.dart';

/// Cart lifecycle statuses
class CartStatus {
  static const String active = 'ACTIVE';
  static const String checkedOut = 'CHECKED_OUT';
  static const String abandoned = 'ABANDONED';

  static const List<String> all = [active, checkedOut, abandoned];
}

/// Persistent shopping cart (D2).
/// Enforces ONE ACTIVE cart per business via partial unique index.
class CartLocal extends Table {
  TextColumn get id => text()();
  TextColumn get businessId => text()();

  TextColumn get status => text().check(
    const CustomExpression("status IN ('ACTIVE', 'CHECKED_OUT', 'ABANDONED')"),
  )();

  IntColumn get createdAt => integer()();
  IntColumn get updatedAt => integer()();

  @override
  Set<Column> get primaryKey => {id};
}
