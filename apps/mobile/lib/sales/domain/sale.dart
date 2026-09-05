import 'package:biz_erp_mobile/core/database/tables/sales_local.dart';

/// Domain representation of a completed/stored POS sale.
class Sale {
  final String clientTransactionId;
  final String businessId;
  final String branchId;
  final String cashierId;
  final String? customerId;
  final String? customerName;
  final String? receiptNumber;
  final int? receiptSequence;
  final String? receiptDate;
  final String status;
  final int subtotalMinor;
  final int discountMinor;
  final int taxMinor;
  final int totalMinor;
  final String currencyCode;
  final int currencyMinorUnits;
  final String deviceId;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? syncedAt;
  final List<SaleItem> items;

  const Sale({
    required this.clientTransactionId,
    required this.businessId,
    required this.branchId,
    required this.cashierId,
    this.customerId,
    this.customerName,
    this.receiptNumber,
    this.receiptSequence,
    this.receiptDate,
    required this.status,
    required this.subtotalMinor,
    required this.discountMinor,
    required this.taxMinor,
    required this.totalMinor,
    required this.currencyCode,
    required this.currencyMinorUnits,
    required this.deviceId,
    required this.createdAt,
    required this.updatedAt,
    this.syncedAt,
    this.items = const [],
  });

  String get displayReceiptNumber => receiptNumber?.isNotEmpty == true
      ? receiptNumber!
      : (clientTransactionId.length >= 8
          ? clientTransactionId.substring(0, 8).toUpperCase()
          : clientTransactionId);

  bool get isSynced => status == SaleStatus.synced;
  bool get isPending =>
      status == SaleStatus.pendingSync || status == SaleStatus.syncing;
  bool get isConflict =>
      status == SaleStatus.conflict || status == SaleStatus.receiptConflict;
  bool get isFailed => status == SaleStatus.syncFailed;

  Sale copyWith({
    String? clientTransactionId,
    String? businessId,
    String? branchId,
    String? cashierId,
    String? customerId,
    String? customerName,
    String? receiptNumber,
    int? receiptSequence,
    String? receiptDate,
    String? status,
    int? subtotalMinor,
    int? discountMinor,
    int? taxMinor,
    int? totalMinor,
    String? currencyCode,
    int? currencyMinorUnits,
    String? deviceId,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? syncedAt,
    List<SaleItem>? items,
  }) {
    return Sale(
      clientTransactionId: clientTransactionId ?? this.clientTransactionId,
      businessId: businessId ?? this.businessId,
      branchId: branchId ?? this.branchId,
      cashierId: cashierId ?? this.cashierId,
      customerId: customerId ?? this.customerId,
      customerName: customerName ?? this.customerName,
      receiptNumber: receiptNumber ?? this.receiptNumber,
      receiptSequence: receiptSequence ?? this.receiptSequence,
      receiptDate: receiptDate ?? this.receiptDate,
      status: status ?? this.status,
      subtotalMinor: subtotalMinor ?? this.subtotalMinor,
      discountMinor: discountMinor ?? this.discountMinor,
      taxMinor: taxMinor ?? this.taxMinor,
      totalMinor: totalMinor ?? this.totalMinor,
      currencyCode: currencyCode ?? this.currencyCode,
      currencyMinorUnits: currencyMinorUnits ?? this.currencyMinorUnits,
      deviceId: deviceId ?? this.deviceId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      syncedAt: syncedAt ?? this.syncedAt,
      items: items ?? this.items,
    );
  }
}

/// Line item for a sale.
class SaleItem {
  final String id;
  final String clientTransactionId;
  final String productId;
  final String productName;
  final int quantity;
  final int unitPriceMinor;
  final int discountMinor;
  final DateTime createdAt;

  const SaleItem({
    required this.id,
    required this.clientTransactionId,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPriceMinor,
    required this.discountMinor,
    required this.createdAt,
  });

  int get subtotalMinor => (quantity * unitPriceMinor) - discountMinor;
}
