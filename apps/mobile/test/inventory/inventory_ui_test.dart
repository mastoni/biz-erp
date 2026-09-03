// MOB-INV UI tests: authorization gating and offline display

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/inventory/data/stock_repository.dart';
import 'package:biz_erp_mobile/inventory/presentation/stock_list_screen.dart';
import 'package:biz_erp_mobile/inventory/presentation/stock_detail_screen.dart';

const biz = '11111111-1111-4111-a111-111111111111';
const branch = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

class _UiMockApi implements SyncApiClient {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late AppDatabase db;
  late StockRepository stockRepo;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    stockRepo = StockRepository(db);
  });

  tearDown(() async => await db.close());

  testWidgets('MOB-INV-001: stock list shows products with low stock highlighting', (tester) async {
    await stockRepo.applyStocksPull([
      StockWithProductDto(
        id: 'stock-1', businessId: biz, branchId: branch,
        productId: 'p1', productName: 'High Stock Product', priceMinor: 10000,
        costMinor: 7000, quantity: 100, serverVersion: 1,
      ),
      StockWithProductDto(
        id: 'stock-2', businessId: biz, branchId: branch,
        productId: 'p2', productName: 'Low Stock Product', priceMinor: 5000,
        costMinor: 3000, quantity: 3, serverVersion: 1,
      ),
      StockWithProductDto(
        id: 'stock-3', businessId: biz, branchId: branch,
        productId: 'p3', productName: 'Out of Stock Product', priceMinor: 8000,
        costMinor: 5000, quantity: 0, serverVersion: 1,
      ),
    ], biz, branch);

    await tester.pumpWidget(
      MaterialApp(
        home: StockListScreen(
          businessId: biz,
          branchId: branch,
          stockRepo: stockRepo,
          apiClient: _UiMockApi(),
          userRole: 'CASHIER',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('High Stock Product'), findsOneWidget);
    expect(find.text('Low Stock Product'), findsOneWidget);
    expect(find.text('Out of Stock Product'), findsOneWidget);

    // Verify quantities displayed
    expect(find.text('100'), findsWidgets);
    expect(find.text('3'), findsWidgets);
    expect(find.text('0'), findsOneWidget);

    // Low stock and out-of-stock should have status indicators
    expect(find.text('Stok Rendah'), findsOneWidget);
    expect(find.text('Habis'), findsOneWidget);
  });

  testWidgets('MOB-INV-002: OWNER role sees adjustment button on detail screen', (tester) async {
    await stockRepo.applyStocksPull([
      StockWithProductDto(
        id: 'stock-1', businessId: biz, branchId: branch,
        productId: 'p1', productName: 'Test Product', priceMinor: 10000,
        costMinor: 7000, quantity: 50, serverVersion: 1,
      ),
    ], biz, branch);

    await tester.pumpWidget(
      MaterialApp(
        home: StockDetailScreen(
          businessId: biz,
          branchId: branch,
          productId: 'p1',
          stockRepo: stockRepo,
          apiClient: _UiMockApi(),
          userRole: 'OWNER',
        ),
      ),
    );
    await tester.pumpAndSettle();

    // The adjustment button (tooltip 'Sesuaikan Stok') should be visible
    expect(find.byTooltip('Sesuaikan Stok'), findsOneWidget);
  });

  testWidgets('MOB-INV-003: CASHIER role does NOT see adjustment button on detail screen', (tester) async {
    await stockRepo.applyStocksPull([
      StockWithProductDto(
        id: 'stock-1', businessId: biz, branchId: branch,
        productId: 'p1', productName: 'Test Product', priceMinor: 10000,
        costMinor: 7000, quantity: 50, serverVersion: 1,
      ),
    ], biz, branch);

    await tester.pumpWidget(
      MaterialApp(
        home: StockDetailScreen(
          businessId: biz,
          branchId: branch,
          productId: 'p1',
          stockRepo: stockRepo,
          apiClient: _UiMockApi(),
          userRole: 'CASHIER',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byTooltip('Sesuaikan Stok'), findsNothing);
  });

  testWidgets('MOB-INV-004: detail screen shows movement history after sync', (tester) async {
    await stockRepo.applyStocksPull([
      StockWithProductDto(
        id: 'stock-1', businessId: biz, branchId: branch,
        productId: 'p1', productName: 'Test Product', priceMinor: 10000,
        costMinor: 7000, quantity: 50, serverVersion: 1,
      ),
    ], biz, branch);

    await stockRepo.applyMovementsPull([
      StockMovementDto(
        id: 'mov-1', businessId: biz, branchId: branch,
        productId: 'p1', quantity: 50, movementType: 'STOCK_IN',
        reference: 'PO/001', actor: 'owner-1', timestamp: 1700000000000,
      ),
      StockMovementDto(
        id: 'mov-2', businessId: biz, branchId: branch,
        productId: 'p1', quantity: -10, movementType: 'ADJUSTMENT',
        reference: 'Stock take', actor: 'owner-1', timestamp: 1700000001000,
      ),
    ], biz, branch);

    await tester.pumpWidget(
      MaterialApp(
        home: StockDetailScreen(
          businessId: biz,
          branchId: branch,
          productId: 'p1',
          stockRepo: stockRepo,
          apiClient: _UiMockApi(),
          userRole: 'OWNER',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Riwayat Pergerakan Stok'), findsOneWidget);
    expect(find.text('STOCK_IN'), findsOneWidget);
    expect(find.text('ADJUSTMENT'), findsWidgets);
    expect(find.text('PO/001'), findsOneWidget);
    expect(find.text('Stock take'), findsOneWidget);
  });

  testWidgets('MOB-INV-005: offline stock list still displays cached data', (tester) async {
    await stockRepo.applyStocksPull([
      StockWithProductDto(
        id: 'stock-1', businessId: biz, branchId: branch,
        productId: 'p1', productName: 'Cached Product', priceMinor: 10000,
        quantity: 25, serverVersion: 1,
      ),
    ], biz, branch);

    await tester.pumpWidget(
      MaterialApp(
        home: StockListScreen(
          businessId: biz,
          branchId: branch,
          stockRepo: stockRepo,
          apiClient: _UiMockApi(),
          userRole: 'CASHIER',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Cached Product'), findsOneWidget);
    expect(find.text('25'), findsOneWidget);
  });

  testWidgets('MOB-INV-006: low-stock threshold boundary (qty=5 is low, qty=6 is normal)', (tester) async {
    await stockRepo.applyStocksPull([
      StockWithProductDto(
        id: 'stock-1', businessId: biz, branchId: branch,
        productId: 'p1', productName: 'Boundary Low', priceMinor: 1000,
        quantity: 5, serverVersion: 1,
      ),
      StockWithProductDto(
        id: 'stock-2', businessId: biz, branchId: branch,
        productId: 'p2', productName: 'Normal Stock', priceMinor: 2000,
        quantity: 6, serverVersion: 1,
      ),
    ], biz, branch);

    await tester.pumpWidget(
      MaterialApp(
        home: StockListScreen(
          businessId: biz,
          branchId: branch,
          stockRepo: stockRepo,
          apiClient: _UiMockApi(),
          userRole: 'CASHIER',
        ),
      ),
    );
    await tester.pumpAndSettle();

    // qty=5 should be flagged as "Stok Rendah"
    expect(find.text('Stok Rendah'), findsOneWidget);
    // qty=6 should be "Tersedia" (not visible as badge text in list, but status should be green)
    expect(find.text('CUKUP'), findsNothing); // not shown in list screen, only in detail
  });

  testWidgets('MOB-INV-007: adjusting stock with invalid input shows error', (tester) async {
    await stockRepo.applyStocksPull([
      StockWithProductDto(
        id: 'stock-1', businessId: biz, branchId: branch,
        productId: 'p1', productName: 'Test Product', priceMinor: 10000,
        costMinor: 7000, quantity: 50, serverVersion: 1,
      ),
    ], biz, branch);

    await tester.pumpWidget(
      MaterialApp(
        home: StockDetailScreen(
          businessId: biz,
          branchId: branch,
          productId: 'p1',
          stockRepo: stockRepo,
          apiClient: _UiMockApi(),
          userRole: 'OWNER',
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Enter empty string in quantity field and tap save
    await tester.enterText(find.byKey(const Key('adjustment_qty_field')), '');
    await tester.tap(find.text('Simpan Penyesuaian'));
    await tester.pumpAndSettle();

    expect(find.textContaining('valid'), findsWidgets);
  });
}
