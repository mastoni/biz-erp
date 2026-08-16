import 'auth_models.dart';
import 'auth_secure_storage.dart';
import 'auth_api_client.dart';


class AuthRepository {
  final AuthSecureStorage _storage;
  final AuthApiClient _apiClient;
  Future<RefreshResult>? _refreshFuture;

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
    
    await _storage.saveSession(session);
    return session;
  }

  Future<void> logout() async {
    final session = await _storage.getSession();
    if (session != null) {
      // Fire and forget logout, do not block local clearing if network fails
      _apiClient.logout(session.accessToken).catchError((_) {});
    }
    await _storage.clearAll();
  }

  Future<String?> getLastBusinessId() async {
    return await _storage.getLastBusinessId();
  }

  Future<RefreshResult> refreshSession() {
    if (_refreshFuture != null) {
      return _refreshFuture!;
    }
    
    _refreshFuture = _doRefreshSession().whenComplete(() {
      _refreshFuture = null;
    });

    return _refreshFuture!;
  }

  Future<RefreshResult> _doRefreshSession() async {
    final session = await _storage.getSession();
    if (session == null || session.refreshToken.isEmpty) {
      return RefreshResult.sessionExpired;
    }
    try {
      final result = await _apiClient.refresh(session.refreshToken);
      
      final updatedSession = AuthSession(
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: session.userId,
        businessId: session.businessId,
        role: session.role,
      );

      await _storage.saveSession(updatedSession);
      return RefreshResult.success;
    } on AuthException catch (e) {
      if (e.code == 'INVALID_REFRESH_TOKEN') {
        await _storage.clearSession();
        return RefreshResult.sessionExpired;
      }
      if (e.code == 'NETWORK_ERROR') {
        return RefreshResult.networkUnavailable;
      }
      return RefreshResult.failed;
    } catch (e) {
      return RefreshResult.failed;
    }
  }
}
