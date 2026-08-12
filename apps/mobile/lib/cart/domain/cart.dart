/// Domain representation of a Cart.
class Cart {
  final String id;
  final String businessId;
  final String status; // ACTIVE, CHECKED_OUT, ABANDONED
  final int createdAt;
  final int updatedAt;

  const Cart({
    required this.id,
    required this.businessId,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });
}

/// Domain representation of a Cart Item.
class CartItem {
  final String id;
  final String cartId;
  final String productId;
  final int quantity;
  final int unitPriceMinor; // FROZEN snapshot
  final int addedAt;
  final int updatedAt;

  const CartItem({
    required this.id,
    required this.cartId,
    required this.productId,
    required this.quantity,
    required this.unitPriceMinor,
    required this.addedAt,
    required this.updatedAt,
  });
}

/// Aggregate root for reading a cart with its line items.
class CartWithItems {
  final Cart cart;
  final List<CartItem> items;

  const CartWithItems({required this.cart, required this.items});
}
