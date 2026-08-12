/// Domain representation of a Product.
/// Mirrors products_local but uses domain types (e.g., bool for isActive).
class Product {
  final String id;
  final String businessId;
  final String name;
  final String? description;
  final int priceMinor;
  final String? category;
  final bool isActive;
  final int serverVersion;
  final int? lastSyncedAt;

  const Product({
    required this.id,
    required this.businessId,
    required this.name,
    this.description,
    required this.priceMinor,
    this.category,
    required this.isActive,
    required this.serverVersion,
    this.lastSyncedAt,
  });
}
