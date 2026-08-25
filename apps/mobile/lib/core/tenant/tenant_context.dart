import 'package:flutter/foundation.dart';
import '../auth/auth_state_notifier.dart';
import '../auth/auth_models.dart';
import 'tenant_models.dart';

/// Manages multi-tenant lifecycle state, selection, and tenant transitions for Mobile.
class TenantContext extends ChangeNotifier {
  final AuthStateNotifier authNotifier;

  TenantStatus _status = TenantStatus.loading;
  TenantInfo? _activeTenant;
  List<TenantInfo> _availableTenants = [];
  String? _errorMessage;

  TenantContext({required this.authNotifier}) {
    authNotifier.addListener(_onAuthStateChanged);
    init();
  }

  AuthStateNotifier get _authNotifier => authNotifier;

  TenantStatus get status => _status;
  TenantInfo? get activeTenant => _activeTenant;
  String? get businessId => _activeTenant?.id ?? _authNotifier.businessId;
  List<TenantInfo> get availableTenants => List.unmodifiable(_availableTenants);
  String? get errorMessage => _errorMessage;

  @override
  void dispose() {
    _authNotifier.removeListener(_onAuthStateChanged);
    super.dispose();
  }

  void _onAuthStateChanged() {
    if (_authNotifier.status == AuthStatus.unauthenticated ||
        _authNotifier.status == AuthStatus.sessionExpired) {
      _status = TenantStatus.empty;
      _activeTenant = null;
      _availableTenants = [];
      _errorMessage = null;
      notifyListeners();
      return;
    }

    if (_authNotifier.status == AuthStatus.authenticated &&
        _authNotifier.session != null) {
      final bId = _authNotifier.session!.businessId;
      if (isValidBusinessId(bId)) {
        if (_activeTenant?.id != bId) {
          _activeTenant = TenantInfo(
            id: bId,
            name: _findTenantName(bId),
            role: _authNotifier.session!.role,
          );
          if (!_availableTenants.any((t) => t.id == bId)) {
            _availableTenants = [..._availableTenants, _activeTenant!];
          }
          _status = TenantStatus.active;
          notifyListeners();
        }
      }
    }
  }

  String _findTenantName(String businessId) {
    final existing = _availableTenants.where((t) => t.id == businessId);
    if (existing.isNotEmpty) {
      return existing.first.name;
    }
    return 'Tenant ${businessId.substring(0, 8)}...';
  }

  Future<void> init() async {
    _errorMessage = null;

    if (_authNotifier.status == AuthStatus.unknown) {
      _status = TenantStatus.loading;
      notifyListeners();
      return;
    }

    if (_authNotifier.status == AuthStatus.unauthenticated ||
        _authNotifier.status == AuthStatus.sessionExpired) {
      _status = TenantStatus.empty;
      _activeTenant = null;
      notifyListeners();
      return;
    }

    final session = _authNotifier.session;
    final bId = session?.businessId ?? _authNotifier.businessId;

    if (bId != null && isValidBusinessId(bId)) {
      _activeTenant = TenantInfo(
        id: bId,
        name: _findTenantName(bId),
        role: session?.role,
      );
      if (!_availableTenants.any((t) => t.id == bId)) {
        _availableTenants = [..._availableTenants, _activeTenant!];
      }
      _status = TenantStatus.active;
    } else if (bId != null && !isValidBusinessId(bId)) {
      _status = TenantStatus.error;
      _errorMessage = 'Invalid business UUID format: $bId';
    } else {
      _status = _availableTenants.isNotEmpty ? TenantStatus.available : TenantStatus.empty;
    }

    notifyListeners();
  }

  void setAvailableTenants(List<TenantInfo> tenants) {
    _availableTenants = List.from(tenants);

    // Also sync to authNotifier
    _authNotifier.setAvailableBusinesses(
      tenants
          .map((t) => AuthBusinessSelection(id: t.id, name: t.name, role: t.role))
          .toList(),
    );

    if (_availableTenants.isEmpty) {
      _status = TenantStatus.empty;
      _activeTenant = null;
    } else if (_availableTenants.length == 1 && _activeTenant == null) {
      // Auto-select single tenant
      final single = _availableTenants.first;
      if (isValidBusinessId(single.id)) {
        _activeTenant = single;
        _status = TenantStatus.active;
      } else {
        _status = TenantStatus.error;
        _errorMessage = 'Invalid business UUID in tenant: ${single.id}';
      }
    } else if (_availableTenants.length > 1 && _activeTenant == null) {
      _status = TenantStatus.available;
    }

    notifyListeners();
  }

  Future<void> switchTenant(String businessId, [String? role]) async {
    // 1. Strict RFC 4122 UUID validation
    if (!isValidBusinessId(businessId)) {
      _status = TenantStatus.error;
      _errorMessage = 'Invalid business UUID: $businessId';
      notifyListeners();
      throw ArgumentError('Invalid business UUID: $businessId');
    }

    // 2. Tenant membership authorization guard
    if (_availableTenants.isNotEmpty &&
        !_availableTenants.any((t) => t.id == businessId)) {
      _status = TenantStatus.error;
      _errorMessage = 'Access denied: Tenant not found in user memberships';
      notifyListeners();
      throw ArgumentError('Access denied: Tenant not found in user memberships');
    }

    // No-op if already active
    if (_activeTenant?.id == businessId && _status == TenantStatus.active) {
      return;
    }

    _status = TenantStatus.switching;
    _errorMessage = null;
    notifyListeners();

    try {
      await _authNotifier.switchTenant(businessId, role);

      final selectedTenant = _availableTenants.firstWhere(
        (t) => t.id == businessId,
        orElse: () => TenantInfo(
          id: businessId,
          name: _findTenantName(businessId),
          role: role ?? _authNotifier.session?.role,
        ),
      );

      _activeTenant = selectedTenant;
      _status = TenantStatus.active;
      notifyListeners();
    } catch (e) {
      _status = TenantStatus.error;
      _errorMessage = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  void clear() {
    _status = TenantStatus.empty;
    _activeTenant = null;
    _availableTenants = [];
    _errorMessage = null;
    notifyListeners();
  }
}
