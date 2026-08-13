import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';

void main() {
  late AppDatabase db;
  late SyncOutboxRepository repo;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    repo = SyncOutboxRepository(db);
  });
  tearDown(() async => await db.close());

  test('SYNC-001 enqueue lalu fetchDue mengembalikan pending', () async {
    await repo.enqueueProductUpsert(
      ProductDto(
        id: 'a1111111-1111-4111-a111-111111111111',
        name: 'Kopi',
        priceMinor: 18000,
        isActive: true,
        serverVersion: 0,
      ),
    );
    final due = await repo.fetchDue(DateTime.now().millisecondsSinceEpoch);
    expect(due.length, 1);
    expect(due.first.status, 'pending');
    expect(due.first.entityType, 'product');
  });

  test('SYNC-003 markRetry menambah attempt & menunda nextAttemptAt', () async {
    final id = await repo.enqueueProductUpsert(
      ProductDto(
        id: 'a1111111-1111-4111-a111-111111111111',
        name: 'Kopi',
        priceMinor: 18000,
        isActive: true,
        serverVersion: 0,
      ),
    );
    final now = DateTime.now().millisecondsSinceEpoch;
    await repo.markRetry(id, now, 'timeout');
    final due = await repo.fetchDue(now + 5000);
    expect(due.first.attemptCount, 1);
    expect(due.first.nextAttemptAt, greaterThan(now));
  });

  test('SYNC-004 setelah maxAttempts menjadi failed', () async {
    final id = await repo.enqueueProductUpsert(
      ProductDto(
        id: 'a1111111-1111-4111-a111-111111111111',
        name: 'Kopi',
        priceMinor: 18000,
        isActive: true,
        serverVersion: 0,
      ),
    );
    final now = DateTime.now().millisecondsSinceEpoch;
    for (int i = 0; i < kMaxSyncAttempts; i++) {
      await repo.markRetry(id, now, 'err');
    }
    final counts = await repo.counts();
    expect(counts.failed, 1);
    expect(counts.pending, 0);
  });
}
