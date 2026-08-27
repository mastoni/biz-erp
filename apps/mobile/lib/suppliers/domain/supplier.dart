class Supplier {
  final String id;
  final String businessId;
  final String name;
  final String? code;
  final String? contact;
  final String? phone;
  final String? email;
  final String category;
  final String term;
  final bool isActive;
  final int serverVersion;
  final int? createdAt;
  final int? updatedAt;
  final int? deletedAt;
  final int? lastSyncedAt;
  final String localStatus;

  const Supplier({
    required this.id,
    required this.businessId,
    required this.name,
    this.code,
    this.contact,
    this.phone,
    this.email,
    required this.category,
    required this.term,
    required this.isActive,
    required this.serverVersion,
    this.createdAt,
    this.updatedAt,
    this.deletedAt,
    this.lastSyncedAt,
    this.localStatus = 'synced',
  });

  bool get isDirty => localStatus == 'dirty';
}
