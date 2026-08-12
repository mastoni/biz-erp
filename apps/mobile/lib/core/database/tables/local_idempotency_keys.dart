import 'package:drift/drift.dart';

/// Entity types for idempotency keys
class EntityType {
  static const String sale = 'SALE';
  static const String payment = 'PAYMENT';

  static const List<String> all = [sale, payment];
}

/// Local idempotency protection.
///
/// Prevents duplicate local financial commits per client_transaction_id.
class LocalIdempotencyKeys extends Table {
  /// The idempotency key (client_transaction_id or client_payment_id)
  TextColumn get key => text()();

  TextColumn get businessId => text()();

  /// Entity type — restricted to SALE or PAYMENT
  TextColumn get entityType => text().check(
    const CustomExpression("entity_type IN ('SALE', 'PAYMENT')"),
  )();

  /// Epoch milliseconds
  IntColumn get createdAt => integer()();

  /// V3 addition: Fingerprint of the original checkout request.
  /// Nullable for backward compatibility with V2 rows.
  /// All new rows MUST have a fingerprint.
  TextColumn get requestFingerprint => text().nullable()();

  @override
  Set<Column> get primaryKey => {key};
}
