class CartNotFoundException implements Exception {
  final String cartId;
  final String businessId;
  CartNotFoundException(this.cartId, this.businessId);
  @override
  String toString() =>
      'CartNotFoundException: Cart $cartId not found or not accessible for business $businessId';
}

class CartItemNotFoundException implements Exception {
  final String itemId;
  CartItemNotFoundException(this.itemId);
  @override
  String toString() => 'CartItemNotFoundException: Item $itemId not found';
}

class CartProductNotFoundException implements Exception {
  final String productId;
  final String businessId;
  CartProductNotFoundException(this.productId, this.businessId);
  @override
  String toString() =>
      'CartProductNotFoundException: Product $productId not found for business $businessId';
}

class ProductNotActiveException implements Exception {
  final String productId;
  ProductNotActiveException(this.productId);
  @override
  String toString() =>
      'ProductNotActiveException: Product $productId is inactive and cannot be added to cart';
}

class InvalidQuantityException implements Exception {
  final int quantity;
  InvalidQuantityException(this.quantity);
  @override
  String toString() =>
      'InvalidQuantityException: Quantity must be >= 1, got $quantity';
}
