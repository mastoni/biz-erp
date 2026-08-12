import 'package:drift/drift.dart';

/// Atomic receipt numbering per branch per day (D4).
/// Uses SQLite UPSERT to prevent race conditions.
class ReceiptSequencesLocal extends Table {
  TextColumn get id => text()();
  TextColumn get businessId => text()();
  TextColumn get branchId => text()();

  /// Format: YYYYMMDD (derived from business timezone, not device timezone)
  TextColumn get sequenceDate => text()();

  /// Last used sequence number
  IntColumn get lastSequence => integer().withDefault(const Constant(0))();

  IntColumn get updatedAt => integer()();

  @override
  Set<Column> get primaryKey => {id};

  @override
  List<String> get customConstraints => [
    'UNIQUE(business_id, branch_id, sequence_date)',
  ];
}
