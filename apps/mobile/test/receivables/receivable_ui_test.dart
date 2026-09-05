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
import 'package:biz_erp_mobile/receivables/data/receivable_repository.dart';
import 'package:biz_erp_mobile/receivables/presentation/receivable_detail_screen.dart';
import 'package:biz_erp_mobile/receivables/presentation/receivable_list_screen.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';

class _DummySyncApi implements SyncApiClient {
  List<ReceivableDto> mockReceivables = [];
  Map<String, ReceivableDto> mockReceivableById = {};
  List<CustomerPaymentDto> mockPayments = [];

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<PullReceivablesResponse> pullReceivables({
    required String businessId,
    String? branchId,
    String? customerId,
    String? status,
    String? dateFrom,
    String? dateTo,
    int limit = 50,
    int offset = 0,
  }) async {
    var items = mockReceivables.where((r) => r.businessId == businessId).toList();
    if (status != null && status.isNotEmpty) {
      items = items.where((r) => r.status == status).toList();
    }
    return PullReceivablesResponse(items, items.length);
  }

  @override
  Future<ReceivableDto?> getReceivable({required String id}) async {
    return mockReceivableById[id];
  }

  @override
  Future<List<CustomerPaymentDto>> pullCustomerPayments({
    required String receivableId,
    int limit = 50,
    int offset = 0,
  }) async {
    return mockPayments.where((p) => p.receivableId == receivableId).toList();
  }

  @override
  Future<PaymentCollectionResultDto> collectReceivablePayment({
    required String receivableId,
    required int amountMinor,
    required String method,
    String? customerId,
    String? reference,
    String? date,
    required String idempotencyKey,
  }) async {
    return const PaymentCollectionResultDto(
      ok: true,
      paymentId: 'pay-new-001',
      journalId: 'jour-new-001',
      receivableId: 'rec-001-uuid',
      newStatus: 'PAID',
    );
  }
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
  late _DummySyncApi mockApi;
  late ReceivableRepository receivableRepo;
  late PrintingService printingService;
  late _MockPrinterAdapter mockAdapter;

  setUp(() async {
    db = AppDatabase(NativeDatabase.memory());
    mockApi = _DummySyncApi();
    receivableRepo = ReceivableRepository(mockApi, db);

    mockAdapter = _MockPrinterAdapter();
    printingService = PrintingService(
      adapter: mockAdapter,
      prefs: _MockPrinterPrefs(),
    );

    // Seed customer
    await db.into(db.customersLocal).insert(
      CustomersLocalCompanion.insert(
        id: 'cust-001',
        businessId: bizId,
        name: 'Toko Sumber Rezeki',
      ),
    );

    // Seed mock data in API
    final rec1 = ReceivableDto(
      id: 'rec-001-uuid',
      businessId: bizId,
      saleId: 'sale-001',
      customerId: 'cust-001',
      branchId: branchId,
      amountMinor: 3000000,
      paidMinor: 1000000,
      outstandingMinor: 2000000,
      date: '2026-09-01',
      reference: 'INV/2026/09/001',
      description: 'Tempo 14 hari',
      status: 'PARTIAL',
      serverVersion: 1,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
    );

    final rec2 = ReceivableDto(
      id: 'rec-002-uuid',
      businessId: bizId,
      saleId: 'sale-002',
      customerId: 'cust-001',
      branchId: branchId,
      amountMinor: 1000000,
      paidMinor: 1000000,
      outstandingMinor: 0,
      date: '2026-09-02',
      reference: 'INV/2026/09/002',
      description: 'Lunas',
      status: 'PAID',
      serverVersion: 2,
      createdAt: '2026-09-02T08:00:00.000Z',
      updatedAt: '2026-09-02T08:00:00.000Z',
    );

    mockApi.mockReceivables = [rec1, rec2];
    mockApi.mockReceivableById = {
      'rec-001-uuid': rec1,
      'rec-002-uuid': rec2,
    };

    mockApi.mockPayments = [
      const CustomerPaymentDto(
        id: 'pay-001',
        businessId: bizId,
        receivableId: 'rec-001-uuid',
        customerId: 'cust-001',
        branchId: branchId,
        amountMinor: 1000000,
        method: 'cash',
        reference: 'TRF-01',
        idempotencyKey: 'idem-1',
        createdAt: '2026-09-01T10:00:00.000Z',
      ),
    ];
  });

  tearDown(() async {
    await db.close();
  });

  group('Receivable UI Tests', () {
    testWidgets('MOB-AR-UI-001: ReceivableListScreen renders title, summary card, and items', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ReceivableListScreen(
            businessId: bizId,
            branchId: branchId,
            businessName: 'Toko Kopi Maju',
            branchName: 'Cabang Pusat',
            receivableRepo: receivableRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Piutang Usaha'), findsOneWidget);
      expect(find.text('Total Sisa Piutang'), findsOneWidget);
      expect(find.text('INV/2026/09/001'), findsOneWidget);
      expect(find.text('Toko Sumber Rezeki'), findsWidgets);
      expect(find.text('SEBAGIAN'), findsOneWidget);
      expect(find.text('LUNAS'), findsOneWidget);
    });

    testWidgets('MOB-AR-UI-002: Status filter chips and search behavior', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ReceivableListScreen(
            businessId: bizId,
            branchId: branchId,
            receivableRepo: receivableRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('INV/2026/09/001'), findsOneWidget);
      expect(find.text('INV/2026/09/002'), findsOneWidget);

      // Tap 'Belum Lunas' chip
      await tester.tap(find.widgetWithText(ChoiceChip, 'Belum Lunas'));
      await tester.pumpAndSettle();

      expect(find.text('INV/2026/09/001'), findsOneWidget);
      expect(find.text('INV/2026/09/002'), findsNothing);

      // Tap 'Lunas' chip
      await tester.tap(find.widgetWithText(ChoiceChip, 'Lunas'));
      await tester.pumpAndSettle();

      expect(find.text('INV/2026/09/001'), findsNothing);
      expect(find.text('INV/2026/09/002'), findsOneWidget);
    });

    testWidgets('MOB-AR-UI-003: Navigation to ReceivableDetailScreen and view payment history', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ReceivableListScreen(
            businessId: bizId,
            branchId: branchId,
            businessName: 'Toko Kopi Maju',
            branchName: 'Cabang Pusat',
            receivableRepo: receivableRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap on first receivable
      await tester.tap(find.text('INV/2026/09/001'));
      await tester.pumpAndSettle();

      // Verify Detail screen
      expect(find.text('Detail Piutang'), findsOneWidget);
      expect(find.text('Ringkasan Finansial'), findsOneWidget);
      expect(find.text('Riwayat Pembayaran'), findsOneWidget);
      expect(find.text('Sisa Tagihan (Piutang)'), findsOneWidget);
      expect(find.text('Rp 2.000.000'), findsWidgets);
      expect(find.text('Tunai (Cash) • 2026-09-01'), findsOneWidget);
    });

    testWidgets('MOB-AR-UI-004: OWNER can open payment collection dialog and submit collection', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ReceivableDetailScreen(
            receivableId: 'rec-001-uuid',
            businessId: bizId,
            businessName: 'Toko Kopi Maju',
            branchName: 'Cabang Pusat',
            receivableRepo: receivableRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap "Terima Pembayaran"
      expect(find.textContaining('Terima Pembayaran'), findsOneWidget);
      await tester.tap(find.textContaining('Terima Pembayaran'));
      await tester.pumpAndSettle();

      // Verify Payment Collection dialog
      expect(find.text('Terima Pembayaran Piutang'), findsOneWidget);
      expect(find.text('Simpan Pembayaran'), findsOneWidget);

      // Submit payment
      await tester.tap(find.text('Simpan Pembayaran'));
      await tester.pumpAndSettle();

      // Verify success snackbar
      expect(find.text('Pembayaran piutang berhasil dicatat.'), findsOneWidget);
    });

    testWidgets('MOB-AR-UI-005: CASHIER / STAFF has collection disabled with role warning', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ReceivableDetailScreen(
            receivableId: 'rec-001-uuid',
            businessId: bizId,
            receivableRepo: receivableRepo,
            printingService: printingService,
            userRole: 'CASHIER',
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify bottom bar indicates only owner can collect
      expect(find.text('Hanya Owner Yang Dapat Menerima Pembayaran'), findsOneWidget);
    });

    testWidgets('MOB-AR-UI-006: Reprint payment proof uses PrintingService', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1024, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          home: ReceivableDetailScreen(
            receivableId: 'rec-001-uuid',
            businessId: bizId,
            businessName: 'Toko Kopi Maju',
            branchName: 'Cabang Pusat',
            receivableRepo: receivableRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Connect mock printer
      await printingService.connect(const PrinterDevice(name: 'Thermal Printer 58mm', address: '00:11:22:33:44:55'));
      await tester.pumpAndSettle();

      // Tap print icon on payment history item
      await tester.ensureVisible(find.byIcon(Icons.print));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.print));
      await tester.pumpAndSettle();

      expect(mockAdapter.lastWrittenBytes.isNotEmpty, isTrue);
      expect(find.text('Bukti pembayaran berhasil dicetak'), findsOneWidget);
    });

    testWidgets('MOB-AR-UI-007: POS drawer navigation opens ReceivableListScreen', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1024, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

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
            receivableRepo: receivableRepo,
            printingService: printingService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Open drawer
      final ScaffoldState state = tester.firstState(find.byType(Scaffold));
      state.openDrawer();
      await tester.pumpAndSettle();

      // Find "Piutang Usaha" in drawer
      expect(find.text('Piutang Usaha'), findsOneWidget);

      // Tap "Piutang Usaha"
      await tester.tap(find.text('Piutang Usaha'));
      await tester.pumpAndSettle();

      // Verify ReceivableListScreen opened
      expect(find.text('Piutang Usaha'), findsWidgets);
      expect(find.text('INV/2026/09/001'), findsOneWidget);
    });
  });
}
