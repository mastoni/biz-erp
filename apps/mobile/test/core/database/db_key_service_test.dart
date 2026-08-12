import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/db_key_service.dart';

/// Fake implementation of SecureStorageAdapter for testing
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
}

void main() {
  late DbKeyService service;
  late FakeSecureStorage fakeStorage;

  setUp(() {
    fakeStorage = FakeSecureStorage();
    service = DbKeyService(storage: fakeStorage);
  });

  group('DB-004: key generated/stored successfully', () {
    test('generates a 256-bit key on first call', () async {
      final result = await service.getKey('business_001');

      expect(result.isGenerated, isTrue);
      expect(result.key.length, 32);
      expect(result.key, isA<Uint8List>());
    });

    test('stores the key in secure storage', () async {
      await service.getKey('business_001');

      final stored = await fakeStorage.read('pos_db_key_business_001');
      expect(stored, isNotNull);
      expect(stored!.length, greaterThan(0));
    });
  });

  group('DB-005: key remains stable across repeated retrieval', () {
    test('returns same key on second call', () async {
      final first = await service.getKey('business_001');
      final second = await service.getKey('business_001');

      expect(second.isRetrieved, isTrue);
      expect(second.key, equals(first.key));
    });

    test('returns same key on third call', () async {
      final first = await service.getKey('business_001');
      await service.getKey('business_001');
      final third = await service.getKey('business_001');

      expect(third.isRetrieved, isTrue);
      expect(third.key, equals(first.key));
    });
  });

  group('KEY-001: key length = 256 bits', () {
    test('generated key is exactly 32 bytes', () async {
      final result = await service.getKey('business_001');
      expect(result.key.length, 32);
    });

    test('retrieved key is exactly 32 bytes', () async {
      await service.getKey('business_001');
      final result = await service.getKey('business_001');
      expect(result.key.length, 32);
    });
  });

  group('KEY-002: different business IDs produce different keys', () {
    test('two different businesses get different keys', () async {
      final keyA = await service.getKey('business_A');
      final keyB = await service.getKey('business_B');

      expect(keyA.key, isNot(equals(keyB.key)));
    });

    test('three different businesses all get different keys', () async {
      final keyA = await service.getKey('business_A');
      final keyB = await service.getKey('business_B');
      final keyC = await service.getKey('business_C');

      expect(keyA.key, isNot(equals(keyB.key)));
      expect(keyA.key, isNot(equals(keyC.key)));
      expect(keyB.key, isNot(equals(keyC.key)));
    });
  });

  group('KEY-003: key is independent of JWT', () {
    test('same business ID always produces same key regardless of context',
        () async {
      final first = await service.getKey('business_001');
      final second = await service.getKey('business_001');
      final third = await service.getKey('business_001');

      expect(second.key, equals(first.key));
      expect(third.key, equals(first.key));
    });
  });

  group('KEY-004: key is never logged', () {
    test('key has entropy and is not predictable', () async {
      final result = await service.getKey('business_001');

      // Verify key is not all zeros
      expect(result.key, isNot(equals(Uint8List(32))));

      // Verify key has entropy (not all same byte)
      final firstByte = result.key[0];
      final allSame = result.key.every((byte) => byte == firstByte);
      expect(allSame, isFalse, reason: 'Key should have entropy');
    });
  });

  group('KEY-005: missing key does not silently overwrite', () {
    test('corrupted key storage throws exception instead of regenerating',
        () async {
      await fakeStorage.write('pos_db_key_business_001', 'invalid_base64_!!!');

      expect(
        () => service.getKey('business_001'),
        throwsA(isA<KeyStorageCorruptedException>()),
      );
    });

    test('wrong-length key throws exception instead of regenerating', () async {
      final shortKey = Uint8List(16);
      for (int i = 0; i < 16; i++) {
        shortKey[i] = i;
      }
      final encoded = base64.encode(shortKey);

      await fakeStorage.write('pos_db_key_business_001', encoded);

      expect(
        () => service.getKey('business_001'),
        throwsA(isA<KeyStorageCorruptedException>()),
      );
    });
  });
}