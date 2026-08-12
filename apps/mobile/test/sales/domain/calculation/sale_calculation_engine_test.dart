import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/calc_models.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/calc_exceptions.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/sale_calculation_engine.dart';

void main() {
  late SaleCalculationEngine engine;

  setUp(() {
    engine = SaleCalculationEngine();
  });

  group('CALC-001 to CALC-004: Subtotal & Basic Math', () {
    test('CALC-001: 1 item, qty 1, price 10000 → subtotal 10000', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
      );
      expect(result.subtotalMinor, 10000);
      expect(result.grandTotalMinor, 10000);
    });

    test('CALC-002: Multi item, multi qty → subtotal accurate', () {
      final result = engine.calculate(
        items: [
          const CalcCartItem(quantity: 2, unitPriceMinor: 5000), // 10000
          const CalcCartItem(quantity: 3, unitPriceMinor: 2000), // 6000
          const CalcCartItem(quantity: 1, unitPriceMinor: 4000), // 4000
        ],
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
      );
      expect(result.subtotalMinor, 20000);
    });

    test('CALC-003: Cart empty → throw EmptyCartException', () {
      expect(
        () => engine.calculate(
          items: [],
          discount: const CalcDiscount.none(),
          taxRateBps: 0,
        ),
        throwsA(isA<EmptyCartException>()),
      );
    });

    test('CALC-004: Qty or Price negative → throw ArgumentError', () {
      expect(
        () => engine.calculate(
          items: [const CalcCartItem(quantity: -1, unitPriceMinor: 1000)],
          discount: const CalcDiscount.none(),
          taxRateBps: 0,
        ),
        throwsA(isA<ArgumentError>()),
      );

      expect(
        () => engine.calculate(
          items: [const CalcCartItem(quantity: 1, unitPriceMinor: -1000)],
          discount: const CalcDiscount.none(),
          taxRateBps: 0,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('CALC-005 to CALC-010: Discount Logic', () {
    test('CALC-005: Discount none → discount = 0', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
      );
      expect(result.discountMinor, 0);
      expect(result.grandTotalMinor, 10000);
    });

    test('CALC-006: Discount fixedMinor (5000) → discount = 5000', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
        discount: const CalcDiscount(
          type: DiscountType.fixedMinor,
          value: 5000,
        ),
        taxRateBps: 0,
      );
      expect(result.discountMinor, 5000);
      expect(result.grandTotalMinor, 5000);
    });

    test(
      'CALC-007: Discount percentageBps (1000 bps = 10% of 100000) → discount = 10000',
      () {
        final result = engine.calculate(
          items: [const CalcCartItem(quantity: 1, unitPriceMinor: 100000)],
          discount: const CalcDiscount(
            type: DiscountType.percentageBps,
            value: 1000,
          ),
          taxRateBps: 0,
        );
        expect(result.discountMinor, 10000);
        expect(result.grandTotalMinor, 90000);
      },
    );

    test(
      'CALC-008: Rounding discount percentage (10001 * 1000 / 10000 = 1000, not 1000.1)',
      () {
        final result = engine.calculate(
          items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10001)],
          discount: const CalcDiscount(
            type: DiscountType.percentageBps,
            value: 1000,
          ),
          taxRateBps: 0,
        );
        expect(result.discountMinor, 1000); // Truncated, not rounded
        expect(result.grandTotalMinor, 9001);
      },
    );

    test('CALC-009: Discount > Subtotal → ArgumentError', () {
      expect(
        () => engine.calculate(
          items: [const CalcCartItem(quantity: 1, unitPriceMinor: 5000)],
          discount: const CalcDiscount(
            type: DiscountType.fixedMinor,
            value: 10000,
          ),
          taxRateBps: 0,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test(
      'CALC-010: Percentage discount > 100% (15000 bps) → ArgumentError',
      () {
        expect(
          () => engine.calculate(
            items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
            discount: const CalcDiscount(
              type: DiscountType.percentageBps,
              value: 15000,
            ),
            taxRateBps: 0,
          ),
          throwsA(isA<ArgumentError>()),
        );
      },
    );
  });

  group('CALC-011 to CALC-015: Tax Logic', () {
    test('CALC-011: Tax 0 bps → tax = 0', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1, unitPriceMinor: 100000)],
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
      );
      expect(result.taxMinor, 0);
      expect(result.grandTotalMinor, 100000);
    });

    test('CALC-012: Tax 1100 bps (11% of 100000) → tax = 11000', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1, unitPriceMinor: 100000)],
        discount: const CalcDiscount.none(),
        taxRateBps: 1100,
      );
      expect(result.taxMinor, 11000);
      expect(result.grandTotalMinor, 111000);
    });

    test('CALC-013: Rounding tax (10001 * 1100 / 10000 = 1100)', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10001)],
        discount: const CalcDiscount.none(),
        taxRateBps: 1100,
      );
      expect(result.taxMinor, 1100); // Truncated
      expect(result.grandTotalMinor, 11101);
    });

    test(
      'CALC-014: Tax calculated from taxableAmount (after discount), not subtotal',
      () {
        final result = engine.calculate(
          items: [const CalcCartItem(quantity: 1, unitPriceMinor: 100000)],
          discount: const CalcDiscount(
            type: DiscountType.fixedMinor,
            value: 20000,
          ),
          taxRateBps: 1100,
        );
        expect(result.subtotalMinor, 100000);
        expect(result.discountMinor, 20000);
        expect(result.taxableAmountMinor, 80000);
        expect(result.taxMinor, 8800); // 11% of 80000, not 100000
        expect(result.grandTotalMinor, 88800);
      },
    );

    test('CALC-015: Tax rate negative → ArgumentError', () {
      expect(
        () => engine.calculate(
          items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
          discount: const CalcDiscount.none(),
          taxRateBps: -100,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('CALC-016 to CALC-020: Validation Edge Cases', () {
    test('CALC-016: quantity = 0 → reject', () {
      expect(
        () => engine.calculate(
          items: [const CalcCartItem(quantity: 0, unitPriceMinor: 1000)],
          discount: const CalcDiscount.none(),
          taxRateBps: 0,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('CALC-017: fixed discount negative → reject', () {
      expect(
        () => engine.calculate(
          items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
          discount: const CalcDiscount(
            type: DiscountType.fixedMinor,
            value: -5000,
          ),
          taxRateBps: 0,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('CALC-018: percentage discount negative → reject', () {
      expect(
        () => engine.calculate(
          items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
          discount: const CalcDiscount(
            type: DiscountType.percentageBps,
            value: -1000,
          ),
          taxRateBps: 0,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('CALC-019: tax rate negative → reject', () {
      expect(
        () => engine.calculate(
          items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
          discount: const CalcDiscount.none(),
          taxRateBps: -500,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('CALC-020: percentage discount exactly 10000 bps → valid', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
        discount: const CalcDiscount(
          type: DiscountType.percentageBps,
          value: 10000,
        ),
        taxRateBps: 0,
      );
      expect(result.discountMinor, 10000);
      expect(result.grandTotalMinor, 0);
    });
  });

  group('CALC-021 to CALC-025: Boundary Conditions', () {
    test('CALC-021: price = 0', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 5, unitPriceMinor: 0)],
        discount: const CalcDiscount.none(),
        taxRateBps: 1100,
      );
      expect(result.subtotalMinor, 0);
      expect(result.taxMinor, 0);
      expect(result.grandTotalMinor, 0);
    });

    test('CALC-022: quantity large', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1000000, unitPriceMinor: 100)],
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
      );
      expect(result.subtotalMinor, 100000000);
      expect(result.grandTotalMinor, 100000000);
    });

    test('CALC-023: subtotal large', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1, unitPriceMinor: 999999999999)],
        discount: const CalcDiscount.none(),
        taxRateBps: 1100,
      );
      expect(result.subtotalMinor, 999999999999);
      expect(result.taxMinor, 109999999999); // 11% truncated
      expect(result.grandTotalMinor, 1109999999998);
    });

    test('CALC-024: tax > 10000 bps → valid per contract', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
        discount: const CalcDiscount.none(),
        taxRateBps: 15000, // 150% tax
      );
      expect(result.taxMinor, 15000);
      expect(result.grandTotalMinor, 25000);
    });

    test('CALC-025: total never negative', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
        discount: const CalcDiscount(
          type: DiscountType.fixedMinor,
          value: 10000,
        ),
        taxRateBps: 1100,
      );
      expect(result.grandTotalMinor, 0);
      expect(result.grandTotalMinor >= 0, isTrue);
    });
  });

  group('CALC-026 to CALC-030: Determinism & Invariants', () {
    test('CALC-026: same input → same output', () {
      final items = [const CalcCartItem(quantity: 2, unitPriceMinor: 5000)];
      const discount = CalcDiscount(type: DiscountType.fixedMinor, value: 1000);
      const taxRate = 1100;

      final result1 = engine.calculate(
        items: items,
        discount: discount,
        taxRateBps: taxRate,
      );
      final result2 = engine.calculate(
        items: items,
        discount: discount,
        taxRateBps: taxRate,
      );

      expect(result1.subtotalMinor, result2.subtotalMinor);
      expect(result1.discountMinor, result2.discountMinor);
      expect(result1.taxMinor, result2.taxMinor);
      expect(result1.grandTotalMinor, result2.grandTotalMinor);
    });

    test('CALC-027: subtotal = Σ(price × quantity)', () {
      final items = [
        const CalcCartItem(quantity: 3, unitPriceMinor: 1000),
        const CalcCartItem(quantity: 2, unitPriceMinor: 2500),
      ];
      final result = engine.calculate(
        items: items,
        discount: const CalcDiscount.none(),
        taxRateBps: 0,
      );
      expect(result.subtotalMinor, 3 * 1000 + 2 * 2500);
    });

    test('CALC-028: taxable = subtotal - discount', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
        discount: const CalcDiscount(
          type: DiscountType.fixedMinor,
          value: 3000,
        ),
        taxRateBps: 0,
      );
      expect(
        result.taxableAmountMinor,
        result.subtotalMinor - result.discountMinor,
      );
    });

    test('CALC-029: grandTotal = taxable + tax', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 1, unitPriceMinor: 10000)],
        discount: const CalcDiscount(
          type: DiscountType.fixedMinor,
          value: 2000,
        ),
        taxRateBps: 1100,
      );
      expect(
        result.grandTotalMinor,
        result.taxableAmountMinor + result.taxMinor,
      );
    });

    test('CALC-030: all outputs remain INTEGER', () {
      final result = engine.calculate(
        items: [const CalcCartItem(quantity: 7, unitPriceMinor: 12345)],
        discount: const CalcDiscount(
          type: DiscountType.percentageBps,
          value: 1234,
        ),
        taxRateBps: 1100,
      );
      expect(result.subtotalMinor, isA<int>());
      expect(result.discountMinor, isA<int>());
      expect(result.taxableAmountMinor, isA<int>());
      expect(result.taxMinor, isA<int>());
      expect(result.grandTotalMinor, isA<int>());
    });
  });
}
