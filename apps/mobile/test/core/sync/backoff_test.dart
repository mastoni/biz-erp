import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';

void main() {
  test('SYNC-002 backoff sequence & cap', () {
    expect(backoffMillis(0), 1000);
    expect(backoffMillis(1), 2000);
    expect(backoffMillis(2), 4000);
    expect(backoffMillis(5), 32000);
    expect(backoffMillis(6), 60000);
    expect(backoffMillis(9), 60000);
  });
}
