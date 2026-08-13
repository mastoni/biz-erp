import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/cart/data/cart_repository.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';
import 'package:biz_erp_mobile/sales/domain/checkout/checkout_models.dart';
import 'package:biz_erp_mobile/core/demo_context.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_controller.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_screen.dart';
import 'package:biz_erp_mobile/core/hardware/printing/bluetooth_printer_adapter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_preferences.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_device.dart';

class _DummyPrefs implements PrinterPreferences {
  @override
  Future<PrinterDevice?> loadLastPrinter() async => null;
  @override
  Future<void> saveLastPrinter(PrinterDevice device) async {}
  @override
  Future<void> clearLastPrinter() async {}
}

void main() {
  late AppDatabase db;
  late PosController controller;

  setUp(() async {
    db = AppDatabase(NativeDatabase.memory());
    final prodRepo = ProductRepository(db);
    final cartRepo = CartRepository(db);
    final checkoutService = CheckoutService(db, SaleCalculationEngine());

    // Seed 1 product
    await prodRepo.upsertProduct(
      Product(
        id: 'a1111111-1111-1111-1111-111111111111',
        businessId: DemoContext.businessId,
        name: 'Test Product',
        priceMinor: 10000,
        isActive: true,
        serverVersion: 1,
      ),
    );

    final printingService = PrintingService(
      adapter: BluetoothPrinterAdapter(),
      prefs: _DummyPrefs(),
    );

    controller = PosController(
      productRepo: prodRepo,
      cartRepo: cartRepo,
      calcEngine: SaleCalculationEngine(),
      checkoutService: checkoutService,
      printingService: printingService, // TAMBAHKAN INI
    );
    await controller.init();
  });

  tearDown(() async {
    await db.close();
  });

  Widget buildTestScreen() =>
      MaterialApp(home: PosScreen(controller: controller));

  testWidgets('UI-001: Product grid shows active products', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    expect(find.text('Test Product'), findsOneWidget);
  });

  testWidgets('UI-002: Tap product adds to cart', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    await tester.tap(find.text('Test Product'));
    await tester.pumpAndSettle();
    expect(find.text('1'), findsOneWidget); // Qty 1 in cart
  });

  testWidgets('UI-003: Cart panel calculates total correctly', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    await tester.tap(find.text('Test Product'));
    await tester.pumpAndSettle();
    expect(find.text('Rp 10.000'), findsWidgets); // Subtotal & Total
  });

  testWidgets('UI-004: Payment dialog validates cash < total', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    await tester.tap(find.text('Test Product'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('BAYAR SEKARANG'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '5000');
    await tester.pump();

    // Tap confirm meskipun cash kurang
    await tester.tap(find.text('KONFIRMASI'));
    await tester.pumpAndSettle();

    // Dialog pembayaran harus tetap terbuka (silent reject)
    expect(find.text('Pilih Pembayaran'), findsOneWidget);
    // Struk tidak boleh muncul
    expect(find.text('Transaksi Sukses'), findsNothing);
  });
  testWidgets('UI-005: Checkout completes and shows receipt', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    await tester.tap(find.text('Test Product'));
    await tester.pumpAndSettle();

    final bayarBtn = find.text('BAYAR SEKARANG');
    await tester.ensureVisible(bayarBtn);
    await tester.tap(bayarBtn);
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '20000');
    await tester.tap(find.widgetWithText(ElevatedButton, 'KONFIRMASI'));
    await tester.pumpAndSettle();

    expect(find.text('Transaksi Sukses'), findsOneWidget);
  });

  testWidgets('UI-006: Checkout failure preserves cart', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    await tester.tap(find.text('Test Product'));
    await tester.pumpAndSettle();

    // Trigger failure by passing insufficient cash directly to controller (bypassing UI validation)
    await controller.performCheckout(PaymentMethod.cash, 5000);
    await tester.pumpAndSettle();

    // Cart should still have the item
    expect(find.text('1'), findsOneWidget);
    expect(controller.errorMessage, isNotNull);
  });

  testWidgets('UI-007: Checkout success creates new cart', (tester) async {
    await tester.pumpWidget(buildTestScreen());
    final initialCartId = controller.currentCart!.cart.id;

    await tester.tap(find.text('Test Product'));
    await tester.pumpAndSettle();

    final bayarBtn = find.text('BAYAR SEKARANG');
    await tester.ensureVisible(bayarBtn);
    await tester.tap(bayarBtn);
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '20000');
    await tester.pump(); // CRITICAL: Rebuild dialog to enable button
    await tester.tap(find.widgetWithText(ElevatedButton, 'KONFIRMASI'));
    await tester.pumpAndSettle();

    expect(controller.currentCart!.cart.id, isNot(initialCartId));
    expect(controller.currentCart!.items.isEmpty, isTrue);
  });
}
