import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'dart:io';

import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/product.dart';
import 'package:biz_erp_mobile/cart/data/cart_repository.dart';
import 'package:biz_erp_mobile/cart/domain/cart_exceptions.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/calc_models.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';
import 'package:biz_erp_mobile/sales/domain/checkout/checkout_models.dart';
import 'package:biz_erp_mobile/sales/domain/checkout/checkout_exceptions.dart';
import 'package:biz_erp_mobile/sales/data/checkout_service.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/calc_exceptions.dart';

void main() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  late AppDatabase db;
  late ProductRepository productRepo;
  late SyncOutboxRepository outbox;
  late CartRepository cartRepo;
  late CheckoutService checkoutService;
  late SaleCalculationEngine calcEngine;

  const bizA = 'biz-A';
  const branchA = 'branch-A';
  const cashier = 'cashier-1';
  const device = 'device-1';
  const prod1 = '550e8400-e29b-41d4-a716-446655440000';
  const idemKey = '22222222-2222-2222-2222-222222222222';
  const idemKey2 = '33333333-3333-3333-3333-333333333333';

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    productRepo = ProductRepository(db);
    outbox = SyncOutboxRepository(db);
    cartRepo = CartRepository(db);
    calcEngine = SaleCalculationEngine();
    checkoutService = CheckoutService(db, calcEngine);
  });

  tearDown(() async {
    await db.close();
  });

  Future<void> seedProductAndCart({
    int price = 10000,
    bool active = true,
  }) async {
    await productRepo.upsertProduct(
      Product(
        id: prod1,
        businessId: bizA,
        name: 'P',
        priceMinor: price,
        isActive: active,
        serverVersion: 1,
      ),
    );
    final cart = await cartRepo.getOrCreateActiveCart(bizA);
    await cartRepo.addItem(cart.id, bizA, prod1, 1);
  }

  Future<CheckoutRequest> makeRequest({
    String key = idemKey,
    PaymentMethod method = PaymentMethod.cash,
    int cash = 10000,
    CalcDiscount discount = const CalcDiscount.none(),
    int tax = 0,
  }) async {
    final cart = await cartRepo.getOrCreateActiveCart(bizA);
    return CheckoutRequest(
      businessId: bizA,
      branchId: branchA,
      cashierId: cashier,
      deviceId: device,
      idempotencyKey: key,
      cartId: cart.id,
      discount: discount,
      taxRateBps: tax,
      paymentMethod: method,
      cashReceivedMinor: cash,
    );
  }

  group('CHK-001 to CHK-005: Happy Path & Snapshot', () {
    test('CHK-001: Checkout CASH success, change correct', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 15000);
      final result = await checkoutService.checkout(req);
      expect(result.grandTotalMinor, 10000);
      expect(result.changeMinor, 5000);
    });

    test('CHK-002: Checkout TRANSFER success, change = 0', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(method: PaymentMethod.transfer);
      final result = await checkoutService.checkout(req);
      expect(result.grandTotalMinor, 10000);
      expect(result.changeMinor, 0);
    });

    test('CHK-003: Price snapshot used', () async {
      await seedProductAndCart(price: 10000);
      // Change product price after adding to cart
      await productRepo.upsertProduct(
        Product(
          id: prod1,
          businessId: bizA,
          name: 'P',
          priceMinor: 99999,
          isActive: true,
          serverVersion: 2,
        ),
      );
      final req = await makeRequest(cash: 10000);
      final result = await checkoutService.checkout(req);
      expect(result.grandTotalMinor, 10000); // Uses snapshot, not 99999
    });

    test('CHK-004: Discount & tax snapshot stored', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(
        cash: 10000,
        discount: const CalcDiscount(
          type: DiscountType.fixedMinor,
          value: 1000,
        ),
        tax: 1000, // 10%
      );
      final result = await checkoutService.checkout(req);
      // subtotal 10000, discount 1000 -> taxable 9000, tax 900 -> total 9900
      expect(result.grandTotalMinor, 9900);

      final sale = await (db.select(
        db.salesLocal,
      )..where((t) => t.clientTransactionId.equals(idemKey))).getSingle();
      expect(sale.subtotalMinor, 10000);
      expect(sale.discountMinor, 1000);
      expect(sale.taxMinor, 900);
      expect(sale.totalMinor, 9900);
    });

    test('CHK-005: Cart transitions to CHECKED_OUT', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 10000);
      await checkoutService.checkout(req);

      final cart = await (db.select(
        db.cartLocal,
      )..where((t) => t.id.equals(req.cartId))).getSingle();
      expect(cart.status, 'CHECKED_OUT');
    });
  });

  group('CHK-006 to CHK-009, CHK-026 to CHK-030: Idempotency & Fingerprint', () {
    test('CHK-006: Invalid UUID -> Reject', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(key: 'not-a-uuid');
      expect(
        () => checkoutService.checkout(req),
        throwsA(isA<InvalidIdempotencyKeyException>()),
      );
    });

    test('CHK-007: Same key + same request -> Return existing', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 10000);
      final res1 = await checkoutService.checkout(req);
      final res2 = await checkoutService.checkout(req);
      expect(res1.clientTransactionId, res2.clientTransactionId);
      expect(res1.receiptNumber, res2.receiptNumber);
    });

    test('CHK-008: Cross-business idempotency key', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 10000);
      await checkoutService.checkout(req);

      // Attempt to use same key for a different business
      final reqB = CheckoutRequest(
        businessId: 'biz-B',
        branchId: 'branch-B',
        cashierId: cashier,
        deviceId: device,
        idempotencyKey: idemKey,
        cartId: req.cartId,
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
        paymentMethod: PaymentMethod.cash,
        cashReceivedMinor: 10000,
      );
      // Since cart belongs to bizA, this will fail with CartNotFoundException before idempotency check
      expect(
        () => checkoutService.checkout(reqB),
        throwsA(isA<CartNotFoundException>()),
      );
    });

    test('CHK-009: Double tap simulation -> Only 1 sale', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 10000);

      Future<void> safeCheckout() async {
        try {
          await checkoutService.checkout(req);
        } catch (_) {}
      }

      // Simulate concurrent/double tap
      await Future.wait([safeCheckout(), safeCheckout()]);

      final sales = await db.select(db.salesLocal).get();
      expect(sales.length, 1);
    });

    test('CHK-011: Second transaction -> Seq 0002', () async {
      await seedProductAndCart(price: 10000);
      final req1 = await makeRequest(key: idemKey, cash: 10000);
      await checkoutService.checkout(req1);

      final cart2 = await cartRepo.getOrCreateActiveCart(bizA);
      await cartRepo.addItem(cart2.id, bizA, prod1, 1);

      final req2 = CheckoutRequest(
        businessId: bizA,
        branchId: branchA,
        cashierId: cashier,
        deviceId: device,
        idempotencyKey: idemKey2,
        cartId: cart2.id,
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
        paymentMethod: PaymentMethod.cash,
        cashReceivedMinor: 10000,
      );

      final result2 = await checkoutService.checkout(req2);
      expect(result2.receiptNumber.endsWith('0002'), isTrue);
    });

    test('CHK-013: Different branch -> Independent sequence', () async {
      await seedProductAndCart(price: 10000);
      final req1 = await makeRequest(key: idemKey, cash: 10000);
      await checkoutService.checkout(req1);

      final cart2 = await cartRepo.getOrCreateActiveCart(bizA);
      await cartRepo.addItem(cart2.id, bizA, prod1, 1);

      final req2 = CheckoutRequest(
        businessId: bizA,
        branchId: 'branch-B',
        cashierId: cashier,
        deviceId: device,
        idempotencyKey: idemKey2,
        cartId: cart2.id,
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
        paymentMethod: PaymentMethod.cash,
        cashReceivedMinor: 10000,
      );

      final result2 = await checkoutService.checkout(req2);
      expect(result2.receiptNumber.startsWith('branch-B-'), isTrue);
      expect(result2.receiptNumber.endsWith('0001'), isTrue);
    });

    test('CHK-019: Cart not ACTIVE -> Reject', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(key: idemKey, cash: 10000);
      await checkoutService.checkout(req); // Cart becomes CHECKED_OUT

      final req2 = CheckoutRequest(
        businessId: req.businessId,
        branchId: req.branchId,
        cashierId: req.cashierId,
        deviceId: req.deviceId,
        idempotencyKey: idemKey2,
        cartId: req.cartId,
        discount: req.discount,
        taxRateBps: req.taxRateBps,
        paymentMethod: req.paymentMethod,
        cashReceivedMinor: req.cashReceivedMinor,
      );

      expect(
        () => checkoutService.checkout(req2),
        throwsA(isA<CartNotActiveException>()),
      );
    });

    test('CHK-026: Same key + same request explicit', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 10000);
      await checkoutService.checkout(req);
      final res2 = await checkoutService.checkout(req);
      expect(res2.grandTotalMinor, 10000);
    });

    test('CHK-027: Same key + different payment method -> REJECT', () async {
      await seedProductAndCart(price: 10000);
      final req1 = await makeRequest(method: PaymentMethod.cash, cash: 10000);
      await checkoutService.checkout(req1);

      final req2 = await makeRequest(method: PaymentMethod.transfer);
      expect(
        () => checkoutService.checkout(req2),
        throwsA(isA<IdempotencyConflictException>()),
      );
    });

    test('CHK-028: Same key + different cart -> REJECT', () async {
      await seedProductAndCart(price: 10000);
      final req1 = await makeRequest(cash: 10000);
      await checkoutService.checkout(req1);

      // Create a new cart
      final newCart = await cartRepo.getOrCreateActiveCart(bizA);
      await cartRepo.addItem(newCart.id, bizA, prod1, 1);

      final req2 = CheckoutRequest(
        businessId: bizA,
        branchId: branchA,
        cashierId: cashier,
        deviceId: device,
        idempotencyKey: idemKey,
        cartId: newCart.id,
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
        paymentMethod: PaymentMethod.cash,
        cashReceivedMinor: 10000,
      );
      expect(
        () => checkoutService.checkout(req2),
        throwsA(isA<IdempotencyConflictException>()),
      );
    });

    test('CHK-029: Same key + different discount/tax -> REJECT', () async {
      await seedProductAndCart(price: 10000);
      final req1 = await makeRequest(cash: 10000);
      await checkoutService.checkout(req1);

      final req2 = await makeRequest(
        cash: 9000,
        discount: const CalcDiscount(
          type: DiscountType.fixedMinor,
          value: 1000,
        ),
      );
      expect(
        () => checkoutService.checkout(req2),
        throwsA(isA<IdempotencyConflictException>()),
      );
    });

    test('CHK-030: Same key + different cashReceived -> REJECT', () async {
      await seedProductAndCart(price: 10000);
      final req1 = await makeRequest(cash: 10000);
      await checkoutService.checkout(req1);

      final req2 = await makeRequest(cash: 20000);
      expect(
        () => checkoutService.checkout(req2),
        throwsA(isA<IdempotencyConflictException>()),
      );
    });
  });

  group('CHK-010 to CHK-013: Receipt Sequence', () {
    test('CHK-010: First transaction -> Seq 0001', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 10000);
      final result = await checkoutService.checkout(req);
      expect(result.receiptNumber.endsWith('0001'), isTrue);
    });

    test('CHK-011: Second transaction -> Seq 0002', () async {
      await seedProductAndCart(price: 10000);
      final req1 = await makeRequest(key: '33333333-3333-3333-3333-333333333333', cash: 10000);
      await checkoutService.checkout(req1);

      // Need a new cart for the second transaction since first is CHECKED_OUT
      final cart2 = await cartRepo.getOrCreateActiveCart(bizA);
      await cartRepo.addItem(cart2.id, bizA, prod1, 1);
      final req2 = await makeRequest(key: '44444444-4444-4444-4444-444444444444', cash: 10000);
      // Manually override cartId for req2
      final req2Updated = CheckoutRequest(
        businessId: req2.businessId,
        branchId: req2.branchId,
        cashierId: req2.cashierId,
        deviceId: req2.deviceId,
        idempotencyKey: req2.idempotencyKey,
        cartId: cart2.id,
        discount: req2.discount,
        taxRateBps: req2.taxRateBps,
        paymentMethod: req2.paymentMethod,
        cashReceivedMinor: req2.cashReceivedMinor,
      );

      final result2 = await checkoutService.checkout(req2Updated);
      expect(result2.receiptNumber.endsWith('0002'), isTrue);
    });

    test('CHK-012: Format receipt number correct', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 10000);
      final result = await checkoutService.checkout(req);
      expect(result.receiptNumber.startsWith('branch-A-'), isTrue);
      expect(result.receiptNumber.contains('-0001'), isTrue);
    });

    test('CHK-013: Different branch -> Independent sequence', () async {
      // This test verifies that receipt sequence uses request.branchId
      await seedProductAndCart(price: 10000);
      final req1 = await makeRequest(cash: 10000);
      await checkoutService.checkout(req1);

      final cart2 = await cartRepo.getOrCreateActiveCart(bizA);
      await cartRepo.addItem(cart2.id, bizA, prod1, 1);
      final req2 = CheckoutRequest(
        businessId: bizA,
        branchId: 'branch-B',
        cashierId: cashier,
        deviceId: device,
        idempotencyKey: '44444444-4444-4444-4444-444444444444',
        cartId: cart2.id,
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
        paymentMethod: PaymentMethod.cash,
        cashReceivedMinor: 10000,
      );
      final result2 = await checkoutService.checkout(req2);
      expect(result2.receiptNumber.startsWith('branch-B-'), isTrue);
      expect(result2.receiptNumber.endsWith('0001'), isTrue);
    });
  });

  group('CHK-014 to CHK-016: Payment Validation', () {
    test('CHK-014: CASH < Total -> Reject', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 5000);
      expect(
        () => checkoutService.checkout(req),
        throwsA(isA<InsufficientPaymentException>()),
      );
    });

    test('CHK-015: CASH = Total -> Change = 0', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 10000);
      final result = await checkoutService.checkout(req);
      expect(result.changeMinor, 0);
    });

    test('CHK-016: TRANSFER amount exact', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(
        method: PaymentMethod.transfer,
        cash: 999999,
      );
      final result = await checkoutService.checkout(req);
      expect(result.grandTotalMinor, 10000);
      expect(result.changeMinor, 0);
    });
  });

  group('CHK-017 to CHK-020: Cart & Business Validation', () {
    test('CHK-017: Empty cart -> Reject', () async {
      final cart = await cartRepo.getOrCreateActiveCart(bizA);
      final req = CheckoutRequest(
        businessId: bizA,
        branchId: branchA,
        cashierId: cashier,
        deviceId: device,
        idempotencyKey: idemKey,
        cartId: cart.id,
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
        paymentMethod: PaymentMethod.cash,
        cashReceivedMinor: 10000,
      );
      expect(
        () => checkoutService.checkout(req),
        throwsA(isA<EmptyCartException>()),
      );
    });

    test('CHK-018: Cart not found / wrong business -> Reject', () async {
      await seedProductAndCart(price: 10000);
      final req = CheckoutRequest(
        businessId: 'biz-B',
        branchId: 'branch-B',
        cashierId: cashier,
        deviceId: device,
        idempotencyKey: idemKey,
        cartId: 'non-existent-cart',
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
        paymentMethod: PaymentMethod.cash,
        cashReceivedMinor: 10000,
      );
      expect(
        () => checkoutService.checkout(req),
        throwsA(isA<CartNotFoundException>()),
      );
    });

    test('CHK-019: Cart not ACTIVE -> Reject', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 10000);
      await checkoutService.checkout(req); // Cart becomes CHECKED_OUT

      // Try to checkout again with same cart but new idempotency key
      final req2 = CheckoutRequest(
        businessId: req.businessId,
        branchId: req.branchId,
        cashierId: req.cashierId,
        deviceId: req.deviceId,
        idempotencyKey: '55555555-5555-5555-5555-555555555555',
        cartId: req.cartId,
        discount: req.discount,
        taxRateBps: req.taxRateBps,
        paymentMethod: req.paymentMethod,
        cashReceivedMinor: req.cashReceivedMinor,
      );
      expect(
        () => checkoutService.checkout(req2),
        throwsA(isA<CartNotActiveException>()),
      );
    });

    test('CHK-020: Inactive product in cart -> Still succeeds', () async {
      await seedProductAndCart(price: 10000);
      await productRepo.softDeleteProduct(prod1, bizA, outbox);

      final req = await makeRequest(cash: 10000);
      final result = await checkoutService.checkout(req);
      expect(result.grandTotalMinor, 10000);
    });
  });

  group('CHK-021 to CHK-025: Atomicity & Invariants', () {
    test('CHK-021: Rollback on error', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(
        cash: 5000,
      ); // Will throw InsufficientPaymentException

      try {
        await checkoutService.checkout(req);
      } catch (_) {}

      // Verify no sale was created
      final sales = await db.select(db.salesLocal).get();
      expect(sales.isEmpty, isTrue);

      // Verify cart is still ACTIVE
      final cart = await (db.select(
        db.cartLocal,
      )..where((t) => t.id.equals(req.cartId))).getSingle();
      expect(cart.status, 'ACTIVE');
    });

    test('CHK-022: Data persists after close/reopen', () async {
      final tempDir = Directory.systemTemp.createTempSync('checkout_persist_');
      final dbFile = File('${tempDir.path}/test.db');

      try {
        final db1 = AppDatabase(NativeDatabase(dbFile));
        final pRepo1 = ProductRepository(db1);
        final cRepo1 = CartRepository(db1);
        final eng1 = SaleCalculationEngine();
        final svc1 = CheckoutService(db1, eng1);

        await pRepo1.upsertProduct(
          Product(
            id: prod1,
            businessId: bizA,
            name: 'P',
            priceMinor: 10000,
            isActive: true,
            serverVersion: 1,
          ),
        );
        final cart = await cRepo1.getOrCreateActiveCart(bizA);
        await cRepo1.addItem(cart.id, bizA, prod1, 1);

        final req = CheckoutRequest(
          businessId: bizA,
          branchId: branchA,
          cashierId: cashier,
          deviceId: device,
          idempotencyKey: idemKey,
          cartId: cart.id,
          discount: const CalcDiscount.none(),
          taxRateBps: 0,
          paymentMethod: PaymentMethod.cash,
          cashReceivedMinor: 10000,
        );
        await svc1.checkout(req);
        await db1.close();

        final db2 = AppDatabase(NativeDatabase(dbFile));
        final sales = await db2.select(db2.salesLocal).get();
        expect(sales.length, 1);
        await db2.close();
      } finally {
        try {
          tempDir.deleteSync(recursive: true);
        } catch (_) {}
      }
    });

    test('CHK-023: Foreign keys valid', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 10000);
      await checkoutService.checkout(req);

      final items = await db.select(db.saleItemsLocal).get();
      expect(items.length, 1);
      expect(items.first.clientTransactionId, idemKey);

      final payments = await db.select(db.paymentsLocal).get();
      expect(payments.length, 1);
      expect(payments.first.clientTransactionId, idemKey);
    });

    test('CHK-024: Total in DB == Total from Engine', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 10000);
      final result = await checkoutService.checkout(req);

      final sale = await (db.select(
        db.salesLocal,
      )..where((t) => t.clientTransactionId.equals(idemKey))).getSingle();
      expect(sale.totalMinor, result.grandTotalMinor);
    });

    test('CHK-025: No negative financial values', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 10000);
      await checkoutService.checkout(req);

      final sale = await (db.select(
        db.salesLocal,
      )..where((t) => t.clientTransactionId.equals(idemKey))).getSingle();
      expect(sale.subtotalMinor >= 0, isTrue);
      expect(sale.discountMinor >= 0, isTrue);
      expect(sale.taxMinor >= 0, isTrue);
      expect(sale.totalMinor >= 0, isTrue);

      final payment = await (db.select(
        db.paymentsLocal,
      )..where((t) => t.clientTransactionId.equals(idemKey))).getSingle();
      expect(payment.amountMinor >= 0, isTrue);
      if (payment.changeMinor != null) {
        expect(payment.changeMinor! >= 0, isTrue);
      }
    });
  });

  group('CHK-031: Receipt sequence not consumed on failure', () {
    test('CHK-031: Failed checkout does not increment sequence', () async {
      await seedProductAndCart(price: 10000);
      final req = await makeRequest(cash: 5000); // Will fail with InsufficientPaymentException

      try {
        await checkoutService.checkout(req);
      } catch (_) {}

      // Verify no sale was created
      final sales = await db.select(db.salesLocal).get();
      expect(sales.isEmpty, isTrue);

      // Verify sequence was not consumed (last_sequence should still be 0)
      final seqRow = await (db.select(db.receiptSequencesLocal)).getSingleOrNull();
      expect(seqRow, isNull); // No sequence row created because checkout failed
    });
  });
}
