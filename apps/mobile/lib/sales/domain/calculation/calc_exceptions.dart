/// Exception thrown when cart is empty (no items to calculate)
class EmptyCartException implements Exception {
  @override
  String toString() =>
      'EmptyCartException: Cart must contain at least one item';
}
