import 'dart:convert';

/// Lifecycle state for tenant management in Mobile client.
enum TenantStatus {
  loading,
  available,
  active,
  switching,
  error,
  empty,
}

/// Canonical RFC 4122 UUID regex validator
final RegExp _uuidRegex = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  caseSensitive: false,
);

bool isValidBusinessId(String? id) {
  if (id == null || id.isEmpty) return false;
  return _uuidRegex.hasMatch(id);
}

class TenantInfo {
  final String id;
  final String name;
  final String? role;

  TenantInfo({
    required this.id,
    required this.name,
    this.role,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      if (role != null) 'role': role,
    };
  }

  factory TenantInfo.fromMap(Map<String, dynamic> map) {
    return TenantInfo(
      id: map['id'] as String,
      name: map['name'] as String,
      role: map['role'] as String?,
    );
  }

  String toJson() => json.encode(toMap());

  factory TenantInfo.fromJson(String source) =>
      TenantInfo.fromMap(json.decode(source) as Map<String, dynamic>);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TenantInfo &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}
