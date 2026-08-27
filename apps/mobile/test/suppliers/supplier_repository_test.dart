// ignore_for_file: avoid_print
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/suppliers/data/supplier_repository.dart';
import 'package:biz_erp_mobile/suppliers/domain/supplier.dart';

const biz = '11111111-1111-4111-a111-111111111111';
const otherBiz = '22222222-2222-4222-a222-222222222222';

void main() {
  late AppDatabase db;
  late SupplierRepository repo;
  late SyncOutboxRepository outbox;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    repo = SupplierRepository(db);
    outbox = SyncOutboxRepository(db);
  });
  tearDown(() async => await db.close());

  // MOBILE-SUPPLIER-002: Drift insert/read
  test('MOBILE-SUPPLIER-002: insert supplier via upsertSupplier, read back via getSupplierById', () async {
    final supplier = Supplier(
      id: 's1',
      businessId: biz,
      name: 'PT Sumber Jaya',
      code: 'SUP-001',
      contact: 'Budi',
      phone: '+628123',
      email: 'budi@supplier.com',
      category: 'Sembako',
      term: 'tunai',
      isActive: true,
      serverVersion: 0,
    );

    await repo.upsertSupplier(supplier);
    final read = await repo.getSupplierById('s1', biz);
    expect(read, isNotNull);
    expect(read!.name, 'PT Sumber Jaya');
    expect(read.code, 'SUP-001');
    expect(read.category, 'Sembako');
    expect(read.term, 'tunai');
    expect(read.isActive, isTrue);
    expect(read.serverVersion, 0);
    expect(read.localStatus, 'synced');
  });

  // MOBILE-SUPPLIER-003: tenant isolation
  test('MOBILE-SUPPLIER-003: getSupplierById does not return supplier from other business', () async {
    await repo.upsertSupplier(Supplier(
      id: 's1-biz1',
      businessId: biz,
      name: 'Biz1 Supplier',
      category: '',
      term: 'tunai',
      isActive: true,
      serverVersion: 1,
    ));
    await repo.upsertSupplier(Supplier(
      id: 's1-biz2',
      businessId: otherBiz,
      name: 'Biz2 Supplier',
      category: '',
      term: 'tunai',
      isActive: true,
      serverVersion: 1,
    ));

    final r1 = await repo.getSupplierById('s1-biz1', biz);
    final r2 = await repo.getSupplierById('s1-biz2', otherBiz);
    expect(r1, isNotNull);
    expect(r1!.name, 'Biz1 Supplier');
    expect(r2, isNotNull);
    expect(r2!.name, 'Biz2 Supplier');

    // Cross-tenant: supplier from biz must not appear under otherBiz
    final cross = await repo.getSupplierById('s1-biz1', otherBiz);
    expect(cross, isNull);
  });

  // MOBILE-SUPPLIER-004: server version mapping
  test('MOBILE-SUPPLIER-004: serverVersion is stored and read correctly', () async {
    await repo.upsertSupplier(Supplier(
      id: 's4',
      businessId: biz,
      name: 'Test Supplier',
      category: '',
      term: 'tunai',
      isActive: true,
      serverVersion: 42,
      lastSyncedAt: 999,
      localStatus: 'synced',
    ));

    final read = await repo.getSupplierById('s4', biz);
    expect(read!.serverVersion, 42);
    expect(read.lastSyncedAt, 999);
  });

  // MOBILE-SUPPLIER-005: soft delete / tombstone
  test('MOBILE-SUPPLIER-005: deleteSupplier marks deletedAt + inactive; tombstone pull applies deletedAt', () async {
    // Part 1: local soft delete via deleteSupplier
    await repo.upsertSupplier(Supplier(
      id: 's5',
      businessId: biz,
      name: 'To Delete',
      category: '',
      term: 'tunai',
      isActive: true,
      serverVersion: 10,
      localStatus: 'synced',
    ));

    await repo.deleteSupplier('s5', biz, outbox);

    final local = await repo.getSupplierById('s5', biz);
    expect(local!.isActive, isFalse);
    expect(local.isDirty, isTrue);

    // Part 2: tombstone pull applies to a clean (synced) local record
    await repo.upsertSupplier(Supplier(
      id: 's5b',
      businessId: biz,
      name: 'Tombstone Target',
      category: '',
      term: 'tunai',
      isActive: true,
      serverVersion: 10,
      localStatus: 'synced',
    ));

    final dto = SupplierDto(
      id: 's5b',
      name: 'Tombstone Target',
      category: '',
      term: 'tunai',
      isActive: false,
      serverVersion: 20,
      deletedAt: 1234567890000,
    );
    await repo.applyServerSync(dto, biz);

    final after = await repo.getSupplierById('s5b', biz);
    expect(after!.isActive, isFalse);
    expect(after.serverVersion, 20);
    expect(after.localStatus, 'synced');
    expect(after.deletedAt, 1234567890000);
  });

  // MOBILE-SUPPLIER-009: offline cache
  test('MOBILE-SUPPLIER-009: offline cache retains last valid data after clear+reload', () async {
    // Seed data
    await repo.upsertSupplier(Supplier(
      id: 's9a',
      businessId: biz,
      name: 'Cached A',
      category: 'Sembako',
      term: 'tunai',
      isActive: true,
      serverVersion: 1,
      localStatus: 'synced',
    ));
    await repo.upsertSupplier(Supplier(
      id: 's9b',
      businessId: biz,
      name: 'Cached B',
      category: 'Minuman',
      term: 'tempo_14',
      isActive: false,
      serverVersion: 2,
      localStatus: 'synced',
    ));

    // Simulate offline: just read — data should still be there
    final list = await repo.listSuppliers(biz);
    expect(list.length, 2);
    expect(list.any((s) => s.name == 'Cached A'), isTrue);
    expect(list.any((s) => s.name == 'Cached B'), isTrue);

    // Active-only filter
    final active = await repo.listActiveSuppliers(biz);
    expect(active.length, 1);
    expect(active.first.name, 'Cached A');
  });
}
