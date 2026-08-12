import 'checkout_models.dart';

class CheckoutFingerprint {
  CheckoutFingerprint._();

  /// Builds a deterministic string representation of a checkout request.
  /// Field order is FIXED to ensure identical strings for identical requests.
  /// For TRANSFER, cashReceivedMinor is normalized to 0.
  static String build(CheckoutRequest request) {
    final normalizedCash = request.paymentMethod == PaymentMethod.cash
        ? request.cashReceivedMinor
        : 0;

    return [
      request.businessId,
      request.branchId,
      request.cartId,
      request.discount.type.name,
      request.discount.value.toString(),
      request.taxRateBps.toString(),
      request.paymentMethod.name,
      normalizedCash.toString(),
    ].join('|');
  }
}
