import 'dart:async';
import 'package:drift/drift.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/database/db_key_service.dart';
import 'package:biz_erp_mobile/core/database/db_opener.dart';
import 'package:biz_erp_mobile/core/demo_context.dart';
import 'package:biz_erp_mobile/cart/data/cart_repository.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_controller.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_screen.dart';
import 'package:biz_erp_mobile/core/hardware/printing/bluetooth_printer_adapter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_preferences.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/scanning/scanner_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Init Database
  final appDir = await getApplicationDocumentsDirectory();
  final keyService = DbKeyService();
  final opener = DbOpener(keyService: keyService, appRoot: appDir);
  final db = await opener.open(DemoContext.businessId);

  // 2. Seed Demo Data (Idempotent)
  await _seedDemoData(db);

  // 3. Init Repositories & Services
  final productRepo = ProductRepository(db);
  final cartRepo = CartRepository(db);
  final calcEngine = SaleCalculationEngine();
  final checkoutService = CheckoutService(db, calcEngine);

  // Phase 2.2.1: Printing service (silent, non-blocking)
  final printingService = PrintingService(
    adapter: BluetoothPrinterAdapter(),
    prefs: FilePrinterPreferences(baseDir: appDir),
  );

  // 4. Init Controller
  final controller = PosController(
    productRepo: productRepo,
    cartRepo: cartRepo,
    calcEngine: calcEngine,
    checkoutService: checkoutService,
    printingService: printingService,
  );
  await controller.init();
  final scannerService = ScannerService(
    productRepo: productRepo,
    businessId: DemoContext.businessId,
    addToCart: (productId) => controller.addToCart(productId),
  );
  scannerService.start();
  unawaited(printingService.autoReconnectLast());
  runApp(MyApp(controller: controller, scannerService: scannerService));
}

Future<void> _seedDemoData(AppDatabase db) async {
  final count = await db.select(db.productsLocal).get();
  if (count.isEmpty) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final products = [
      ProductsLocalCompanion.insert(
        id: 'a1111111-1111-1111-1111-111111111111',
        businessId: DemoContext.businessId,
        name: 'Kopi Susu Gula Aren',
        priceMinor: 18000,
        serverVersion: const Value(1),
        lastSyncedAt: Value(now),
        barcode: const Value('8991002123456'),
      ),
      // Roti Bakar  → barcode: const Value('8991002123457')
      // Air Mineral → barcode: const Value('8996001112223')
      // Gorengan    → TANPA barcode (nullable proof)
      ProductsLocalCompanion.insert(
        id: 'b2222222-2222-2222-2222-222222222222',
        businessId: DemoContext.businessId,
        name: 'Roti Bakar Coklat',
        priceMinor: 15000,
        serverVersion: const Value(1),
        lastSyncedAt: Value(now),
      ),
      ProductsLocalCompanion.insert(
        id: 'c3333333-3333-3333-3333-333333333333',
        businessId: DemoContext.businessId,
        name: 'Air Mineral 600ml',
        priceMinor: 5000,
        serverVersion: const Value(1),
        lastSyncedAt: Value(now),
      ),
      ProductsLocalCompanion.insert(
        id: 'd4444444-4444-4444-4444-444444444444',
        businessId: DemoContext.businessId,
        name: 'Gorengan (Paket)',
        priceMinor: 10000,
        serverVersion: const Value(1),
        lastSyncedAt: Value(now),
      ),
    ];
    for (final p in products) {
      await db.into(db.productsLocal).insert(p);
    }
  }
}

class MyApp extends StatelessWidget {
  final PosController controller;
  final ScannerService? scannerService;

  const MyApp({super.key, required this.controller, this.scannerService});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BizERP POS',
      theme: ThemeData(primarySwatch: Colors.blueGrey, useMaterial3: true),
      home: PosScreen(controller: controller, scannerService: scannerService),
    );
  }
}
