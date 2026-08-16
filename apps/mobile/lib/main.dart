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
import 'package:biz_erp_mobile/core/sync/sync_config.dart';
import 'package:biz_erp_mobile/core/sync/http_sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/network_monitor.dart';
import 'package:biz_erp_mobile/core/sync/sync_engine.dart';
import 'package:biz_erp_mobile/core/sync/sync_meta_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';
import 'package:biz_erp_mobile/sales/data/sales_sync_repository.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/scanning/scanner_service.dart';
import 'package:biz_erp_mobile/core/auth/auth_secure_storage.dart';
import 'package:biz_erp_mobile/core/auth/auth_api_client.dart';
import 'package:biz_erp_mobile/core/auth/auth_repository.dart';
import 'package:biz_erp_mobile/core/auth/auth_state_notifier.dart';
import 'package:biz_erp_mobile/core/auth/auth_models.dart';
import 'package:biz_erp_mobile/core/auth/presentation/login_screen.dart';

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

  // Phase 4.0.9: Auth Initialization
  final authStorage = AuthSecureStorage();
  final authApiClient = AuthApiClient(baseUrl: SyncConfig.baseUrl);
  final authRepository = AuthRepository(storage: authStorage, apiClient: authApiClient);
  final authStateNotifier = AuthStateNotifier(repository: authRepository);
  await authStateNotifier.init();

  // Phase 3.1: Sync Services
  final syncMetaRepo = SyncMetaRepository(db);
  final syncOutboxRepo = SyncOutboxRepository(db);
  final salesSyncRepo = SalesSyncRepository(db);
  final apiClient = HttpSyncApiClient(
    baseUrl: SyncConfig.baseUrl,
    businessId: DemoContext.businessId,
    tokenProvider: () => authStateNotifier.session?.accessToken,
    onRefresh: authStateNotifier.refresh,
  );
  final networkMonitor = NetworkMonitor(api: apiClient);
  final syncEngine = SyncEngine(
    outbox: syncOutboxRepo,
    meta: syncMetaRepo,
    api: apiClient,
    products: productRepo,
    salesSync: salesSyncRepo,
    businessId: DemoContext.businessId,
  );
  final syncStatusNotifier = SyncStatusNotifier(
    networkMonitor: networkMonitor,
    syncEngine: syncEngine,
    outbox: syncOutboxRepo,
    productRepository: productRepo,
    businessId: DemoContext.businessId,
  );

  runApp(MyApp(
    controller: controller,
    scannerService: scannerService,
    syncStatusNotifier: syncStatusNotifier,
    productRepo: productRepo,
    outboxRepo: syncOutboxRepo,
    authStateNotifier: authStateNotifier,
  ));
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
      // Roti Bakar  Ã¢â€ â€™ barcode: const Value('8991002123457')
      // Air Mineral Ã¢â€ â€™ barcode: const Value('8996001112223')
      // Gorengan    Ã¢â€ â€™ TANPA barcode (nullable proof)
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
  final SyncStatusNotifier syncStatusNotifier;
  final ProductRepository? productRepo;
  final SyncOutboxRepository? outboxRepo;
  final AuthStateNotifier authStateNotifier;

  const MyApp({
    super.key,
    required this.controller,
    this.scannerService,
    required this.syncStatusNotifier,
    this.productRepo,
    this.outboxRepo,
    required this.authStateNotifier,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BizERP POS',
      theme: ThemeData(primarySwatch: Colors.blueGrey, useMaterial3: true),
      home: AnimatedBuilder(
        animation: authStateNotifier,
        builder: (context, _) {
          if (authStateNotifier.status == AuthStatus.unknown) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          if (authStateNotifier.status == AuthStatus.authenticated) {
            return PosScreen(
              controller: controller,
              scannerService: scannerService,
              syncStatusNotifier: syncStatusNotifier,
              productRepo: productRepo,
              outboxRepo: outboxRepo,
              authStateNotifier: authStateNotifier,
            );
          }
          return LoginScreen(authNotifier: authStateNotifier);
        },
      ),
    );
  }
}
