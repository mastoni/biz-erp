class IdempotencyConflictException implements Exception {
  final String key;
  IdempotencyConflictException(this.key);
  @override
  String toString() =>
      'IdempotencyConflictException: Request mismatch for key $key';
}

class InsufficientPaymentException implements Exception {
  final int cashReceived;
  final int grandTotal;
  InsufficientPaymentException(this.cashReceived, this.grandTotal);
  @override
  String toString() =>
      'InsufficientPaymentException: Cash $cashReceived < Total $grandTotal';
}

class InvalidIdempotencyKeyException implements Exception {
  final String key;
  InvalidIdempotencyKeyException(this.key);
  @override
  String toString() =>
      'InvalidIdempotencyKeyException: Key must be a valid UUID v4: $key';
}

class CartNotActiveException implements Exception {
  final String cartId;
  CartNotActiveException(this.cartId);
  @override
  String toString() => 'CartNotActiveException: Cart $cartId is not ACTIVE';
}
