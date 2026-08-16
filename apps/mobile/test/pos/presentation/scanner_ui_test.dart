import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/cart/data/cart_repository.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/hardware/printing/bluetooth_printer_adapter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_device.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_preferences.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/scanning/scanner_service.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_controller.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_screen.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';

class _DummyPrefs implements PrinterPreferences {
  @override
  Future<PrinterDevice?> loadLastPrinter() async => null;
  @override
  Future<void> saveLastPrinter(PrinterDevice device) async {}
  @override
  Future<void> clearLastPrinter() async {}
}

void main() {
  const biz = '11111111-1111-1111-1111-111111111111';

  testWidgets('UI-SCAN snackbar sukses & not-found', (tester) async {
    final db = AppDatabase(NativeDatabase.memory());
    final repo = ProductRepository(db);
    final cartRepo = CartRepository(db);

    await repo.upsertProduct(
      Product(
        id: '10000000-0000-4000-a000-000000000001',
        businessId: biz,
        name: 'Kopi',
        priceMinor: 18000,
        isActive: true,
        serverVersion: 1,
        barcode: '8991002123456',
      ),
    );

    final controller = PosController(
      businessId: biz,
      productRepo: repo,
      cartRepo: cartRepo,
      calcEngine: SaleCalculationEngine(),
      checkoutService: CheckoutService(db, SaleCalculationEngine()),
      printingService: PrintingService(
        adapter: BluetoothPrinterAdapter(),
        prefs: _DummyPrefs(),
      ),
    );
    await controller.init();

    final service = ScannerService(
      productRepo: repo,
      businessId: biz,
      addToCart: (pid) => controller.addToCart(pid),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: PosScreen(controller: controller, scannerService: service),
      ),
    );
    await tester.pumpAndSettle();

    // Scan 1: sukses
    await service.processBarcode('8991002123456');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('+ Kopi'), findsOneWidget);

    // TUNGGU SNACKBAR PERTAMA HILANG (default 2 detik di kode + buffer)
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();

    // Scan 2: not-found
    await service.processBarcode('9999999999999');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();

    expect(find.textContaining('Produk tidak ditemukan'), findsOneWidget);

    await db.close();
  });
}
