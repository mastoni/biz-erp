import 'package:drift/drift.dart';
import 'package:drift/native.dart';

import 'tables/sales_local.dart';
import 'tables/sale_items_local.dart';
import 'tables/payments_local.dart';
import 'tables/local_idempotency_keys.dart';
import 'tables/products_local.dart';
import 'tables/receipt_sequences_local.dart';
import 'tables/cart_local.dart';
import 'tables/cart_items_local.dart';
import 'tables/business_settings_local.dart';

part 'app_database.g.dart';

/// The main application database for offline POS.
///
/// Schema version 2 — Phase 2 POS Domain additions.
/// Migration framework preserves all V1 financial data.
@DriftDatabase(
  tables: [
    SalesLocal,
    SaleItemsLocal,
    PaymentsLocal,
    LocalIdempotencyKeys,
    ProductsLocal,
    ReceiptSequencesLocal,
    CartLocal,
    CartItemsLocal,
    BusinessSettingsLocal,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  /// For testing with in-memory database
  AppDatabase.memory() : super(NativeDatabase.memory());

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) async {
      await m.createAll();
      await customStatement(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_cart_per_business '
        'ON cart_local(business_id) WHERE status = \'ACTIVE\'',
      );
    },
    onUpgrade: (m, from, to) async {
      if (from < 2) {
        // Create new V2 tables
        await m.createTable(productsLocal);
        await m.createTable(receiptSequencesLocal);
        await m.createTable(cartLocal);
        await m.createTable(cartItemsLocal);
        await m.createTable(businessSettingsLocal);

        // Add new columns to existing V1 tables (nullable to preserve V1 rows)
        await m.addColumn(salesLocal, salesLocal.receiptNumber);
        await m.addColumn(salesLocal, salesLocal.receiptSequence);
        await m.addColumn(salesLocal, salesLocal.receiptDate);
        await m.addColumn(paymentsLocal, paymentsLocal.changeMinor);

        // Create partial unique index for one ACTIVE cart per business
        await customStatement(
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_cart_per_business '
          'ON cart_local(business_id) WHERE status = \'ACTIVE\'',
        );
      }
    },
    beforeOpen: (details) async {
      // Enable foreign key constraints after every open
      await customStatement('PRAGMA foreign_keys = ON');
    },
  );
}
