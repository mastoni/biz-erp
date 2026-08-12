import 'dart:io';

import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';

const _v1SchemaSql = '''
CREATE TABLE "sales_local" (
  "client_transaction_id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "cashier_id" TEXT NOT NULL,
  "customer_id" TEXT NULL,
  "status" TEXT NOT NULL CHECK(status IN ('DRAFT', 'PENDING_SYNC', 'SYNCING', 'RESULT_UNKNOWN', 'SYNCED', 'SYNC_FAILED', 'CONFLICT', 'CANCELLED')),
  "subtotal_minor" INTEGER NOT NULL CHECK(subtotal_minor >= 0),
  "discount_minor" INTEGER NOT NULL DEFAULT 0 CHECK(discount_minor >= 0),
  "tax_minor" INTEGER NOT NULL DEFAULT 0 CHECK(tax_minor >= 0),
  "total_minor" INTEGER NOT NULL CHECK(total_minor >= 0),
  "currency_code" TEXT NOT NULL,
  "currency_minor_units" INTEGER NOT NULL,
  "device_id" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL,
  "synced_at" INTEGER NULL,
  PRIMARY KEY ("client_transaction_id")
);
CREATE TABLE "sale_items_local" (
  "id" TEXT NOT NULL,
  "client_transaction_id" TEXT NOT NULL REFERENCES "sales_local"("client_transaction_id"),
  "product_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL CHECK(quantity >= 1),
  "unit_price_minor" INTEGER NOT NULL CHECK(unit_price_minor >= 0),
  "discount_minor" INTEGER NOT NULL DEFAULT 0 CHECK(discount_minor >= 0),
  "created_at" INTEGER NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "payments_local" (
  "client_payment_id" TEXT NOT NULL,
  "client_transaction_id" TEXT NOT NULL REFERENCES "sales_local"("client_transaction_id"),
  "payment_method" TEXT NOT NULL,
  "amount_minor" INTEGER NOT NULL CHECK(amount_minor >= 0),
  "record_status" TEXT NOT NULL DEFAULT 'RECORDED' CHECK(record_status IN ('RECORDED', 'SYNCED')),
  "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK(verification_status IN ('UNVERIFIED', 'VERIFIED', 'FAILED_VERIFICATION')),
  "created_at" INTEGER NOT NULL,
  "synced_at" INTEGER NULL,
  PRIMARY KEY ("client_payment_id")
);
CREATE TABLE "local_idempotency_keys" (
  "key" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL CHECK(entity_type IN ('SALE', 'PAYMENT')),
  "created_at" INTEGER NOT NULL,
  PRIMARY KEY ("key")
);
PRAGMA user_version = 1;
''';

void main() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;

  group('V2 Fresh Install', () {
    test('creates all 9 tables', () async {
      final db = AppDatabase.memory();
      await db.customSelect('SELECT 1').get();

      final tables = await db
          .customSelect(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          )
          .get();
      final names = tables.map((r) => r.read<String>('name')).toSet();

      expect(
        names,
        containsAll([
          'sales_local',
          'sale_items_local',
          'payments_local',
          'local_idempotency_keys',
          'products_local',
          'receipt_sequences_local',
          'cart_local',
          'cart_items_local',
          'business_settings_local',
        ]),
      );

      await db.close();
    });

    test('schemaVersion is 2', () async {
      final db = AppDatabase.memory();
      expect(db.schemaVersion, equals(2));
      await db.customSelect('SELECT 1').get();

      final result = await db.customSelect('PRAGMA user_version').get();
      expect(result.first.read<int>('user_version'), equals(2));
      await db.close();
    });

    test('partial unique index on cart_local is created', () async {
      final db = AppDatabase.memory();
      await db.customSelect('SELECT 1').get();

      final indexes = await db
          .customSelect(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_one_active_cart_per_business'",
          )
          .get();
      expect(indexes.length, equals(1));
      await db.close();
    });
  });

  group('V2 Partial Unique Index (Cart)', () {
    late AppDatabase db;

    setUp(() async {
      db = AppDatabase.memory();
      await db.customSelect('SELECT 1').get();
    });

    tearDown(() async {
      await db.close();
    });

    test('business A + ACTIVE cart #1 = allowed', () async {
      await db
          .into(db.cartLocal)
          .insert(
            CartLocalCompanion.insert(
              id: 'cart-1',
              businessId: 'biz-A',
              status: 'ACTIVE',
              createdAt: 1000,
              updatedAt: 1000,
            ),
          );
      expect((await db.select(db.cartLocal).get()).length, 1);
    });

    test('business A + ACTIVE cart #2 = rejected', () async {
      await db
          .into(db.cartLocal)
          .insert(
            CartLocalCompanion.insert(
              id: 'cart-1',
              businessId: 'biz-A',
              status: 'ACTIVE',
              createdAt: 1000,
              updatedAt: 1000,
            ),
          );
      expect(
        () => db
            .into(db.cartLocal)
            .insert(
              CartLocalCompanion.insert(
                id: 'cart-2',
                businessId: 'biz-A',
                status: 'ACTIVE',
                createdAt: 1000,
                updatedAt: 1000,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });

    test('business A + CHECKED_OUT cart = allowed', () async {
      await db
          .into(db.cartLocal)
          .insert(
            CartLocalCompanion.insert(
              id: 'cart-1',
              businessId: 'biz-A',
              status: 'ACTIVE',
              createdAt: 1000,
              updatedAt: 1000,
            ),
          );
      await db
          .into(db.cartLocal)
          .insert(
            CartLocalCompanion.insert(
              id: 'cart-2',
              businessId: 'biz-A',
              status: 'CHECKED_OUT',
              createdAt: 1000,
              updatedAt: 1000,
            ),
          );
      expect((await db.select(db.cartLocal).get()).length, 2);
    });

    test('business A + ABANDONED cart = allowed', () async {
      await db
          .into(db.cartLocal)
          .insert(
            CartLocalCompanion.insert(
              id: 'cart-1',
              businessId: 'biz-A',
              status: 'ACTIVE',
              createdAt: 1000,
              updatedAt: 1000,
            ),
          );
      await db
          .into(db.cartLocal)
          .insert(
            CartLocalCompanion.insert(
              id: 'cart-2',
              businessId: 'biz-A',
              status: 'ABANDONED',
              createdAt: 1000,
              updatedAt: 1000,
            ),
          );
      expect((await db.select(db.cartLocal).get()).length, 2);
    });

    test('business B + ACTIVE cart = allowed', () async {
      await db
          .into(db.cartLocal)
          .insert(
            CartLocalCompanion.insert(
              id: 'cart-1',
              businessId: 'biz-A',
              status: 'ACTIVE',
              createdAt: 1000,
              updatedAt: 1000,
            ),
          );
      await db
          .into(db.cartLocal)
          .insert(
            CartLocalCompanion.insert(
              id: 'cart-2',
              businessId: 'biz-B',
              status: 'ACTIVE',
              createdAt: 1000,
              updatedAt: 1000,
            ),
          );
      expect((await db.select(db.cartLocal).get()).length, 2);
    });
  });

  group('V1 -> V2 Migration', () {
    late Directory tempDir;
    late File dbFile;

    setUp(() {
      tempDir = Directory.systemTemp.createTempSync('v1_to_v2_');
      dbFile = File('${tempDir.path}/test.db');
    });

    tearDown(() {
      try {
        tempDir.deleteSync(recursive: true);
      } catch (_) {}
    });

    test('V1 data survives V1->V2 migration', () async {
      // 1. Create V1 database using raw sqlite3
      final rawDb = sqlite3.open(dbFile.path);
      for (final stmt in _v1SchemaSql.split(';')) {
        if (stmt.trim().isNotEmpty) rawDb.execute(stmt);
      }

      rawDb.execute('''
        INSERT INTO sales_local (client_transaction_id, business_id, branch_id, cashier_id, status, subtotal_minor, total_minor, currency_code, currency_minor_units, device_id, created_at, updated_at)
        VALUES ('tx-1', 'biz-1', 'branch-1', 'cashier-1', 'DRAFT', 10000, 10000, 'IDR', 0, 'device-1', 1000, 1000)
      ''');
      rawDb.execute('''
        INSERT INTO payments_local (client_payment_id, client_transaction_id, payment_method, amount_minor, created_at)
        VALUES ('pay-1', 'tx-1', 'CASH', 10000, 1000)
      ''');
      rawDb.execute('''
        INSERT INTO local_idempotency_keys (key, business_id, entity_type, created_at)
        VALUES ('idem-1', 'biz-1', 'SALE', 1000)
      ''');
      rawDb.close();

      // 2. Open with V2 AppDatabase (triggers migration)
      final v2Db = AppDatabase(NativeDatabase(dbFile));
      await v2Db.customSelect('SELECT 1').get();

      // 3. Verify V1 data survived
      final sale = await (v2Db.select(
        v2Db.salesLocal,
      )..where((t) => t.clientTransactionId.equals('tx-1'))).getSingle();
      expect(sale.totalMinor, 10000);

      final payment = await (v2Db.select(
        v2Db.paymentsLocal,
      )..where((t) => t.clientPaymentId.equals('pay-1'))).getSingle();
      expect(payment.amountMinor, 10000);

      final idem = await (v2Db.select(
        v2Db.localIdempotencyKeys,
      )..where((t) => t.key.equals('idem-1'))).getSingle();
      expect(idem.entityType, 'SALE');

      // 4. Verify V2 schema version
      final version = await v2Db.customSelect('PRAGMA user_version').get();
      expect(version.first.read<int>('user_version'), 2);

      // 5. Verify new columns exist and are nullable
      expect(sale.receiptNumber, isNull);
      expect(sale.receiptSequence, isNull);
      expect(sale.receiptDate, isNull);
      expect(payment.changeMinor, isNull);

      // 6. Verify new tables exist
      final tables = await v2Db
          .customSelect("SELECT name FROM sqlite_master WHERE type='table'")
          .get();
      final names = tables.map((r) => r.read<String>('name')).toSet();
      expect(
        names,
        containsAll([
          'products_local',
          'receipt_sequences_local',
          'cart_local',
          'cart_items_local',
          'business_settings_local',
        ]),
      );

      await v2Db.close();
    });
  });
}
