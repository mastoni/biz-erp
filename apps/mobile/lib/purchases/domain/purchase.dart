class PurchaseItem {
  final String id;
  final String purchaseId;
  final String? productId;
  final String productName;
  final int orderedQty;
  final int receivedQty;
  final int unitCostMinor;
  final int subtotalMinor;

  const PurchaseItem({
    required this.id,
    required this.purchaseId,
    this.productId,
    required this.productName,
    required this.orderedQty,
    this.receivedQty = 0,
    required this.unitCostMinor,
    required this.subtotalMinor,
  });

  int get remainingQty => (orderedQty - receivedQty).clamp(0, orderedQty);
  int get receivedValueMinor => receivedQty * unitCostMinor;
}

class ReceiveLine {
  final String itemId;
  final int receiveQty;

  const ReceiveLine({
    required this.itemId,
    required this.receiveQty,
  });
}

class PurchasePayment {
  final String id;
  final String businessId;
  final String purchaseId;
  final int amountMinor;
  final String method; // 'cash' | 'bank_transfer' | 'debit' | 'credit'
  final String? reference;
  final String idempotencyKey;
  final String createdAt;

  const PurchasePayment({
    required this.id,
    required this.businessId,
    required this.purchaseId,
    required this.amountMinor,
    required this.method,
    this.reference,
    required this.idempotencyKey,
    required this.createdAt,
  });
}

class Purchase {
  final String id;
  final String businessId;
  final String branchId;
  final String supplierId;
  final String? supplierName;
  final String? supplierCode;
  final String code;
  final String date;
  final String dueDate;
  final String supplierTerm; // 'Tunai' | 'Tempo 14' | 'Tempo 30'
  final String status; // 'draft' | 'sent' | 'partial' | 'received' | 'cancelled'
  final int totalMinor;
  final int receivedMinor;
  final int paidMinor;
  final int outstandingMinor;
  final String? note;
  final int serverVersion;
  final String localStatus; // 'synced' | 'dirty'
  final int? createdAt;
  final int? updatedAt;
  final int? deletedAt;
  final int? lastSyncedAt;
  final List<PurchaseItem> items;
  final List<PurchasePayment> payments;

  const Purchase({
    required this.id,
    required this.businessId,
    required this.branchId,
    required this.supplierId,
    this.supplierName,
    this.supplierCode,
    required this.code,
    required this.date,
    required this.dueDate,
    required this.supplierTerm,
    required this.status,
    required this.totalMinor,
    this.receivedMinor = 0,
    this.paidMinor = 0,
    this.outstandingMinor = 0,
    this.note,
    required this.serverVersion,
    this.localStatus = 'synced',
    this.createdAt,
    this.updatedAt,
    this.deletedAt,
    this.lastSyncedAt,
    this.items = const [],
    this.payments = const [],
  });

  bool get isDirty => localStatus == 'dirty';
  bool get isDeleted => deletedAt != null;

  int get orderedTotalQty => items.fold(0, (sum, i) => sum + i.orderedQty);
  int get receivedTotalQty => items.fold(0, (sum, i) => sum + i.receivedQty);
  int get remainingTotalQty => items.fold(0, (sum, i) => sum + i.remainingQty);
  int get receivePercentage =>
      orderedTotalQty == 0 ? 0 : ((receivedTotalQty / orderedTotalQty) * 100).round();
}
