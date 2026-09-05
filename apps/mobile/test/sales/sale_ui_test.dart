import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/cart/data/cart_repository.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/hardware/printing/bluetooth_printer_adapter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_device.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_preferences.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/sync/branch_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/customers/data/customer_repository.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_controller.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_screen.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/data/sale_repository.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';
import 'package:biz_erp_mobile/sales/presentation/sale_list_screen.dart';
import 'package:biz_erp_mobile/sales/presentation/sale_detail_screen.dart';

class _DummySyncApi implements SyncApiClient {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _MockBranchRepo extends BranchRepository {
  _MockBranchRepo(AppDatabase db) : super(db, _DummySyncApi());

  @override
  Future<List<BranchDto>> getCachedBranches(String businessId) async => [
        BranchDto(
          id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
          businessId: businessId,
          name: 'Cabang Pusat',
          status: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        ),
      ];

  @override
  Future<void> setActiveBranch(String businessId, String branchId) async {}

  @override
  Future<String?> getSelectedBranchId(String businessId) async => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
}

class _MockPrinterAdapter implements BluetoothPrinterAdapter {
  bool _connected = false;
  List<int> lastWrittenBytes = [];

  @override
  Future<bool> isConnected() async => _connected;

  @override
  Future<List<PrinterDevice>> pairedDevices() async => [
        const PrinterDevice(name: 'Thermal Printer 58mm', address: '00:11:22:33:44:55'),
      ];

  @override
  Future<void> connect(String address) async {
    _connected = true;
  }

  @override
  Future<void> disconnect() async {
    _connected = false;
  }

  @override
  Future<void> writeBytes(List<int> bytes) async {
    lastWrittenBytes = bytes;
  }
}

class _MockPrinterPrefs implements PrinterPreferences {
  PrinterDevice? saved;
  @override
  Future<PrinterDevice?> loadLastPrinter() async => saved;
  @override
  Future<void> saveLastPrinter(PrinterDevice device) async {
    saved = device;
  }
  @override
  Future<void> clearLastPrinter() async {
    saved = null;
  }
}

void main() {
  const bizId = '11111111-1111-1111-1111-111111111111';
  const branchId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

  late AppDatabase db;
  late SaleRepository saleRepo;
  late PrintingService printingService;
  late _MockPrinterAdapter mockAdapter;

  setUp(() async {
    db = AppDatabase(NativeDatabase.memory());
    saleRepo = SaleRepository(db);

    mockAdapter = _MockPrinterAdapter();
    printingService = PrintingService(
      adapter: mockAdapter,
      prefs: _MockPrinterPrefs(),
    );

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

    // Seed a completed sale
    await db.into(db.salesLocal).insert(
      SalesLocalCompanion.insert(
        clientTransactionId: 'sale-001-uuid',
        businessId: bizId,
        branchId: branchId,
        cashierId: 'cashier-01',
        customerId: const Value('cust-1'),
        receiptNumber: const Value('REC/2026/09/001'),
        status: 'SYNCED',
        subtotalMinor: 1800000,
        discountMinor: const Value(0),
        taxMinor: const Value(0),
        totalMinor: 1800000,
        currencyCode: 'IDR',
        currencyMinorUnits: 0,
        deviceId: 'device-01',
        createdAt: DateTime.now().millisecondsSinceEpoch,
        updatedAt: DateTime.now().millisecondsSinceEpoch,
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
        createdAt: DateTime.now().millisecondsSinceEpoch,
      ),
    );
  });

  tearDown(() async {
    await db.close();
  });

  group('Sale UI Tests', () {
    testWidgets('MOB-SALES-UI-001: SaleListScreen renders title, summary, and transaction card', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SaleListScreen(
            businessId: bizId,
            branchId: branchId,
            businessName: 'Toko Kopi Maju',
            branchName: 'Cabang Pusat',
            saleRepo: saleRepo,
            printingService: printingService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Riwayat Penjualan'), findsOneWidget);
      expect(find.text('Total Penjualan'), findsOneWidget);
      expect(find.text('1 Transaksi'), findsOneWidget);
      expect(find.text('REC/2026/09/001'), findsOneWidget);
      expect(find.text('Budi Santoso'), findsOneWidget);
      expect(find.text('Tersinkron'), findsOneWidget);
    });

    testWidgets('MOB-SALES-UI-002: SaleListScreen search and empty state behavior', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SaleListScreen(
            businessId: bizId,
            branchId: branchId,
            saleRepo: saleRepo,
            printingService: printingService,
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('REC/2026/09/001'), findsOneWidget);

      // Search non-existent receipt
      await tester.enterText(find.byType(TextField), 'NON_EXISTENT');
      await tester.pumpAndSettle();

      expect(find.text('Tidak ada transaksi dengan nomor tersebut'), findsOneWidget);
      expect(find.text('REC/2026/09/001'), findsNothing);
    });

    testWidgets('MOB-SALES-UI-003: Navigation to SaleDetailScreen and reprint action wiring', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SaleListScreen(
            businessId: bizId,
            branchId: branchId,
            businessName: 'Toko Kopi Maju',
            branchName: 'Cabang Pusat',
            saleRepo: saleRepo,
            printingService: printingService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap on transaction card to open details
      await tester.tap(find.text('REC/2026/09/001'));
      await tester.pumpAndSettle();

      // Verify SaleDetailScreen
      expect(find.text('Detail Transaksi'), findsOneWidget);
      expect(find.text('Nomor Struk'), findsOneWidget);
      expect(find.text('Kopi Susu Gula Aren'), findsOneWidget);
      expect(find.text('Ringkasan Pembayaran'), findsOneWidget);
      expect(find.text('Cetak Ulang Struk'), findsOneWidget);

      // Connect printer mock
      await printingService.connect(const PrinterDevice(name: 'Thermal Printer 58mm', address: '00:11:22:33:44:55'));
      await tester.pumpAndSettle();

      // Tap reprint button
      await tester.tap(find.text('Cetak Ulang Struk'));
      await tester.pumpAndSettle();

      expect(mockAdapter.lastWrittenBytes.isNotEmpty, isTrue);
      expect(find.text('Struk berhasil dicetak ulang'), findsOneWidget);
    });

    testWidgets('MOB-SALES-UI-004: SaleDetailScreen standalone view renders all sections correctly', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SaleDetailScreen(
            saleId: 'sale-001-uuid',
            businessId: bizId,
            businessName: 'Toko Kopi Maju',
            branchName: 'Cabang Pusat',
            saleRepo: saleRepo,
            printingService: printingService,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Detail Transaksi'), findsOneWidget);
      expect(find.text('REC/2026/09/001'), findsOneWidget);
      expect(find.text('Budi Santoso'), findsOneWidget);
      expect(find.text('cashier-01'), findsOneWidget);
      expect(find.text('Kopi Susu Gula Aren'), findsOneWidget);
      expect(find.text('1 x Rp 1.800.000'), findsOneWidget);
      expect(find.text('Subtotal'), findsOneWidget);
      expect(find.text('Total Akhir'), findsOneWidget);
      expect(find.text('Rp 1.800.000'), findsWidgets);
    });

    testWidgets('MOB-SALES-UI-005: POS drawer navigation opens Sales History screen', (tester) async {
      final prodRepo = ProductRepository(db);
      final cartRepo = CartRepository(db);
      final outbox = SyncOutboxRepository(db);
      final checkoutService = CheckoutService(db, SaleCalculationEngine(), outbox, prodRepo);

      final controller = PosController(
        businessId: bizId,
        branchId: branchId,
        branchRepo: _MockBranchRepo(db),
        productRepo: prodRepo,
        cartRepo: cartRepo,
        calcEngine: SaleCalculationEngine(),
        checkoutService: checkoutService,
        printingService: printingService,
        customerRepo: CustomerRepository(db),
      );
      await controller.init();

      await tester.pumpWidget(
        MaterialApp(
          home: PosScreen(
            controller: controller,
            saleRepo: saleRepo,
            printingService: printingService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Open drawer using the scaffold drawer icon / gesture
      final ScaffoldState state = tester.firstState(find.byType(Scaffold));
      state.openDrawer();
      await tester.pumpAndSettle();

      // Find "Riwayat Penjualan" drawer item
      expect(find.text('Riwayat Penjualan'), findsOneWidget);

      // Tap on "Riwayat Penjualan"
      await tester.tap(find.text('Riwayat Penjualan'));
      await tester.pumpAndSettle();

      // Verify SaleListScreen is displayed
      expect(find.text('Riwayat Penjualan'), findsWidgets);
      expect(find.text('REC/2026/09/001'), findsOneWidget);
    });
  });
}
