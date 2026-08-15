import 'dart:convert';
import 'package:drift/drift.dart' hide isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/products/domain/product_exceptions.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';

void main() {
  late AppDatabase db;
  late ProductRepository repo;
  late SyncOutboxRepository outbox;

  const businessId = 'test-biz-update';
  const productId = '11111111-1111-1111-1111-111111111111';

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    repo = ProductRepository(db);
    outbox = SyncOutboxRepository(db);
  });

  tearDown(() async {
    await db.close();
  });

  Product baseProduct({
    String name = 'Test Product',
    int price = 10000,
    String? barcode,
    String localStatus = 'synced',
    int serverVersion = 5,
  }) {
    return Product(
      id: productId,
      businessId: businessId,
      name: name,
      priceMinor: price,
      isActive: true,
      serverVersion: serverVersion,
      barcode: barcode,
      localStatus: localStatus,
    );
  }

  Future<void> seedExisting({String name = 'Original', int serverVersion = 5}) async {
    await repo.upsertProduct(baseProduct(name: name, serverVersion: serverVersion));
    await (db.update(db.productsLocal)..where((t) => t.id.equals(productId)))
        .write(const ProductsLocalCompanion(localStatus: Value('synced')));
  }

  group('updateProduct - dirty flag', () {
    test('PROD-U01: updateProduct sets localStatus to dirty', () async {
      await seedExisting();
      final updated = baseProduct(name: 'Updated Name');
      await repo.updateProduct(updated, outbox);

      final result = await repo.getProductById(productId, businessId);
      expect(result, isNotNull);
      expect(result!.localStatus, 'dirty');
      expect(result.isDirty, isTrue);
    });

    test('PROD-U02: updateProduct preserves existing serverVersion', () async {
      await seedExisting(serverVersion: 7);
      final updated = baseProduct(name: 'Changed', serverVersion: 999);
      await repo.updateProduct(updated, outbox);

      final result = await repo.getProductById(productId, businessId);
      expect(result!.serverVersion, 7, reason: 'serverVersion must NOT be overwritten by UI');
    });

    test('PROD-U03: updateProduct enqueues to sync_outbox', () async {
      await seedExisting();
      final updated = baseProduct(name: 'To Be Synced');
      await repo.updateProduct(updated, outbox);

      final counts = await outbox.counts();
      expect(counts.pending, 1);
    });

    test('PROD-U04: updateProduct preserves businessId', () async {
      await seedExisting();
      final updated = baseProduct(name: 'Changed');
      await repo.updateProduct(updated, outbox);

      final result = await repo.getProductById(productId, businessId);
      expect(result!.businessId, businessId);
    });
  });

  group('updateProduct - validation', () {
    test('PROD-U05: empty name rejected', () async {
      await seedExisting();
      final updated = baseProduct(name: '   ');
      expect(
        () => repo.updateProduct(updated, outbox),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('PROD-U06: negative price rejected', () async {
      await seedExisting();
      final updated = baseProduct(price: -100);
      expect(
        () => repo.updateProduct(updated, outbox),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('PROD-U07: non-existent product rejected', () async {
      final bogus = Product(
        id: '99999999-9999-9999-9999-999999999999',
        businessId: businessId,
        name: 'Ghost',
        priceMinor: 1000,
        isActive: true,
        serverVersion: 1,
      );
      expect(
        () => repo.updateProduct(bogus, outbox),
        throwsA(isA<ProductNotFoundException>()),
      );
    });
  });

  group('updateProduct - domain model', () {
    test('PROD-U08: Product domain exposes localStatus', () async {
      await seedExisting();
      final p = await repo.getProductById(productId, businessId);
      expect(p, isNotNull);
      expect(p!.localStatus, 'synced');
      expect(p.isDirty, isFalse);
    });

    test('PROD-U09: Product domain exposes barcode', () async {
      await seedExisting();
      await (db.update(db.productsLocal)..where((t) => t.id.equals(productId)))
          .write(const ProductsLocalCompanion(barcode: Value('ABC123')));

      final p = await repo.getProductById(productId, businessId);
      expect(p!.barcode, 'ABC123');
    });
  });

  group('updateProduct - atomicity safety', () {
    test('PROD-U10: dirty state preserved on successful update', () async {
      await seedExisting();
      final updated = baseProduct(name: 'Safe');
      await repo.updateProduct(updated, outbox);

      final p = await repo.getProductById(productId, businessId);
      expect(p!.localStatus, 'dirty');
      expect(p.name, 'Safe');
    });
  });

  group('updateProduct - deactivate/restore sync', () {
    test('PROD-C03: softDeleteProduct sets isActive=false, localStatus=dirty, enqueues upsert', () async {
      await seedExisting();
      await repo.softDeleteProduct(productId, businessId, outbox);

      final p = await repo.getProductById(productId, businessId);
      expect(p, isNotNull);
      expect(p!.isActive, isFalse);
      expect(p.localStatus, 'dirty');
      expect(p.serverVersion, 5, reason: 'serverVersion must be preserved');
      final allOutbox = await db.select(db.syncOutbox).get();
      expect(allOutbox.length, 1);
      expect(allOutbox.first.operation, 'upsert');
      expect(allOutbox.first.idempotencyKey, productId);
      expect(allOutbox.first.status, 'pending');

      // Verify payload has is_active: 0 (integer, database stores as INTEGER)
      final payloadJson = allOutbox.first.payloadJson;
      final payload = jsonDecode(payloadJson) as Map<String, dynamic>;
      expect(payload['is_active'] == 0 || payload['isActive'] == 0, isTrue,
          reason: 'Payload should have is_active=0 (integer), got: $payload');
    });

    test('PROD-C04: restoreProduct sets isActive=true, localStatus=dirty, enqueues upsert', () async {
      // Seed as inactive
      await repo.upsertProduct(baseProduct(name: 'Inactive', serverVersion: 5));
      await (db.update(db.productsLocal)..where((t) => t.id.equals(productId)))
          .write(const ProductsLocalCompanion(isActive: Value(0), localStatus: Value('synced')));

      await repo.restoreProduct(productId, businessId, outbox);

      final p = await repo.getProductById(productId, businessId);
      expect(p, isNotNull);
      expect(p!.isActive, isTrue);
      expect(p.localStatus, 'dirty');
      expect(p.serverVersion, 5, reason: 'serverVersion must be preserved');

      final allOutbox = await db.select(db.syncOutbox).get();
      expect(allOutbox.length, 1);
      expect(allOutbox.first.operation, 'upsert');
      expect(allOutbox.first.idempotencyKey, productId);
      expect(allOutbox.first.status, 'pending');

      // Verify payload has is_active: 1 (integer, database stores as INTEGER)
      final payloadJson = allOutbox.first.payloadJson;
      final payload = jsonDecode(payloadJson) as Map<String, dynamic>;
      expect(payload['is_active'] == 1 || payload['isActive'] == 1, isTrue,
          reason: 'Payload should have is_active=1 (integer), got: $payload');
    });
  });
}
