/// Domain representation of a Product.
/// Mirrors products_local but uses domain types (e.g., bool for isActive).
class Product {
  final String id;
  final String businessId;
  final String name;
  final String? description;
  final int priceMinor;
  final int? costMinor;
  final String? category;
  final bool isActive;
  final int serverVersion;
  final int? lastSyncedAt;
  final String? barcode;
  /// Sync status: 'synced' | 'dirty' | 'deleted'
  /// Matches products_local.localStatus string values.
  final String localStatus;

  const Product({
    required this.id,
    required this.businessId,
    required this.name,
    this.description,
    required this.priceMinor,
    this.costMinor,
    this.category,
    required this.isActive,
    required this.serverVersion,
    this.lastSyncedAt,
    this.barcode,
    this.localStatus = 'synced',
  });

  /// Convenience: is this product waiting to be pushed?
  bool get isDirty => localStatus == 'dirty';
}
