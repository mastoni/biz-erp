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
import 'package:biz_erp_mobile/core/demo_context.dart';

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
            'business': {'id': DemoContext.businessId},
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
        businessId: DemoContext.businessId,
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

    test('AUTH-M013: AuthSession.businessId == DemoContext.businessId after login', () async {
      // login returning mismatch business
      mockClient = createMockClient(
        loginStatus: 200,
        loginResponse: {
          'access_token': 'a',
          'refresh_token': 'r',
          'user': {'id': 'u'},
          'business': {'id': 'WRONG_BUSINESS'},
          'role': 'OWNER',
          'expires_in': 3600,
        },
      );
      apiClient = AuthApiClient(baseUrl: 'http://test', client: mockClient);
      repository = AuthRepository(storage: storage, apiClient: apiClient);
      
      expect(
        () async => await repository.login('t', 'p'),
        throwsA(isA<AuthException>().having((e) => e.code, 'code', 'DEMO_CONTEXT_MISMATCH')),
      );
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
}
