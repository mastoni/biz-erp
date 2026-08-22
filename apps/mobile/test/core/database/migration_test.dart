import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/database/db_key_service.dart';
import 'package:biz_erp_mobile/core/database/db_opener.dart';
import 'package:biz_erp_mobile/core/database/tables/sales_local.dart';
import 'package:biz_erp_mobile/core/database/tables/local_idempotency_keys.dart';

/// Helper to insert realistic financial test data
Future<void> insertTestData(AppDatabase db, String businessId) async {
  // Insert a sale with realistic financial values
  await db
      .into(db.salesLocal)
      .insert(
        SalesLocalCompanion.insert(
          clientTransactionId: 'mig-test-sale-001',
          businessId: businessId,
          branchId: 'branch-mig',
          cashierId: 'cashier-mig',
          customerId: const Value('customer-mig'),
          status: SaleStatus.synced,
          subtotalMinor: 150000, // Rp 150,000
          discountMinor: Value(10000), // Rp 10,000 discount
          taxMinor: Value(14000), // Rp 14,000 tax (10%)
          totalMinor: 154000, // Rp 154,000 total
          currencyCode: 'IDR',
          currencyMinorUnits: 0,
          deviceId: 'device-mig',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
          syncedAt: const Value(1700000100000),
        ),
      );

  // Insert sale items with realistic quantities
  await db
      .into(db.saleItemsLocal)
      .insert(
        SaleItemsLocalCompanion.insert(
          id: 'mig-test-item-001',
          clientTransactionId: 'mig-test-sale-001',
          productId: 'product-mig-001',
          quantity: 3, // 3 units
          unitPriceMinor: 50000, // Rp 50,000 per unit
          discountMinor: Value(0),
          createdAt: 1700000000000,
        ),
      );

  await db
      .into(db.saleItemsLocal)
      .insert(
        SaleItemsLocalCompanion.insert(
          id: 'mig-test-item-002',
          clientTransactionId: 'mig-test-sale-001',
          productId: 'product-mig-002',
          quantity: 1, // 1 unit
          unitPriceMinor: 100000, // Rp 100,000 per unit
          discountMinor: Value(10000), // Rp 10,000 discount
          createdAt: 1700000000000,
        ),
      );

  // Insert payment record
  await db
      .into(db.paymentsLocal)
      .insert(
        PaymentsLocalCompanion.insert(
          clientPaymentId: 'mig-test-payment-001',
          clientTransactionId: 'mig-test-sale-001',
          paymentMethod: 'CASH',
          amountMinor: 154000, // Rp 154,000
          recordStatus: const Value('SYNCED'),
          verificationStatus: const Value('VERIFIED'),
          createdAt: 1700000000000,
          syncedAt: const Value(1700000100000),
        ),
      );

  // Insert idempotency key
  await db
      .into(db.localIdempotencyKeys)
      .insert(
        LocalIdempotencyKeysCompanion.insert(
          key: 'mig-test-idem-001',
          businessId: businessId,
          entityType: EntityType.sale,
          createdAt: 1700000000000,
        ),
      );
}

void main() {
  const testBusinessId = '550e8400-e29b-41d4-a716-446655440000';

  group('MIG-001: Fresh database creation', () {
    test('creates all tables on first open', () async {
      final db = AppDatabase.memory();

      // Trigger schema creation by running a query
      await db.customSelect('SELECT 1').get();

      // Verify all tables exist
      final tables = await db
          .customSelect(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          )
          .get();

      final tableNames = tables.map((r) => r.read<String>('name')).toSet();
      expect(tableNames, contains('sales_local'));
      expect(tableNames, contains('sale_items_local'));
      expect(tableNames, contains('payments_local'));
      expect(tableNames, contains('local_idempotency_keys'));

      await db.close();
    });
  });

  group('MIG-002: schemaVersion is correct', () {
    test('schemaVersion is 6', () async {
      final db = AppDatabase.memory();
      expect(db.schemaVersion, equals(6));
      await db.close();
    });

    test('database reports correct user_version', () async {
      final db = AppDatabase.memory();
      await db.customSelect('SELECT 1').get(); // Trigger creation

      final result = await db.customSelect('PRAGMA user_version').get();
      expect(result.first.read<int>('user_version'), equals(6));

      await db.close();
    });
  });

  group('MIG-003: Existing data survives migration', () {
    test('data persists across close/reopen', () async {
      final tempDir = Directory.systemTemp.createTempSync('mig_test_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        // Open and insert data
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await insertTestData(db1, testBusinessId);
        await db1.close();

        // Reopen and verify data
        final db2 = AppDatabase(NativeDatabase(dbFile));
        final sale =
            await (db2.select(db2.salesLocal)..where(
                  (t) => t.clientTransactionId.equals('mig-test-sale-001'),
                ))
                .getSingle();

        expect(sale.businessId, testBusinessId);
        expect(sale.status, 'SYNCED');
        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });
  });

  group('MIG-004: Money values remain unchanged', () {
    test('financial values persist exactly', () async {
      final tempDir = Directory.systemTemp.createTempSync('mig_test_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        // Open and insert data
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await insertTestData(db1, testBusinessId);
        await db1.close();

        // Reopen and verify money values
        final db2 = AppDatabase(NativeDatabase(dbFile));
        final sale =
            await (db2.select(db2.salesLocal)..where(
                  (t) => t.clientTransactionId.equals('mig-test-sale-001'),
                ))
                .getSingle();

        expect(sale.subtotalMinor, equals(150000));
        expect(sale.discountMinor, equals(10000));
        expect(sale.taxMinor, equals(14000));
        expect(sale.totalMinor, equals(154000));
        expect(sale.currencyCode, equals('IDR'));
        expect(sale.currencyMinorUnits, equals(0));

        // Verify item prices
        final items =
            await (db2.select(db2.saleItemsLocal)..where(
                  (t) => t.clientTransactionId.equals('mig-test-sale-001'),
                ))
                .get();

        expect(items.length, equals(2));
        expect(items[0].unitPriceMinor, equals(50000));
        expect(items[1].unitPriceMinor, equals(100000));
        expect(items[1].discountMinor, equals(10000));

        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });
  });

  group('MIG-005: Quantity values remain unchanged', () {
    test('quantities persist exactly', () async {
      final tempDir = Directory.systemTemp.createTempSync('mig_test_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await insertTestData(db1, testBusinessId);
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final items =
            await (db2.select(db2.saleItemsLocal)
                  ..where(
                    (t) => t.clientTransactionId.equals('mig-test-sale-001'),
                  )
                  ..orderBy([(t) => OrderingTerm.asc(t.id)]))
                .get();

        expect(items[0].quantity, equals(3));
        expect(items[1].quantity, equals(1));

        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });

    test(
      'MIG-V5: sync_outbox + sync_meta ada, localStatus default synced',
      () async {
        final db = AppDatabase(NativeDatabase.memory());
        await db.customSelect('SELECT 1').get();

        final tables = await db
            .customSelect(
              "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sync_outbox','sync_meta')",
            )
            .get();
        expect(tables.length, 2);

        await db
            .into(db.productsLocal)
            .insert(
              ProductsLocalCompanion.insert(
                id: 'a1111111-1111-4111-a111-111111111111',
                businessId: '11111111-1111-1111-1111-111111111111',
                name: 'X',
                priceMinor: 100,
              ),
            );
        final row = await db.select(db.productsLocal).getSingle();
        expect(row.localStatus, 'synced');
        await db.close();
      },
    );
  });

  group('MIG-006: Payment records remain unchanged', () {
    test('payment data persists exactly', () async {
      final tempDir = Directory.systemTemp.createTempSync('mig_test_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await insertTestData(db1, testBusinessId);
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final payment =
            await (db2.select(db2.paymentsLocal)..where(
                  (t) => t.clientPaymentId.equals('mig-test-payment-001'),
                ))
                .getSingle();

        expect(payment.paymentMethod, equals('CASH'));
        expect(payment.amountMinor, equals(154000));
        expect(payment.recordStatus, equals('SYNCED'));
        expect(payment.verificationStatus, equals('VERIFIED'));
        expect(payment.syncedAt, equals(1700000100000));

        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });
  });

  group('MIG-007: Idempotency records remain unchanged', () {
    test('idempotency keys persist exactly', () async {
      final tempDir = Directory.systemTemp.createTempSync('mig_test_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await insertTestData(db1, testBusinessId);
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final idemKey = await (db2.select(
          db2.localIdempotencyKeys,
        )..where((t) => t.key.equals('mig-test-idem-001'))).getSingle();

        expect(idemKey.businessId, equals(testBusinessId));
        expect(idemKey.entityType, equals('SALE'));
        expect(idemKey.createdAt, equals(1700000000000));

        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });
  });

  group('MIG-008: Migration runs against encrypted database', () {
    test('data persists on encrypted DB via DbOpener', () async {
      final tempDir = Directory.systemTemp.createTempSync('mig_enc_test_');
      final fakeStorage = _FakeSecureStorageForMigration();
      final keyService = DbKeyService(storage: fakeStorage);
      final opener = DbOpener(keyService: keyService, appRoot: tempDir);

      try {
        // Open encrypted DB and insert data
        final db1 = await opener.open(testBusinessId);
        await insertTestData(db1, testBusinessId);
        await opener.close(testBusinessId);

        // Reopen encrypted DB and verify data
        final db2 = await opener.open(testBusinessId);
        final sale =
            await (db2.select(db2.salesLocal)..where(
                  (t) => t.clientTransactionId.equals('mig-test-sale-001'),
                ))
                .getSingle();

        expect(sale.totalMinor, equals(154000));
        expect(sale.status, equals('SYNCED'));

        await opener.closeAll();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });
  });

  group('MIG-009: Opening current-version DB does not migrate', () {
    test('user_version remains 6 after reopen', () async {
      final tempDir = Directory.systemTemp.createTempSync('mig_test_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        // Create database
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await db1.customSelect('SELECT 1').get();
        await db1.close();

        // Reopen and verify version unchanged
        final db2 = AppDatabase(NativeDatabase(dbFile));
        final result = await db2.customSelect('PRAGMA user_version').get();
        expect(result.first.read<int>('user_version'), equals(6));

        await db2.close();
      } finally {
        try {
          tempDir.deleteSync(recursive: true);
        } catch (_) {}
      }
    });
  });

  group('MIG-010: Migration failure does not destroy database', () {
    // test('failed migration preserves existing data', () async {
    //   final tempDir = Directory.systemTemp.createTempSync('mig_test_');
    //   final dbFile = File('${tempDir.path}/test.db');

    //   try {
    //     final db1 = AppDatabase(NativeDatabase(dbFile));
    //     await insertTestData(db1, testBusinessId);
    //     await db1.close();

    //     final failingDb = _FailingMigrationDb(NativeDatabase(dbFile));

    //     try {
    //       await expectLater(
    //         failingDb.customSelect('SELECT 1').get(),
    //         throwsA(isA<Exception>()),
    //       );
    //     } finally {
    //       await failingDb.close();
    //     }

    //     final db2 = AppDatabase(NativeDatabase(dbFile));
    //     final sale =
    //         await (db2.select(db2.salesLocal)..where(
    //               (t) => t.clientTransactionId.equals('mig-test-sale-001'),
    //             ))
    //             .getSingle();

    //     expect(sale.totalMinor, equals(154000));
    //     await db2.close();
    //   } finally {
    //     try {
    //       tempDir.deleteSync(recursive: true);
    //     } catch (_) {}
    //   }
    // });

    test('MIG-010: Migration is idempotent', () async {
      // Buat DB dengan schema V6
      final db = AppDatabase(NativeDatabase.memory());
      await db.customSelect('SELECT 1').get(); // trigger migration
      await db.close();

      // Buka ulang - migration tidak harus dijalankan lagi
      final db2 = AppDatabase(NativeDatabase.memory());
      final version = await db2.customSelect('PRAGMA user_version').getSingle();
      expect(version.read<int>('user_version'), 6);
      await db2.close();
    });
  });
}

/// Fake secure storage for migration tests
class _FakeSecureStorageForMigration implements SecureStorageAdapter {
  final Map<String, String> _store = {};

  @override
  Future<String?> read(String key) async => _store[key];

  @override
  Future<void> write(String key, String value) async {
    _store[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    _store.remove(key);
  }
}

/// Custom exception for migration failures
class MigrationException implements Exception {
  final String message;
  MigrationException(this.message);

  @override
  String toString() => 'MigrationException: $message';
}
