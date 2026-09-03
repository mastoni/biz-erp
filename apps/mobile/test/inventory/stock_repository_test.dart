// MOB-INV-001 through MOB-INV-010: StockRepository unit tests

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/inventory/data/stock_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';

void main() {
  const biz = '11111111-1111-1111-1111-111111111111';
  const branch = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

  late AppDatabase db;
  late StockRepository repo;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    repo = StockRepository(db);
  });

  tearDown(() async => await db.close());

  group('MOB-INV Data Layer', () {
    test('MOB-INV-001: applyStocksPull upserts stock DTOs into local cache', () async {
      final items = [
        StockWithProductDto(
          id: 'stock-1',
          businessId: biz,
          branchId: branch,
          productId: 'prod-1',
          productName: 'Test Product',
          sku: 'SKU-001',
          category: 'Test',
          barcode: '8991002123456',
          priceMinor: 10000,
          costMinor: 7000,
          quantity: 50,
          serverVersion: 1,
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        ),
        StockWithProductDto(
          id: 'stock-2',
          businessId: biz,
          branchId: branch,
          productId: 'prod-2',
          productName: 'Low Stock Item',
          priceMinor: 5000,
          quantity: 3,
          serverVersion: 1,
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        ),
      ];

      final count = await repo.applyStocksPull(items, biz, branch);
      expect(count, 2);

      final stocks = await repo.listStocks(biz, branch);
      expect(stocks.length, 2);
      expect(stocks.any((s) => s.productId == 'prod-1' && s.quantity == 50), isTrue);
      expect(stocks.any((s) => s.productId == 'prod-2' && s.quantity == 3), isTrue);
    });

    test('MOB-INV-002: applyStocksPull replaces stale data with server state', () async {
      // Insert old data
      await repo.applyStocksPull([
        StockWithProductDto(
          id: 'stock-1',
          businessId: biz,
          branchId: branch,
          productId: 'prod-1',
          productName: 'Old Name',
          priceMinor: 10000,
          quantity: 50,
          serverVersion: 1,
        ),
      ], biz, branch);

      // Server sends updated data with same productId but different name/quantity
      await repo.applyStocksPull([
        StockWithProductDto(
          id: 'stock-1',
          businessId: biz,
          branchId: branch,
          productId: 'prod-1',
          productName: 'Updated Name',
          priceMinor: 15000,
          quantity: 75,
          serverVersion: 2,
        ),
      ], biz, branch);

      final stocks = await repo.listStocks(biz, branch);
      expect(stocks.length, 1);
      expect(stocks.first.productName, 'Updated Name');
      expect(stocks.first.quantity, 75);
      expect(stocks.first.priceMinor, 15000);
      expect(stocks.first.serverVersion, 2);
    });

    test('MOB-INV-003: getStockByProductId returns correct stock', () async {
      await repo.applyStocksPull([
        StockWithProductDto(
          id: 'stock-1',
          businessId: biz,
          branchId: branch,
          productId: 'prod-1',
          productName: 'Product A',
          priceMinor: 10000,
          quantity: 50,
          serverVersion: 1,
        ),
        StockWithProductDto(
          id: 'stock-2',
          businessId: biz,
          branchId: branch,
          productId: 'prod-2',
          productName: 'Product B',
          priceMinor: 5000,
          quantity: 3,
          serverVersion: 1,
        ),
      ], biz, branch);

      final stock = await repo.getStockByProductId(biz, branch, 'prod-1');
      expect(stock, isNotNull);
      expect(stock!.productName, 'Product A');
      expect(stock.quantity, 50);

      final notFound = await repo.getStockByProductId(biz, branch, 'nonexistent');
      expect(notFound, isNull);
    });

    test('MOB-INV-004: getStockSummary computes local derived summary matching LOW_STOCK_THRESHOLD=5', () async {
      await repo.applyStocksPull([
        StockWithProductDto(
          id: 'stock-1', businessId: biz, branchId: branch,
          productId: 'p1', productName: 'High Stock', priceMinor: 10000,
          costMinor: 7000, quantity: 100, serverVersion: 1,
        ),
        StockWithProductDto(
          id: 'stock-2', businessId: biz, branchId: branch,
          productId: 'p2', productName: 'Low Stock', priceMinor: 5000,
          costMinor: 3000, quantity: 3, serverVersion: 1,
        ),
        StockWithProductDto(
          id: 'stock-3', businessId: biz, branchId: branch,
          productId: 'p3', productName: 'Out of Stock', priceMinor: 8000,
          costMinor: 5000, quantity: 0, serverVersion: 1,
        ),
        StockWithProductDto(
          id: 'stock-4', businessId: biz, branchId: branch,
          productId: 'p4', productName: 'Low Border', priceMinor: 2000,
          costMinor: 1000, quantity: 5, serverVersion: 1,
        ),
      ], biz, branch);

      final summary = await repo.getStockSummary(biz, branch);
      // totalStockValueMinor = 7000*100 + 3000*3 + 5000*0 + 1000*5 = 700000 + 9000 + 0 + 5000 = 714000
      expect(summary.totalStockValueMinor, 714000);
      expect(summary.lowStockCount, 2); // qty 3 (low) and qty 5 (low, boundary)
      expect(summary.outOfStockCount, 1); // qty 0
      expect(summary.totalSkus, 4);
    });

    test('MOB-INV-005: listMovements stores and retrieves movement history', () async {
      final items = [
        StockMovementDto(
          id: 'mov-1',
          businessId: biz,
          branchId: branch,
          productId: 'prod-1',
          quantity: 50,
          movementType: 'STOCK_IN',
          reference: 'PO/001',
          actor: 'user-1',
          timestamp: 1700000000000,
        ),
        StockMovementDto(
          id: 'mov-2',
          businessId: biz,
          branchId: branch,
          productId: 'prod-1',
          quantity: -10,
          movementType: 'ADJUSTMENT',
          reference: 'Stock take',
          actor: 'owner-1',
          timestamp: 1700000001000,
        ),
      ];

      await repo.applyMovementsPull(items, biz, branch);
      final movements = await repo.listMovements(biz, branch, productId: 'prod-1');
      expect(movements.length, 2);
      expect(movements.any((m) => m.id == 'mov-1' && m.quantity == 50), isTrue);
      expect(movements.any((m) => m.id == 'mov-2' && m.quantity == -10), isTrue);
    });

    test('MOB-INV-006: listStocks is scoped to correct business + branch', () async {
      await repo.applyStocksPull([
        StockWithProductDto(
          id: 'stock-1', businessId: biz, branchId: branch,
          productId: 'p1', productName: 'B1-P1', priceMinor: 10000, quantity: 50, serverVersion: 1,
        ),
        StockWithProductDto(
          id: 'stock-2', businessId: biz, branchId: 'other-branch',
          productId: 'p2', productName: 'B1-OB', priceMinor: 5000, quantity: 30, serverVersion: 1,
        ),
      ], biz, branch);

      final results = await repo.listStocks(biz, branch);
      expect(results.length, 1);
      expect(results.first.productId, 'p1');
    });

    test('MOB-INV-007: clearBranch removes stocks and movements', () async {
      await repo.applyStocksPull([
        StockWithProductDto(
          id: 'stock-1', businessId: biz, branchId: branch,
          productId: 'p1', productName: 'Product', priceMinor: 10000, quantity: 50, serverVersion: 1,
        ),
      ], biz, branch);
      await repo.applyMovementsPull([
        StockMovementDto(
          id: 'mov-1', businessId: biz, branchId: branch,
          productId: 'p1', quantity: 50, movementType: 'STOCK_IN', actor: 'user-1',
        ),
      ], biz, branch);

      await repo.clearBranch(biz, branch);

      expect(await repo.listStocks(biz, branch), isEmpty);
      expect(await repo.listMovements(biz, branch), isEmpty);
    });

    test('MOB-INV-008: maxServerVersion returns highest server_version', () async {
      await repo.applyStocksPull([
        StockWithProductDto(id: 's1', businessId: biz, branchId: branch, productId: 'p1', productName: 'A', priceMinor: 1000, quantity: 10, serverVersion: 3),
        StockWithProductDto(id: 's2', businessId: biz, branchId: branch, productId: 'p2', productName: 'B', priceMinor: 2000, quantity: 20, serverVersion: 5),
        StockWithProductDto(id: 's3', businessId: biz, branchId: branch, productId: 'p3', productName: 'C', priceMinor: 3000, quantity: 0, serverVersion: 1),
      ], biz, branch);

      expect(await repo.maxServerVersion(biz, branch), 5);
    });
  });
}
