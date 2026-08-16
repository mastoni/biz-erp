import 'dart:async';
import 'package:drift/drift.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/database/db_key_service.dart';
import 'package:biz_erp_mobile/core/database/db_opener.dart';
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

  // Phase 4.0.9: Global Auth Initialization
  final authStorage = AuthSecureStorage();
  final authApiClient = AuthApiClient(baseUrl: SyncConfig.baseUrl);
  final authRepository = AuthRepository(storage: authStorage, apiClient: authApiClient);
  final authStateNotifier = AuthStateNotifier(repository: authRepository);
  await authStateNotifier.init();

  runApp(MyApp(
    authStateNotifier: authStateNotifier,
  ));
}

class TenantDependencyGraph {
  final AppDatabase db;
  final ProductRepository productRepo;
  final SyncOutboxRepository outboxRepo;
  final SyncStatusNotifier syncStatusNotifier;
  final PosController controller;
  final ScannerService scannerService;
  final HttpSyncApiClient apiClient;
  final SyncEngine syncEngine;
  final PrintingService printingService;

  TenantDependencyGraph({
    required this.db,
    required this.productRepo,
    required this.outboxRepo,
    required this.syncStatusNotifier,
    required this.controller,
    required this.scannerService,
    required this.apiClient,
    required this.syncEngine,
    required this.printingService,
  });

  Future<void> dispose() async {
    scannerService.stop();
    apiClient.close();
    await db.close();
  }
}

class MyApp extends StatefulWidget {
  final AuthStateNotifier authStateNotifier;

  const MyApp({super.key, required this.authStateNotifier});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  TenantDependencyGraph? _graph;
  String? _currentBusinessId;
  bool _isLoadingTenant = false;

  @override
  void initState() {
    super.initState();
    widget.authStateNotifier.addListener(_onAuthStateChanged);
    _onAuthStateChanged(); // check initial state
  }

  @override
  void dispose() {
    widget.authStateNotifier.removeListener(_onAuthStateChanged);
    _graph?.dispose();
    super.dispose();
  }

  Future<void> _onAuthStateChanged() async {
    final businessId = widget.authStateNotifier.businessId;

    if (businessId == null) {
      if (_graph != null) {
        await _graph!.dispose();
        if (mounted) {
          setState(() {
            _graph = null;
            _currentBusinessId = null;
          });
        }
      }
      return;
    }

    if (businessId != _currentBusinessId) {
      if (mounted) {
        setState(() {
          _isLoadingTenant = true;
        });
      }

      if (_graph != null) {
        await _graph!.dispose();
      }

      final newGraph = await _buildTenantGraph(businessId);

      if (mounted) {
        setState(() {
          _graph = newGraph;
          _currentBusinessId = businessId;
          _isLoadingTenant = false;
        });
      }
    }
  }

  Future<TenantDependencyGraph> _buildTenantGraph(String businessId) async {
    final appDir = await getApplicationDocumentsDirectory();
    final keyService = DbKeyService();
    final opener = DbOpener(keyService: keyService, appRoot: appDir);
    final db = await opener.open(businessId);

    // Repositories
    final productRepo = ProductRepository(db);
    final cartRepo = CartRepository(db);
    final calcEngine = SaleCalculationEngine();
    final checkoutService = CheckoutService(db, calcEngine);
    final syncMetaRepo = SyncMetaRepository(db);
    final syncOutboxRepo = SyncOutboxRepository(db);
    final salesSyncRepo = SalesSyncRepository(db);

    // Printing Service
    final printingService = PrintingService(
      adapter: BluetoothPrinterAdapter(),
      prefs: FilePrinterPreferences(baseDir: appDir),
    );

    // Controller
    final controller = PosController(
      businessId: businessId,
      productRepo: productRepo,
      cartRepo: cartRepo,
      calcEngine: calcEngine,
      checkoutService: checkoutService,
      printingService: printingService,
    );
    await controller.init();

    // Scanner Service
    final scannerService = ScannerService(
      productRepo: productRepo,
      businessId: businessId,
      addToCart: (productId) => controller.addToCart(productId),
    );
    scannerService.start();
    unawaited(printingService.autoReconnectLast());

    // Sync Services
    final apiClient = HttpSyncApiClient(
      baseUrl: SyncConfig.baseUrl,
      tokenProvider: () => widget.authStateNotifier.session?.accessToken,
      onRefresh: widget.authStateNotifier.refresh,
    );
    final networkMonitor = NetworkMonitor(api: apiClient);
    final syncEngine = SyncEngine(
      outbox: syncOutboxRepo,
      meta: syncMetaRepo,
      api: apiClient,
      products: productRepo,
      salesSync: salesSyncRepo,
      businessId: businessId,
    );
    final syncStatusNotifier = SyncStatusNotifier(
      networkMonitor: networkMonitor,
      syncEngine: syncEngine,
      outbox: syncOutboxRepo,
      productRepository: productRepo,
      businessId: businessId,
      authStateNotifier: widget.authStateNotifier,
    );

    return TenantDependencyGraph(
      db: db,
      productRepo: productRepo,
      outboxRepo: syncOutboxRepo,
      syncStatusNotifier: syncStatusNotifier,
      controller: controller,
      scannerService: scannerService,
      apiClient: apiClient,
      syncEngine: syncEngine,
      printingService: printingService,
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BizERP POS',
      theme: ThemeData(primarySwatch: Colors.blueGrey, useMaterial3: true),
      home: AnimatedBuilder(
        animation: widget.authStateNotifier,
        builder: (context, _) {
          if (widget.authStateNotifier.status == AuthStatus.unknown) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          if (widget.authStateNotifier.status == AuthStatus.unauthenticated) {
            return LoginScreen(authNotifier: widget.authStateNotifier);
          }
          if (_isLoadingTenant || _graph == null) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }

          return PosScreen(
            controller: _graph!.controller,
            scannerService: _graph!.scannerService,
            syncStatusNotifier: _graph!.syncStatusNotifier,
            productRepo: _graph!.productRepo,
            outboxRepo: _graph!.outboxRepo,
            authStateNotifier: widget.authStateNotifier,
          );
        },
      ),
    );
  }
}
