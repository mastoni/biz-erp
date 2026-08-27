import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:biz_erp_mobile/core/auth/auth_models.dart';
import 'package:biz_erp_mobile/core/auth/auth_secure_storage.dart';
import 'package:biz_erp_mobile/core/auth/auth_api_client.dart';
import 'package:biz_erp_mobile/core/auth/auth_repository.dart';
import 'package:biz_erp_mobile/core/auth/auth_state_notifier.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AuthSecureStorage storage;
  late MockClient mockClient;
  late AuthApiClient apiClient;
  late AuthRepository repository;
  late AuthStateNotifier notifier;

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    storage = AuthSecureStorage();
  });

  MockClient createMockClient({
    int loginStatus = 200,
    Map<String, dynamic>? loginResponse,
    int logoutStatus = 204,
  }) {
    return MockClient((request) async {
      if (request.url.path == '/v1/auth/login') {
        if (loginStatus == 200) {
          final res = loginResponse ?? {
            'access_token': 'access_token_123',
            'refresh_token': 'refresh_token_123',
            'user': {'id': 'user_123'},
            'business': {'id': 'b1111111-1111-1111-1111-111111111111'},
            'role': 'OWNER',
            'expires_in': 3600,
          };
          return http.Response(jsonEncode(res), 200);
        } else {
          final res = loginResponse ?? {
            'error': {'code': 'INVALID_CREDENTIALS', 'message': 'Email atau kata sandi tidak sesuai.'}
          };
          return http.Response(jsonEncode(res), loginStatus);
        }
      } else if (request.url.path == '/v1/auth/logout') {
        return http.Response('', logoutStatus);
      }
      return http.Response('Not Found', 404);
    });
  }

  group('Mobile Authentication Foundation', () {
    test('AUTH-M001: initial unauthenticated state', () async {
      mockClient = createMockClient();
      apiClient = AuthApiClient(baseUrl: 'http://test', client: mockClient);
      repository = AuthRepository(storage: storage, apiClient: apiClient);
      notifier = AuthStateNotifier(repository: repository);

      await notifier.init();
      expect(notifier.status, AuthStatus.unauthenticated);
      expect(notifier.session, isNull);
    });

    test('AUTH-M002: login success stores session', () async {
      mockClient = createMockClient();
      apiClient = AuthApiClient(baseUrl: 'http://test', client: mockClient);
      repository = AuthRepository(storage: storage, apiClient: apiClient);
      notifier = AuthStateNotifier(repository: repository);

      await notifier.init();
      await notifier.login('test@example.com', 'password');

      expect(notifier.status, AuthStatus.authenticated);
      expect(notifier.session, isNotNull);
      expect(notifier.session!.accessToken, 'access_token_123');

      final stored = await storage.getSession();
      expect(stored, isNotNull);
      expect(stored!.accessToken, 'access_token_123');
    });

    test('AUTH-M003: invalid credentials show safe message', () async {
      mockClient = createMockClient(loginStatus: 401);
      apiClient = AuthApiClient(baseUrl: 'http://test', client: mockClient);
      repository = AuthRepository(storage: storage, apiClient: apiClient);
      notifier = AuthStateNotifier(repository: repository);

      await notifier.init();
      
      expect(
        () async => await notifier.login('test@example.com', 'wrong'),
        throwsA(isA<AuthException>().having((e) => e.message, 'message', 'Email atau kata sandi tidak sesuai.')),
      );
    });

    test('AUTH-M004 & AUTH-M014: restore session / restart with session -> authenticated', () async {
      await storage.saveSession(AuthSession(
        accessToken: 'access_1',
        refreshToken: 'refresh_1',
        userId: 'u1',
        businessId: 'b1111111-1111-1111-1111-111111111111',
        role: 'OWNER',
      ));

      mockClient = createMockClient();
      apiClient = AuthApiClient(baseUrl: 'http://test', client: mockClient);
      repository = AuthRepository(storage: storage, apiClient: apiClient);
      notifier = AuthStateNotifier(repository: repository);

      await notifier.init();
      expect(notifier.status, AuthStatus.authenticated);
      expect(notifier.session!.accessToken, 'access_1');
    });

    test('AUTH-M005: logout clears tokens', () async {
      mockClient = createMockClient();
      apiClient = AuthApiClient(baseUrl: 'http://test', client: mockClient);
      repository = AuthRepository(storage: storage, apiClient: apiClient);
      notifier = AuthStateNotifier(repository: repository);

      await notifier.login('t', 'p');
      expect(notifier.status, AuthStatus.authenticated);

      await notifier.logout();
      expect(notifier.status, AuthStatus.unauthenticated);
      
      final stored = await storage.getSession();
      expect(stored, isNull);
    });

    test('AUTH-M007: offline logout preserves local DB/outbox (clears tokens even if network fails)', () async {
      // simulate network failure on logout
      mockClient = createMockClient(logoutStatus: 500); 
      apiClient = AuthApiClient(baseUrl: 'http://test', client: mockClient);
      repository = AuthRepository(storage: storage, apiClient: apiClient);
      notifier = AuthStateNotifier(repository: repository);

      await notifier.login('t', 'p');
      await notifier.logout(); // Should not throw

      expect(notifier.status, AuthStatus.unauthenticated);
      final stored = await storage.getSession();
      expect(stored, isNull);
    });

    test('AUTH-M009: multiple business selection', () async {
      mockClient = createMockClient(
        loginStatus: 409,
        loginResponse: {
          'error': {
            'code': 'BUSINESS_SELECTION_REQUIRED',
            'message': 'Pilih bisnis',
            'details': {
              'available_businesses': [
                {'id': 'B1', 'name': 'Business 1'},
                {'id': 'B2', 'name': 'Business 2'}
              ]
            }
          }
        },
      );
      apiClient = AuthApiClient(baseUrl: 'http://test', client: mockClient);
      
      try {
        await apiClient.login('test', 'pass');
        fail('Should have thrown AuthException');
      } on AuthException catch (e) {
        expect(e.code, 'BUSINESS_SELECTION_REQUIRED');
        expect(e.businesses, isNotNull);
        expect(e.businesses!.length, 2);
      }
    });

    test('AUTH-M011: raw HTTP exception never shown', () async {
      // Simulate socket exception by throwing in mock client
      final errorClient = MockClient((request) async {
        throw Exception('SocketException: Connection refused');
      });
      apiClient = AuthApiClient(baseUrl: 'http://test', client: errorClient);
      repository = AuthRepository(storage: storage, apiClient: apiClient);
      notifier = AuthStateNotifier(repository: repository);

      expect(
        () async => await notifier.login('t', 'p'),
        throwsA(isA<AuthException>().having((e) => e.message, 'message', 'Server sedang tidak dapat dihubungi. Silakan periksa koneksi internet Anda.')),
      );
    });

    test('AUTH-M013: AuthSession.businessId matches returned business ID after login', () async {
      mockClient = createMockClient(
        loginStatus: 200,
        loginResponse: {
          'access_token': 'a',
          'refresh_token': 'r',
          'user': {'id': 'u'},
          'business': {'id': 'OTHER_BUSINESS'},
          'role': 'OWNER',
          'expires_in': 3600,
        },
      );
      apiClient = AuthApiClient(baseUrl: 'http://test', client: mockClient);
      repository = AuthRepository(storage: storage, apiClient: apiClient);
      
      final session = await repository.login('t', 'p');
      expect(session.businessId, 'OTHER_BUSINESS');
    });

    test('AUTH-M015: restart without session -> LoginScreen (unauthenticated)', () async {
      mockClient = createMockClient();
      apiClient = AuthApiClient(baseUrl: 'http://test', client: mockClient);
      repository = AuthRepository(storage: storage, apiClient: apiClient);
      notifier = AuthStateNotifier(repository: repository);
      
      await notifier.init();
      expect(notifier.status, AuthStatus.unauthenticated);
    });
  });

  // ---------------------------------------------------------------------------
  // AUTH-UX: Business Selection UX contract tests
  // ---------------------------------------------------------------------------
  group('AUTH-UX Business Selection', () {
    // Canonical business IDs used throughout these tests — must be RFC 4122 UUIDs
    // because the server only returns proper UUIDs.
    const businessAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const businessBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    MockClient makeSingleBusinessClient() {
      return MockClient((request) async {
        if (request.url.path == '/v1/auth/login') {
          return http.Response(
            jsonEncode({
              'access_token': 'tok_single',
              'refresh_token': 'ref_single',
              'user': {'id': 'user_1'},
              'business': {'id': businessAId},
              'role': 'OWNER',
              'expires_in': 900,
            }),
            200,
          );
        }
        return http.Response('', 404);
      });
    }

    MockClient makeMultiBusinessClient() {
      return MockClient((request) async {
        if (request.url.path == '/v1/auth/login') {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          final sentBusinessId = body['business_id'] as String?;

          // First call (no business_id) → 409
          if (sentBusinessId == null) {
            return http.Response(
              jsonEncode({
                'error': {
                  'code': 'BUSINESS_SELECTION_REQUIRED',
                  'message': 'Multiple active businesses found.',
                  'details': {
                    'available_businesses': [
                      {'id': businessAId, 'name': 'Business A', 'role': 'OWNER'},
                      {'id': businessBId, 'name': 'Business B', 'role': 'CASHIER'},
                    ],
                  },
                },
              }),
              409,
            );
          }

          // Second call with a valid business_id → 200
          if (sentBusinessId == businessAId || sentBusinessId == businessBId) {
            return http.Response(
              jsonEncode({
                'access_token': 'tok_selected',
                'refresh_token': 'ref_selected',
                'user': {'id': 'user_1'},
                'business': {'id': sentBusinessId},
                'role': sentBusinessId == businessAId ? 'OWNER' : 'CASHIER',
                'expires_in': 900,
              }),
              200,
            );
          }

          // Unknown business_id → 403
          return http.Response(
            jsonEncode({
              'error': {'code': 'BUSINESS_ACCESS_DENIED', 'message': 'Access denied'},
            }),
            403,
          );
        }
        return http.Response('', 404);
      });
    }

    // -------------------------------------------------------------------------
    // AUTH-UX-001: single-business login succeeds without business selection
    // -------------------------------------------------------------------------
    test('AUTH-UX-001: single-business login succeeds — no BUSINESS_SELECTION_REQUIRED', () async {
      FlutterSecureStorage.setMockInitialValues({});
      final store = AuthSecureStorage();
      final client = makeSingleBusinessClient();
      final api = AuthApiClient(baseUrl: 'http://test', client: client);
      final repo = AuthRepository(storage: store, apiClient: api);
      final notifier = AuthStateNotifier(repository: repo);

      await notifier.init();
      await notifier.login('owner@single.com', 'password');

      expect(notifier.status, AuthStatus.authenticated);
      expect(notifier.session, isNotNull);
      expect(notifier.session!.accessToken, 'tok_single');
      expect(notifier.session!.businessId, businessAId);
    });

    // -------------------------------------------------------------------------
    // AUTH-UX-002: multi-business login returns BUSINESS_SELECTION_REQUIRED
    // -------------------------------------------------------------------------
    test('AUTH-UX-002: 409 BUSINESS_SELECTION_REQUIRED thrown as AuthException', () async {
      FlutterSecureStorage.setMockInitialValues({});
      final api = AuthApiClient(baseUrl: 'http://test', client: makeMultiBusinessClient());

      try {
        await api.login('owner@multi.com', 'password');
        fail('Expected AuthException to be thrown');
      } on AuthException catch (e) {
        expect(e.code, 'BUSINESS_SELECTION_REQUIRED');
        expect(e.businesses, isNotNull);
        expect(e.businesses!.isNotEmpty, isTrue);
      }
    });

    // -------------------------------------------------------------------------
    // AUTH-UX-003: businesses list from exception matches server payload exactly
    // -------------------------------------------------------------------------
    test('AUTH-UX-003: available_businesses list matches server response exactly', () async {
      FlutterSecureStorage.setMockInitialValues({});
      final api = AuthApiClient(baseUrl: 'http://test', client: makeMultiBusinessClient());

      try {
        await api.login('owner@multi.com', 'password');
        fail('Expected AuthException');
      } on AuthException catch (e) {
        final businesses = e.businesses!;
        expect(businesses.length, 2);
        expect(businesses[0].id, businessAId);
        expect(businesses[0].name, 'Business A');
        expect(businesses[0].role, 'OWNER');
        expect(businesses[1].id, businessBId);
        expect(businesses[1].name, 'Business B');
        expect(businesses[1].role, 'CASHIER');
      }
    });

    // -------------------------------------------------------------------------
    // AUTH-UX-004: selected business_id from list is re-submitted and succeeds
    // -------------------------------------------------------------------------
    test('AUTH-UX-004: second login with valid business_id from list succeeds', () async {
      FlutterSecureStorage.setMockInitialValues({});
      final store = AuthSecureStorage();
      final api = AuthApiClient(baseUrl: 'http://test', client: makeMultiBusinessClient());
      final repo = AuthRepository(storage: store, apiClient: api);
      final notifier = AuthStateNotifier(repository: repo);

      await notifier.init();

      // First attempt → 409 → catches and stores businesses
      List<AuthBusinessSelection> serverBusinesses = [];
      try {
        await notifier.login('owner@multi.com', 'password');
      } on AuthException catch (e) {
        expect(e.code, 'BUSINESS_SELECTION_REQUIRED');
        serverBusinesses = e.businesses ?? [];
        notifier.setAvailableBusinesses(serverBusinesses);
      }

      expect(serverBusinesses.isNotEmpty, isTrue);

      // Second attempt with selected business_id → 200
      await notifier.login('owner@multi.com', 'password', businessAId);

      expect(notifier.status, AuthStatus.authenticated);
      expect(notifier.session!.businessId, businessAId);
      expect(notifier.session!.accessToken, 'tok_selected');
    });

    // -------------------------------------------------------------------------
    // AUTH-UX-005: only IDs from the server list can be selected
    // -------------------------------------------------------------------------
    test('AUTH-UX-005: AuthException.businesses list is the only source of selectable IDs', () async {
      FlutterSecureStorage.setMockInitialValues({});
      final api = AuthApiClient(baseUrl: 'http://test', client: makeMultiBusinessClient());

      try {
        await api.login('owner@multi.com', 'password');
        fail('Expected AuthException');
      } on AuthException catch (e) {
        final ids = e.businesses!.map((b) => b.id).toList();

        // Only IDs in this list can be presented to the user.
        // Any ID not in this list is not from the server and must not be submitted.
        expect(ids, contains(businessAId));
        expect(ids, contains(businessBId));
        expect(ids, isNot(contains('00000000-0000-0000-0000-000000000000')));
      }
    });

    // -------------------------------------------------------------------------
    // AUTH-UX-006: wrong/unlisted business_id is server-rejected with 403
    // -------------------------------------------------------------------------
    test('AUTH-UX-006: re-login with unlisted business_id is rejected by server (403)', () async {
      FlutterSecureStorage.setMockInitialValues({});
      final api = AuthApiClient(baseUrl: 'http://test', client: makeMultiBusinessClient());

      try {
        // Attempt directly with a foreign business_id (not in server list)
        await api.login('owner@multi.com', 'password', 'ffffffff-ffff-4fff-8fff-ffffffffffff');
        fail('Expected AuthException');
      } on AuthException catch (e) {
        expect(e.code, 'BUSINESS_ACCESS_DENIED');
      }
    });

    // -------------------------------------------------------------------------
    // AUTH-UX-007: email and password are passed unchanged on second login call
    // -------------------------------------------------------------------------
    test('AUTH-UX-007: email and password preserved — second login call uses same credentials', () async {
      FlutterSecureStorage.setMockInitialValues({});
      String? capturedEmail;
      String? capturedPassword;
      String? capturedBusinessId;

      final inspectingClient = MockClient((request) async {
        if (request.url.path == '/v1/auth/login') {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          capturedEmail = body['email'] as String?;
          capturedPassword = body['password'] as String?;
          capturedBusinessId = body['business_id'] as String?;

          if (capturedBusinessId != null) {
            return http.Response(
              jsonEncode({
                'access_token': 'tok_ok',
                'refresh_token': 'ref_ok',
                'user': {'id': 'u1'},
                'business': {'id': capturedBusinessId},
                'role': 'OWNER',
                'expires_in': 900,
              }),
              200,
            );
          }
          // No business_id → return 409
          return http.Response(
            jsonEncode({
              'error': {
                'code': 'BUSINESS_SELECTION_REQUIRED',
                'message': 'Select a business',
                'details': {
                  'available_businesses': [
                    {'id': businessAId, 'name': 'Business A', 'role': 'OWNER'},
                  ],
                },
              },
            }),
            409,
          );
        }
        return http.Response('', 404);
      });

      final api = AuthApiClient(baseUrl: 'http://test', client: inspectingClient);

      const testEmail = 'preserved@test.com';
      const testPassword = 'StrongPass!99';

      // First call (no business_id)
      try {
        await api.login(testEmail, testPassword);
      } on AuthException catch (_) {}

      expect(capturedEmail, testEmail);
      expect(capturedPassword, testPassword);
      expect(capturedBusinessId, isNull);

      // Second call (with business_id)
      await api.login(testEmail, testPassword, businessAId);

      // Credentials must be unchanged on the second call
      expect(capturedEmail, testEmail);
      expect(capturedPassword, testPassword);
      expect(capturedBusinessId, businessAId);
    });

    // -------------------------------------------------------------------------
    // AUTH-UX-008: successful selected-business login stores correct context
    // -------------------------------------------------------------------------
    test('AUTH-UX-008: selected-business login establishes correct session context', () async {
      FlutterSecureStorage.setMockInitialValues({});
      final store = AuthSecureStorage();
      final api = AuthApiClient(baseUrl: 'http://test', client: makeMultiBusinessClient());
      final repo = AuthRepository(storage: store, apiClient: api);
      final notifier = AuthStateNotifier(repository: repo);

      await notifier.init();

      // Step 1: first login attempt → 409
      try {
        await notifier.login('owner@multi.com', 'password');
      } on AuthException catch (e) {
        notifier.setAvailableBusinesses(e.businesses ?? []);
      }

      // Step 2: user selects Business B
      await notifier.login('owner@multi.com', 'password', businessBId);

      // Verify correct business context is established
      expect(notifier.status, AuthStatus.authenticated);
      expect(notifier.session, isNotNull);
      expect(notifier.session!.businessId, businessBId);
      expect(notifier.session!.role, 'CASHIER');

      // Verify persisted to secure storage
      final stored = await store.getSession();
      expect(stored, isNotNull);
      expect(stored!.businessId, businessBId);
      expect(stored.accessToken, 'tok_selected');
    });
  });
}
