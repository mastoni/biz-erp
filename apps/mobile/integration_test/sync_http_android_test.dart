import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:http/http.dart' as http;
import 'package:biz_erp_mobile/core/sync/sync_config.dart';
import 'package:biz_erp_mobile/core/sync/http_sync_api_client.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('E2E-002A: Android reaches API health endpoint', (tester) async {
    final baseUrl = SyncConfig.baseUrl;
    print('SyncConfig.baseUrl: ${baseUrl}');
    expect(baseUrl, 'http://10.0.2.2:8080');

    final client = HttpSyncApiClient(baseUrl: baseUrl);
    final isHealthy = await client.health();
    print('HttpSyncApiClient.health() result: ${isHealthy}');
    expect(isHealthy, isTrue, reason: 'HttpSyncApiClient.health() harus true');

    final response = await http.get(Uri.parse('${baseUrl}/health')).timeout(const Duration(seconds: 10));
    print('HTTP Status Code: ${response.statusCode}');
    print('HTTP Body: ${response.body}');

    expect(response.statusCode, 200);

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    expect(json['status'], 'ok');
    expect(json['database'], 'ok');

    client.close();
  });
}
