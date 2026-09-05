import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/sales/data/sale_repository.dart';

void main() {
  const bizId = '11111111-1111-1111-1111-111111111111';
  const otherBizId = '22222222-2222-2222-2222-222222222222';
  const branchId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const otherBranchId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

  late AppDatabase db;
  late SaleRepository repo;

  setUp(() async {
    db = AppDatabase(NativeDatabase.memory());
    repo = SaleRepository(db);

    // Seed customer and products
    await db.into(db.customersLocal).insert(
      CustomersLocalCompanion.insert(
        id: 'cust-1',
        businessId: bizId,
        name: 'Budi Santoso',
      ),
    );

    await db.into(db.productsLocal).insert(
      ProductsLocalCompanion.insert(
        id: 'prod-1',
        businessId: bizId,
        name: 'Kopi Susu Gula Aren',
        priceMinor: 1800000,
      ),
    );

    await db.into(db.productsLocal).insert(
      ProductsLocalCompanion.insert(
        id: 'prod-2',
        businessId: bizId,
        name: 'Croissant Cokelat',
        priceMinor: 2500000,
      ),
    );

    // Seed Sale 1 (Today, Branch A)
    await db.into(db.salesLocal).insert(
      SalesLocalCompanion.insert(
        clientTransactionId: 'sale-001-uuid',
        businessId: bizId,
        branchId: branchId,
        cashierId: 'cashier-01',
        customerId: const Value('cust-1'),
        receiptNumber: const Value('REC/2026/09/001'),
        status: 'SYNCED',
        subtotalMinor: 4300000,
        discountMinor: const Value(300000),
        taxMinor: const Value(400000),
        totalMinor: 4400000,
        currencyCode: 'IDR',
        currencyMinorUnits: 0,
        deviceId: 'device-01',
        createdAt: 1725500000000, // T1
        updatedAt: 1725500000000,
        syncedAt: const Value(1725500010000),
      ),
    );

    await db.into(db.saleItemsLocal).insert(
      SaleItemsLocalCompanion.insert(
        id: 'item-001',
        clientTransactionId: 'sale-001-uuid',
        productId: 'prod-1',
        quantity: 1,
        unitPriceMinor: 1800000,
        discountMinor: const Value(0),
        createdAt: 1725500000000,
      ),
    );

    await db.into(db.saleItemsLocal).insert(
      SaleItemsLocalCompanion.insert(
        id: 'item-002',
        clientTransactionId: 'sale-001-uuid',
        productId: 'prod-2',
        quantity: 1,
        unitPriceMinor: 2500000,
        discountMinor: const Value(300000),
        createdAt: 1725500000000,
      ),
    );

    // Seed Sale 2 (Yesterday, Branch A, Pending Sync, No Customer)
    await db.into(db.salesLocal).insert(
      SalesLocalCompanion.insert(
        clientTransactionId: 'sale-002-uuid',
        businessId: bizId,
        branchId: branchId,
        cashierId: 'cashier-01',
        receiptNumber: const Value('REC/2026/09/002'),
        status: 'PENDING_SYNC',
        subtotalMinor: 1800000,
        discountMinor: const Value(0),
        taxMinor: const Value(0),
        totalMinor: 1800000,
        currencyCode: 'IDR',
        currencyMinorUnits: 0,
        deviceId: 'device-01',
        createdAt: 1725400000000, // T0
        updatedAt: 1725400000000,
      ),
    );

    // Seed Sale 3 (Other Branch B)
    await db.into(db.salesLocal).insert(
      SalesLocalCompanion.insert(
        clientTransactionId: 'sale-003-other-branch',
        businessId: bizId,
        branchId: otherBranchId,
        cashierId: 'cashier-02',
        receiptNumber: const Value('REC/2026/09/003'),
        status: 'SYNCED',
        subtotalMinor: 1000000,
        totalMinor: 1000000,
        currencyCode: 'IDR',
        currencyMinorUnits: 0,
        deviceId: 'device-02',
        createdAt: 1725500000000,
        updatedAt: 1725500000000,
      ),
    );

    // Seed Sale 4 (Other Business)
    await db.into(db.salesLocal).insert(
      SalesLocalCompanion.insert(
        clientTransactionId: 'sale-004-other-biz',
        businessId: otherBizId,
        branchId: branchId,
        cashierId: 'cashier-03',
        status: 'SYNCED',
        subtotalMinor: 5000000,
        totalMinor: 5000000,
        currencyCode: 'IDR',
        currencyMinorUnits: 0,
        deviceId: 'device-03',
        createdAt: 1725500000000,
        updatedAt: 1725500000000,
      ),
    );
  });

  tearDown(() async {
    await db.close();
  });

  group('SaleRepository Unit Tests', () {
    test('MOB-SALES-001: listSales returns sales for specified business and branch ordered by date desc', () async {
      final sales = await repo.listSales(
        businessId: bizId,
        branchId: branchId,
      );

      expect(sales.length, 2);
      expect(sales.first.clientTransactionId, 'sale-001-uuid');
      expect(sales.first.receiptNumber, 'REC/2026/09/001');
      expect(sales.first.customerName, 'Budi Santoso');
      expect(sales.first.totalMinor, 4400000);
      expect(sales.first.isSynced, isTrue);

      expect(sales[1].clientTransactionId, 'sale-002-uuid');
      expect(sales[1].isPending, isTrue);
    });

    test('MOB-SALES-002: branch and tenant isolation enforces zero cross-talk', () async {
      final salesBranchA = await repo.listSales(
        businessId: bizId,
        branchId: branchId,
      );
      expect(salesBranchA.any((s) => s.clientTransactionId == 'sale-003-other-branch'), isFalse);
      expect(salesBranchA.any((s) => s.clientTransactionId == 'sale-004-other-biz'), isFalse);

      final salesBranchB = await repo.listSales(
        businessId: bizId,
        branchId: otherBranchId,
      );
      expect(salesBranchB.length, 1);
      expect(salesBranchB.first.clientTransactionId, 'sale-003-other-branch');
    });

    test('MOB-SALES-003: date range filtering filters sales correctly', () async {
      final salesAfterT0 = await repo.listSales(
        businessId: bizId,
        branchId: branchId,
        startDate: DateTime.fromMillisecondsSinceEpoch(1725450000000),
      );

      expect(salesAfterT0.length, 1);
      expect(salesAfterT0.first.clientTransactionId, 'sale-001-uuid');
    });

    test('MOB-SALES-004: search query filters by receipt number and client transaction ID', () async {
      final searchResult = await repo.listSales(
        businessId: bizId,
        branchId: branchId,
        searchQuery: '002',
      );

      expect(searchResult.length, 1);
      expect(searchResult.first.clientTransactionId, 'sale-002-uuid');

      final notFound = await repo.listSales(
        businessId: bizId,
        branchId: branchId,
        searchQuery: 'REC-999999',
      );
      expect(notFound.isEmpty, isTrue);
    });

    test('MOB-SALES-005: getSaleById resolves customer and all line items with product names', () async {
      final sale = await repo.getSaleById('sale-001-uuid', businessId: bizId);

      expect(sale, isNotNull);
      expect(sale!.customerName, 'Budi Santoso');
      expect(sale.items.length, 2);

      final item1 = sale.items.firstWhere((i) => i.productId == 'prod-1');
      expect(item1.productName, 'Kopi Susu Gula Aren');
      expect(item1.quantity, 1);
      expect(item1.unitPriceMinor, 1800000);
      expect(item1.subtotalMinor, 1800000);

      final item2 = sale.items.firstWhere((i) => i.productId == 'prod-2');
      expect(item2.productName, 'Croissant Cokelat');
      expect(item2.discountMinor, 300000);
      expect(item2.subtotalMinor, 2200000);
    });

    test('MOB-SALES-006: getSalesSummary calculates total sales and pending counts', () async {
      final summary = await repo.getSalesSummary(
        businessId: bizId,
        branchId: branchId,
      );

      expect(summary['totalCount'], 2);
      expect(summary['totalAmountMinor'], 6200000); // 4400000 + 1800000
      expect(summary['pendingCount'], 1);
    });
  });
}
