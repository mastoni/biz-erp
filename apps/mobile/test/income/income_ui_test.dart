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
import 'package:biz_erp_mobile/income/data/income_repository.dart';
import 'package:biz_erp_mobile/income/domain/income.dart';
import 'package:biz_erp_mobile/income/presentation/income_detail_screen.dart';
import 'package:biz_erp_mobile/income/presentation/income_list_screen.dart';
import 'package:biz_erp_mobile/income/presentation/widgets/income_create_dialog.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_controller.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_screen.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';

class _DummyIncomeSyncApi implements SyncApiClient {
  List<IncomeDto> mockIncomes = [];
  Map<String, IncomeDto> mockIncomeById = {};
  bool shouldThrow = false;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<PullIncomeResponse> pullIncome({
    required String businessId,
    String? branchId,
    String? status,
    String? category,
    String? dateFrom,
    String? dateTo,
    String? search,
    int limit = 50,
    int offset = 0,
  }) async {
    if (shouldThrow) throw Exception('Network error');
    var items = mockIncomes.where((i) => i.businessId == businessId).toList();
    if (status != null && status.isNotEmpty) {
      items = items.where((i) => i.status == status).toList();
    }
    if (category != null && category.isNotEmpty) {
      items = items.where((i) => i.category == category).toList();
    }
    return PullIncomeResponse(items, items.length);
  }

  @override
  Future<IncomeDto?> getIncome({required String id}) async {
    if (shouldThrow) throw Exception('Network error');
    return mockIncomeById[id];
  }

  @override
  Future<IncomeDto> createIncome({
    required String businessId,
    String? branchId,
    required String date,
    required int amountMinor,
    required String method,
    String? category,
    String? reference,
    required String description,
  }) async {
    if (shouldThrow) throw Exception('Network error');
    final created = IncomeDto(
      id: 'inc-new-001',
      businessId: businessId,
      branchId: branchId,
      date: date,
      amountMinor: amountMinor,
      method: method,
      category: category,
      reference: reference,
      description: description,
      status: 'draft',
      serverVersion: 1,
      createdAt: '2026-09-05T10:00:00.000Z',
      updatedAt: '2026-09-05T10:00:00.000Z',
    );
    mockIncomes.add(created);
    mockIncomeById[created.id] = created;
    return created;
  }
}

class _MockBranchRepo extends BranchRepository {
  _MockBranchRepo(AppDatabase db) : super(db, _DummyIncomeSyncApi());

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
  late _DummyIncomeSyncApi mockApi;
  late IncomeRepository incomeRepo;
  late PrintingService printingService;
  late _MockPrinterAdapter mockAdapter;

  setUp(() async {
    db = AppDatabase(NativeDatabase.memory());
    mockApi = _DummyIncomeSyncApi();
    incomeRepo = IncomeRepository(mockApi);

    mockAdapter = _MockPrinterAdapter();
    printingService = PrintingService(
      adapter: mockAdapter,
      prefs: _MockPrinterPrefs(),
    );

    final inc1 = const IncomeDto(
      id: 'inc-001',
      businessId: bizId,
      branchId: branchId,
      date: '2026-09-01',
      amountMinor: 250000,
      method: 'cash',
      category: 'Jasa & Servis',
      reference: 'SRV-001',
      description: 'Servis printer kasir',
      status: 'posted',
      serverVersion: 1,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
    );

    final inc2 = const IncomeDto(
      id: 'inc-002',
      businessId: bizId,
      branchId: branchId,
      date: '2026-09-02',
      amountMinor: 150000,
      method: 'bank_transfer',
      category: 'Komisi & Fee',
      reference: 'FEE-002',
      description: 'Komisi agen logistik',
      status: 'draft',
      serverVersion: 1,
      createdAt: '2026-09-02T09:00:00.000Z',
      updatedAt: '2026-09-02T09:00:00.000Z',
    );

    mockApi.mockIncomes = [inc1, inc2];
    mockApi.mockIncomeById[inc1.id] = inc1;
    mockApi.mockIncomeById[inc2.id] = inc2;
  });

  tearDown(() async {
    await db.close();
  });

  group('Income UI Tests (MOB-INCOME-1)', () {
    testWidgets('MOB-INCOME-UI-001: IncomeListScreen renders Indonesian title, KPI cards, and items', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: IncomeListScreen(
            businessId: bizId,
            branchId: branchId,
            incomeRepo: incomeRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Pendapatan Operasional'), findsOneWidget);
      expect(find.text('Total Pendapatan'), findsOneWidget);
      expect(find.text('Jumlah Transaksi'), findsOneWidget);
      expect(find.text('Rp 400.000'), findsOneWidget); // Total
      expect(find.text('2 Entri'), findsOneWidget); // Count

      expect(find.text('Servis printer kasir'), findsOneWidget);
      expect(find.text('Komisi agen logistik'), findsOneWidget);
      expect(find.text('Catat Pendapatan'), findsOneWidget); // FAB for OWNER
    });

    testWidgets('MOB-INCOME-UI-002: Status filter toggles Draft and Posted lists', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: IncomeListScreen(
            businessId: bizId,
            branchId: branchId,
            incomeRepo: incomeRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Filter to draft
      await tester.tap(find.text('Draft (1)'));
      await tester.pumpAndSettle();

      expect(find.text('Komisi agen logistik'), findsOneWidget);
      expect(find.text('Servis printer kasir'), findsNothing);
    });

    testWidgets('MOB-INCOME-UI-003: CASHIER role has no create FAB button (view-only)', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: IncomeListScreen(
            businessId: bizId,
            branchId: branchId,
            incomeRepo: incomeRepo,
            printingService: printingService,
            userRole: 'CASHIER',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Catat Pendapatan'), findsNothing);
      expect(find.byType(FloatingActionButton), findsNothing);
    });

    testWidgets('MOB-INCOME-UI-004: IncomeCreateDialog validates and creates income online', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: IncomeCreateDialog(
              businessId: bizId,
              branchId: branchId,
              incomeRepo: incomeRepo,
              userRole: 'OWNER',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Catat Pendapatan'), findsOneWidget);

      // Validation check on empty submit
      await tester.tap(find.text('Simpan'));
      await tester.pumpAndSettle();

      expect(find.text('Nominal wajib diisi'), findsOneWidget);
      expect(find.text('Keterangan wajib diisi'), findsOneWidget);

      // Fill in fields
      await tester.enterText(find.byType(TextFormField).at(0), '175000');
      await tester.enterText(find.byType(TextFormField).at(3), 'Jasa setting router');
      await tester.pumpAndSettle();

      await tester.tap(find.text('Simpan'));
      await tester.pumpAndSettle();

      expect(mockApi.mockIncomes.length, equals(3));
      expect(mockApi.mockIncomes.last.amountMinor, equals(175000));
      expect(mockApi.mockIncomes.last.description, equals('Jasa setting router'));
    });

    testWidgets('MOB-INCOME-UI-005: IncomeDetailScreen renders details and voucher print button', (tester) async {
      final sampleIncome = Income.fromDto(mockApi.mockIncomes.first);

      await tester.pumpWidget(
        MaterialApp(
          home: IncomeDetailScreen(
            income: sampleIncome,
            printingService: printingService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Detail Pendapatan'), findsOneWidget);
      expect(find.text('Jasa & Servis'), findsOneWidget);
      expect(find.text('Rp 250.000'), findsOneWidget);
      expect(find.text('Servis printer kasir'), findsOneWidget);
      expect(find.text('SRV-001'), findsOneWidget);
      expect(find.text('Tunai'), findsOneWidget);
      expect(find.text('inc-001'), findsOneWidget);

      expect(find.text('Cetak Bukti Voucher'), findsOneWidget);
    });

    testWidgets('MOB-INCOME-UI-006: POS drawer has Pendapatan Operasional entry and navigates', (tester) async {
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
            incomeRepo: incomeRepo,
            printingService: printingService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Open drawer
      final scaffoldState = tester.state<ScaffoldState>(find.byType(Scaffold));
      scaffoldState.openDrawer();
      await tester.pumpAndSettle();

      expect(find.text('Pendapatan Operasional'), findsOneWidget);

      // Tap drawer entry
      await tester.tap(find.text('Pendapatan Operasional'));
      await tester.pumpAndSettle();

      expect(find.byType(IncomeListScreen), findsOneWidget);
    });

    testWidgets('MOB-INCOME-UI-007: Offline error banner shows on network failure', (tester) async {
      mockApi.shouldThrow = true;

      await tester.pumpWidget(
        MaterialApp(
          home: IncomeListScreen(
            businessId: bizId,
            branchId: branchId,
            incomeRepo: incomeRepo,
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
