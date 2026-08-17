import 'package:flutter_test/flutter_test.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:biz_erp_mobile/core/observability/sentry_integration.dart';
import 'package:biz_erp_mobile/core/sync/http_sync_api_client.dart';

void main() {
  group('Sentry Flutter Integration', () {
    test('SENTRY-M-001: DSN absent disables Sentry', () async {
      bool runnerCalled = false;
      await initSentry(() {
        runnerCalled = true;
      });
      expect(runnerCalled, isTrue);
      expect(Sentry.isEnabled, isFalse);
    });

    test('SENTRY-M-007 to SENTRY-M-010: Scrubbing logic works', () async {
      final originalEvent = SentryEvent(
        request: SentryRequest(
          headers: {'authorization': 'Bearer super-secret-token'},
          data: {'password': 'my-password', 'customer_data': 'safe'},
        ),
        contexts: Contexts(
          device: const SentryDevice(name: 'test-device'),
        )..['custom'] = {
          'refresh_token': 'secret-refresh',
          'nested': {'jwt': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret'},
        },
        tags: {'sentry_dsn': 'https://123@sentry.io/456'},
      );

      final scrubbedEvent = await scrubEventForTest(originalEvent);
      
      expect(scrubbedEvent, isNotNull);
      final req = scrubbedEvent!.request;
      expect(req!.headers['authorization'], '[REDACTED]');
      expect((req.data as Map)['password'], '[REDACTED]');
      expect((req.data as Map)['customer_data'], 'safe');

      final contexts = scrubbedEvent.contexts;
      final custom = contexts['custom'] as Map;
      expect(custom['refresh_token'], '[REDACTED]');
      expect((custom['nested'] as Map)['jwt'], '[REDACTED]');

      final tags = scrubbedEvent.tags;
      expect(tags!['sentry_dsn'], '[REDACTED]');
    });

    test('SENTRY-M-013 & SENTRY-M-014: HttpException preserves requestId', () {
      final exception = HttpException('Server error', statusCode: 500, requestId: 'req-12345');
      expect(exception.statusCode, 500);
      expect(exception.requestId, 'req-12345');
      expect(exception.toString(), contains('req-12345'));
    });
  });
}
