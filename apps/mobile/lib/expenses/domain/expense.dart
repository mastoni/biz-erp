class Expense {
  final String id;
  final String businessId;
  final String? branchId;
  final String date;
  final int amountMinor;
  final String method;
  final String? category;
  final String? reference;
  final String description;
  final String status;
  final int serverVersion;
  final String createdAt;
  final String updatedAt;
  final String? deletedAt;

  const Expense({
    required this.id,
    required this.businessId,
    this.branchId,
    required this.date,
    required this.amountMinor,
    required this.method,
    this.category,
    this.reference,
    required this.description,
    required this.status,
    required this.serverVersion,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
  });

  bool get isDraft => status.toLowerCase() == 'draft';
  bool get isPosted => status.toLowerCase() == 'posted';
  bool get isReversed => status.toLowerCase() == 'reversed';
  bool get isDeleted => deletedAt != null;

  factory Expense.fromJson(Map<String, dynamic> json) {
    return Expense(
      id: json['id'] as String,
      businessId: json['business_id'] as String,
      branchId: json['branch_id'] as String?,
      date: json['date'] as String,
      amountMinor: (json['amount_minor'] as num).toInt(),
      method: json['method'] as String,
      category: json['category'] as String?,
      reference: json['reference'] as String?,
      description: json['description'] as String? ?? '',
      status: json['status'] as String? ?? 'draft',
      serverVersion: (json['server_version'] as num?)?.toInt() ?? 1,
      createdAt: json['created_at'] as String? ?? '',
      updatedAt: json['updated_at'] as String? ?? '',
      deletedAt: json['deleted_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'business_id': businessId,
      'branch_id': branchId,
      'date': date,
      'amount_minor': amountMinor,
      'method': method,
      'category': category,
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
