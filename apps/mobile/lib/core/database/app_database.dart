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
  int get schemaVersion => 4;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) async {
      await m.createAll();
      await m.database.customStatement(
        'CREATE INDEX IF NOT EXISTS idx_products_business_barcode '
        'ON products_local (business_id, barcode)',
      );
      await customStatement(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_cart_per_business '
        'ON cart_local(business_id) WHERE status = \'ACTIVE\'',
      );
    },
    onUpgrade: (m, from, to) async {
      if (from < 2) {
        await m.createTable(productsLocal);
        await m.createTable(receiptSequencesLocal);
        await m.createTable(cartLocal);
        await m.createTable(cartItemsLocal);
        await m.createTable(businessSettingsLocal);

        await m.addColumn(salesLocal, salesLocal.receiptNumber);
        await m.addColumn(salesLocal, salesLocal.receiptSequence);
        await m.addColumn(salesLocal, salesLocal.receiptDate);
        await m.addColumn(paymentsLocal, paymentsLocal.changeMinor);

        await customStatement(
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_cart_per_business '
          'ON cart_local(business_id) WHERE status = \'ACTIVE\'',
        );
      }
      if (from < 3) {
        // V3: Add request fingerprint (nullable for backward compatibility)
        await m.addColumn(
          localIdempotencyKeys,
          localIdempotencyKeys.requestFingerprint,
        );
      }
      if (from < 4) {
        // Cek apakah kolom barcode sudah ada (mungkin fresh install sudah buat via createAll)
        final columns = await m.database
            .customSelect(
              "PRAGMA table_info(products_local)",
              readsFrom: const {},
            )
            .get();
        final hasBarcode = columns.any(
          (row) => row.read<String>('name') == 'barcode',
        );
        if (!hasBarcode) {
          await m.database.customStatement(
            'ALTER TABLE products_local ADD COLUMN barcode TEXT',
          );
        }
        await m.database.customStatement(
          'CREATE INDEX IF NOT EXISTS idx_products_business_barcode '
          'ON products_local (business_id, barcode)',
        );
      }
    },
    beforeOpen: (details) async {
      await customStatement('PRAGMA foreign_keys = ON');
    },
  );
}
