import 'dart:convert';
import 'package:http/http.dart' as http;
import 'auth_models.dart';

class AuthException implements Exception {
  final String code;
  final String message;
  final List<AuthBusinessSelection>? businesses;

  AuthException(this.code, this.message, {this.businesses});

  @override
  String toString() => 'AuthException: $code - $message';
}

class AuthApiClient {
  final String baseUrl;
  final http.Client _client;

  AuthApiClient({required this.baseUrl, http.Client? client}) : _client = client ?? http.Client();

  Future<AuthSession> login(String email, String password, [String? businessId]) async {
    final uri = Uri.parse('$baseUrl/v1/auth/login');
    final body = {
      'email': email,
      'password': password,
      'business_id': ?businessId,
    };

    try {
      final response = await _client.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final accessToken = json['access_token'] as String;
        final user = json['user'] as Map<String, dynamic>;
        final business = json['business'] as Map<String, dynamic>;
        
        return AuthSession(
          accessToken: accessToken,
          refreshToken: json['refresh_token'] as String,
          userId: user['id'] as String,
          businessId: business['id'] as String,
          role: json['role'] as String,
        );
      } else {
        // Parse error
        String code = 'UNKNOWN_ERROR';
        String message = 'Terjadi kesalahan pada server.';
        List<AuthBusinessSelection>? businesses;

        try {
          final json = jsonDecode(response.body) as Map<String, dynamic>;
          final err = json['error'] as Map<String, dynamic>?;
          if (err != null) {
            code = err['code'] as String? ?? code;
            message = err['message'] as String? ?? message;
            if (code == 'BUSINESS_SELECTION_REQUIRED') {
              final details = err['details'] as Map<String, dynamic>?;
              final list = details?['available_businesses'] as List?;
              if (list != null) {
                businesses = list.map((b) => AuthBusinessSelection.fromMap(b as Map<String, dynamic>)).toList();
              }
            }
          }
        } catch (_) {}

        throw AuthException(code, message, businesses: businesses);
      }
    } on AuthException {
      rethrow;
    } catch (e, stack) {
      // ignore: avoid_print
      print('LOGIN EXCEPTION: $e\n$stack');
      throw AuthException('NETWORK_ERROR', 'Server sedang tidak dapat dihubungi. Silakan periksa koneksi internet Anda.');
    }
  }

  Future<void> logout(String accessToken) async {
    final uri = Uri.parse('$baseUrl/v1/auth/logout');
    try {
      final response = await _client.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode != 204 && response.statusCode != 200) {
        // We can ignore logout errors on the server, as local logout is most important,
        // but let's just log or ignore.
      }
    } catch (e) {
      // Ignored for offline logout capability.
    }
  }

  Future<TokenRefreshResult> refresh(String refreshToken) async {
    final uri = Uri.parse('$baseUrl/v1/auth/refresh');
    final body = {
      'refresh_token': refreshToken,
    };

    try {
      final response = await _client.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return TokenRefreshResult(
          accessToken: json['access_token'] as String,
          refreshToken: json['refresh_token'] as String,
          expiresIn: json['expires_in'] as int,
        );
      } else if (response.statusCode == 401) {
        throw AuthException('INVALID_REFRESH_TOKEN', 'Sesi Anda telah berakhir.');
      } else {
        throw AuthException('UNKNOWN_ERROR', 'Terjadi kesalahan pada server saat refresh session.');
      }
    } on AuthException {
      rethrow;
    } catch (e) {
      throw AuthException('NETWORK_ERROR', 'Server sedang tidak dapat dihubungi.');
    }
  }
}
