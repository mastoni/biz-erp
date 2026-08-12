import 'package:drift/drift.dart';

/// Reserved sentinel for business-level settings
class BusinessSettingsSentinel {
  static const String businessLevel = '__BUSINESS__';
}

/// Business and branch configuration (tax, currency, timezone).
class BusinessSettingsLocal extends Table {
  TextColumn get id => text()();
  TextColumn get businessId => text()();

  /// Branch UUID or '__BUSINESS__' sentinel for business-level settings.
  /// Real branch_id MUST NOT equal '__BUSINESS__' (ASSUMPTION-BRANCH-001).
  TextColumn get branchId =>
      text().withDefault(const Constant('__BUSINESS__'))();

  /// Tax rate in basis points. 11% = 1100 bps. INTEGER only.
  IntColumn get taxRateBps => integer().withDefault(const Constant(0))();

  TextColumn get currencyCode => text().withDefault(const Constant('IDR'))();

  IntColumn get currencyMinorUnits =>
      integer().withDefault(const Constant(0))();

  /// IANA timezone identifier. Authoritative for receipt_date (TZ rule).
  TextColumn get timezone =>
      text().withDefault(const Constant('Asia/Jakarta'))();

  IntColumn get updatedAt => integer()();

  @override
  Set<Column> get primaryKey => {id};

  @override
  List<String> get customConstraints => ['UNIQUE(business_id, branch_id)'];
}
