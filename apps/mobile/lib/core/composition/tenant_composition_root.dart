import 'dart:async';
import 'package:path_provider/path_provider.dart';

import 'package:biz_erp_mobile/core/auth/auth_state_notifier.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/database/db_key_service.dart';
import 'package:biz_erp_mobile/core/database/db_opener.dart';
import 'package:biz_erp_mobile/cart/data/cart_repository.dart';
import 'package:biz_erp_mobile/customers/data/customer_repository.dart';
import 'package:biz_erp_mobile/suppliers/data/supplier_repository.dart';

import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_controller.dart';
import 'package:biz_erp_mobile/core/hardware/printing/bluetooth_printer_adapter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printer_preferences.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/scanning/scanner_service.dart';
import 'package:biz_erp_mobile/core/sync/sync_config.dart';
import 'package:biz_erp_mobile/core/sync/http_sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/network_monitor.dart';
import 'package:biz_erp_mobile/core/sync/sync_engine.dart';
import 'package:biz_erp_mobile/core/sync/sync_meta_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';
import 'package:biz_erp_mobile/core/sync/branch_repository.dart';
import 'package:biz_erp_mobile/core/sync/store_settings_repository.dart';
import 'package:biz_erp_mobile/sales/data/sales_sync_repository.dart';

/// Container yang menyimpan semua instance dependency untuk sebuah sesi tenant/business.
class TenantDependencyGraph {
  final AppDatabase db;
  final ProductRepository productRepo;
  final CustomerRepository customerRepo;
  final SupplierRepository supplierRepo;
  final CartRepository cartRepo;
  final SyncOutboxRepository outboxRepo;
  final SyncStatusNotifier syncStatusNotifier;
  final PosController controller;
  final ScannerService scannerService;
  final HttpSyncApiClient apiClient;
  final SyncEngine syncEngine;
  final PrintingService printingService;
  final BranchRepository branchRepo;
  final StoreSettingsRepository storeSettingsRepo;

  TenantDependencyGraph({
    required this.db,
    required this.productRepo,
    required this.customerRepo,
    required this.supplierRepo,
    required this.cartRepo,
    required this.outboxRepo,
    required this.syncStatusNotifier,
    required this.controller,
    required this.scannerService,
    required this.apiClient,
    required this.syncEngine,
    required this.printingService,
    required this.branchRepo,
    required this.storeSettingsRepo,
  });

  /// Membersihkan background workers, koneksi API, dan menutup koneksi SQLite terenkripsi.
  Future<void> dispose() async {
    scannerService.stop();
    apiClient.close();
    await db.close();
  }
}

/// Composition Root terisolasi yang bertanggung jawab merakit dependency graph
/// per tenant secara deterministik.
class TenantCompositionRoot {
  const TenantCompositionRoot._();

  static Future<TenantDependencyGraph> compose({
    required String businessId,
    required AuthStateNotifier authStateNotifier,
  }) async {
    final appDir = await getApplicationDocumentsDirectory();
    final keyService = DbKeyService();
    final opener = DbOpener(keyService: keyService, appRoot: appDir);
    final db = await opener.open(businessId);

    // 1. Data Repositories
    final productRepo = ProductRepository(db);
    final cartRepo = CartRepository(db);
    final customerRepo = CustomerRepository(db);
    final supplierRepo = SupplierRepository(db);
    final calcEngine = SaleCalculationEngine();
    final syncMetaRepo = SyncMetaRepository(db);
    final syncOutboxRepo = SyncOutboxRepository(db);
    final salesSyncRepo = SalesSyncRepository(db);

    // 2. Synchronization & Network Subsystem
    final apiClient = HttpSyncApiClient(
      baseUrl: SyncConfig.baseUrl,
      tokenProvider: () => authStateNotifier.session?.accessToken,
      onRefresh: authStateNotifier.refresh,
      businessId: businessId,
    );
    final networkMonitor = NetworkMonitor(api: apiClient);
    final syncEngine = SyncEngine(
      outbox: syncOutboxRepo,
      meta: syncMetaRepo,
      api: apiClient,
      products: productRepo,
      salesSync: salesSyncRepo,
      customers: customerRepo,
      suppliers: supplierRepo,
      businessId: businessId,
    );
    final syncStatusNotifier = SyncStatusNotifier(
      networkMonitor: networkMonitor,
      syncEngine: syncEngine,
      outbox: syncOutboxRepo,
      productRepository: productRepo,
      businessId: businessId,
      authStateNotifier: authStateNotifier,
    );

    // 3. Checkout Service
    final checkoutService = CheckoutService(
      db,
      calcEngine,
      syncOutboxRepo,
      productRepo,
      () => syncStatusNotifier.syncNow(),
    );

     // 4. Branch Context Resolution
    final branchRepo = BranchRepository(db, apiClient);
    String? branchId = await branchRepo.getSelectedBranchId(businessId);
    if (branchId == null) {
      final activeBranch = await branchRepo.getActiveBranch(businessId);
      if (activeBranch != null) {
        branchId = activeBranch.id;
        await branchRepo.setActiveBranch(businessId, branchId);
      }
    }

    // 5. Store Settings — server is authoritative for resolved config.
    //    Fetch after branch is resolved; persist locally for offline use.
    final storeSettingsRepo = StoreSettingsRepository(db, apiClient);
    if (branchId != null) {
      try {
        await storeSettingsRepo.fetchAndCache(
          businessId: businessId,
          branchId: branchId,
        );
      } catch (_) {
        // Offline-first: cached settings from a prior sync will be
        // used by the POS controller via getCached().
      }
    }

    // 5. Hardware Subsystems (Printing & Scanner)
    final printingService = PrintingService(
      adapter: BluetoothPrinterAdapter(),
      prefs: FilePrinterPreferences(baseDir: appDir),
    );

    // 6. Presentation Controller
    final controller = PosController(
      businessId: businessId,
      branchId: branchId,
      branchRepo: branchRepo,
      storeSettingsRepo: storeSettingsRepo,
      productRepo: productRepo,
      cartRepo: cartRepo,
      calcEngine: calcEngine,
      checkoutService: checkoutService,
      printingService: printingService,
      customerRepo: customerRepo,
    );
    await controller.init();

    final scannerService = ScannerService(
      productRepo: productRepo,
      businessId: businessId,
      addToCart: (productId) => controller.addToCart(productId),
    );
    scannerService.start();
    unawaited(printingService.autoReconnectLast());

    return TenantDependencyGraph(
      db: db,
      productRepo: productRepo,
      customerRepo: customerRepo,
      cartRepo: cartRepo,
      outboxRepo: syncOutboxRepo,
      syncStatusNotifier: syncStatusNotifier,
      controller: controller,
      scannerService: scannerService,
      apiClient: apiClient,
      syncEngine: syncEngine,
      printingService: printingService,
      branchRepo: branchRepo,
      storeSettingsRepo: storeSettingsRepo,
      supplierRepo: supplierRepo,
    );
  }
}
