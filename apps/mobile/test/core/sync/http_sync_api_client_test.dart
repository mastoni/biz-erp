import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:biz_erp_mobile/core/sync/http_sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';

void main() {
  group('HttpSyncApiClient', () {
    const baseUrl = 'http://test.example.com';
    const businessId = 'test-business-123';

    test('HTTP-001: health 200 returns true', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/health');
        return http.Response('{"status":"ok"}', 200);
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
      );

      final result = await client.health();
      expect(result, isTrue);
    });

    test('HTTP-002: health 503 returns false', () async {
      final mockClient = MockClient((request) async {
        return http.Response('Service Unavailable', 503);
      });

      final client = HttpSyncApiClient(baseUrl: baseUrl, client: mockClient);

      final result = await client.health();
      expect(result, isFalse);
    });

    test('HTTP-003: health timeout returns false', () async {
      final mockClient = MockClient((request) async {
        await Future.delayed(const Duration(seconds: 10));
        return http.Response('{"status":"ok"}', 200);
      });

      final client = HttpSyncApiClient(baseUrl: baseUrl, client: mockClient);

      final result = await client.health();
      expect(result, isFalse);
    });

    test('HTTP-004: pull products maps items to products', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'items': [
              {
                'id': 'prod-1',
                'name': 'Product 1',
                'price_minor': 1000,
                'is_active': true,
                'server_version': 1,
              },
            ],
            'has_more': false,
            'current_version': 1,
          }),
          200,
        );
      });

      final client = HttpSyncApiClient(baseUrl: baseUrl, client: mockClient);

      final response = await client.pullProducts(
        businessId: businessId,
        sinceVersion: 0,
      );

      expect(response.products.length, 1);
      expect(response.products[0].id, 'prod-1');
    });

    test('HTTP-005: pull products sends business_id', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.queryParameters['business_id'], businessId);
        return http.Response(
          jsonEncode({'items': [], 'has_more': false, 'current_version': 0}),
          200,
        );
      });

      final client = HttpSyncApiClient(baseUrl: baseUrl, client: mockClient);

      await client.pullProducts(businessId: businessId, sinceVersion: 0);
    });

    test(
      'HTTP-006: pull products maps sinceVersion to after_version',
      () async {
        final mockClient = MockClient((request) async {
          expect(request.url.queryParameters['after_version'], '42');
          return http.Response(
            jsonEncode({'items': [], 'has_more': false, 'current_version': 0}),
            200,
          );
        });

        final client = HttpSyncApiClient(baseUrl: baseUrl, client: mockClient);

        await client.pullProducts(businessId: businessId, sinceVersion: 42);
      },
    );

    test('HTTP-007: pull products parses is_active boolean', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'items': [
              {
                'id': 'prod-1',
                'name': 'Product 1',
                'price_minor': 1000,
                'is_active': true,
                'server_version': 1,
              },
              {
                'id': 'prod-2',
                'name': 'Product 2',
                'price_minor': 2000,
                'is_active': 1,
                'server_version': 1,
              },
            ],
            'has_more': false,
            'current_version': 1,
          }),
          200,
        );
      });

      final client = HttpSyncApiClient(baseUrl: baseUrl, client: mockClient);

      final response = await client.pullProducts(
        businessId: businessId,
        sinceVersion: 0,
      );

      expect(response.products[0].isActive, isTrue);
      expect(response.products[1].isActive, isTrue);
    });

    test('HTTP-008: push product sends expected_server_version', () async {
      final mockClient = MockClient((request) async {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['expected_server_version'], 5);
        return http.Response(jsonEncode({'server_version': 6}), 200);
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
      );

      final product = ProductDto(
        id: 'prod-1',
        name: 'Product 1',
        priceMinor: 1000,
        isActive: true,
        serverVersion: 5,
      );

      final result = await client.pushProduct(product, ifMatchVersion: 5);
      expect(result.ok, isTrue);
      expect(result.serverVersion, 6);
    });

    test('HTTP-009: push product success', () async {
      final mockClient = MockClient((request) async {
        return http.Response(jsonEncode({'server_version': 6}), 200);
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
      );

      final product = ProductDto(
        id: 'prod-1',
        name: 'Product 1',
        priceMinor: 1000,
        isActive: true,
        serverVersion: 5,
      );

      final result = await client.pushProduct(product);
      expect(result.ok, isTrue);
    });

    test('HTTP-010: push product VERSION_CONFLICT', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error': {
              'code': 'VERSION_CONFLICT',
              'details': {
                'current_product': {
                  'id': 'prod-1',
                  'name': 'Product 1 Updated',
                  'price_minor': 1500,
                  'is_active': true,
                  'server_version': 6,
                }
              }
            }
          }),
          409,
        );
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
      );

      final product = ProductDto(
        id: 'prod-1',
        name: 'Product 1',
        priceMinor: 1000,
        isActive: true,
        serverVersion: 5,
      );

      final result = await client.pushProduct(product);
      expect(result.ok, isFalse);
      expect(result.conflict, isTrue);
      expect(result.serverState, isNotNull);
      expect(result.serverState!.name, 'Product 1 Updated');
    });

    test('HTTP-011: push sales sends idempotency key', () async {
      final mockClient = MockClient((request) async {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final items = body['items'] as List;
        expect(items[0]['idempotency_key'], 'idem-123');
        expect(items[0]['request_hash'], isA<String>());
        expect(items[0]['sale']['total_minor'], 1000);
        expect(items[0]['sale']['paid_minor'], 1000);
        expect(items[0]['sale']['client_created_at'], isA<String>());
        expect(items[0]['sale_items'], isA<List>());
        return http.Response(
          jsonEncode({
            'results': [
              {
                'idempotency_key': 'idem-123',
                'status': 'created',
                'sale_id': 'sale-456',
              },
            ],
          }),
          200,
        );
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
      );

      final sale = SaleDto(
        id: 'sale-uuid-1',
        idempotencyKey: 'idem-123',
        receiptNumber: 'R-001',
        subtotalMinor: 1000,
        discountMinor: 0,
        taxMinor: 0,
        grandTotalMinor: 1000,
        paymentMethod: 'cash',
        cashReceivedMinor: 1000,
        changeMinor: 0,
        clientCreatedAt: DateTime.now().millisecondsSinceEpoch,
        items: const [],
      );

      final results = await client.pushSalesBatch([sale]);
      expect(results.length, 1);
    });

    test('HTTP-012: sales created maps to synced', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'results': [
              {
                'idempotency_key': 'idem-123',
                'status': 'created',
                'sale_id': 'sale-456',
              },
            ],
          }),
          200,
        );
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
      );

      final sale = SaleDto(
        id: 'sale-uuid-1',
        idempotencyKey: 'idem-123',
        receiptNumber: 'R-001',
        subtotalMinor: 1000,
        discountMinor: 0,
        taxMinor: 0,
        grandTotalMinor: 1000,
        paymentMethod: 'cash',
        cashReceivedMinor: 1000,
        changeMinor: 0,
        clientCreatedAt: DateTime.now().millisecondsSinceEpoch,
        items: const [],
      );

      final results = await client.pushSalesBatch([sale]);
      expect(results[0].status, 'created');
      expect(results[0].error, isNull);
    });

    test('HTTP-013: sales replayed maps to success', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'results': [
              {
                'idempotency_key': 'idem-123',
                'status': 'replayed',
                'sale_id': 'sale-456',
              },
            ],
          }),
          200,
        );
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
      );

      final sale = SaleDto(
        id: 'sale-uuid-1',
        idempotencyKey: 'idem-123',
        receiptNumber: 'R-001',
        subtotalMinor: 1000,
        discountMinor: 0,
        taxMinor: 0,
        grandTotalMinor: 1000,
        paymentMethod: 'cash',
        cashReceivedMinor: 1000,
        changeMinor: 0,
        clientCreatedAt: DateTime.now().millisecondsSinceEpoch,
        items: const [],
      );

      final results = await client.pushSalesBatch([sale]);
      expect(results[0].status, 'created'); // replayed mapped to created
      expect(results[0].error, isNull);
    });

    test('HTTP-014: idempotency conflict returns error', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'results': [
              {
                'idempotency_key': 'idem-123',
                'status': 'failed',
                'error': 'Duplicate with different data',
              },
            ],
          }),
          200,
        );
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
      );

      final sale = SaleDto(
        id: 'sale-uuid-1',
        idempotencyKey: 'idem-123',
        receiptNumber: 'R-001',
        subtotalMinor: 1000,
        discountMinor: 0,
        taxMinor: 0,
        grandTotalMinor: 1000,
        paymentMethod: 'cash',
        cashReceivedMinor: 1000,
        changeMinor: 0,
        clientCreatedAt: DateTime.now().millisecondsSinceEpoch,
        items: const [],
      );

      final results = await client.pushSalesBatch([sale]);
      expect(results[0].status, 'failed');
      expect(results[0].error, isNotNull);
    });

    test('HTTP-015: HTTP 500 throws retry-compatible error', () async {
      final mockClient = MockClient((request) async {
        return http.Response('Internal Server Error', 500);
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
      );

      // We must pass a non-empty list so it actually makes the HTTP request
      final sale = SaleDto(
        id: 'sale-uuid-1',
        idempotencyKey: 'idem-123',
        receiptNumber: 'R-001',
        subtotalMinor: 1000,
        discountMinor: 0,
        taxMinor: 0,
        grandTotalMinor: 1000,
        paymentMethod: 'cash',
        cashReceivedMinor: 1000,
        changeMinor: 0,
        clientCreatedAt: DateTime.now().millisecondsSinceEpoch,
        items: const [],
      );

      expect(
        () => client.pushSalesBatch([sale]), // Pass [sale] instead of []
        throwsA(isA<HttpException>()),
      );
    });

    test('HTTP-016: malformed JSON throws explicit error', () async {
      final mockClient = MockClient((request) async {
        return http.Response('not json', 200);
      });

      final client = HttpSyncApiClient(baseUrl: baseUrl, client: mockClient);

      expect(
        () => client.pullProducts(businessId: businessId, sinceVersion: 0),
        throwsA(isA<MalformedResponseException>()),
      );
    });

    test('HTTP-017: push product uses correct URL with ID', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/v1/sync/products/prod-1');
        expect(request.method, 'PUT');
        return http.Response(jsonEncode({'server_version': 6}), 200);
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
      );

      final product = ProductDto(
        id: 'prod-1',
        name: 'Product 1',
        priceMinor: 1000,
        isActive: true,
        serverVersion: 5,
      );

      await client.pushProduct(product);
    });

    test('HTTP-018: push product handles 404 Not Found', () async {
      final mockClient = MockClient((request) async {
        return http.Response('Not Found', 404);
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
      );

      final product = ProductDto(
        id: 'prod-unknown',
        name: 'Unknown',
        priceMinor: 1000,
        isActive: true,
        serverVersion: 1,
      );

      final result = await client.pushProduct(product);
      expect(result.ok, isFalse);
      expect(result.conflict, isFalse);
      expect(result.error, contains('404'));
    });

    test('HTTP-019: push product handles 401/403 Tenant Mismatch', () async {
      final mockClient = MockClient((request) async {
        return http.Response('Unauthorized', 401);
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
      );

      final product = ProductDto(
        id: 'prod-1',
        name: 'Product 1',
        priceMinor: 1000,
        isActive: true,
        serverVersion: 1,
      );

      final result = await client.pushProduct(product);
      expect(result.ok, isFalse);
      expect(result.error, contains('401'));
    });
  });
}
