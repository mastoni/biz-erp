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

  // 4. Init Controller
  final controller = PosController(
    productRepo: productRepo,
    cartRepo: cartRepo,
    calcEngine: calcEngine,
    checkoutService: checkoutService,
  );
  await controller.init();

  runApp(MyApp(controller: controller));
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
      ),
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
  const MyApp({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BizERP POS',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blueGrey,
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: PosScreen(controller: controller),
    );
  }
}
