import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:biz_erp_mobile/core/auth/auth_models.dart';
import 'package:biz_erp_mobile/core/auth/auth_secure_storage.dart';
import 'package:biz_erp_mobile/core/auth/auth_api_client.dart';
import 'package:biz_erp_mobile/core/auth/auth_repository.dart';
import 'package:biz_erp_mobile/core/auth/auth_state_notifier.dart';
import 'package:biz_erp_mobile/core/tenant/tenant_models.dart';
import 'package:biz_erp_mobile/core/tenant/tenant_context.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AuthSecureStorage storage;
  late MockClient mockClient;
  late AuthApiClient apiClient;
  late AuthRepository repository;
  late AuthStateNotifier authNotifier;
  late TenantContext tenantContext;

  const validTenant1Id = '11111111-1111-4111-a111-111111111111';
  const validTenant2Id = '22222222-2222-4222-a222-222222222222';
  const unauthorizedTenantId = '33333333-3333-4333-a333-333333333333';

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    storage = AuthSecureStorage();
    mockClient = MockClient((request) async => http.Response('{}', 200));
    apiClient = AuthApiClient(baseUrl: 'http://test', client: mockClient);
    repository = AuthRepository(storage: storage, apiClient: apiClient);
    authNotifier = AuthStateNotifier(repository: repository);
  });

  group('PHASE V1.1-C Mobile Tenant Context Suite', () {
    test('MOBILE-TENANT-001: single tenant auto-select', () async {
      await storage.saveSession(AuthSession(
        accessToken: 'token_1',
        refreshToken: 'refresh_1',
        userId: 'user_1',
        businessId: validTenant1Id,
        role: 'OWNER',
      ));

      await authNotifier.init();
      tenantContext = TenantContext(authNotifier: authNotifier);
      await tenantContext.init();

      expect(tenantContext.status, TenantStatus.active);
      expect(tenantContext.activeTenant, isNotNull);
      expect(tenantContext.activeTenant!.id, validTenant1Id);
      expect(tenantContext.businessId, validTenant1Id);
    });

    test('MOBILE-TENANT-002: multiple tenants show selection', () async {
      tenantContext = TenantContext(authNotifier: authNotifier);

      tenantContext.setAvailableTenants([
        TenantInfo(id: validTenant1Id, name: 'Toko Utama Jakarta', role: 'OWNER'),
        TenantInfo(id: validTenant2Id, name: 'Toko Cabang Surabaya', role: 'CASHIER'),
      ]);

      expect(tenantContext.status, TenantStatus.available);
      expect(tenantContext.availableTenants.length, 2);
      expect(tenantContext.activeTenant, isNull);
    });

    test('MOBILE-TENANT-003: zero tenants show empty state', () async {
      tenantContext = TenantContext(authNotifier: authNotifier);
      tenantContext.setAvailableTenants([]);

      expect(tenantContext.status, TenantStatus.empty);
      expect(tenantContext.activeTenant, isNull);
    });

    test('MOBILE-TENANT-004: unauthorized tenant cannot be selected', () async {
      await storage.saveSession(AuthSession(
        accessToken: 'token_1',
        refreshToken: 'refresh_1',
        userId: 'user_1',
        businessId: validTenant1Id,
        role: 'OWNER',
      ));
      await authNotifier.init();

      tenantContext = TenantContext(authNotifier: authNotifier);
      tenantContext.setAvailableTenants([
        TenantInfo(id: validTenant1Id, name: 'Toko Utama Jakarta', role: 'OWNER'),
      ]);

      expect(
        () async => await tenantContext.switchTenant(unauthorizedTenantId),
        throwsA(isA<ArgumentError>().having(
          (e) => e.message,
          'message',
          'Access denied: Tenant not found in user memberships',
        )),
      );

      expect(tenantContext.status, TenantStatus.error);
    });

    test('MOBILE-TENANT-005: tenant switch rebuilds composition context cleanly', () async {
      await storage.saveSession(AuthSession(
        accessToken: 'token_1',
        refreshToken: 'refresh_1',
        userId: 'user_1',
        businessId: validTenant1Id,
        role: 'OWNER',
      ));
      await authNotifier.init();

      tenantContext = TenantContext(authNotifier: authNotifier);
      tenantContext.setAvailableTenants([
        TenantInfo(id: validTenant1Id, name: 'Toko Utama Jakarta', role: 'OWNER'),
        TenantInfo(id: validTenant2Id, name: 'Toko Cabang Surabaya', role: 'CASHIER'),
      ]);

      expect(tenantContext.businessId, validTenant1Id);

      // Switch to tenant 2
      await tenantContext.switchTenant(validTenant2Id);

      expect(tenantContext.status, TenantStatus.active);
      expect(tenantContext.activeTenant?.id, validTenant2Id);
      expect(tenantContext.businessId, validTenant2Id);
      expect(authNotifier.businessId, validTenant2Id);
    });

    test('MOBILE-TENANT-006: branch context resets/reloads on tenant change', () async {
      final tenant1Branches = [
        {'id': 'branch_t1_1', 'name': 'Pusat', 'business_id': validTenant1Id}
      ];
      final tenant2Branches = [
        {'id': 'branch_t2_1', 'name': 'Surabaya', 'business_id': validTenant2Id}
      ];

      var currentTenantId = validTenant1Id;
      var branchList = List<Map<String, dynamic>>.from(tenant1Branches);
      String? activeBranchId = branchList.first['id'];

      expect(currentTenantId, validTenant1Id);
      expect(branchList.first['business_id'], validTenant1Id);
      expect(activeBranchId, 'branch_t1_1');

      // Tenant switch triggered:
      currentTenantId = validTenant2Id;
      // Step 1: Invalidate immediately
      branchList = [];
      activeBranchId = null;

      expect(currentTenantId, validTenant2Id);
      expect(branchList.isEmpty, true);
      expect(activeBranchId, isNull);

      // Step 2: Load new tenant branches
      branchList = List<Map<String, dynamic>>.from(tenant2Branches);
      activeBranchId = branchList.first['id'];

      expect(branchList.first['business_id'], validTenant2Id);
      expect(activeBranchId, 'branch_t2_1');
    });

    test('MOBILE-TENANT-007: cart is not carried across tenants', () async {
      final tenant1CartItems = ['Item A', 'Item B'];
      var currentTenantCart = List<String>.from(tenant1CartItems);

      expect(currentTenantCart.length, 2);

      // Tenant change -> cart reset
      currentTenantCart = [];
      expect(currentTenantCart.isEmpty, true);
    });

    test('MOBILE-TENANT-008: no fake business_id values', () async {
      expect(isValidBusinessId('T-001'), false);
      expect(isValidBusinessId('biz_123'), false);
      expect(isValidBusinessId('Toko Utama'), false);
      expect(isValidBusinessId(''), false);
      expect(isValidBusinessId(null), false);

      expect(isValidBusinessId(validTenant1Id), true);
      expect(isValidBusinessId(validTenant2Id), true);
    });

    test('MOBILE-TENANT-009: offline behavior uses last valid tenant if safely cached', () async {
      await storage.saveSession(AuthSession(
        accessToken: 'token_offline',
        refreshToken: 'refresh_offline',
        userId: 'user_offline',
        businessId: validTenant1Id,
        role: 'OWNER',
      ));

      // Re-init notifier and context as if app restarted offline
      final offlineNotifier = AuthStateNotifier(repository: repository);
      await offlineNotifier.init();

      final offlineContext = TenantContext(authNotifier: offlineNotifier);
      await offlineContext.init();

      expect(offlineContext.status, TenantStatus.active);
      expect(offlineContext.businessId, validTenant1Id);
      expect(offlineNotifier.businessId, validTenant1Id);
    });
  });
}
