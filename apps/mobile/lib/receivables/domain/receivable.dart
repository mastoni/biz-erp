class Receivable {
  final String id;
  final String businessId;
  final String saleId;
  final String customerId;
  final String? branchId;
  final int amountMinor;
  final int paidMinor;
  final int outstandingMinor;
  final String date;
  final String? reference;
  final String description;
  final String status;
  final int serverVersion;
  final String createdAt;
  final String updatedAt;
  final String? deletedAt;

  // Joined / UI helper field
  final String? customerName;

  const Receivable({
    required this.id,
    required this.businessId,
    required this.saleId,
    required this.customerId,
    this.branchId,
    required this.amountMinor,
    required this.paidMinor,
    required this.outstandingMinor,
    required this.date,
    this.reference,
    required this.description,
    required this.status,
    required this.serverVersion,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    this.customerName,
  });

  bool get isOpen => status == 'OPEN';
  bool get isPartial => status == 'PARTIAL';
  bool get isPaid => status == 'PAID';
  bool get isReversed => status == 'REVERSED';
  bool get isOverdue => !isPaid && !isReversed; // Base overdue flag

  Receivable copyWith({
    String? id,
    String? businessId,
    String? saleId,
    String? customerId,
    String? branchId,
    int? amountMinor,
    int? paidMinor,
    int? outstandingMinor,
    String? date,
    String? reference,
    String? description,
    String? status,
    int? serverVersion,
    String? createdAt,
    String? updatedAt,
    String? deletedAt,
    String? customerName,
  }) {
    return Receivable(
      id: id ?? this.id,
      businessId: businessId ?? this.businessId,
      saleId: saleId ?? this.saleId,
      customerId: customerId ?? this.customerId,
      branchId: branchId ?? this.branchId,
      amountMinor: amountMinor ?? this.amountMinor,
      paidMinor: paidMinor ?? this.paidMinor,
      outstandingMinor: outstandingMinor ?? this.outstandingMinor,
      date: date ?? this.date,
      reference: reference ?? this.reference,
      description: description ?? this.description,
      status: status ?? this.status,
      serverVersion: serverVersion ?? this.serverVersion,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      deletedAt: deletedAt ?? this.deletedAt,
      customerName: customerName ?? this.customerName,
    );
  }

  factory Receivable.fromJson(Map<String, dynamic> json, {String? customerName}) {
    return Receivable(
      id: json['id'] as String,
      businessId: json['business_id'] as String,
      saleId: json['sale_id'] as String,
      customerId: json['customer_id'] as String,
      branchId: json['branch_id'] as String?,
      amountMinor: (json['amount_minor'] as num).toInt(),
      paidMinor: (json['paid_minor'] as num).toInt(),
      outstandingMinor: (json['outstanding_minor'] as num).toInt(),
      date: json['date'] as String,
      reference: json['reference'] as String?,
      description: json['description'] as String? ?? '',
      status: json['status'] as String,
      serverVersion: (json['server_version'] as num?)?.toInt() ?? 1,
      createdAt: json['created_at'] as String,
      updatedAt: json['updated_at'] as String,
      deletedAt: json['deleted_at'] as String?,
      customerName: customerName,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'business_id': businessId,
      'sale_id': saleId,
      'customer_id': customerId,
      'branch_id': branchId,
      'amount_minor': amountMinor,
      'paid_minor': paidMinor,
      'outstanding_minor': outstandingMinor,
      'date': date,
      'reference': reference,
      'description': description,
      'status': status,
      'server_version': serverVersion,
      'created_at': createdAt,
      'updated_at': updatedAt,
      'deleted_at': deletedAt,
    };
  }
}

class CustomerPayment {
  final String id;
  final String businessId;
  final String receivableId;
  final String customerId;
  final String? branchId;
  final int amountMinor;
  final String method; // 'cash' | 'bank_transfer' | 'debit' | 'credit'
  final String? reference;
  final String idempotencyKey;
  final String createdAt;

  const CustomerPayment({
    required this.id,
    required this.businessId,
    required this.receivableId,
    required this.customerId,
    this.branchId,
    required this.amountMinor,
    required this.method,
    this.reference,
    required this.idempotencyKey,
    required this.createdAt,
  });

  factory CustomerPayment.fromJson(Map<String, dynamic> json) {
    return CustomerPayment(
      id: json['id'] as String,
      businessId: json['business_id'] as String,
      receivableId: json['receivable_id'] as String,
      customerId: json['customer_id'] as String,
      branchId: json['branch_id'] as String?,
      amountMinor: (json['amount_minor'] as num).toInt(),
      method: json['method'] as String,
      reference: json['reference'] as String?,
      idempotencyKey: json['idempotency_key'] as String? ?? '',
      createdAt: json['created_at'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'business_id': businessId,
      'receivable_id': receivableId,
      'customer_id': customerId,
      'branch_id': branchId,
      'amount_minor': amountMinor,
      'method': method,
      'reference': reference,
      'idempotency_key': idempotencyKey,
      'created_at': createdAt,
    };
  }
}

class PaymentCollectionResult {
  final String paymentId;
  final String journalId;
  final String receivableId;
  final String newStatus;

  const PaymentCollectionResult({
    required this.paymentId,
    required this.journalId,
    required this.receivableId,
    required this.newStatus,
  });

  factory PaymentCollectionResult.fromJson(Map<String, dynamic> json) {
    return PaymentCollectionResult(
      paymentId: json['paymentId'] as String? ?? json['payment_id'] as String? ?? '',
      journalId: json['journalId'] as String? ?? json['journal_id'] as String? ?? '',
      receivableId: json['receivableId'] as String? ?? json['receivable_id'] as String? ?? '',
      newStatus: json['newStatus'] as String? ?? json['new_status'] as String? ?? '',
    );
  }
}
