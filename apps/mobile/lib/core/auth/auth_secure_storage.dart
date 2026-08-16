import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'auth_models.dart';

class AuthSecureStorage {
  final FlutterSecureStorage _storage;

  AuthSecureStorage({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  static const _sessionKey = 'auth_session';
  static const _lastBusinessIdKey = 'last_business_id';

  Future<void> saveSession(AuthSession session) async {
    await _storage.write(key: _lastBusinessIdKey, value: session.businessId);
    await _storage.write(key: _sessionKey, value: session.toJson());
  }

  Future<AuthSession?> getSession() async {
    final data = await _storage.read(key: _sessionKey);
    if (data == null) return null;
    try {
      return AuthSession.fromJson(data);
    } catch (e) {
      return null;
    }
  }

  Future<String?> getLastBusinessId() async {
    return await _storage.read(key: _lastBusinessIdKey);
  }

  Future<void> clearSession() async {
    await _storage.delete(key: _sessionKey);
  }

  Future<void> clearAll() async {
    await _storage.delete(key: _sessionKey);
    await _storage.delete(key: _lastBusinessIdKey);
  }
}
