import 'package:flutter/foundation.dart';
import 'auth_models.dart';
import 'auth_repository.dart';

class AuthStateNotifier extends ChangeNotifier {
  final AuthRepository _repository;

  AuthStatus _status = AuthStatus.unknown;
  AuthSession? _session;

  AuthStateNotifier({required AuthRepository repository}) : _repository = repository;

  AuthStatus get status => _status;
  AuthSession? get session => _session;

  Future<void> init() async {
    final session = await _repository.restoreSession();
    if (session != null) {
      _session = session;
      _status = AuthStatus.authenticated;
    } else {
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<void> login(String email, String password, [String? businessId]) async {
    final session = await _repository.login(email, password, businessId);
    _session = session;
    _status = AuthStatus.authenticated;
    notifyListeners();
  }

  Future<void> logout() async {
    await _repository.logout();
    _session = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  void sessionExpired() {
    _session = null;
    _status = AuthStatus.sessionExpired;
    notifyListeners();
  }
}
