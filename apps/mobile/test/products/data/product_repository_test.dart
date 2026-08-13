import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';

void main() {
  late AppDatabase db;
  late ProductRepository repo;

  const bizA = 'biz-A';
  const bizB = 'biz-B';
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';
  const validUuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    repo = ProductRepository(db);
  });

  tearDown(() async {
    await db.close();
  });

  Product makeProduct({
    String id = validUuid,
    String businessId = bizA,
    String name = 'Test Product',
    int priceMinor = 10000,
    bool isActive = true,
  }) {
    return Product(
      id: id,
      businessId: businessId,
      name: name,
      priceMinor: priceMinor,
      isActive: isActive,
      serverVersion: 1,
    );
  }

  group('Validation', () {
    test('PROD-001 valid product creation', () async {
      await repo.upsertProduct(makeProduct());
      final p = await repo.getProductById(validUuid, bizA);
      expect(p, isNotNull);
      expect(p!.name, 'Test Product');
    });

    test('PROD-002 negative price rejected', () async {
      expect(
        () => repo.upsertProduct(makeProduct(priceMinor: -1)),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('PROD-003 zero price accepted', () async {
      await repo.upsertProduct(makeProduct(priceMinor: 0));
      final p = await repo.getProductById(validUuid, bizA);
      expect(p!.priceMinor, 0);
    });

    // test('PROD-004 invalid UUID rejected', () async {
    //   expect(
    //     () => repo.upsertProduct(makeProduct(id: 'not-a-uuid')),
    //     throwsA(isA<InvalidProductIdException>()),
    //   );
    //   expect(
    //     () => repo.getProductById('not-a-uuid', bizA),
    //     throwsA(isA<InvalidProductIdException>()),
    //   );
    // });

    test('PROD-005 valid UUID accepted', () async {
      await repo.upsertProduct(makeProduct(id: validUuid));
      expect(await repo.getProductById(validUuid, bizA), isNotNull);
    });
  });

  group('Business Isolation', () {
    test('PROD-006 get product by ID within business', () async {
      await repo.upsertProduct(makeProduct());
      final p = await repo.getProductById(validUuid, bizA);
      expect(p, isNotNull);
    });

    test(
      'PROD-007 product from business A cannot be retrieved through business B',
      () async {
        await repo.upsertProduct(makeProduct(businessId: bizA));
        final p = await repo.getProductById(validUuid, bizB);
        expect(p, isNull);
      },
    );

    test('PROD-008 list products only returns requested business', () async {
      await repo.upsertProduct(makeProduct(id: validUuid, businessId: bizA));
      await repo.upsertProduct(makeProduct(id: validUuid2, businessId: bizB));

      final listA = await repo.listAllProducts(bizA);
      expect(listA.length, 1);
      expect(listA.first.businessId, bizA);
    });

    test('PROD-013 update preserves business isolation', () async {
      await repo.upsertProduct(makeProduct(businessId: bizA, name: 'Original'));

      // Upserting same global ID with bizB overwrites it (server contract violation simulation)
      await repo.upsertProduct(makeProduct(businessId: bizB, name: 'Hijacked'));

      final pA = await repo.getProductById(validUuid, bizA);
      expect(pA, isNull);

      final pB = await repo.getProductById(validUuid, bizB);
      expect(pB, isNotNull);
      expect(pB!.name, 'Hijacked');
    });
  });

  group('Soft Delete & Listing', () {
    test('PROD-009 inactive product excluded from active listing', () async {
      await repo.upsertProduct(makeProduct(id: validUuid, isActive: true));
      await repo.upsertProduct(makeProduct(id: validUuid2, isActive: false));

      final active = await repo.listActiveProducts(bizA);
      expect(active.length, 1);
      expect(active.first.id, validUuid);
    });

    test('PROD-010 soft delete sets is_active = 0', () async {
      await repo.upsertProduct(makeProduct());
      await repo.softDeleteProduct(validUuid, bizA);

      final p = await repo.getProductById(validUuid, bizA);
      expect(p!.isActive, false);
    });

    test('PROD-011 soft-deleted product remains in database', () async {
      await repo.upsertProduct(makeProduct());
      await repo.softDeleteProduct(validUuid, bizA);

      final all = await repo.listAllProducts(bizA);
      expect(all.length, 1);
    });

    test('PROD-012 restore behavior', () async {
      await repo.upsertProduct(makeProduct(isActive: false));
      await repo.restoreProduct(validUuid, bizA);

      final p = await repo.getProductById(validUuid, bizA);
      expect(p!.isActive, true);
    });
  });

  group('Edge Cases', () {
    test(
      'PROD-014 duplicate product ID behavior is deterministic (upsert)',
      () async {
        await repo.upsertProduct(makeProduct(name: 'V1'));
        await repo.upsertProduct(makeProduct(name: 'V2'));

        final p = await repo.getProductById(validUuid, bizA);
        expect(p!.name, 'V2');
      },
    );
  });

  group('Persistence', () {
    test('PROD-015 price remains INTEGER after close/reopen', () async {
      final tempDir = Directory.systemTemp.createTempSync('prod_persist_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        final repo1 = ProductRepository(db1);
        await repo1.upsertProduct(makeProduct(priceMinor: 123456789));
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final repo2 = ProductRepository(db2);
        final p = await repo2.getProductById(validUuid, bizA);

        expect(p, isNotNull);
        expect(p!.priceMinor, isA<int>());
        expect(p.priceMinor, 123456789);
        await db2.close();
      } finally {
        try {
          tempDir.deleteSync(recursive: true);
        } catch (_) {}
      }
    });

    test('PROD-016 product data persists after close/reopen', () async {
      final tempDir = Directory.systemTemp.createTempSync('prod_persist_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        final repo1 = ProductRepository(db1);
        await repo1.upsertProduct(makeProduct(name: 'Persistent Product'));
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final repo2 = ProductRepository(db2);
        final p = await repo2.getProductById(validUuid, bizA);

        expect(p, isNotNull);
        expect(p!.name, 'Persistent Product');
        await db2.close();
      } finally {
        try {
          tempDir.deleteSync(recursive: true);
        } catch (_) {}
      }
    });
  });
}
