import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:drift/native.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';
import 'package:biz_erp_mobile/core/sync/network_monitor.dart';
import 'package:biz_erp_mobile/core/sync/sync_engine.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/core/auth/auth_state_notifier.dart';
import 'package:biz_erp_mobile/core/auth/auth_models.dart';
import 'package:biz_erp_mobile/core/auth/auth_repository.dart';
import 'package:biz_erp_mobile/suppliers/data/supplier_repository.dart';
import 'package:biz_erp_mobile/purchases/data/purchase_repository.dart';
import 'package:biz_erp_mobile/inventory/data/stock_repository.dart';
import 'package:biz_erp_mobile/suppliers/domain/supplier.dart';
import 'package:biz_erp_mobile/suppliers/presentation/supplier_list_screen.dart';
import 'package:biz_erp_mobile/suppliers/presentation/supplier_edit_screen.dart';
import 'package:flutter/material.dart';

const biz = '11111111-1111-4111-a111-111111111111';

class _FakeAuthRepository implements AuthRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeAuthStateNotifier extends AuthStateNotifier {
  _FakeAuthStateNotifier() : super(repository: _FakeAuthRepository());

  @override
  AuthStatus get status => AuthStatus.authenticated;
}

class _FakeNetworkMonitor implements NetworkMonitor {
  final StreamController<bool> controller = StreamController<bool>.broadcast();
  bool reachable = true;
  @override
  Stream<bool> get onConnectivityChanged => controller.stream;
  @override
  Future<bool> apiReachable() async => reachable;
}

class _FakeOutbox implements SyncOutboxRepository {
  @override
  Future<SyncCounts> counts() async => const SyncCounts(0, 0, 0);
  @override
  Future<List<SyncOutboxItem>> getConflicts() async => [];
  @override
  Future<void> discardConflict(String outboxId) async {}
  @override
  Future<void> markConflict(String id, String serverStateJson, String error) async {}
  @override
  Future<void> markRetry(String id, int now, String error) async {}
  @override
  Future<void> markSynced(String id) async {}
  @override
  Future<void> markFailed(String id, String error) async {}
  @override
  Future<String> enqueueProductUpsert(ProductDto product) async => '';
  @override
  Future<String> enqueueProductCreate(ProductDto product) async => '';
  @override
  Future<String> enqueueSale(SaleDto sale) async => '';
  @override
  Future<String> enqueueCustomerCreate(CustomerDto customer, {String? idempotencyKey}) async => '';
  @override
  Future<String> enqueueCustomerUpsert(CustomerDto customer, {String? idempotencyKey}) async => '';
  @override
  Future<String> enqueueSupplierCreate(SupplierDto supplier, {String? idempotencyKey}) async => '';
  @override
  Future<String> enqueueSupplierUpsert(SupplierDto supplier, {String? idempotencyKey}) async => '';
  @override
  Future<String> enqueuePurchaseCreate(PurchaseDto purchase, {String? idempotencyKey}) async => '';
  @override
  Future<String> enqueuePurchaseUpsert(PurchaseDto purchase, {String? idempotencyKey}) async => '';
  @override
  Future<List<SyncOutboxItem>> fetchDue(int now, {int limit = 100}) async => [];
}

class _FakeSyncEngine extends ChangeNotifier implements SyncEngine {
  int syncNowCallCount = 0;
  @override
  PurchaseRepository? get purchases => null;
  @override
  StockRepository? get stocks => null;
  @override
  SyncApiClient get apiClient => throw UnimplementedError();
  @override
  String? get branchId => null;
  @override
  Future<SyncSummary> syncNow() async {
    syncNowCallCount++;
    await Future.delayed(const Duration(milliseconds: 10));
    notifyListeners();
    return SyncSummary(reachable: true, pushed: 0, pulledProducts: 0, pulledCustomers: 0, pulledSuppliers: 0, pulledSales: 0, counts: SyncCounts(0, 0, 0));
  }
}

void main() {
  // MOBILE-SUPPLIER-016: list screen rendering
  testWidgets('MOBILE-SUPPLIER-016: list screen renders supplier fields', (tester) async {
    final db = AppDatabase(NativeDatabase.memory());
    final repo = SupplierRepository(db);
    final outbox = SyncOutboxRepository(db);

    await repo.upsertSupplier(Supplier(
      id: 's-list-001',
      businessId: biz,
      name: 'PT Sumber Jaya',
      code: 'SUP-001',
      contact: 'Budi',
      phone: '+628123456789',
      email: 'budi@supplier.com',
      category: 'Sembako',
      term: 'tunai',
      isActive: true,
      serverVersion: 1,
      localStatus: 'synced',
    ));

    await repo.upsertSupplier(Supplier(
      id: 's-list-002',
      businessId: biz,
      name: 'Supplier Nonaktif',
      code: 'SUP-002',
      contact: null,
      phone: null,
      email: null,
      category: 'Minuman',
      term: 'tempo_30',
      isActive: false,
      serverVersion: 2,
      localStatus: 'synced',
    ));

    final notifier = SyncStatusNotifier(
      networkMonitor: _FakeNetworkMonitor(),
      syncEngine: _FakeSyncEngine(),
      outbox: _FakeOutbox(),
      productRepository: ProductRepository(db),
      businessId: biz,
      authStateNotifier: _FakeAuthStateNotifier(),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: SupplierListScreen(
          businessId: biz,
          supplierRepo: repo,
          outboxRepo: outbox,
          syncStatusNotifier: notifier,
          userRole: 'CASHIER',
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('PT Sumber Jaya'), findsOneWidget);
    expect(find.text('Supplier Nonaktif'), findsOneWidget);
    expect(find.text('Belum ada supplier'), findsNothing);

    await db.close();
  });

  testWidgets('MOBILE-SUPPLIER-016b: OWNER sees FAB', (tester) async {
    final db = AppDatabase(NativeDatabase.memory());
    final repo = SupplierRepository(db);
    final outbox = SyncOutboxRepository(db);
    final notifier = SyncStatusNotifier(
      networkMonitor: _FakeNetworkMonitor(),
      syncEngine: _FakeSyncEngine(),
      outbox: _FakeOutbox(),
      productRepository: ProductRepository(db),
      businessId: biz,
      authStateNotifier: _FakeAuthStateNotifier(),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: SupplierListScreen(
          businessId: biz,
          supplierRepo: repo,
          outboxRepo: outbox,
          syncStatusNotifier: notifier,
          userRole: 'OWNER',
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(FloatingActionButton), findsOneWidget);

    await db.close();
  });

  testWidgets('MOBILE-SUPPLIER-016c: CASHIER does not see FAB', (tester) async {
    final db = AppDatabase(NativeDatabase.memory());
    final repo = SupplierRepository(db);
    final outbox = SyncOutboxRepository(db);
    final notifier = SyncStatusNotifier(
      networkMonitor: _FakeNetworkMonitor(),
      syncEngine: _FakeSyncEngine(),
      outbox: _FakeOutbox(),
      productRepository: ProductRepository(db),
      businessId: biz,
      authStateNotifier: _FakeAuthStateNotifier(),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: SupplierListScreen(
          businessId: biz,
          supplierRepo: repo,
          outboxRepo: outbox,
          syncStatusNotifier: notifier,
          userRole: 'CASHIER',
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(FloatingActionButton), findsNothing);

    await db.close();
  });

  // MOBILE-SUPPLIER-017: edit screen fields
  testWidgets('MOBILE-SUPPLIER-017: edit screen renders all fields', (tester) async {
    final db = AppDatabase(NativeDatabase.memory());
    final repo = SupplierRepository(db);
    final outbox = SyncOutboxRepository(db);

    await repo.upsertSupplier(Supplier(
      id: 's-edit-001',
      businessId: biz,
      name: 'PT Edit Test',
      code: 'EDT-001',
      contact: 'John Doe',
      phone: '+628111111111',
      email: 'john@test.com',
      category: 'Sembako',
      term: 'tempo_14',
      isActive: true,
      serverVersion: 3,
      localStatus: 'synced',
    ));

    await tester.pumpWidget(
      MaterialApp(
        home: SupplierEditScreen(
          businessId: biz,
          supplierId: 's-edit-001',
          supplierRepo: repo,
          outboxRepo: outbox,
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Edit Supplier'), findsOneWidget);
    expect(find.text('PT Edit Test'), findsOneWidget);
    expect(find.text('EDT-001'), findsOneWidget);
    expect(find.text('John Doe'), findsOneWidget);
    expect(find.text('+628111111111'), findsOneWidget);
    expect(find.text('john@test.com'), findsOneWidget);
    expect(find.text('Sembako'), findsOneWidget);
    expect(find.text('Tambah Supplier'), findsNothing);

    await db.close();
  });

  testWidgets('MOBILE-SUPPLIER-017b: create mode shows Tambah Supplier title and Simpan button', (tester) async {
    final db = AppDatabase(NativeDatabase.memory());
    final repo = SupplierRepository(db);
    final outbox = SyncOutboxRepository(db);

    await tester.pumpWidget(
      MaterialApp(
        home: SupplierEditScreen(
          businessId: biz,
          supplierId: null,
          supplierRepo: repo,
          outboxRepo: outbox,
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Tambah Supplier'), findsOneWidget);
    expect(find.text('Simpan'), findsOneWidget);

    await db.close();
  });
}
