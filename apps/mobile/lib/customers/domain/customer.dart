class Customer {
  final String id;
  final String businessId;
  final String name;
  final String? phone;
  final String? email;
  final bool isActive;
  final int serverVersion;
  final int? lastSyncedAt;
  final String localStatus;

  const Customer({
    required this.id,
    required this.businessId,
    required this.name,
    this.phone,
    this.email,
    required this.isActive,
    required this.serverVersion,
    this.lastSyncedAt,
    this.localStatus = 'synced',
  });

  bool get isDirty => localStatus == 'dirty';
}
