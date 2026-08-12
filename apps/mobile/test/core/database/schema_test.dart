import 'package:drift/drift.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart' show SqliteException;
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/database/tables/sales_local.dart';
import 'package:biz_erp_mobile/core/database/tables/local_idempotency_keys.dart';

void main() {
  late AppDatabase db;

  setUp(() {
    db = AppDatabase.memory();
  });

  tearDown(() async {
    await db.close();
  });

  group('Schema creation', () {
    test('all tables are created', () async {
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
    });
  });

  group('sales_local constraints', () {
    test('valid sale can be inserted', () async {
      await db
          .into(db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'test-tx-001',
              businessId: 'biz-001',
              branchId: 'branch-001',
              cashierId: 'cashier-001',
              status: SaleStatus.draft,
              subtotalMinor: 10000,
              discountMinor: Value(0),
              taxMinor: Value(1000),
              totalMinor: 11000,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'device-001',
              createdAt: DateTime.now().millisecondsSinceEpoch,
              updatedAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      final sale = await (db.select(
        db.salesLocal,
      )..where((t) => t.clientTransactionId.equals('test-tx-001'))).getSingle();

      expect(sale.clientTransactionId, 'test-tx-001');
      expect(sale.totalMinor, 11000);
      expect(sale.status, 'DRAFT');
    });

    test('duplicate client_transaction_id is rejected', () async {
      final companion = SalesLocalCompanion.insert(
        clientTransactionId: 'test-tx-dup',
        businessId: 'biz-001',
        branchId: 'branch-001',
        cashierId: 'cashier-001',
        status: SaleStatus.draft,
        subtotalMinor: 5000,
        totalMinor: 5000,
        currencyCode: 'IDR',
        currencyMinorUnits: 0,
        deviceId: 'device-001',
        createdAt: DateTime.now().millisecondsSinceEpoch,
        updatedAt: DateTime.now().millisecondsSinceEpoch,
      );

      await db.into(db.salesLocal).insert(companion);

      expect(
        () => db.into(db.salesLocal).insert(companion),
        throwsA(isA<SqliteException>()),
      );
    });

    test('negative total_minor is rejected', () async {
      expect(
        () => db
            .into(db.salesLocal)
            .insert(
              SalesLocalCompanion.insert(
                clientTransactionId: 'test-tx-neg',
                businessId: 'biz-001',
                branchId: 'branch-001',
                cashierId: 'cashier-001',
                status: SaleStatus.draft,
                subtotalMinor: 5000,
                totalMinor: -100,
                currencyCode: 'IDR',
                currencyMinorUnits: 0,
                deviceId: 'device-001',
                createdAt: DateTime.now().millisecondsSinceEpoch,
                updatedAt: DateTime.now().millisecondsSinceEpoch,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });

    test('invalid status is rejected', () async {
      expect(
        () => db
            .into(db.salesLocal)
            .insert(
              SalesLocalCompanion.insert(
                clientTransactionId: 'test-tx-bad-status',
                businessId: 'biz-001',
                branchId: 'branch-001',
                cashierId: 'cashier-001',
                status: 'INVALID_STATUS',
                subtotalMinor: 5000,
                totalMinor: 5000,
                currencyCode: 'IDR',
                currencyMinorUnits: 0,
                deviceId: 'device-001',
                createdAt: DateTime.now().millisecondsSinceEpoch,
                updatedAt: DateTime.now().millisecondsSinceEpoch,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });
  });

  group('sale_items_local constraints', () {
    test('quantity >= 1 is enforced', () async {
      await db
          .into(db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'parent-tx',
              businessId: 'biz-001',
              branchId: 'branch-001',
              cashierId: 'cashier-001',
              status: SaleStatus.draft,
              subtotalMinor: 5000,
              totalMinor: 5000,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'device-001',
              createdAt: DateTime.now().millisecondsSinceEpoch,
              updatedAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      expect(
        () => db
            .into(db.saleItemsLocal)
            .insert(
              SaleItemsLocalCompanion.insert(
                id: 'item-001',
                clientTransactionId: 'parent-tx',
                productId: 'prod-001',
                quantity: 0,
                unitPriceMinor: 5000,
                createdAt: DateTime.now().millisecondsSinceEpoch,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });

    test('quantity >= 1 is accepted', () async {
      await db
          .into(db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'parent-tx-2',
              businessId: 'biz-001',
              branchId: 'branch-001',
              cashierId: 'cashier-001',
              status: SaleStatus.draft,
              subtotalMinor: 5000,
              totalMinor: 5000,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'device-001',
              createdAt: DateTime.now().millisecondsSinceEpoch,
              updatedAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      await db
          .into(db.saleItemsLocal)
          .insert(
            SaleItemsLocalCompanion.insert(
              id: 'item-002',
              clientTransactionId: 'parent-tx-2',
              productId: 'prod-001',
              quantity: 1,
              unitPriceMinor: 5000,
              createdAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      final item = await (db.select(
        db.saleItemsLocal,
      )..where((t) => t.id.equals('item-002'))).getSingle();

      expect(item.quantity, 1);
    });

    test('FK to nonexistent sale is rejected', () async {
      expect(
        () => db
            .into(db.saleItemsLocal)
            .insert(
              SaleItemsLocalCompanion.insert(
                id: 'item-orphan',
                clientTransactionId: 'nonexistent-tx',
                productId: 'prod-001',
                quantity: 1,
                unitPriceMinor: 5000,
                createdAt: DateTime.now().millisecondsSinceEpoch,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });
  });

  group('payments_local constraints', () {
    test('default verification_status is UNVERIFIED', () async {
      await db
          .into(db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'pay-parent-tx',
              businessId: 'biz-001',
              branchId: 'branch-001',
              cashierId: 'cashier-001',
              status: SaleStatus.draft,
              subtotalMinor: 10000,
              totalMinor: 10000,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'device-001',
              createdAt: DateTime.now().millisecondsSinceEpoch,
              updatedAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      await db
          .into(db.paymentsLocal)
          .insert(
            PaymentsLocalCompanion.insert(
              clientPaymentId: 'pay-001',
              clientTransactionId: 'pay-parent-tx',
              paymentMethod: 'CASH',
              amountMinor: 10000,
              createdAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      final payment = await (db.select(
        db.paymentsLocal,
      )..where((t) => t.clientPaymentId.equals('pay-001'))).getSingle();

      expect(payment.recordStatus, 'RECORDED');
      expect(payment.verificationStatus, 'UNVERIFIED');
    });

    test('negative amount_minor is rejected', () async {
      await db
          .into(db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'pay-parent-tx-2',
              businessId: 'biz-001',
              branchId: 'branch-001',
              cashierId: 'cashier-001',
              status: SaleStatus.draft,
              subtotalMinor: 10000,
              totalMinor: 10000,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'device-001',
              createdAt: DateTime.now().millisecondsSinceEpoch,
              updatedAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      expect(
        () => db
            .into(db.paymentsLocal)
            .insert(
              PaymentsLocalCompanion.insert(
                clientPaymentId: 'pay-neg',
                clientTransactionId: 'pay-parent-tx-2',
                paymentMethod: 'CASH',
                amountMinor: -500,
                createdAt: DateTime.now().millisecondsSinceEpoch,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });

    test('invalid verification_status is rejected', () async {
      await db
          .into(db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'pay-parent-tx-3',
              businessId: 'biz-001',
              branchId: 'branch-001',
              cashierId: 'cashier-001',
              status: SaleStatus.draft,
              subtotalMinor: 10000,
              totalMinor: 10000,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'device-001',
              createdAt: DateTime.now().millisecondsSinceEpoch,
              updatedAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      expect(
        () => db
            .into(db.paymentsLocal)
            .insert(
              PaymentsLocalCompanion.insert(
                clientPaymentId: 'pay-bad-status',
                clientTransactionId: 'pay-parent-tx-3',
                paymentMethod: 'CASH',
                amountMinor: 10000,
                verificationStatus: const Value('INVALID'),
                createdAt: DateTime.now().millisecondsSinceEpoch,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });
  });

  group('local_idempotency_keys constraints', () {
    test('unique key is enforced', () async {
      await db
          .into(db.localIdempotencyKeys)
          .insert(
            LocalIdempotencyKeysCompanion.insert(
              key: 'idem-key-001',
              businessId: 'biz-001',
              entityType: EntityType.sale,
              createdAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      expect(
        () => db
            .into(db.localIdempotencyKeys)
            .insert(
              LocalIdempotencyKeysCompanion.insert(
                key: 'idem-key-001',
                businessId: 'biz-001',
                entityType: EntityType.sale,
                createdAt: DateTime.now().millisecondsSinceEpoch,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });

    test('invalid entity_type is rejected', () async {
      expect(
        () => db
            .into(db.localIdempotencyKeys)
            .insert(
              LocalIdempotencyKeysCompanion.insert(
                key: 'idem-key-bad-type',
                businessId: 'biz-001',
                entityType: 'INVALID_TYPE',
                createdAt: DateTime.now().millisecondsSinceEpoch,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });
  });
}
