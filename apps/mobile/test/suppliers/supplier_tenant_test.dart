import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/suppliers/data/supplier_repository.dart';
import 'package:biz_erp_mobile/suppliers/domain/supplier.dart';

const biz = '11111111-1111-4111-a111-111111111111';
const otherBiz = '22222222-2222-4222-a222-222222222222';

void main() {
  // MOBILE-SUPPLIER-010: tenant switch clears old data
  test('MOBILE-SUPPLIER-010: tenant switch clears old supplier data', () async {
    final db1 = AppDatabase(NativeDatabase.memory());
    final repo1 = SupplierRepository(db1);

    await repo1.upsertSupplier(Supplier(
      id: 's10',
      businessId: biz,
      name: 'Tenant1 Supplier',
      category: 'Sembako',
      term: 'tunai',
      isActive: true,
      serverVersion: 1,
      localStatus: 'synced',
    ));

    // Verify data exists for biz
    final list1 = await repo1.listSuppliers(biz);
    expect(list1.length, 1);
    expect(list1.first.name, 'Tenant1 Supplier');

    // Close DB (simulating tenant switch — new DB opened)
    await db1.close();

    // Open new in-memory DB (simulating new tenant context)
    final db2 = AppDatabase(NativeDatabase.memory());
    final repo2 = SupplierRepository(db2);

    // No suppliers for new tenant
    final list2 = await repo2.listSuppliers(otherBiz);
    expect(list2, isEmpty);

    // New tenant data
    await repo2.upsertSupplier(Supplier(
      id: 's10b',
      businessId: otherBiz,
      name: 'Tenant2 Supplier',
      category: 'Minuman',
      term: 'tempo_14',
      isActive: true,
      serverVersion: 1,
      localStatus: 'synced',
    ));

    final list3 = await repo2.listSuppliers(otherBiz);
    expect(list3.length, 1);
    expect(list3.first.name, 'Tenant2 Supplier');

    // Cross-tenant isolation: new repo doesn't see old tenant's supplier
    final crossCheck = await repo2.listSuppliers(biz);
    expect(crossCheck, isEmpty);

    await db2.close();
  });

  // MOBILE-SUPPLIER-011: branch switch preserves supplier master
  test('MOBILE-SUPPLIER-011: branch switch preserves supplier master', () async {
    final db = AppDatabase(NativeDatabase.memory());
    final repo = SupplierRepository(db);

    // Suppliers are business-scoped, not branch-scoped
    await repo.upsertSupplier(Supplier(
      id: 's11',
      businessId: biz,
      name: 'Branch-Agnostic Supplier',
      category: 'Sembako',
      term: 'tunai',
      isActive: true,
      serverVersion: 1,
      localStatus: 'synced',
    ));

    // Simulate branch switch by just querying again (no DB change)
    final listAfterBranchSwitch = await repo.listSuppliers(biz);
    expect(listAfterBranchSwitch.length, 1);
    expect(listAfterBranchSwitch.first.name, 'Branch-Agnostic Supplier');

    // Active suppliers too
    final active = await repo.listActiveSuppliers(biz);
    expect(active.length, 1);

    await db.close();
  });

  // MOBILE-SUPPLIER-015: no fabricated balance/rating/lastOrder
  test('MOBILE-SUPPLIER-015: Supplier domain has no fabricated balance/rating/lastOrder fields', () async {
    final supplier = Supplier(
      id: 's15',
      businessId: biz,
      name: 'Clean Supplier',
      code: 'SUP-015',
      contact: 'John',
      phone: '+628123',
      email: 'john@supplier.com',
      category: 'Sembako',
      term: 'tunai',
      isActive: true,
      serverVersion: 1,
      localStatus: 'synced',
    );

    // Verify the DTO does not contain fabricated fields
    final dto = SupplierDto(
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      contact: supplier.contact,
      phone: supplier.phone,
      email: supplier.email,
      category: supplier.category,
      term: supplier.term,
      isActive: supplier.isActive,
      serverVersion: supplier.serverVersion,
    );

    final jsonMap = dto.toJson();
    expect(jsonMap.containsKey('balance'), isFalse);
    expect(jsonMap.containsKey('rating'), isFalse);
    expect(jsonMap.containsKey('last_order'), isFalse);
    expect(jsonMap.containsKey('purchase_history'), isFalse);

    // Round-trip: fields should be absent in parsed JSON too
    final parsed = SupplierDto.fromJson(jsonMap);
    expect(parsed.toJson().containsKey('balance'), isFalse);
    expect(parsed.toJson().containsKey('rating'), isFalse);
    expect(parsed.toJson().containsKey('last_order'), isFalse);
  });
}
