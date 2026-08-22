import 'package:drift/drift.dart';

/// Valid sale statuses for the offline POS state machine
class SaleStatus {
  static const String draft = 'DRAFT';
  static const String pendingSync = 'PENDING_SYNC';
  static const String syncing = 'SYNCING';
  static const String resultUnknown = 'RESULT_UNKNOWN';
  static const String synced = 'SYNCED';
  static const String syncFailed = 'SYNC_FAILED';
  static const String conflict = 'CONFLICT';
  static const String receiptConflict = 'RECEIPT_CONFLICT';
  static const String cancelled = 'CANCELLED';

  static const List<String> all = [
    draft,
    pendingSync,
    syncing,
    resultUnknown,
    synced,
    syncFailed,
    conflict,
    receiptConflict,
    cancelled,
  ];
}

/// Offline sale header and state-machine anchor.
///
/// Money fields use INTEGER minor units (never REAL/FLOAT).
/// client_transaction_id is the primary key and idempotency anchor.
class SalesLocal extends Table {
  /// UUID v4 — primary key and idempotency anchor
  TextColumn get clientTransactionId => text()();

  TextColumn get businessId => text()();
  TextColumn get branchId => text()();
  TextColumn get cashierId => text()();
  TextColumn get customerId => text().nullable()();

  /// V2 additions: Structured receipt fields (D4)
  TextColumn get receiptNumber => text().nullable()();
  IntColumn get receiptSequence => integer().nullable()();
  TextColumn get receiptDate => text().nullable()();

  /// Sale status — restricted to valid state machine values
  TextColumn get status => text().check(
    const CustomExpression(
      "status IN ('DRAFT', 'PENDING_SYNC', 'SYNCING', 'RESULT_UNKNOWN', "
      "'SYNCED', 'SYNC_FAILED', 'CONFLICT', 'RECEIPT_CONFLICT', 'CANCELLED')",
    ),
  )();

  /// Money fields — INTEGER minor units only
  IntColumn get subtotalMinor =>
      integer().check(const CustomExpression('subtotal_minor >= 0'))();

  IntColumn get discountMinor => integer()
      .withDefault(const Constant(0))
      .check(const CustomExpression('discount_minor >= 0'))();

  IntColumn get taxMinor => integer()
      .withDefault(const Constant(0))
      .check(const CustomExpression('tax_minor >= 0'))();

  IntColumn get totalMinor =>
      integer().check(const CustomExpression('total_minor >= 0'))();

  TextColumn get currencyCode => text()();
  IntColumn get currencyMinorUnits => integer()();

  TextColumn get deviceId => text()();

  /// Epoch milliseconds
  IntColumn get createdAt => integer()();
  IntColumn get updatedAt => integer()();
  IntColumn get syncedAt => integer().nullable()();

  @override
  Set<Column> get primaryKey => {clientTransactionId};
}
