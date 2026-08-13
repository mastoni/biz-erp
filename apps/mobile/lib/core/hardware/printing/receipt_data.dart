/// Snapshot satu baris item struk (harga dari snapshot, BUKAN katalog aktif).
class ReceiptItemData {
  final String productId;
  final String displayName;
  final int quantity;
  final int unitPriceMinor;

  const ReceiptItemData({
    required this.productId,
    required this.displayName,
    required this.quantity,
    required this.unitPriceMinor,
  });
}

/// Snapshot transaksi untuk pencetakan struk.
/// Seluruh nilai finansial berasal dari snapshot transaksi yang sudah COMMIT.
class ReceiptData {
  final String receiptNumber;
  final String businessName;
  final String branchName;
  final String cashierId;
  final int createdAtEpochMs;
  final int subtotalMinor;
  final int discountMinor;
  final int taxMinor;
  final int totalMinor;
  final int cashReceivedMinor;
  final int changeMinor;
  final List<ReceiptItemData> items;

  const ReceiptData({
    required this.receiptNumber,
    required this.businessName,
    required this.branchName,
    required this.cashierId,
    required this.createdAtEpochMs,
    required this.subtotalMinor,
    required this.discountMinor,
    required this.taxMinor,
    required this.totalMinor,
    required this.cashReceivedMinor,
    required this.changeMinor,
    required this.items,
  });
}
