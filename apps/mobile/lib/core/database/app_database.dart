import 'package:drift/drift.dart';
import 'package:drift/native.dart';

import 'tables/sales_local.dart';
import 'tables/sale_items_local.dart';
import 'tables/payments_local.dart';
import 'tables/local_idempotency_keys.dart';

part 'app_database.g.dart';

/// The main application database for offline POS.
///
/// This database uses SQLite3MultipleCiphers for encryption (configured
/// in Phase 1B.1 via the official sqlite3 hook mechanism).
///
/// Schema version 1 — initial schema (Phase 1B.3).
/// Migration framework established in Phase 1B.5.
@DriftDatabase(
  tables: [SalesLocal, SaleItemsLocal, PaymentsLocal, LocalIdempotencyKeys],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  /// For testing with in-memory database
  AppDatabase.memory() : super(NativeDatabase.memory());

  /// Current schema version.
  ///
  /// VERSION HISTORY:
  /// - Version 1: Initial schema (Phase 1B.3)
  ///   Tables: sales_local, sale_items_local, payments_local, local_idempotency_keys
  ///
  /// Future schema changes MUST increment this version.
  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) async {
      // Fresh database: create all tables from scratch.
      // This is called when the database file does not exist.
      await m.createAll();
    },
    onUpgrade: (m, from, to) async {
      // Incremental migrations for existing databases.
      //
      // This callback is called when an existing database with version
      // 'from' is opened by code expecting version 'to' (where from < to).
      //
      // VERSION HISTORY:
      // - Version 1: Initial schema (Phase 1B.3)
      //
      // FUTURE MIGRATIONS:
      // Add migration steps here as schemaVersion increments.
      // Example for v1 → v2:
      //
      //   if (from < 2) {
      //     // Migrate from v1 to v2
      //     await m.addColumn(salesLocal, salesLocal.newColumn);
      //   }
      //
      // IMPORTANT:
      // - Do not execute destructive operations unless explicitly required.
      // - Preserve all existing financial data.
      // - Test migrations thoroughly before deployment.
      //
      // For v1 → v1, no migration is needed.
      // Drift only calls onUpgrade when from < to.
    },
    beforeOpen: (details) async {
      // Enable foreign key constraints (disabled by default in SQLite).
      // This must run after every open, including after migrations.
      await customStatement('PRAGMA foreign_keys = ON');
    },
  );
}
