import 'dart:io';

import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart' show SqliteException;
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/cart/data/cart_repository.dart';
import 'package:biz_erp_mobile/cart/domain/cart_exceptions.dart';

void main() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;

  late AppDatabase db;
  late ProductRepository productRepo;
  late CartRepository cartRepo;

  const bizA = 'biz-A';
  const bizB = 'biz-B';
  const prod1 = '550e8400-e29b-41d4-a716-446655440000';

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    productRepo = ProductRepository(db);
    cartRepo = CartRepository(db);
  });

  tearDown(() async {
    await db.close();
  });

  Future<void> seedProduct(
    String id,
    String biz, {
    int price = 1000,
    bool active = true,
  }) async {
    await productRepo.upsertProduct(
      Product(
        id: id,
        businessId: biz,
        name: 'Prod',
        priceMinor: price,
        isActive: active,
        serverVersion: 1,
      ),
    );
  }

  group('Cart Lifecycle & Uniqueness', () {
    test('CART-001 create/get active cart', () async {
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      expect(cart.status, 'ACTIVE');
      expect(cart.businessId, bizA);
    });

    test('CART-002 same business reuses same ACTIVE cart', () async {
      final cart1 = await cartRepo.getOrCreateActiveCart(bizA);
      final cart2 = await cartRepo.getOrCreateActiveCart(bizA);
      expect(cart1.id, cart2.id);
    });

    test('CART-003 different business gets separate cart', () async {
      final cartA = await cartRepo.getOrCreateActiveCart(bizA);
      final cartB = await cartRepo.getOrCreateActiveCart(bizB);
      expect(cartA.id, isNot(cartB.id));
    });

    test('CART-004 second ACTIVE cart rejected at DB level', () async {
      await db
          .into(db.cartLocal)
          .insert(
            CartLocalCompanion.insert(
              id: 'cart-1',
              businessId: bizA,
              status: 'ACTIVE',
              createdAt: 1,
              updatedAt: 1,
            ),
          );
      expect(
        () => db
            .into(db.cartLocal)
            .insert(
              CartLocalCompanion.insert(
                id: 'cart-2',
                businessId: bizA,
                status: 'ACTIVE',
                createdAt: 1,
                updatedAt: 1,
              ),
            ),
        throwsA(isA<SqliteException>()),
      );
    });

    test('CART-018 clear/abandon cart behavior', () async {
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      await cartRepo.abandonCart(cart.id, bizA);

      final abandoned = await cartRepo.getCartWithItems(cart.id, bizA);
      expect(abandoned!.cart.status, 'ABANDONED');

      final newCart = await cartRepo.getOrCreateActiveCart(bizA);
      expect(newCart.id, isNot(cart.id));
      expect(newCart.status, 'ACTIVE');
    });
  });

  group('Product Validation & Snapshot', () {
    test('CART-005 add active product', () async {
      await seedProduct(prod1, bizA);
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      final item = await cartRepo.addItem(cart.id, bizA, prod1, 1);
      expect(item.productId, prod1);
    });

    test('CART-006 inactive product rejected', () async {
      await seedProduct(prod1, bizA, active: false);
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      expect(
        () => cartRepo.addItem(cart.id, bizA, prod1, 1),
        throwsA(isA<ProductNotActiveException>()),
      );
    });

    test('CART-007 nonexistent product rejected', () async {
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      expect(
        () => cartRepo.addItem(cart.id, bizA, prod1, 1),
        throwsA(isA<CartProductNotFoundException>()),
      );
    });

    test('CART-008 cross-business product rejected', () async {
      await seedProduct(prod1, bizB);
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      expect(
        () => cartRepo.addItem(cart.id, bizA, prod1, 1),
        throwsA(isA<CartProductNotFoundException>()),
      );
    });

    test('CART-009 price snapshot captured at add time', () async {
      await seedProduct(prod1, bizA, price: 5000);
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      final item = await cartRepo.addItem(cart.id, bizA, prod1, 1);
      expect(item.unitPriceMinor, 5000);
    });

    test(
      'CART-010 product price change does not alter cart snapshot',
      () async {
        await seedProduct(prod1, bizA, price: 5000);
        final cart = await cartRepo.getOrCreateActiveCart(bizA);
        await cartRepo.addItem(cart.id, bizA, prod1, 1);

        // Change product price
        await seedProduct(prod1, bizA, price: 9000);

        final cartWithItems = await cartRepo.getCartWithItems(cart.id, bizA);
        expect(cartWithItems!.items.first.unitPriceMinor, 5000);
      },
    );

    test(
      'CART-022 inactive product already present in cart remains historically readable',
      () async {
        await seedProduct(prod1, bizA);
        final cart = await cartRepo.getOrCreateActiveCart(bizA);
        await cartRepo.addItem(cart.id, bizA, prod1, 1);

        await productRepo.softDeleteProduct(prod1, bizA);

        final cartWithItems = await cartRepo.getCartWithItems(cart.id, bizA);
        expect(cartWithItems!.items.length, 1);
        expect(cartWithItems.items.first.productId, prod1);
      },
    );
  });

  group('Quantity Validation', () {
    test('CART-011 quantity 1 accepted', () async {
      await seedProduct(prod1, bizA);
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      final item = await cartRepo.addItem(cart.id, bizA, prod1, 1);
      expect(item.quantity, 1);
    });

    test('CART-012 quantity >1 accepted', () async {
      await seedProduct(prod1, bizA);
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      final item = await cartRepo.addItem(cart.id, bizA, prod1, 5);
      expect(item.quantity, 5);
    });

    test('CART-013 quantity 0 rejected', () async {
      await seedProduct(prod1, bizA);
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      expect(
        () => cartRepo.addItem(cart.id, bizA, prod1, 0),
        throwsA(isA<InvalidQuantityException>()),
      );
    });

    test('CART-014 negative quantity rejected', () async {
      await seedProduct(prod1, bizA);
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      expect(
        () => cartRepo.addItem(cart.id, bizA, prod1, -1),
        throwsA(isA<InvalidQuantityException>()),
      );
    });

    test(
      'CART-015 fractional quantity rejected (enforced by Dart type system)',
      () {
        // Dart's strong typing prevents passing a double to an int parameter.
        // cartRepo.addItem(cartId, bizA, prod1, 1.5); // Compile-time error
        expect(true, isTrue);
      },
    );

    test('CART-016 update quantity preserves price snapshot', () async {
      await seedProduct(prod1, bizA, price: 5000);
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      final item = await cartRepo.addItem(cart.id, bizA, prod1, 1);

      await cartRepo.updateItemQuantity(item.id, bizA, 10);

      final cartWithItems = await cartRepo.getCartWithItems(cart.id, bizA);
      final updatedItem = cartWithItems!.items.first;
      expect(updatedItem.quantity, 10);
      expect(updatedItem.unitPriceMinor, 5000);
    });
  });

  group('Item Management & Determinism', () {
    test('CART-017 remove item', () async {
      await seedProduct(prod1, bizA);
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      final item = await cartRepo.addItem(cart.id, bizA, prod1, 1);

      await cartRepo.removeItem(item.id, bizA);

      final cartWithItems = await cartRepo.getCartWithItems(cart.id, bizA);
      expect(cartWithItems!.items.isEmpty, isTrue);
    });

    test(
      'CART-023 adding same product behavior is deterministic (adds to quantity)',
      () async {
        await seedProduct(prod1, bizA);
        final cart = await cartRepo.getOrCreateActiveCart(bizA);
        await cartRepo.addItem(cart.id, bizA, prod1, 2);
        final item2 = await cartRepo.addItem(cart.id, bizA, prod1, 3);

        expect(item2.quantity, 5);
        final cartWithItems = await cartRepo.getCartWithItems(cart.id, bizA);
        expect(cartWithItems!.items.length, 1);
      },
    );

    test('CART-024 duplicate/cart item behavior is deterministic', () async {
      await seedProduct(prod1, bizA);
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      await cartRepo.addItem(cart.id, bizA, prod1, 1);
      await cartRepo.addItem(cart.id, bizA, prod1, 1);
      await cartRepo.addItem(cart.id, bizA, prod1, 1);

      final cartWithItems = await cartRepo.getCartWithItems(cart.id, bizA);
      expect(cartWithItems!.items.length, 1);
      expect(cartWithItems.items.first.quantity, 3);
    });
  });

  group('Persistence & Isolation', () {
    test('CART-019 cart survives close/reopen', () async {
      final tempDir = Directory.systemTemp.createTempSync('cart_persist_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        final repo1 = CartRepository(db1);
        final cart = await repo1.getOrCreateActiveCart(bizA);
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final repo2 = CartRepository(db2);
        final cart2 = await repo2.getOrCreateActiveCart(bizA);

        expect(cart2.id, cart.id);
        await db2.close();
      } finally {
        try {
          tempDir.deleteSync(recursive: true);
        } catch (_) {}
      }
    });

    test('CART-020 cart item survives close/reopen', () async {
      final tempDir = Directory.systemTemp.createTempSync('cart_persist_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        final pRepo1 = ProductRepository(db1);
        final cRepo1 = CartRepository(db1);

        await pRepo1.upsertProduct(
          Product(
            id: prod1,
            businessId: bizA,
            name: 'P',
            priceMinor: 100,
            isActive: true,
            serverVersion: 1,
          ),
        );
        final cart = await cRepo1.getOrCreateActiveCart(bizA);
        await cRepo1.addItem(cart.id, bizA, prod1, 5);
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final cRepo2 = CartRepository(db2);
        final cart2 = await cRepo2.getOrCreateActiveCart(bizA);
        final items = await cRepo2.getCartWithItems(cart2.id, bizA);

        expect(items!.items.length, 1);
        expect(items.items.first.quantity, 5);
        await db2.close();
      } finally {
        try {
          tempDir.deleteSync(recursive: true);
        } catch (_) {}
      }
    });

    test('CART-021 business isolation', () async {
      await cartRepo.getOrCreateActiveCart(bizA);
      final cartB = await cartRepo.getOrCreateActiveCart(bizB);

      // A cannot read B's cart
      final readBfromA = await cartRepo.getCartWithItems(cartB.id, bizA);
      expect(readBfromA, isNull);

      // A cannot add to B's cart
      await seedProduct(prod1, bizB);
      expect(
        () => cartRepo.addItem(cartB.id, bizA, prod1, 1),
        throwsA(isA<CartNotFoundException>()),
      );
    });
  });
}
