import 'package:drift/drift.dart';

/// Local cached branch data from server.
class BranchesLocal extends Table {
  /// UUID from server branches.id
  TextColumn get id => text()();

  TextColumn get businessId => text()();

  TextColumn get name => text()();

  BoolColumn get status => boolean()();

  /// Server-side timestamps for sync tracking
  TextColumn get createdAt => text()();
  TextColumn get updatedAt => text()();

  /// Local metadata
  IntColumn get cachedAt => integer()();

  @override
  Set<Column> get primaryKey => {id, businessId};

  @override
  List<String> get customConstraints => [
    'UNIQUE(business_id, name)',
  ];
}

/// Active branch selection per business.
class ActiveBranchLocal extends Table {
  TextColumn get businessId => text()();

  /// Currently selected branch UUID (from branches_local.id)
  TextColumn get branchId => text()();

  IntColumn get updatedAt => integer()();

  @override
  Set<Column> get primaryKey => {businessId};
}