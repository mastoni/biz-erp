/// Domain representation of a product's stock level at a branch.
/// Server (PostgreSQL) is the single source of truth; mobile cache is read-only.
class Stock {
  final String id;
  final String businessId;
  final String branchId;
  final String productId;
  final String productName;
  final String? sku;
  final String? category;
  final String? barcode;
  final int priceMinor;
  final int? costMinor;
  final int quantity;
  final int serverVersion;
  final int? createdAt;
  final int? updatedAt;
  final int? cachedAt;

  const Stock({
    required this.id,
    required this.businessId,
    required this.branchId,
    required this.productId,
    required this.productName,
    this.sku,
    this.category,
    this.barcode,
    required this.priceMinor,
    this.costMinor,
    required this.quantity,
    required this.serverVersion,
    this.createdAt,
    this.updatedAt,
    this.cachedAt,
  });

  /// MVP: products with quantity == 0 are "out of stock".
  bool get isOutOfStock => quantity <= 0;

  /// MVP: LOW_STOCK_THRESHOLD is 5 (backend constant).
  /// Mobile mirrors this for offline UI flagging.
  static const int lowStockThreshold = 5;

  bool get isLowStock => !isOutOfStock && quantity <= lowStockThreshold;
}
