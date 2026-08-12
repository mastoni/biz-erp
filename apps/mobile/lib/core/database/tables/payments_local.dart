import 'package:drift/drift.dart';
import 'sales_local.dart';

/// Payment record statuses (sync lifecycle)
class RecordStatus {
  static const String recorded = 'RECORDED';
  static const String synced = 'SYNCED';

  static const List<String> all = [recorded, synced];
}

/// Payment verification statuses (financial proof)
class VerificationStatus {
  static const String unverified = 'UNVERIFIED';
  static const String verified = 'VERIFIED';
  static const String failedVerification = 'FAILED_VERIFICATION';

  static const List<String> all = [unverified, verified, failedVerification];
}

/// Offline payment records.
///
/// Preserves the distinction between RECORDED and VERIFIED.
/// CASH is NOT automatically marked as VERIFIED.
/// Money fields use INTEGER minor units.
class PaymentsLocal extends Table {
  /// UUID — primary key
  TextColumn get clientPaymentId => text()();

  /// FK → sales_local.client_transaction_id
  TextColumn get clientTransactionId =>
      text().references(SalesLocal, #clientTransactionId)();

  TextColumn get paymentMethod => text()();

  /// Amount — INTEGER minor units
  IntColumn get amountMinor =>
      integer().check(const CustomExpression('amount_minor >= 0'))();

  /// Sync lifecycle status
  TextColumn get recordStatus => text()
      .withDefault(const Constant('RECORDED'))
      .check(
        const CustomExpression("record_status IN ('RECORDED', 'SYNCED')"),
      )();

  /// Financial verification status
  TextColumn get verificationStatus => text()
      .withDefault(const Constant('UNVERIFIED'))
      .check(
        const CustomExpression(
          "verification_status IN ('UNVERIFIED', 'VERIFIED', 'FAILED_VERIFICATION')",
        ),
      )();

  /// Epoch milliseconds
  IntColumn get createdAt => integer()();
  IntColumn get syncedAt => integer().nullable()();

  /// V2 addition: Change given for cash payments (D8)
  IntColumn get changeMinor =>
      integer().nullable().check(const CustomExpression('change_minor >= 0'))();

  @override
  Set<Column> get primaryKey => {clientPaymentId};
}
