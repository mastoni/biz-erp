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
import 'package:biz_erp_mobile/expenses/data/expense_repository.dart';
import 'package:biz_erp_mobile/expenses/presentation/expense_detail_screen.dart';
import 'package:biz_erp_mobile/expenses/presentation/expense_list_screen.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_controller.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_screen.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';

class _DummySyncApi implements SyncApiClient {
  List<ExpenseDto> mockExpenses = [];
  Map<String, ExpenseDto> mockExpenseById = {};

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<PullExpensesResponse> pullExpenses({
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
    var items = mockExpenses.where((e) => e.businessId == businessId).toList();
    if (status != null && status.isNotEmpty) {
      items = items.where((e) => e.status == status).toList();
    }
    if (category != null && category.isNotEmpty) {
      items = items.where((e) => e.category == category).toList();
    }
    return PullExpensesResponse(items, items.length);
  }

  @override
  Future<ExpenseDto?> getExpense({required String id}) async {
    return mockExpenseById[id];
  }

  @override
  Future<ExpenseDto> createExpense({
    required String businessId,
    String? branchId,
    required String date,
    required int amountMinor,
    required String method,
    String? category,
    String? reference,
    required String description,
  }) async {
    final created = ExpenseDto(
      id: 'exp-new-001',
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
    mockExpenses.add(created);
    mockExpenseById[created.id] = created;
    return created;
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
  late ExpenseRepository expenseRepo;
  late PrintingService printingService;
  late _MockPrinterAdapter mockAdapter;

  setUp(() async {
    db = AppDatabase(NativeDatabase.memory());
    mockApi = _DummySyncApi();
    expenseRepo = ExpenseRepository(mockApi);

    mockAdapter = _MockPrinterAdapter();
    printingService = PrintingService(
      adapter: mockAdapter,
      prefs: _MockPrinterPrefs(),
    );

    final exp1 = ExpenseDto(
      id: 'exp-001',
      businessId: bizId,
      branchId: branchId,
      date: '2026-09-01',
      amountMinor: 150000,
      method: 'cash',
      category: 'Operasional',
      reference: 'EXP/2026/09/001',
      description: 'Listrik & Air toko',
      status: 'posted',
      serverVersion: 1,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z',
    );

    final exp2 = ExpenseDto(
      id: 'exp-002',
      businessId: bizId,
      branchId: branchId,
      date: '2026-09-02',
      amountMinor: 45000,
      method: 'cash',
      category: 'Plastik & Kemasan',
      reference: 'EXP/2026/09/002',
      description: 'Beli plastik kresek',
      status: 'draft',
      serverVersion: 1,
      createdAt: '2026-09-02T08:00:00.000Z',
      updatedAt: '2026-09-02T08:00:00.000Z',
    );

    mockApi.mockExpenses = [exp1, exp2];
    mockApi.mockExpenseById = {
      'exp-001': exp1,
      'exp-002': exp2,
    };
  });

  tearDown(() async {
    await db.close();
  });

  group('Expense UI Tests', () {
    testWidgets('MOB-EXP-UI-001: ExpenseListScreen renders title, summary card, and items', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1024, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          home: ExpenseListScreen(
            businessId: bizId,
            branchId: branchId,
            businessName: 'Toko Kopi Maju',
            branchName: 'Cabang Pusat',
            expenseRepo: expenseRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Pengeluaran Operasional'), findsOneWidget);
      expect(find.text('Total Pengeluaran Toko'), findsOneWidget);
      expect(find.text('Listrik & Air toko'), findsOneWidget);
      expect(find.text('Beli plastik kresek'), findsOneWidget);
      expect(find.text('Rp 150.000'), findsWidgets);
      expect(find.text('Rp 45.000'), findsWidgets);
      expect(find.text('POSTED'), findsOneWidget);
      expect(find.text('DRAFT'), findsOneWidget);
    });

    testWidgets('MOB-EXP-UI-002: Status filter chips and category filtering', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1024, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          home: ExpenseListScreen(
            businessId: bizId,
            branchId: branchId,
            expenseRepo: expenseRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Listrik & Air toko'), findsOneWidget);
      expect(find.text('Beli plastik kresek'), findsOneWidget);

      // Tap 'Draft' chip
      await tester.tap(find.widgetWithText(ChoiceChip, 'Draft'));
      await tester.pumpAndSettle();

      expect(find.text('Listrik & Air toko'), findsNothing);
      expect(find.text('Beli plastik kresek'), findsOneWidget);

      // Tap 'Posted' chip
      await tester.tap(find.widgetWithText(ChoiceChip, 'Posted'));
      await tester.pumpAndSettle();

      expect(find.text('Listrik & Air toko'), findsOneWidget);
      expect(find.text('Beli plastik kresek'), findsNothing);
    });

    testWidgets('MOB-EXP-UI-003: Navigation to ExpenseDetailScreen displays complete metadata', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1024, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          home: ExpenseListScreen(
            businessId: bizId,
            branchId: branchId,
            businessName: 'Toko Kopi Maju',
            branchName: 'Cabang Pusat',
            expenseRepo: expenseRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap on first expense card
      await tester.tap(find.text('Listrik & Air toko'));
      await tester.pumpAndSettle();

      // Verify Detail screen
      expect(find.text('Detail Pengeluaran'), findsOneWidget);
      expect(find.text('Nominal Pengeluaran'), findsOneWidget);
      expect(find.text('Rp 150.000'), findsOneWidget);
      expect(find.text('Kas Tunai (Cash)'), findsOneWidget);
      expect(find.text('EXP/2026/09/001'), findsWidgets);
      expect(find.text('Informasi Audit Server'), findsOneWidget);
    });

    testWidgets('MOB-EXP-UI-004: OWNER can open ExpenseCreateDialog and submit new expense', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1024, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          home: ExpenseListScreen(
            businessId: bizId,
            branchId: branchId,
            expenseRepo: expenseRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Find FAB "Catat Biaya"
      expect(find.text('Catat Biaya'), findsOneWidget);
      await tester.tap(find.text('Catat Biaya'));
      await tester.pumpAndSettle();

      // Verify Create Dialog
      expect(find.text('Catat Pengeluaran'), findsOneWidget);
      expect(find.text('Keterangan Pengeluaran *'), findsOneWidget);

      // Enter description (first TextFormField)
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'Beli sabun cuci piring & spon',
      );

      // Enter amount (second TextFormField)
      await tester.enterText(
        find.byType(TextFormField).at(1),
        '25000',
      );

      // Submit
      await tester.tap(find.text('Simpan Pengeluaran'));
      await tester.pumpAndSettle();

      // Verify snackbar & list updated
      expect(find.text('Pengeluaran operasional berhasil dicatat.'), findsOneWidget);
      expect(find.text('Beli sabun cuci piring & spon'), findsOneWidget);
    });

    testWidgets('MOB-EXP-UI-005: CASHIER cannot see create FAB (read-only)', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ExpenseListScreen(
            businessId: bizId,
            branchId: branchId,
            expenseRepo: expenseRepo,
            printingService: printingService,
            userRole: 'CASHIER',
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify FAB "Catat Biaya" is absent for CASHIER
      expect(find.text('Catat Biaya'), findsNothing);
      expect(find.byType(FloatingActionButton), findsNothing);
    });

    testWidgets('MOB-EXP-UI-006: Thermal voucher printing on ExpenseDetailScreen', (tester) async {
      await tester.binding.setSurfaceSize(const Size(1024, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          home: ExpenseDetailScreen(
            expenseId: 'exp-001',
            businessId: bizId,
            businessName: 'Toko Kopi Maju',
            branchName: 'Cabang Pusat',
            expenseRepo: expenseRepo,
            printingService: printingService,
            userRole: 'OWNER',
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Connect mock printer
      await printingService.connect(const PrinterDevice(name: 'Thermal Printer 58mm', address: '00:11:22:33:44:55'));
      await tester.pumpAndSettle();

      // Tap print button
      await tester.ensureVisible(find.byIcon(Icons.print).first);
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.print).first);
      await tester.pumpAndSettle();

      expect(mockAdapter.lastWrittenBytes.isNotEmpty, isTrue);
      expect(find.text('Voucher pengeluaran berhasil dicetak'), findsOneWidget);
    });

    testWidgets('MOB-EXP-UI-007: POS drawer navigation opens ExpenseListScreen', (tester) async {
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
            expenseRepo: expenseRepo,
            printingService: printingService,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Open drawer
      final ScaffoldState state = tester.firstState(find.byType(Scaffold));
      state.openDrawer();
      await tester.pumpAndSettle();

      // Find "Pengeluaran Operasional" in drawer
      expect(find.text('Pengeluaran Operasional'), findsOneWidget);

      // Tap "Pengeluaran Operasional"
      await tester.tap(find.text('Pengeluaran Operasional'));
      await tester.pumpAndSettle();

      // Verify ExpenseListScreen opened
      expect(find.text('Pengeluaran Operasional'), findsWidgets);
      expect(find.text('Listrik & Air toko'), findsOneWidget);
    });
  });
}
