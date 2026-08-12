/// Pure Dart models for sale calculation.
/// No database dependencies. Immutable value objects.
library;

/// Types of discounts supported (D3: Simple deterministic rules)
enum DiscountType {
  none,

  /// No discount applied
  fixedMinor,

  /// Fixed amount in minor units (e.g., Rp 10.000 = 10000)
  percentageBps,

  /// Percentage in basis points (e.g., 10% = 1000 bps)
}

/// Input: single cart item for calculation
class CalcCartItem {
  final int quantity; // Must be >= 1
  final int unitPriceMinor; // Must be >= 0

  const CalcCartItem({required this.quantity, required this.unitPriceMinor});
}

/// Input: discount parameters
class CalcDiscount {
  final DiscountType type;
  final int value; // Minor units if fixed, BPS if percentage. Must be >= 0.

  const CalcDiscount({required this.type, required this.value});

  const CalcDiscount.none() : type = DiscountType.none, value = 0;
}

/// Output: calculation result (Immutable)
class SaleCalculationResult {
  final int subtotalMinor;

  /// Σ (quantity * unitPriceMinor)
  final int discountMinor;

  /// Discount amount applied
  final int taxableAmountMinor;

  /// subtotal - discount
  final int taxMinor;

  /// Tax calculated
  final int grandTotalMinor;

  /// taxableAmount + tax

  const SaleCalculationResult({
    required this.subtotalMinor,
    required this.discountMinor,
    required this.taxableAmountMinor,
    required this.taxMinor,
    required this.grandTotalMinor,
  });

  @override
  String toString() =>
      'SaleCalculationResult('
      'subtotal=$subtotalMinor, '
      'discount=$discountMinor, '
      'taxable=$taxableAmountMinor, '
      'tax=$taxMinor, '
      'total=$grandTotalMinor)';
}
