import 'package:flutter/foundation.dart';
import 'auth_models.dart';
import 'auth_repository.dart';

class AuthStateNotifier extends ChangeNotifier {
  final AuthRepository _repository;

  AuthStatus _status = AuthStatus.unknown;
  AuthSession? _session;
  String? _lastBusinessId;

  AuthStateNotifier({required this._repository});

  AuthStatus get status => _status;
  AuthSession? get session => _session;
  String? get businessId => _session?.businessId ?? _lastBusinessId;

  Future<void> init() async {
    _lastBusinessId = await _repository.getLastBusinessId();
    final session = await _repository.restoreSession();
    if (session != null) {
      _session = session;
      _lastBusinessId = session.businessId;
      _status = AuthStatus.authenticated;
    } else {
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<void> login(String email, String password, [String? businessId]) async {
    final session = await _repository.login(email, password, businessId);
    _session = session;
    _lastBusinessId = session.businessId;
    _status = AuthStatus.authenticated;
    notifyListeners();
  }

  Future<void> logout() async {
    await _repository.logout();
    _session = null;
    _lastBusinessId = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  void sessionExpired() {
    _session = null;
    _status = AuthStatus.sessionExpired;
    notifyListeners();
  }

  Future<RefreshResult> refresh() async {
    final result = await _repository.refreshSession();
    
    if (result == RefreshResult.success) {
      _session = await _repository.restoreSession();
      // Ensure status is authenticated if we were in a transient state
      if (_status != AuthStatus.authenticated) {
        _status = AuthStatus.authenticated;
      }
      notifyListeners();
    } else if (result == RefreshResult.sessionExpired) {
      sessionExpired();
    }
    // For networkUnavailable or failed, we do not change the UI state to unauthenticated
    
    return result;
  }
}
