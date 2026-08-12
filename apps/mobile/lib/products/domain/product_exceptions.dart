/// Thrown when a product ID does not match the UUID v4 format.
/// Enforces ASSUMPTION-PROD-001 (server-generated UUID).
class InvalidProductIdException implements Exception {
  final String id;
  InvalidProductIdException(this.id);

  @override
  String toString() =>
      'InvalidProductIdException: Product ID is not a valid UUID v4: $id';
}

/// Thrown when a product is not found within the specified business scope.
class ProductNotFoundException implements Exception {
  final String id;
  final String businessId;
  ProductNotFoundException(this.id, this.businessId);

  @override
  String toString() =>
      'ProductNotFoundException: Product $id not found for business $businessId';
}
