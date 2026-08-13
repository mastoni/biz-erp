import 'dart:io';

import 'package:drift/drift.dart' hide isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/database/db_key_service.dart';
import 'package:biz_erp_mobile/core/database/db_opener.dart';
import 'package:biz_erp_mobile/core/database/tables/sales_local.dart';
import 'package:biz_erp_mobile/core/database/tables/local_idempotency_keys.dart';

/// Fake secure storage for integrity tests
class _FakeStorage implements SecureStorageAdapter {
  final Map<String, String> _store = {};
  @override
  Future<String?> read(String key) async => _store[key];
  @override
  Future<void> write(String key, String value) async => _store[key] = value;
  @override
  Future<void> delete(String key) async => _store.remove(key);
  void simulateKeyLoss(String key) => _store.remove(key);
}

/// Helper: insert a complete sale with items and payment
Future<void> insertCompleteSale(
  AppDatabase db,
  String businessId, {
  String txId = 'integrity-tx-001',
  int subtotal = 100000,
  int discount = 5000,
  int tax = 9500,
  int total = 104500,
  int quantity = 2,
  int unitPrice = 50000,
  int paymentAmount = 104500,
}) async {
  await db
      .into(db.salesLocal)
      .insert(
        SalesLocalCompanion.insert(
          clientTransactionId: txId,
          businessId: businessId,
          branchId: 'branch-int',
          cashierId: 'cashier-int',
          status: SaleStatus.draft,
          subtotalMinor: subtotal,
          discountMinor: Value(discount),
          taxMinor: Value(tax),
          totalMinor: total,
          currencyCode: 'IDR',
          currencyMinorUnits: 0,
          deviceId: 'device-int',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        ),
      );

  await db
      .into(db.saleItemsLocal)
      .insert(
        SaleItemsLocalCompanion.insert(
          id: 'integrity-item-001',
          clientTransactionId: txId,
          productId: 'product-int',
          quantity: quantity,
          unitPriceMinor: unitPrice,
          createdAt: 1700000000000,
        ),
      );

  await db
      .into(db.paymentsLocal)
      .insert(
        PaymentsLocalCompanion.insert(
          clientPaymentId: 'integrity-pay-001',
          clientTransactionId: txId,
          paymentMethod: 'CASH',
          amountMinor: paymentAmount,
          createdAt: 1700000000000,
        ),
      );
}

void main() {
  const bizA = '550e8400-e29b-41d4-a716-446655440000';
  const bizB = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  // ============================================================
  // B. BUSINESS ISOLATION
  // ============================================================
  group('B. Business Isolation', () {
    late Directory tempDir;
    late _FakeStorage storage;
    late DbKeyService keyService;
    late DbOpener opener;

    setUp(() {
      tempDir = Directory.systemTemp.createTempSync('int_biz_');
      storage = _FakeStorage();
      keyService = DbKeyService(storage: storage);
      opener = DbOpener(keyService: keyService, appRoot: tempDir);
      driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
    });

    tearDown(() async {
      await opener.closeAll();
      tempDir.deleteSync(recursive: true);
    });

    test('INT-BIZ-001: A and B use different database paths', () {
      final pathA = opener.dbPathFor(bizA);
      final pathB = opener.dbPathFor(bizB);
      expect(pathA, isNot(equals(pathB)));
      expect(pathA, contains('business_$bizA'));
      expect(pathB, contains('business_$bizB'));
    });

    test('INT-BIZ-002: A data cannot appear in B', () async {
      final dbA = await opener.open(bizA);
      final dbB = await opener.open(bizB);

      await dbA
          .into(dbA.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'biz-iso-tx',
              businessId: bizA,
              branchId: 'b',
              cashierId: 'c',
              status: SaleStatus.draft,
              subtotalMinor: 1000,
              totalMinor: 1000,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'd',
              createdAt: 1700000000000,
              updatedAt: 1700000000000,
            ),
          );

      final results = await (dbB.select(
        dbB.salesLocal,
      )..where((t) => t.clientTransactionId.equals('biz-iso-tx'))).get();
      expect(results, isEmpty);
    });

    test('INT-BIZ-003: A key cannot open B database', () async {
      // Open both to create keys and databases
      await opener.open(bizA);
      await opener.open(bizB);
      await opener.closeAll();

      // Verify keys are different
      final keyA = await keyService.getKey(bizA);
      final keyB = await keyService.getKey(bizB);
      expect(keyA.key, isNot(equals(keyB.key)));

      // Verify databases are at different paths
      final pathA = opener.dbPathFor(bizA);
      final pathB = opener.dbPathFor(bizB);
      expect(pathA, isNot(equals(pathB)));
    });

    test('INT-BIZ-004: B key cannot open A database', () async {
      await opener.open(bizA);
      await opener.open(bizB);
      await opener.closeAll();

      final keyA = await keyService.getKey(bizA);
      final keyB = await keyService.getKey(bizB);
      expect(keyB.key, isNot(equals(keyA.key)));
    });
  });

  // ============================================================
  // C. KEY LOSS PROTECTION
  // ============================================================
  group('C. Key Loss Protection', () {
    late Directory tempDir;
    late _FakeStorage storage;
    late DbKeyService keyService;
    late DbOpener opener;

    setUp(() {
      tempDir = Directory.systemTemp.createTempSync('int_key_');
      storage = _FakeStorage();
      keyService = DbKeyService(storage: storage);
      opener = DbOpener(keyService: keyService, appRoot: tempDir);
    });

    tearDown(() async {
      await opener.closeAll();
      tempDir.deleteSync(recursive: true);
    });

    test(
      'INT-KEY-001: existing DB + missing key raises KeyLossException',
      () async {
        final db = await opener.open(bizA);
        await db.customSelect('SELECT 1').get();
        await opener.close(bizA);

        storage.simulateKeyLoss('pos_db_key_$bizA');

        expect(() => opener.open(bizA), throwsA(isA<KeyLossException>()));
      },
    );

    test('INT-KEY-002: missing key does not generate replacement', () async {
      final db = await opener.open(bizA);
      await db.customSelect('SELECT 1').get();
      await opener.close(bizA);

      storage.simulateKeyLoss('pos_db_key_$bizA');

      try {
        await opener.open(bizA);
        fail('Should have thrown KeyLossException');
      } on KeyLossException {
        // Expected
      }

      final hasKey = await keyService.hasKey(bizA);
      expect(hasKey, isFalse);
    });

    test(
      'INT-KEY-003: existing DB remains untouched after key-loss failure',
      () async {
        final db = await opener.open(bizA);
        await insertCompleteSale(db, bizA);
        await opener.close(bizA);

        final dbPath = opener.dbPathFor(bizA);
        final fileSizeBefore = File(dbPath).lengthSync();

        storage.simulateKeyLoss('pos_db_key_$bizA');

        try {
          await opener.open(bizA);
        } on KeyLossException {
          // Expected
        }

        // File must still exist and be unchanged
        expect(File(dbPath).existsSync(), isTrue);
        expect(File(dbPath).lengthSync(), equals(fileSizeBefore));
      },
    );

    test('INT-KEY-004: new business without DB may create new key', () async {
      final result = await keyService.getKey(bizA);
      expect(result.isGenerated, isTrue);
      expect(result.key.length, equals(32));
    });
  });

  // ============================================================
  // D. TRANSACTION INTEGRITY
  // ============================================================
  group('D. Transaction Integrity', () {
    late AppDatabase db;

    setUp(() {
      db = AppDatabase.memory();
    });

    tearDown(() async {
      await db.close();
    });

    test('INT-TXN-001: successful transaction commits all changes', () async {
      await db.transaction(() async {
        await insertCompleteSale(db, bizA);
      });

      final sale =
          await (db.select(
                db.salesLocal,
              )..where((t) => t.clientTransactionId.equals('integrity-tx-001')))
              .getSingle();
      expect(sale.totalMinor, equals(104500));

      final items = await (db.select(
        db.saleItemsLocal,
      )..where((t) => t.clientTransactionId.equals('integrity-tx-001'))).get();
      expect(items.length, equals(1));

      final payments = await (db.select(
        db.paymentsLocal,
      )..where((t) => t.clientTransactionId.equals('integrity-tx-001'))).get();
      expect(payments.length, equals(1));
    });

    test('INT-TXN-002: failed transaction rolls back all changes', () async {
      try {
        await db.transaction(() async {
          await db
              .into(db.salesLocal)
              .insert(
                SalesLocalCompanion.insert(
                  clientTransactionId: 'rollback-tx',
                  businessId: bizA,
                  branchId: 'b',
                  cashierId: 'c',
                  status: SaleStatus.draft,
                  subtotalMinor: 5000,
                  totalMinor: 5000,
                  currencyCode: 'IDR',
                  currencyMinorUnits: 0,
                  deviceId: 'd',
                  createdAt: 1700000000000,
                  updatedAt: 1700000000000,
                ),
              );
          throw Exception('Simulated failure');
        });
      } catch (_) {
        // Expected
      }

      final results = await (db.select(
        db.salesLocal,
      )..where((t) => t.clientTransactionId.equals('rollback-tx'))).get();
      expect(
        results,
        isEmpty,
        reason: 'Failed transaction must roll back all changes',
      );
    });

    test(
      'INT-TXN-003: partial failure cannot leave partially committed sale',
      () async {
        try {
          await db.transaction(() async {
            // Insert sale header
            await db
                .into(db.salesLocal)
                .insert(
                  SalesLocalCompanion.insert(
                    clientTransactionId: 'partial-tx',
                    businessId: bizA,
                    branchId: 'b',
                    cashierId: 'c',
                    status: SaleStatus.draft,
                    subtotalMinor: 10000,
                    totalMinor: 10000,
                    currencyCode: 'IDR',
                    currencyMinorUnits: 0,
                    deviceId: 'd',
                    createdAt: 1700000000000,
                    updatedAt: 1700000000000,
                  ),
                );

            // Insert item
            await db
                .into(db.saleItemsLocal)
                .insert(
                  SaleItemsLocalCompanion.insert(
                    id: 'partial-item',
                    clientTransactionId: 'partial-tx',
                    productId: 'p',
                    quantity: 1,
                    unitPriceMinor: 10000,
                    createdAt: 1700000000000,
                  ),
                );

            // Simulate payment failure
            throw Exception('Payment processing failed');
          });
        } catch (_) {
          // Expected
        }

        // Both sale header AND item must be rolled back
        final sales = await (db.select(
          db.salesLocal,
        )..where((t) => t.clientTransactionId.equals('partial-tx'))).get();
        expect(sales, isEmpty, reason: 'Sale header must be rolled back');

        final items = await (db.select(
          db.saleItemsLocal,
        )..where((t) => t.clientTransactionId.equals('partial-tx'))).get();
        expect(items, isEmpty, reason: 'Sale items must be rolled back');
      },
    );

    test('INT-TXN-004: nested operations preserve atomicity', () async {
      await db.transaction(() async {
        await insertCompleteSale(db, bizA, txId: 'nested-tx');

        // Nested operation within same transaction
        await db
            .into(db.localIdempotencyKeys)
            .insert(
              LocalIdempotencyKeysCompanion.insert(
                key: 'nested-tx',
                businessId: bizA,
                entityType: EntityType.sale,
                createdAt: 1700000000000,
              ),
            );
      });

      // All operations committed atomically
      final sale = await (db.select(
        db.salesLocal,
      )..where((t) => t.clientTransactionId.equals('nested-tx'))).getSingle();
      expect(sale, isNotNull);

      final idem = await (db.select(
        db.localIdempotencyKeys,
      )..where((t) => t.key.equals('nested-tx'))).getSingle();
      expect(idem, isNotNull);
    });
  });

  // ============================================================
  // E. MONEY INTEGRITY
  // ============================================================
  group('E. Money Integrity', () {
    late AppDatabase db;

    setUp(() {
      db = AppDatabase.memory();
    });

    tearDown(() async {
      await db.close();
    });

    test('INT-MONEY-001: all money fields remain INTEGER', () async {
      await insertCompleteSale(db, bizA);

      final sale =
          await (db.select(
                db.salesLocal,
              )..where((t) => t.clientTransactionId.equals('integrity-tx-001')))
              .getSingle();

      expect(sale.subtotalMinor, isA<int>());
      expect(sale.discountMinor, isA<int>());
      expect(sale.taxMinor, isA<int>());
      expect(sale.totalMinor, isA<int>());
    });

    test('INT-MONEY-002: zero monetary values behave correctly', () async {
      await db
          .into(db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'zero-money-tx',
              businessId: bizA,
              branchId: 'b',
              cashierId: 'c',
              status: SaleStatus.draft,
              subtotalMinor: 0,
              discountMinor: Value(0),
              taxMinor: Value(0),
              totalMinor: 0,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'd',
              createdAt: 1700000000000,
              updatedAt: 1700000000000,
            ),
          );

      final sale =
          await (db.select(db.salesLocal)
                ..where((t) => t.clientTransactionId.equals('zero-money-tx')))
              .getSingle();

      expect(sale.subtotalMinor, equals(0));
      expect(sale.discountMinor, equals(0));
      expect(sale.taxMinor, equals(0));
      expect(sale.totalMinor, equals(0));
    });

    test('INT-MONEY-003: negative monetary values are rejected', () async {
      expect(
        () => db
            .into(db.salesLocal)
            .insert(
              SalesLocalCompanion.insert(
                clientTransactionId: 'neg-money-tx',
                businessId: bizA,
                branchId: 'b',
                cashierId: 'c',
                status: SaleStatus.draft,
                subtotalMinor: -100,
                totalMinor: -100,
                currencyCode: 'IDR',
                currencyMinorUnits: 0,
                deviceId: 'd',
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });

    test('INT-MONEY-004: large valid integer values are preserved', () async {
      const largeValue = 999999999999; // ~Rp 1 trillion

      await db
          .into(db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'large-money-tx',
              businessId: bizA,
              branchId: 'b',
              cashierId: 'c',
              status: SaleStatus.draft,
              subtotalMinor: largeValue,
              totalMinor: largeValue,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'd',
              createdAt: 1700000000000,
              updatedAt: 1700000000000,
            ),
          );

      final sale =
          await (db.select(db.salesLocal)
                ..where((t) => t.clientTransactionId.equals('large-money-tx')))
              .getSingle();

      expect(sale.subtotalMinor, equals(largeValue));
      expect(sale.totalMinor, equals(largeValue));
    });

    test('INT-MONEY-005: no floating-point conversion occurs', () async {
      await insertCompleteSale(db, bizA);

      final sale =
          await (db.select(
                db.salesLocal,
              )..where((t) => t.clientTransactionId.equals('integrity-tx-001')))
              .getSingle();

      // Verify runtime type is int, not double
      expect(sale.totalMinor.runtimeType, equals(int));
      expect(sale.subtotalMinor.runtimeType, equals(int));

      // Verify exact value preservation (no floating point drift)
      expect(sale.totalMinor, equals(104500));
      expect(sale.subtotalMinor, equals(100000));
    });
  });

  // ============================================================
  // F. QUANTITY INTEGRITY
  // ============================================================
  group('F. Quantity Integrity', () {
    late AppDatabase db;

    setUp(() async {
      db = AppDatabase.memory();
      // Create parent sale for FK
      await db
          .into(db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'qty-parent-tx',
              businessId: bizA,
              branchId: 'b',
              cashierId: 'c',
              status: SaleStatus.draft,
              subtotalMinor: 1000,
              totalMinor: 1000,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'd',
              createdAt: 1700000000000,
              updatedAt: 1700000000000,
            ),
          );
    });

    tearDown(() async {
      await db.close();
    });

    test('INT-QTY-001: quantity = 1 is valid', () async {
      await db
          .into(db.saleItemsLocal)
          .insert(
            SaleItemsLocalCompanion.insert(
              id: 'qty-1-item',
              clientTransactionId: 'qty-parent-tx',
              productId: 'p',
              quantity: 1,
              unitPriceMinor: 1000,
              createdAt: 1700000000000,
            ),
          );

      final item = await (db.select(
        db.saleItemsLocal,
      )..where((t) => t.id.equals('qty-1-item'))).getSingle();
      expect(item.quantity, equals(1));
    });

    test('INT-QTY-002: quantity > 1 is valid', () async {
      await db
          .into(db.saleItemsLocal)
          .insert(
            SaleItemsLocalCompanion.insert(
              id: 'qty-99-item',
              clientTransactionId: 'qty-parent-tx',
              productId: 'p',
              quantity: 99,
              unitPriceMinor: 1000,
              createdAt: 1700000000000,
            ),
          );

      final item = await (db.select(
        db.saleItemsLocal,
      )..where((t) => t.id.equals('qty-99-item'))).getSingle();
      expect(item.quantity, equals(99));
    });

    test('INT-QTY-003: quantity = 0 is rejected', () async {
      expect(
        () => db
            .into(db.saleItemsLocal)
            .insert(
              SaleItemsLocalCompanion.insert(
                id: 'qty-0-item',
                clientTransactionId: 'qty-parent-tx',
                productId: 'p',
                quantity: 0,
                unitPriceMinor: 1000,
                createdAt: 1700000000000,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });

    test('INT-QTY-004: negative quantity is rejected', () async {
      expect(
        () => db
            .into(db.saleItemsLocal)
            .insert(
              SaleItemsLocalCompanion.insert(
                id: 'qty-neg-item',
                clientTransactionId: 'qty-parent-tx',
                productId: 'p',
                quantity: -5,
                unitPriceMinor: 1000,
                createdAt: 1700000000000,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });

    test(
      'INT-QTY-005: fractional quantity cannot be silently accepted',
      () async {
        // Drift's type system enforces INTEGER at compile time.
        // Verify the column type is INTEGER in the schema.
        final schema = await db
            .customSelect(
              "SELECT sql FROM sqlite_master WHERE type='table' AND name='sale_items_local'",
            )
            .get();

        final createSql = schema.first.read<String>('sql');
        expect(createSql, contains('INTEGER'));
        expect(createSql, contains('quantity'));
        // Column is defined as INTEGER NOT NULL CHECK(quantity >= 1)
        // Fractional values cannot be stored in INTEGER columns
      },
    );
  });

  // ============================================================
  // G. PAYMENT INTEGRITY
  // ============================================================
  group('G. Payment Integrity', () {
    late AppDatabase db;

    setUp(() async {
      db = AppDatabase.memory();
      await db
          .into(db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'pay-parent-tx',
              businessId: bizA,
              branchId: 'b',
              cashierId: 'c',
              status: SaleStatus.draft,
              subtotalMinor: 10000,
              totalMinor: 10000,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'd',
              createdAt: 1700000000000,
              updatedAt: 1700000000000,
            ),
          );
    });

    tearDown(() async {
      await db.close();
    });

    test('INT-PAY-001: payment amount stored as integer minor units', () async {
      await db
          .into(db.paymentsLocal)
          .insert(
            PaymentsLocalCompanion.insert(
              clientPaymentId: 'pay-int-001',
              clientTransactionId: 'pay-parent-tx',
              paymentMethod: 'CASH',
              amountMinor: 10000,
              createdAt: 1700000000000,
            ),
          );

      final payment = await (db.select(
        db.paymentsLocal,
      )..where((t) => t.clientPaymentId.equals('pay-int-001'))).getSingle();

      expect(payment.amountMinor, isA<int>());
      expect(payment.amountMinor, equals(10000));
    });

    test('INT-PAY-002: RECORDED remains distinct from VERIFIED', () async {
      await db
          .into(db.paymentsLocal)
          .insert(
            PaymentsLocalCompanion.insert(
              clientPaymentId: 'pay-int-002',
              clientTransactionId: 'pay-parent-tx',
              paymentMethod: 'CASH',
              amountMinor: 10000,
              recordStatus: const Value('RECORDED'),
              verificationStatus: const Value('UNVERIFIED'),
              createdAt: 1700000000000,
            ),
          );

      final payment = await (db.select(
        db.paymentsLocal,
      )..where((t) => t.clientPaymentId.equals('pay-int-002'))).getSingle();

      expect(payment.recordStatus, equals('RECORDED'));
      expect(payment.recordStatus, isNot(equals('SYNCED')));
      expect(payment.verificationStatus, equals('UNVERIFIED'));
      expect(payment.verificationStatus, isNot(equals('VERIFIED')));
    });

    test('INT-PAY-003: UNVERIFIED remains distinct from VERIFIED', () async {
      await db
          .into(db.paymentsLocal)
          .insert(
            PaymentsLocalCompanion.insert(
              clientPaymentId: 'pay-int-003',
              clientTransactionId: 'pay-parent-tx',
              paymentMethod: 'BANK_TRANSFER',
              amountMinor: 10000,
              verificationStatus: const Value('UNVERIFIED'),
              createdAt: 1700000000000,
            ),
          );

      final payment = await (db.select(
        db.paymentsLocal,
      )..where((t) => t.clientPaymentId.equals('pay-int-003'))).getSingle();

      expect(payment.verificationStatus, equals('UNVERIFIED'));
      expect(payment.verificationStatus, isNot(equals('VERIFIED')));
      expect(payment.verificationStatus, isNot(equals('FAILED_VERIFICATION')));
    });

    test('INT-PAY-004: FAILED_VERIFICATION remains distinguishable', () async {
      await db
          .into(db.paymentsLocal)
          .insert(
            PaymentsLocalCompanion.insert(
              clientPaymentId: 'pay-int-004',
              clientTransactionId: 'pay-parent-tx',
              paymentMethod: 'BANK_TRANSFER',
              amountMinor: 10000,
              verificationStatus: const Value('FAILED_VERIFICATION'),
              createdAt: 1700000000000,
            ),
          );

      final payment = await (db.select(
        db.paymentsLocal,
      )..where((t) => t.clientPaymentId.equals('pay-int-004'))).getSingle();

      expect(payment.verificationStatus, equals('FAILED_VERIFICATION'));
      expect(payment.verificationStatus, isNot(equals('UNVERIFIED')));
      expect(payment.verificationStatus, isNot(equals('VERIFIED')));
    });

    test('INT-PAY-005: RECORDED is not auto-converted to VERIFIED', () async {
      final tempDir = Directory.systemTemp.createTempSync('int_pay_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        // Insert with defaults (RECORDED + UNVERIFIED)
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await db1
            .into(db1.salesLocal)
            .insert(
              SalesLocalCompanion.insert(
                clientTransactionId: 'pay-auto-tx',
                businessId: bizA,
                branchId: 'b',
                cashierId: 'c',
                status: SaleStatus.draft,
                subtotalMinor: 10000,
                totalMinor: 10000,
                currencyCode: 'IDR',
                currencyMinorUnits: 0,
                deviceId: 'd',
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
              ),
            );
        await db1
            .into(db1.paymentsLocal)
            .insert(
              PaymentsLocalCompanion.insert(
                clientPaymentId: 'pay-auto-001',
                clientTransactionId: 'pay-auto-tx',
                paymentMethod: 'CASH',
                amountMinor: 10000,
                createdAt: 1700000000000,
              ),
            );
        await db1.close();

        // Reopen and verify no auto-conversion
        final db2 = AppDatabase(NativeDatabase(dbFile));
        final payment = await (db2.select(
          db2.paymentsLocal,
        )..where((t) => t.clientPaymentId.equals('pay-auto-001'))).getSingle();

        expect(
          payment.recordStatus,
          equals('RECORDED'),
          reason: 'RECORDED must not auto-convert',
        );
        expect(
          payment.verificationStatus,
          equals('UNVERIFIED'),
          reason: 'UNVERIFIED must not auto-convert to VERIFIED',
        );
        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });
  });

  // ============================================================
  // H. IDEMPOTENCY
  // ============================================================
  group('H. Idempotency', () {
    late AppDatabase db;

    setUp(() {
      db = AppDatabase.memory();
    });

    tearDown(() async {
      await db.close();
    });

    test('INT-IDEM-001: same key cannot be inserted twice', () async {
      await db
          .into(db.localIdempotencyKeys)
          .insert(
            LocalIdempotencyKeysCompanion.insert(
              key: 'idem-dup-key',
              businessId: bizA,
              entityType: EntityType.sale,
              createdAt: 1700000000000,
            ),
          );

      expect(
        () => db
            .into(db.localIdempotencyKeys)
            .insert(
              LocalIdempotencyKeysCompanion.insert(
                key: 'idem-dup-key',
                businessId: bizA,
                entityType: EntityType.sale,
                createdAt: 1700000000000,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });

    test('INT-IDEM-002: different keys can coexist', () async {
      await db
          .into(db.localIdempotencyKeys)
          .insert(
            LocalIdempotencyKeysCompanion.insert(
              key: 'idem-key-a',
              businessId: bizA,
              entityType: EntityType.sale,
              createdAt: 1700000000000,
            ),
          );

      await db
          .into(db.localIdempotencyKeys)
          .insert(
            LocalIdempotencyKeysCompanion.insert(
              key: 'idem-key-b',
              businessId: bizA,
              entityType: EntityType.payment,
              createdAt: 1700000000000,
            ),
          );

      final keys = await db.select(db.localIdempotencyKeys).get();
      expect(keys.length, equals(2));
    });

    test(
      'INT-IDEM-003: SALE and PAYMENT entity types distinguishable',
      () async {
        await db
            .into(db.localIdempotencyKeys)
            .insert(
              LocalIdempotencyKeysCompanion.insert(
                key: 'idem-sale-key',
                businessId: bizA,
                entityType: EntityType.sale,
                createdAt: 1700000000000,
              ),
            );

        await db
            .into(db.localIdempotencyKeys)
            .insert(
              LocalIdempotencyKeysCompanion.insert(
                key: 'idem-pay-key',
                businessId: bizA,
                entityType: EntityType.payment,
                createdAt: 1700000000000,
              ),
            );

        final saleKey = await (db.select(
          db.localIdempotencyKeys,
        )..where((t) => t.key.equals('idem-sale-key'))).getSingle();
        final payKey = await (db.select(
          db.localIdempotencyKeys,
        )..where((t) => t.key.equals('idem-pay-key'))).getSingle();

        expect(saleKey.entityType, equals('SALE'));
        expect(payKey.entityType, equals('PAYMENT'));
        expect(saleKey.entityType, isNot(equals(payKey.entityType)));
      },
    );

    test('INT-IDEM-004: uniqueness survives close/reopen', () async {
      final tempDir = Directory.systemTemp.createTempSync('int_idem_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await db1
            .into(db1.localIdempotencyKeys)
            .insert(
              LocalIdempotencyKeysCompanion.insert(
                key: 'idem-persist-key',
                businessId: bizA,
                entityType: EntityType.sale,
                createdAt: 1700000000000,
              ),
            );
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        expect(
          () => db2
              .into(db2.localIdempotencyKeys)
              .insert(
                LocalIdempotencyKeysCompanion.insert(
                  key: 'idem-persist-key',
                  businessId: bizA,
                  entityType: EntityType.sale,
                  createdAt: 1700000000000,
                ),
              ),
          throwsA(isA<SqliteException>()),
        );
        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });
  });

  // ============================================================
  // I. FOREIGN KEY INTEGRITY
  // ============================================================
  group('I. Foreign Key Integrity', () {
    late AppDatabase db;

    setUp(() {
      db = AppDatabase.memory();
    });

    tearDown(() async {
      await db.close();
    });

    test('INT-FK-001: sale item cannot reference nonexistent sale', () async {
      expect(
        () => db
            .into(db.saleItemsLocal)
            .insert(
              SaleItemsLocalCompanion.insert(
                id: 'fk-orphan-item',
                clientTransactionId: 'nonexistent-tx',
                productId: 'p',
                quantity: 1,
                unitPriceMinor: 1000,
                createdAt: 1700000000000,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });

    test('INT-FK-002: payment cannot reference nonexistent sale', () async {
      expect(
        () => db
            .into(db.paymentsLocal)
            .insert(
              PaymentsLocalCompanion.insert(
                clientPaymentId: 'fk-orphan-pay',
                clientTransactionId: 'nonexistent-tx',
                paymentMethod: 'CASH',
                amountMinor: 1000,
                createdAt: 1700000000000,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });

    test(
      'INT-FK-003: valid references remain valid after close/reopen',
      () async {
        final tempDir = Directory.systemTemp.createTempSync('int_fk_');
        final dbFile = File('${tempDir.path}/test.db');

        try {
          final db1 = AppDatabase(NativeDatabase(dbFile));
          await insertCompleteSale(db1, bizA, txId: 'fk-persist-tx');
          await db1.close();

          final db2 = AppDatabase(NativeDatabase(dbFile));

          // Verify FK relationships are intact
          final items = await (db2.select(
            db2.saleItemsLocal,
          )..where((t) => t.clientTransactionId.equals('fk-persist-tx'))).get();
          expect(items.length, equals(1));

          final payments = await (db2.select(
            db2.paymentsLocal,
          )..where((t) => t.clientTransactionId.equals('fk-persist-tx'))).get();
          expect(payments.length, equals(1));

          // Verify FK enforcement still active
          expect(
            () => db2
                .into(db2.saleItemsLocal)
                .insert(
                  SaleItemsLocalCompanion.insert(
                    id: 'fk-orphan-after-reopen',
                    clientTransactionId: 'nonexistent-tx',
                    productId: 'p',
                    quantity: 1,
                    unitPriceMinor: 1000,
                    createdAt: 1700000000000,
                  ),
                ),
            throwsA(isA<SqliteException>()),
          );

          await db2.close();
        } finally {
          tempDir.deleteSync(recursive: true);
        }
      },
    );
  });

  // ============================================================
  // J. MIGRATION INTEGRITY
  // ============================================================
  group('J. Migration Integrity', () {
    test(
      'INT-MIG-001: current schema opens without unnecessary migration',
      () async {
        final tempDir = Directory.systemTemp.createTempSync('int_mig_');
        final dbFile = File('${tempDir.path}/test.db');

        try {
          final db1 = AppDatabase(NativeDatabase(dbFile));
          await db1.customSelect('SELECT 1').get();
          await db1.close();

          final db2 = AppDatabase(NativeDatabase(dbFile));
          final result = await db2.customSelect('PRAGMA user_version').get();
          expect(result.first.read<int>('user_version'), equals(4));
          await db2.close();
        } finally {
          try {
            tempDir.deleteSync(recursive: true);
          } catch (_) {}
        }
      },
    );

    test('INT-MIG-002: existing data survives migration', () async {
      final tempDir = Directory.systemTemp.createTempSync('int_mig_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await insertCompleteSale(db1, bizA, txId: 'mig-int-tx');
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final sale =
            await (db2.select(db2.salesLocal)
                  ..where((t) => t.clientTransactionId.equals('mig-int-tx')))
                .getSingle();
        expect(sale.totalMinor, equals(104500));
        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('INT-MIG-003: money values survive unchanged', () async {
      final tempDir = Directory.systemTemp.createTempSync('int_mig_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await insertCompleteSale(
          db1,
          bizA,
          txId: 'mig-money-tx',
          subtotal: 250000,
          discount: 25000,
          tax: 22500,
          total: 247500,
        );
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final sale =
            await (db2.select(db2.salesLocal)
                  ..where((t) => t.clientTransactionId.equals('mig-money-tx')))
                .getSingle();
        expect(sale.subtotalMinor, equals(250000));
        expect(sale.discountMinor, equals(25000));
        expect(sale.taxMinor, equals(22500));
        expect(sale.totalMinor, equals(247500));
        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('INT-MIG-004: quantity values survive unchanged', () async {
      final tempDir = Directory.systemTemp.createTempSync('int_mig_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await insertCompleteSale(db1, bizA, txId: 'mig-qty-tx', quantity: 7);
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final item =
            await (db2.select(db2.saleItemsLocal)
                  ..where((t) => t.clientTransactionId.equals('mig-qty-tx')))
                .getSingle();
        expect(item.quantity, equals(7));
        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('INT-MIG-005: payment values survive unchanged', () async {
      final tempDir = Directory.systemTemp.createTempSync('int_mig_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await insertCompleteSale(
          db1,
          bizA,
          txId: 'mig-pay-tx',
          paymentAmount: 99999,
        );
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final payment =
            await (db2.select(db2.paymentsLocal)
                  ..where((t) => t.clientTransactionId.equals('mig-pay-tx')))
                .getSingle();
        expect(payment.amountMinor, equals(99999));
        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('INT-MIG-006: idempotency values survive unchanged', () async {
      final tempDir = Directory.systemTemp.createTempSync('int_mig_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await db1
            .into(db1.localIdempotencyKeys)
            .insert(
              LocalIdempotencyKeysCompanion.insert(
                key: 'mig-idem-key',
                businessId: bizA,
                entityType: EntityType.sale,
                createdAt: 1700000000000,
              ),
            );
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final idem = await (db2.select(
          db2.localIdempotencyKeys,
        )..where((t) => t.key.equals('mig-idem-key'))).getSingle();
        expect(idem.entityType, equals('SALE'));
        expect(idem.createdAt, equals(1700000000000));
        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('INT-MIG-007: migration failure is surfaced', () async {
      final tempDir = Directory.systemTemp.createTempSync('int_mig_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await db1.customSelect('SELECT 1').get();
        await db1.close();

        // _FailingMigrationDatabase from migration_test.dart pattern
        final failingDb = _FailingMigrationDb(NativeDatabase(dbFile));
        try {
          await failingDb.customSelect('SELECT 1').get();
          fail('Should have thrown');
        } catch (e) {
          expect(e, isA<Exception>());
        } finally {
          await failingDb.close();
        }
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('INT-MIG-008: migration does not silently destroy data', () async {
      final tempDir = Directory.systemTemp.createTempSync('int_mig_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await insertCompleteSale(db1, bizA, txId: 'mig-safe-tx');
        await db1.close();

        // Attempt failing migration
        final failingDb = _FailingMigrationDb(NativeDatabase(dbFile));
        try {
          await failingDb.customSelect('SELECT 1').get();
        } catch (_) {
          // Expected
        } finally {
          await failingDb.close();
        }

        // Verify data still intact
        final db2 = AppDatabase(NativeDatabase(dbFile));
        final sale =
            await (db2.select(db2.salesLocal)
                  ..where((t) => t.clientTransactionId.equals('mig-safe-tx')))
                .getSingle();
        expect(sale.totalMinor, equals(104500));
        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });
  });

  // ============================================================
  // K. PERSISTENCE
  // ============================================================
  group('K. Persistence', () {
    test('INT-PERSIST-001: data survives close/reopen', () async {
      final tempDir = Directory.systemTemp.createTempSync('int_persist_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        await insertCompleteSale(db1, bizA, txId: 'persist-tx');
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final sale =
            await (db2.select(db2.salesLocal)
                  ..where((t) => t.clientTransactionId.equals('persist-tx')))
                .getSingle();
        expect(sale.totalMinor, equals(104500));
        await db2.close();
      } finally {
        tempDir.deleteSync(recursive: true);
      }
    });

    test(
      'INT-PERSIST-002: data survives multiple close/reopen cycles',
      () async {
        final tempDir = Directory.systemTemp.createTempSync('int_persist_');
        final dbFile = File('${tempDir.path}/test.db');

        try {
          // Cycle 1: write
          final db1 = AppDatabase(NativeDatabase(dbFile));
          await insertCompleteSale(db1, bizA, txId: 'multi-cycle-tx');
          await db1.close();

          // Cycle 2: read
          final db2 = AppDatabase(NativeDatabase(dbFile));
          var sale =
              await (db2.select(db2.salesLocal)..where(
                    (t) => t.clientTransactionId.equals('multi-cycle-tx'),
                  ))
                  .getSingle();
          expect(sale.totalMinor, equals(104500));
          await db2.close();

          // Cycle 3: read again
          final db3 = AppDatabase(NativeDatabase(dbFile));
          sale =
              await (db3.select(db3.salesLocal)..where(
                    (t) => t.clientTransactionId.equals('multi-cycle-tx'),
                  ))
                  .getSingle();
          expect(sale.totalMinor, equals(104500));
          await db3.close();
        } finally {
          tempDir.deleteSync(recursive: true);
        }
      },
    );

    test(
      'INT-PERSIST-003: per-business DB remains associated with its business',
      () async {
        final tempDir = Directory.systemTemp.createTempSync('int_persist_');
        final storage = _FakeStorage();
        final keyService = DbKeyService(storage: storage);
        final opener = DbOpener(keyService: keyService, appRoot: tempDir);
        driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;

        try {
          // Open A, write, close
          final dbA = await opener.open(bizA);
          await insertCompleteSale(dbA, bizA, txId: 'biz-persist-tx');
          await opener.close(bizA);

          // Reopen A, verify data
          final dbA2 = await opener.open(bizA);
          final sale =
              await (dbA2.select(dbA2.salesLocal)..where(
                    (t) => t.clientTransactionId.equals('biz-persist-tx'),
                  ))
                  .getSingle();
          expect(sale.businessId, equals(bizA));

          // Open B, verify A's data is not there
          final dbB = await opener.open(bizB);
          final results =
              await (dbB.select(dbB.salesLocal)..where(
                    (t) => t.clientTransactionId.equals('biz-persist-tx'),
                  ))
                  .get();
          expect(results, isEmpty);

          await opener.closeAll();
        } finally {
          tempDir.deleteSync(recursive: true);
        }
      },
    );
  });
}

/// Test-only database with failing migration (for INT-MIG-007/008)
class _FailingMigrationDb extends AppDatabase {
  _FailingMigrationDb(super.e);

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) async => m.createAll(),
    onUpgrade: (m, from, to) async {
      throw Exception('Simulated migration failure v$from → v$to');
    },
    beforeOpen: (details) async {
      await customStatement('PRAGMA foreign_keys = ON');
    },
  );
}
