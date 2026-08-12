import 'calc_models.dart';
import 'calc_exceptions.dart';

/// Pure deterministic sale calculation engine.
///
/// Financial invariants enforced at runtime (not via assert):
/// - All calculations use INTEGER arithmetic only (no double/float)
/// - Rounding policy: floor/truncate fractional minor units toward zero (~/ operator)
/// - All validation throws exceptions on invalid input (never silent failures)
class SaleCalculationEngine {
  /// Calculate sale totals deterministically.
  ///
  /// Throws [EmptyCartException] if items list is empty.
  /// Throws [ArgumentError] if any input violates financial invariants.
  SaleCalculationResult calculate({
    required List<CalcCartItem> items,
    required CalcDiscount discount,
    required int taxRateBps,
  }) {
    // VALIDATION: Cart must not be empty
    if (items.isEmpty) {
      throw EmptyCartException();
    }

    // VALIDATION: All items must have valid quantity and price
    for (final item in items) {
      if (item.quantity < 1) {
        throw ArgumentError('Item quantity must be >= 1, got ${item.quantity}');
      }
      if (item.unitPriceMinor < 0) {
        throw ArgumentError(
          'Item unitPriceMinor must be >= 0, got ${item.unitPriceMinor}',
        );
      }
    }

    // VALIDATION: Discount value must be non-negative
    if (discount.value < 0) {
      throw ArgumentError('Discount value must be >= 0, got ${discount.value}');
    }

    // VALIDATION: Percentage discount must not exceed 100% (10000 bps)
    if (discount.type == DiscountType.percentageBps && discount.value > 10000) {
      throw ArgumentError(
        'Percentage discount must be <= 10000 bps, got ${discount.value}',
      );
    }

    // VALIDATION: Tax rate must be non-negative
    if (taxRateBps < 0) {
      throw ArgumentError('Tax rate must be >= 0, got $taxRateBps');
    }

    // CALCULATION: Subtotal = Σ (quantity × unitPriceMinor)
    int subtotalMinor = 0;
    for (final item in items) {
      subtotalMinor += item.quantity * item.unitPriceMinor;
    }

    // CALCULATION: Discount amount
    int discountMinor = 0;
    switch (discount.type) {
      case DiscountType.none:
        discountMinor = 0;
        break;
      case DiscountType.fixedMinor:
        discountMinor = discount.value;
        // VALIDATION: Fixed discount must not exceed subtotal
        if (discountMinor > subtotalMinor) {
          throw ArgumentError(
            'Fixed discount ($discountMinor) cannot exceed subtotal ($subtotalMinor)',
          );
        }
        break;
      case DiscountType.percentageBps:
        // Rounding policy: truncate toward zero (~/)
        discountMinor = (subtotalMinor * discount.value) ~/ 10000;
        break;
    }

    // CALCULATION: Taxable amount = subtotal - discount
    final taxableAmountMinor = subtotalMinor - discountMinor;

    // CALCULATION: Tax = taxable × taxRateBps / 10000
    // Rounding policy: truncate toward zero (~/)
    final taxMinor = (taxableAmountMinor * taxRateBps) ~/ 10000;

    // CALCULATION: Grand total = taxable + tax
    final grandTotalMinor = taxableAmountMinor + taxMinor;

    // FINANCIAL INVARIANT: Total must never be negative
    if (grandTotalMinor < 0) {
      throw StateError(
        'Calculation produced negative grandTotal ($grandTotalMinor). '
        'This indicates a logic error in the engine.',
      );
    }

    return SaleCalculationResult(
      subtotalMinor: subtotalMinor,
      discountMinor: discountMinor,
      taxableAmountMinor: taxableAmountMinor,
      taxMinor: taxMinor,
      grandTotalMinor: grandTotalMinor,
    );
  }
}
