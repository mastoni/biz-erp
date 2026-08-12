import 'dart:io';

import 'package:drift/drift.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/database/db_key_service.dart';
import 'package:biz_erp_mobile/core/database/db_opener.dart';
import 'package:biz_erp_mobile/core/database/tables/sales_local.dart';

/// Fake secure storage for testing
class FakeSecureStorage implements SecureStorageAdapter {
  final Map<String, String> _store = {};

  @override
  Future<String?> read(String key) async => _store[key];

  @override
  Future<void> write(String key, String value) async {
    _store[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    _store.remove(key);
  }

  /// Simulate key loss (delete without going through service)
  void simulateKeyLoss(String key) {
    _store.remove(key);
  }
}

/// Force the database file to be materialized on disk.
///
/// NativeDatabase is lazy — the file is only created on first query.
/// This helper triggers file creation so tests can inspect the file.
Future<void> materialize(AppDatabase db) async {
  await db.customSelect('SELECT 1').get();
}

/// Check if sqlite3mc (SQLite3MultipleCiphers) is loaded on this platform.
///
/// Returns true if `PRAGMA cipher` returns rows (sqlite3mc active),
/// false if plain sqlite3 is in use.
Future<bool> isSqlite3mcLoaded(AppDatabase db) async {
  try {
    final rows = await db.customSelect('PRAGMA cipher').get();
    return rows.isNotEmpty;
  } catch (_) {
    return false;
  }
}

void main() {
  late Directory tempDir;
  late FakeSecureStorage fakeStorage;
  late DbKeyService keyService;
  late DbOpener opener;

  const validBusinessId = '550e8400-e29b-41d4-a716-446655440000';
  const validBusinessId2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  setUp(() {
    tempDir = Directory.systemTemp.createTempSync('db_opener_test_');
    fakeStorage = FakeSecureStorage();
    keyService = DbKeyService(storage: fakeStorage);
    opener = DbOpener(keyService: keyService, appRoot: tempDir);

    // Silence Drift warning about multiple AppDatabase instances.
    // Tests intentionally open multiple databases for different businesses.
    driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  });

  tearDown(() async {
    await opener.closeAll();
    if (tempDir.existsSync()) {
      tempDir.deleteSync(recursive: true);
    }
  });

  group('DB-OPEN-002: same business resolves to same path', () {
    test('repeated path resolution returns same path', () {
      final path1 = opener.dbPathFor(validBusinessId);
      final path2 = opener.dbPathFor(validBusinessId);
      expect(path1, equals(path2));
    });

    test('opening same business returns same instance', () async {
      final db1 = await opener.open(validBusinessId);
      final db2 = await opener.open(validBusinessId);
      expect(identical(db1, db2), isTrue);
    });
  });

  group('DB-OPEN-003: different businesses resolve to different paths', () {
    test('different business IDs produce different paths', () {
      final pathA = opener.dbPathFor(validBusinessId);
      final pathB = opener.dbPathFor(validBusinessId2);
      expect(pathA, isNot(equals(pathB)));
    });

    test('paths contain business-specific directories', () {
      final pathA = opener.dbPathFor(validBusinessId);
      final pathB = opener.dbPathFor(validBusinessId2);
      expect(pathA, contains('business_$validBusinessId'));
      expect(pathB, contains('business_$validBusinessId2'));
    });
  });

  group('Business ID validation', () {
    test('valid UUID is accepted', () {
      expect(() => opener.dbPathFor(validBusinessId), returnsNormally);
    });

    test('path traversal is rejected', () {
      expect(
        () => opener.dbPathFor('../etc/passwd'),
        throwsA(isA<InvalidBusinessIdException>()),
      );
    });

    test('absolute path is rejected', () {
      expect(
        () => opener.dbPathFor('/tmp/evil'),
        throwsA(isA<InvalidBusinessIdException>()),
      );
    });

    test('business name is rejected', () {
      expect(
        () => opener.dbPathFor('my_business'),
        throwsA(isA<InvalidBusinessIdException>()),
      );
    });

    test('empty string is rejected', () {
      expect(
        () => opener.dbPathFor(''),
        throwsA(isA<InvalidBusinessIdException>()),
      );
    });
  });

  group('DB-001: encrypted DB opens with correct key', () {
    test('first open creates database', () async {
      final db = await opener.open(validBusinessId);
      expect(db, isA<AppDatabase>());

      // Force file materialization (NativeDatabase is lazy)
      await materialize(db);

      final dbFile = File(opener.dbPathFor(validBusinessId));
      expect(dbFile.existsSync(), isTrue);
    });
  });

  group('DB-002: write/read works through Drift', () {
    test('can insert and query sales_local', () async {
      final db = await opener.open(validBusinessId);

      await db
          .into(db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'opener-test-tx',
              businessId: validBusinessId,
              branchId: 'branch-1',
              cashierId: 'cashier-1',
              status: SaleStatus.draft,
              subtotalMinor: 5000,
              totalMinor: 5000,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'device-1',
              createdAt: DateTime.now().millisecondsSinceEpoch,
              updatedAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      final sale =
          await (db.select(db.salesLocal)
                ..where((t) => t.clientTransactionId.equals('opener-test-tx')))
              .getSingle();

      expect(sale.businessId, validBusinessId);
      expect(sale.totalMinor, 5000);
    });
  });

  group('DB-006: business isolation', () {
    test('business A cannot read business B data', () async {
      final dbA = await opener.open(validBusinessId);
      final dbB = await opener.open(validBusinessId2);

      // Insert into A
      await dbA
          .into(dbA.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'iso-tx-a',
              businessId: validBusinessId,
              branchId: 'branch-a',
              cashierId: 'cashier-a',
              status: SaleStatus.draft,
              subtotalMinor: 1000,
              totalMinor: 1000,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'device-a',
              createdAt: DateTime.now().millisecondsSinceEpoch,
              updatedAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      // Query from B — should not find A's data
      final results = await (dbB.select(
        dbB.salesLocal,
      )..where((t) => t.clientTransactionId.equals('iso-tx-a'))).get();

      expect(results, isEmpty);
    });
  });

  group('DB-007: database persists after close/reopen', () {
    test('data survives close and reopen', () async {
      // Open and write
      final db1 = await opener.open(validBusinessId);
      await db1
          .into(db1.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: 'persist-tx',
              businessId: validBusinessId,
              branchId: 'branch-1',
              cashierId: 'cashier-1',
              status: SaleStatus.draft,
              subtotalMinor: 2000,
              totalMinor: 2000,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'device-1',
              createdAt: DateTime.now().millisecondsSinceEpoch,
              updatedAt: DateTime.now().millisecondsSinceEpoch,
            ),
          );

      // Close
      await opener.close(validBusinessId);

      // Reopen
      final db2 = await opener.open(validBusinessId);

      // Verify data persisted
      final sale = await (db2.select(
        db2.salesLocal,
      )..where((t) => t.clientTransactionId.equals('persist-tx'))).getSingle();

      expect(sale.totalMinor, 2000);
    });
  });

  group('DB-OPEN-001: existing DB + missing key produces explicit error', () {
    test('key loss throws KeyLossException', () async {
      // Create database first
      final db = await opener.open(validBusinessId);
      await materialize(db);
      await opener.close(validBusinessId);

      // Simulate key loss
      fakeStorage.simulateKeyLoss('pos_db_key_$validBusinessId');

      // Attempt to open — should throw KeyLossException
      expect(
        () => opener.open(validBusinessId),
        throwsA(isA<KeyLossException>()),
      );
    });

    test('key loss does NOT generate replacement key', () async {
      // Create database first
      final db = await opener.open(validBusinessId);
      await materialize(db);
      await opener.close(validBusinessId);

      // Simulate key loss
      fakeStorage.simulateKeyLoss('pos_db_key_$validBusinessId');

      // Attempt to open — should throw
      try {
        await opener.open(validBusinessId);
        fail('Should have thrown KeyLossException');
      } on KeyLossException {
        // Expected
      }

      // Verify no new key was generated
      final hasKey = await keyService.hasKey(validBusinessId);
      expect(
        hasKey,
        isFalse,
        reason: 'Key loss must not generate a replacement key',
      );
    });
  });

  group('DB-OPEN-004: database is not plaintext', () {
    test(
      'database file does not start with SQLite header (sqlite3mc platforms only)',
      () async {
        final db = await opener.open(validBusinessId);
        await materialize(db);

        // Check if sqlite3mc is actually loaded on this platform
        final encrypted = await isSqlite3mcLoaded(db);

        if (!encrypted) {
          // On platforms without sqlite3mc (e.g., Windows host with plain sqlite3.dll),
          // encryption cannot be tested at the file level. The Android integration
          // test is the authoritative verification for this behavior.
          return;
        }

        // sqlite3mc IS loaded — verify file is not plaintext
        final dbFile = File(opener.dbPathFor(validBusinessId));
        final bytes = dbFile.readAsBytesSync();

        // Plaintext SQLite files start with "SQLite format 3\0"
        final header = String.fromCharCodes(bytes.take(15));
        expect(
          header,
          isNot('SQLite format 3'),
          reason: 'Encrypted DB must not have plaintext SQLite header',
        );
      },
    );
  });

  group('DB-OPEN-005: key never appears in exceptions', () {
    test('KeyLossException does not contain key material', () {
      final exception = KeyLossException(validBusinessId);
      final message = exception.toString();

      expect(message, isNot(contains('base64')));
      expect(message, isNot(contains('key =')));
      expect(message, contains(validBusinessId));
    });

    test('InvalidBusinessIdException does not contain key material', () {
      final exception = InvalidBusinessIdException('invalid-id');
      final message = exception.toString();
      expect(message, isNot(contains('base64')));
      expect(message, isNot(contains('key =')));
    });
  });

  group('Lifecycle', () {
    test('close removes database from open list', () async {
      final db1 = await opener.open(validBusinessId);
      await materialize(db1);
      await opener.close(validBusinessId);

      // Opening again should create a new instance
      final db2 = await opener.open(validBusinessId);
      expect(db2, isA<AppDatabase>());
      expect(identical(db1, db2), isFalse);
    });

    test('closeAll closes all databases', () async {
      await opener.open(validBusinessId);
      await opener.open(validBusinessId2);
      await opener.closeAll();

      // Both should be reopenable
      final dbA = await opener.open(validBusinessId);
      final dbB = await opener.open(validBusinessId2);
      expect(dbA, isA<AppDatabase>());
      expect(dbB, isA<AppDatabase>());
    });

    test('close does not delete database file', () async {
      final db = await opener.open(validBusinessId);
      await materialize(db);
      final dbPath = opener.dbPathFor(validBusinessId);
      await opener.close(validBusinessId);

      expect(
        File(dbPath).existsSync(),
        isTrue,
        reason: 'Close must not delete the database file',
      );
    });

    test('close does not delete encryption key', () async {
      final db = await opener.open(validBusinessId);
      await materialize(db);
      await opener.close(validBusinessId);

      final hasKey = await keyService.hasKey(validBusinessId);
      expect(
        hasKey,
        isTrue,
        reason: 'Close must not delete the encryption key',
      );
    });
  });
}
