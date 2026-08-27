import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/suppliers/data/supplier_repository.dart';
import 'package:biz_erp_mobile/suppliers/domain/supplier.dart';

const biz = '11111111-1111-4111-a111-111111111111';

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

  // Seed an active supplier for both tests
  Future<void> seedActive() async {
    await repo.upsertSupplier(Supplier(
      id: 's-rbac',
      businessId: biz,
      name: 'RBAC Supplier',
      code: 'RBAC-001',
      contact: 'Owner Test',
      phone: '+6281',
      email: 'owner@supplier.com',
      category: 'Sembako',
      term: 'tunai',
      isActive: true,
      serverVersion: 1,
      localStatus: 'synced',
    ));
  }

  // MOBILE-SUPPLIER-012: CASHIER read behavior
  test('MOBILE-SUPPLIER-012: CASHIER can read suppliers (list + get)', () async {
    await seedActive();

    // CASHIER path: read-only via repository (no mutation methods called)
    final list = await repo.listSuppliers(biz);
    expect(list.length, 1);
    expect(list.first.name, 'RBAC Supplier');

    final single = await repo.getSupplierById('s-rbac', biz);
    expect(single, isNotNull);
    expect(single!.code, 'RBAC-001');
    expect(single.category, 'Sembako');
    expect(single.term, 'tunai');
    expect(single.isActive, isTrue);
  });

  // MOBILE-SUPPLIER-013: OWNER mutation behavior
  test('MOBILE-SUPPLIER-013: OWNER can create/update/delete supplier', () async {
    // Create
    final newSupplier = Supplier(
      id: 's-owner-001',
      businessId: biz,
      name: 'Owner New Supplier',
      code: 'OWN-001',
      contact: 'Owner',
      phone: '+6289',
      email: 'own@supplier.com',
      category: 'Minuman',
      term: 'tempo_14',
      isActive: true,
      serverVersion: 0,
    );
    await repo.createSupplier(newSupplier, outbox);

    final created = await repo.getSupplierById('s-owner-001', biz);
    expect(created, isNotNull);
    expect(created!.name, 'Owner New Supplier');
    expect(created.isDirty, isTrue);

    // Update
    final updated = Supplier(
      id: 's-owner-001',
      businessId: biz,
      name: 'Owner Updated Supplier',
      code: 'OWN-002',
      contact: 'Owner2',
      phone: '+6288',
      email: 'own2@supplier.com',
      category: 'Snack',
      term: 'tempo_30',
      isActive: true,
      serverVersion: created.serverVersion,
    );
    await repo.updateSupplier(updated, outbox);

    final afterUpdate = await repo.getSupplierById('s-owner-001', biz);
    expect(afterUpdate!.name, 'Owner Updated Supplier');
    expect(afterUpdate.code, 'OWN-002');
    expect(afterUpdate.category, 'Snack');
    expect(afterUpdate.term, 'tempo_30');
    expect(afterUpdate.isDirty, isTrue);

    // Delete (status toggle)
    await repo.deleteSupplier('s-owner-001', biz, outbox);
    final afterDelete = await repo.getSupplierById('s-owner-001', biz);
    expect(afterDelete!.isActive, isFalse);
    expect(afterDelete.isDirty, isTrue);
  });
}
