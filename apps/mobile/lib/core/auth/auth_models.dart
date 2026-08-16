// apps/mobile/lib/core/auth/auth_models.dart
import 'dart:convert';

enum AuthStatus {
  unknown,
  authenticated,
  unauthenticated,
  sessionExpired,
}

enum RefreshResult {
  success,
  sessionExpired,
  networkUnavailable,
  failed,
}

class AuthSession {
  final String accessToken;
  final String refreshToken;
  final String userId;
  final String businessId;
  final String role;

  AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.businessId,
    required this.role,
  });

  Map<String, dynamic> toMap() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'userId': userId,
      'businessId': businessId,
      'role': role,
    };
  }

  factory AuthSession.fromMap(Map<String, dynamic> map) {
    return AuthSession(
      accessToken: map['accessToken'] as String,
      refreshToken: map['refreshToken'] as String,
      userId: map['userId'] as String,
      businessId: map['businessId'] as String,
      role: map['role'] as String,
    );
  }

  String toJson() => json.encode(toMap());

  factory AuthSession.fromJson(String source) => AuthSession.fromMap(json.decode(source) as Map<String, dynamic>);
}

class AuthBusinessSelection {
  final String id;
  final String name;

  AuthBusinessSelection({required this.id, required this.name});

  factory AuthBusinessSelection.fromMap(Map<String, dynamic> map) {
    return AuthBusinessSelection(
      id: map['id'] as String,
      name: map['name'] as String,
    );
  }
}

class TokenRefreshResult {
  final String accessToken;
  final String refreshToken;
  final int expiresIn;

  TokenRefreshResult({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });
}
