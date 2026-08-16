import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:biz_erp_mobile/core/auth/auth_models.dart';
import 'package:biz_erp_mobile/core/sync/http_sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';

void main() {
  group('Auth HTTP Single-Flight Refresh', () {
    const baseUrl = 'http://test.example.com';
    const businessId = 'test-business-123';

    test('AUTH-HTTP-001: access token attached', () async {
      final mockClient = MockClient((request) async {
        expect(request.headers['Authorization'], 'Bearer current-token');
        return http.Response('{"items": [], "has_more": false, "current_version": 1}', 200);
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
        tokenProvider: () => 'current-token',
      );

      await client.pullProducts(businessId: businessId, sinceVersion: 0);
    });

    test('AUTH-HTTP-002: 401 triggers refresh', () async {
      int refreshCount = 0;
      int requestCount = 0;

      final mockClient = MockClient((request) async {
        requestCount++;
        if (requestCount == 1) {
          return http.Response('Unauthorized', 401);
        }
        return http.Response('{"items": [], "has_more": false, "current_version": 1}', 200);
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
        tokenProvider: () => 'current-token',
        onRefresh: () async {
          refreshCount++;
          return RefreshResult.success;
        },
      );

      await client.pullProducts(businessId: businessId, sinceVersion: 0);
      expect(refreshCount, 1);
      expect(requestCount, 2);
    });

    test('AUTH-HTTP-007 & 008 & 009: single-flight with concurrent A/B/C requests', () async {
      int refreshCount = 0;
      int reqA = 0;
      int reqB = 0;
      int reqC = 0;
      
      bool isRefreshed = false;
      
      final completer = Completer<RefreshResult>();

      final mockClient = MockClient((request) async {
        if (request.url.path.contains('products')) {
          reqA++;
          return isRefreshed ? http.Response('{"items": [], "has_more": false, "current_version": 1}', 200) : http.Response('Unauthorized', 401);
        } else if (request.url.path.contains('sales/batch')) {
          reqC++;
          return isRefreshed ? http.Response('{"results": []}', 200) : http.Response('Unauthorized', 401);
        } else if (request.url.path.contains('sales')) {
          reqB++;
          return isRefreshed ? http.Response('{"sales": [], "has_more": false}', 200) : http.Response('Unauthorized', 401);
        }
        return http.Response('OK', 200);
      });

      // Simulation of AuthRepository refreshSession
      Future<RefreshResult> mockRefreshSession() {
        refreshCount++;
        return completer.future;
      }
      
      Future<RefreshResult>? activeRefresh;
      Future<RefreshResult> singleFlightRefresh() {
        if (activeRefresh != null) return activeRefresh!;
        activeRefresh = mockRefreshSession().whenComplete(() {
          activeRefresh = null;
        });
        return activeRefresh!;
      }

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
        tokenProvider: () => isRefreshed ? 'new-token' : 'old-token',
        onRefresh: singleFlightRefresh,
      );

      // Fire A, B, C concurrently
      final futureA = client.pullProducts(businessId: businessId, sinceVersion: 0);
      final futureB = client.pullSales(businessId: businessId, sinceMs: 0);
      final futureC = client.pushSalesBatch([
        SaleDto(
          id: 'sale-1',
          idempotencyKey: 'idem-1',
          receiptNumber: 'R-1',
          subtotalMinor: 1000,
          discountMinor: 0,
          taxMinor: 0,
          grandTotalMinor: 1000,
          paymentMethod: 'cash',
          cashReceivedMinor: 1000,
          changeMinor: 0,
          clientCreatedAt: 0,
          items: const [],
        )
      ]);

      // Allow event loop to process initial requests
      await Future.delayed(const Duration(milliseconds: 50));
      
      // All should have hit 401 once
      expect(reqA, 1);
      expect(reqB, 1);
      expect(reqC, 1);
      
      // But only ONE refresh was triggered
      expect(refreshCount, 1);
      
      // Resolve the refresh
      isRefreshed = true;
      completer.complete(RefreshResult.success);
      
      await Future.wait([futureA, futureB, futureC]);
      
      // Each should have retried EXACTLY ONCE
      expect(reqA, 2);
      expect(reqB, 2);
      expect(reqC, 2);
      expect(refreshCount, 1);
    });

    test('AUTH-HTTP-010: retry uses NEW access token', () async {
      bool isRefreshed = false;
      int requestCount = 0;

      final mockClient = MockClient((request) async {
        requestCount++;
        if (requestCount == 1) {
          expect(request.headers['Authorization'], 'Bearer old-token');
          return http.Response('Unauthorized', 401);
        } else {
          expect(request.headers['Authorization'], 'Bearer new-token');
          return http.Response('{"items": [], "has_more": false, "current_version": 1}', 200);
        }
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
        tokenProvider: () => isRefreshed ? 'new-token' : 'old-token',
        onRefresh: () async {
          isRefreshed = true;
          return RefreshResult.success;
        },
      );

      await client.pullProducts(businessId: businessId, sinceVersion: 0);
    });

    test('AUTH-HTTP-011: second 401 does not trigger another refresh', () async {
      int refreshCount = 0;
      int requestCount = 0;

      final mockClient = MockClient((request) async {
        requestCount++;
        return http.Response('Unauthorized', 401);
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
        tokenProvider: () => 'token',
        onRefresh: () async {
          refreshCount++;
          return RefreshResult.success;
        },
      );

      expect(
        () => client.pullProducts(businessId: businessId, sinceVersion: 0),
        throwsA(isA<HttpException>()),
      );
      
      await Future.delayed(const Duration(milliseconds: 50));
      expect(refreshCount, 1); // Only 1 refresh
      expect(requestCount, 2); // Only 2 requests (original + 1 retry)
    });

    test('AUTH-HTTP-012: INVALID_REFRESH_TOKEN causes fail', () async {
      int refreshCount = 0;
      int requestCount = 0;

      final mockClient = MockClient((request) async {
        requestCount++;
        return http.Response('Unauthorized', 401);
      });

      final client = HttpSyncApiClient(
        baseUrl: baseUrl,
        client: mockClient,
        businessId: businessId,
        tokenProvider: () => 'token',
        onRefresh: () async {
          refreshCount++;
          return RefreshResult.sessionExpired;
        },
      );

      expect(
        () => client.pullProducts(businessId: businessId, sinceVersion: 0),
        throwsA(isA<HttpException>()),
      );
      
      await Future.delayed(const Duration(milliseconds: 50));
      expect(refreshCount, 1);
      expect(requestCount, 1); // Break on sessionExpired, NO RETRY
    });
  });
}
