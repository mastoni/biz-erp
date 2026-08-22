import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'tables/business_settings_local.dart';
import 'tables/cart_items_local.dart';
import 'tables/cart_local.dart';
import 'tables/customers_local.dart';
import 'tables/local_idempotency_keys.dart';
import 'tables/payments_local.dart';
import 'tables/products_local.dart';
import 'tables/receipt_sequences_local.dart';
import 'tables/sale_items_local.dart';
import 'tables/sales_local.dart';
import 'tables/sync_meta.dart';
import 'tables/sync_outbox.dart';

part 'app_database.g.dart';

@DriftDatabase(
  tables: [
    ProductsLocal,
    BusinessSettingsLocal,
    CartLocal,
    CartItemsLocal,
    CustomersLocal,
    SalesLocal,
    SaleItemsLocal,
    PaymentsLocal,
    ReceiptSequencesLocal,
    LocalIdempotencyKeys,
    SyncOutbox,
    SyncMeta,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  /// For testing with in-memory database
  AppDatabase.memory() : super(NativeDatabase.memory());

  @override
  int get schemaVersion => 6;

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
      if (from < 5) {
        // Cek apakah tabel sync_outbox sudah ada
        final tables = await customSelect(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_outbox'",
        ).get();
        if (tables.isEmpty) {
          await m.createTable(syncOutbox);
        }

        // Cek apakah tabel sync_meta sudah ada
        final metaTables = await customSelect(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_meta'",
        ).get();
        if (metaTables.isEmpty) {
          await m.createTable(syncMeta);
        }

        // Cek apakah kolom local_status sudah ada di products_local
        final columns = await customSelect(
          "PRAGMA table_info(products_local)",
        ).get();
        final hasLocalStatus = columns.any(
          (row) => row.read<String>('name') == 'local_status',
        );
        if (!hasLocalStatus) {
          await customStatement(
            "ALTER TABLE products_local ADD COLUMN local_status TEXT NOT NULL DEFAULT 'synced'",
          );
        }
      }
      if (from < 6) {
        // Cek apakah tabel customers_local sudah ada
        final customerTables = await customSelect(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='customers_local'",
        ).get();
        if (customerTables.isEmpty) {
          await m.createTable(customersLocal);
        }
      }
    },
    beforeOpen: (details) async {
      await customStatement('PRAGMA foreign_keys = ON');
    },
  );
}
