import 'auth_models.dart';
import 'auth_secure_storage.dart';
import 'auth_api_client.dart';
import '../demo_context.dart';

class AuthRepository {
  final AuthSecureStorage _storage;
  final AuthApiClient _apiClient;

  AuthRepository({
    required AuthSecureStorage storage,
    required AuthApiClient apiClient,
  })  : _storage = storage,
        _apiClient = apiClient;

  Future<AuthSession?> restoreSession() async {
    return await _storage.getSession();
  }

  Future<AuthSession> login(String email, String password, [String? businessId]) async {
    final session = await _apiClient.login(email, password, businessId);
    
    if (session.businessId != DemoContext.businessId) {
      throw AuthException('DEMO_CONTEXT_MISMATCH', 'Business ID mismatch. Logged in as ${session.businessId} but DemoContext requires ${DemoContext.businessId}');
    }

    await _storage.saveSession(session);
    return session;
  }

  Future<void> logout() async {
    final session = await _storage.getSession();
    if (session != null) {
      // Fire and forget logout, do not block local clearing if network fails
      _apiClient.logout(session.accessToken).catchError((_) {});
    }
    await _storage.clearSession();
  }
}
