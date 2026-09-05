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
import 'package:biz_erp_mobile/reports/data/report_repository.dart';
import 'package:biz_erp_mobile/reports/presentation/sales_report_screen.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';

class _DummyReportSyncApi implements SyncApiClient {
  SalesSummaryDto mockSummary = const SalesSummaryDto(
    totalSales: 25,
    totalRevenueMinor: 3500000,
    totalItemsSold: 50,
    averageOrderValueMinor: 140000,
    paymentMethods: [
      PaymentMethodSummaryDto(paymentMethod: 'cash', count: 18, totalMinor: 2500000),
      PaymentMethodSummaryDto(paymentMethod: 'bank_transfer', count: 7, totalMinor: 1000000),
    ],
  );

  List<ProductSalesReportDto> mockProducts = [
    const ProductSalesReportDto(
      productId: 'p-1',
      productName: 'Kopi Susu Mantap',
      category: 'Minuman',
      totalQuantity: 30,
      totalRevenueMinor: 600000,
    ),
    const ProductSalesReportDto(
      productId: 'p-2',
      productName: 'Donat Cokelat Lumer',
      category: 'Makanan',
      totalQuantity: 20,
      totalRevenueMinor: 300000,
    ),
  ];

  List<HourlySalesBucketDto> mockHourly = [
    const HourlySalesBucketDto(hour: 10, totalRevenueMinor: 800000, transactionCount: 6),
    const HourlySalesBucketDto(hour: 14, totalRevenueMinor: 1500000, transactionCount: 12),
  ];

  bool shouldThrow = false;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<SalesSummaryDto> pullSalesSummary({
    required String from,
    required String to,
    String? branchId,
  }) async {
    if (shouldThrow) throw Exception('Network error');
    return mockSummary;
  }

  @override
  Future<List<ProductSalesReportDto>> pullProductSalesReport({
    required String from,
    required String to,
    String? branchId,
  }) async {
    if (shouldThrow) throw Exception('Network error');
    return mockProducts;
  }

  @override
  Future<List<HourlySalesBucketDto>> pullHourlySalesReport({
    required String from,
    required String to,
    String? branchId,
  }) async {
    if (shouldThrow) throw Exception('Network error');
    return mockHourly;
  }
}

class _MockBranchRepo extends BranchRepository {
  _MockBranchRepo(AppDatabase db) : super(db, _DummyReportSyncApi());

  @override
  Future<List<BranchDto>> getCachedBranches(String businessId) async => [
        BranchDto(
          id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
          businessId: businessId,
          name: 'Cabang Utama',
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
  late _DummyReportSyncApi mockApi;
  late ReportRepository reportRepo;
  late PrintingService printingService;
  late _MockPrinterAdapter mockAdapter;

  setUp(() async {
    db = AppDatabase(NativeDatabase.memory());
    mockApi = _DummyReportSyncApi();
    reportRepo = ReportRepository(mockApi);

    mockAdapter = _MockPrinterAdapter();
    printingService = PrintingService(
      adapter: mockAdapter,
      prefs: _MockPrinterPrefs(),
    );
  });

  tearDown(() async {
    await db.close();
  });

  group('SalesReportScreen UI Tests (MOB-REPORTS-1)', () {
    testWidgets('MOB-REP-UI-001: SalesReportScreen renders KPIs, payment breakdown, top products, and hourly traffic', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SalesReportScreen(
            businessId: bizId,
            branchId: branchId,
            reportRepo: reportRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Laporan & Rekap Penjualan'), findsOneWidget);
      expect(find.text('Hari Ini'), findsOneWidget);

      // Section 1: KPI Grid
      expect(find.text('Total Omset'), findsOneWidget);
      expect(find.text('Rp 3.500.000'), findsOneWidget);
      expect(find.text('Total Transaksi'), findsOneWidget);
      expect(find.text('25 Penjualan'), findsOneWidget);
      expect(find.text('Total Item Terjual'), findsOneWidget);
      expect(find.text('50 Pcs'), findsOneWidget);
      expect(find.text('Rata-rata Transaksi (AOV)'), findsOneWidget);
      expect(find.text('Rp 140.000'), findsOneWidget);

      // Section 2: Payment Methods Breakdown
      expect(find.text('Metode Pembayaran'), findsOneWidget);
      expect(find.text('Tunai'), findsOneWidget);
      expect(find.text('Rp 2.500.000'), findsOneWidget);
      expect(find.text('Transfer Bank'), findsOneWidget);
      expect(find.text('Rp 1.000.000'), findsOneWidget);

      // Section 3: Top Products
      expect(find.text('Produk Terlaris'), findsOneWidget);
      expect(find.text('Kopi Susu Mantap'), findsOneWidget);
      expect(find.text('30 Terjual'), findsOneWidget);
      expect(find.text('Rp 600.000'), findsOneWidget);
      expect(find.text('Donat Cokelat Lumer'), findsOneWidget);

      // Section 4: Hourly Traffic
      expect(find.text('Jam Ramai Toko (Hourly Traffic)'), findsOneWidget);
      expect(find.text('Pukul 10:00'), findsOneWidget);
      expect(find.text('6 Transaksi'), findsOneWidget);
      expect(find.text('Pukul 14:00'), findsOneWidget);
      expect(find.text('12 Transaksi'), findsOneWidget);
    });

    testWidgets('MOB-REP-UI-002: Switching presets (Kemarin, 7 Hari Terakhir, Bulan Ini) triggers reload', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SalesReportScreen(
            businessId: bizId,
            branchId: branchId,
            reportRepo: reportRepo,
            printingService: printingService,
            userRole: 'CASHIER',
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Kemarin'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('7 Hari Terakhir'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Bulan Ini'));
      await tester.pumpAndSettle();

      expect(find.text('Rp 3.500.000'), findsOneWidget);
    });

    testWidgets('MOB-REP-UI-003: Cetak Rekap Kasir thermal button prints closing summary receipt', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1024, 1600));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          home: SalesReportScreen(
            businessId: bizId,
            branchId: branchId,
            reportRepo: reportRepo,
            printingService: printingService,
            userRole: 'CASHIER',
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Connect mock printer
      await printingService.connect(const PrinterDevice(name: 'Thermal Printer 58mm', address: '00:11:22:33:44:55'));
      await tester.pumpAndSettle();

      expect(find.text('Cetak Rekap Kasir (Thermal)'), findsOneWidget);

      // Tap thermal print button
      await tester.ensureVisible(find.text('Cetak Rekap Kasir (Thermal)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cetak Rekap Kasir (Thermal)'));
      await tester.pumpAndSettle();

      expect(mockAdapter.lastWrittenBytes.isNotEmpty, isTrue);
      expect(find.text('Rekap kasir berhasil dicetak'), findsOneWidget);
    });

    testWidgets('MOB-REP-UI-004: POS drawer navigation opens SalesReportScreen', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1024, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final prodRepo = ProductRepository(db);
      final cartRepo = CartRepository(db);
      final outbox = SyncOutboxRepository(db);
      final checkoutService = CheckoutService(db, SaleCalculationEngine(), outbox, prodRepo);

      final posController = PosController(
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
      await posController.init();

      await tester.pumpWidget(
        MaterialApp(
          home: PosScreen(
            controller: posController,
            reportRepo: reportRepo,
            printingService: printingService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Open drawer
      final scaffoldState = tester.state<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      expect(find.text('Laporan & Rekap Penjualan'), findsOneWidget);

      // Tap drawer entry
      await tester.tap(find.text('Laporan & Rekap Penjualan'));
      await tester.pumpAndSettle();

      expect(find.byType(SalesReportScreen), findsOneWidget);
    });

    testWidgets('MOB-REP-UI-005: Offline error banner shows on network failure with retry button', (tester) async {
      mockApi.shouldThrow = true;

      await tester.pumpWidget(
        MaterialApp(
          home: SalesReportScreen(
            businessId: bizId,
            branchId: branchId,
            reportRepo: reportRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Offline'), findsOneWidget);
      expect(find.text('Coba Lagi'), findsOneWidget);
    });
  });
}
