/// Domain representation of a stock movement (audit trail entry).
/// Movements are created server-side by the Inventory Adjustment API.
/// Mobile never writes to this table directly.
class StockMovement {
  final String id;
  final String businessId;
  final String branchId;
  final String productId;
  final int quantity;
  final String movementType;
  final String? reference;
  final String actor;
  final int? timestamp;
  final int? cachedAt;

  const StockMovement({
    required this.id,
    required this.businessId,
    required this.branchId,
    required this.productId,
    required this.quantity,
    required this.movementType,
    this.reference,
    required this.actor,
    this.timestamp,
    this.cachedAt,
  });
}
