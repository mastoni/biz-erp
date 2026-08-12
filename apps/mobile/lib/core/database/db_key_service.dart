import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Abstract interface for secure storage operations.
/// Allows testing without depending on the concrete FlutterSecureStorage API.
abstract class SecureStorageAdapter {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// Production implementation using flutter_secure_storage.
class FlutterSecureStorageAdapter implements SecureStorageAdapter {
  final FlutterSecureStorage _storage;

  FlutterSecureStorageAdapter({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

/// Result type indicating whether a key was newly generated or retrieved.
enum KeyResultType { generated, retrieved }

/// Wrapper for encryption key with metadata about its origin.
class KeyResult {
  final Uint8List key;
  final KeyResultType type;

  KeyResult._(this.key, this.type);

  factory KeyResult.generated(Uint8List key) =>
      KeyResult._(key, KeyResultType.generated);

  factory KeyResult.retrieved(Uint8List key) =>
      KeyResult._(key, KeyResultType.retrieved);

  bool get isGenerated => type == KeyResultType.generated;
  bool get isRetrieved => type == KeyResultType.retrieved;
}

/// Exception thrown when stored key is corrupted and cannot be recovered.
/// Never exposes the key material itself.
class KeyStorageCorruptedException implements Exception {
  final String businessId;
  final String reason;

  KeyStorageCorruptedException(this.businessId, this.reason);

  @override
  String toString() =>
      'KeyStorageCorruptedException: $reason (business: $businessId)';
}

/// Secure database encryption key service.
///
/// Generates and manages 256-bit encryption keys for per-business databases.
/// Keys are stored in platform secure storage (Keychain/Keystore) and are
/// completely independent of JWT tokens, passwords, or any other credentials.
class DbKeyService {
  static const int _keyLengthBytes = 32; // 256 bits
  final SecureStorageAdapter _storage;

  DbKeyService({SecureStorageAdapter? storage})
    : _storage = storage ?? FlutterSecureStorageAdapter();

  String _storageKeyFor(String businessId) => 'pos_db_key_$businessId';

  /// Get or generate the encryption key for a business.
  ///
  /// Returns a [KeyResult] indicating whether the key was newly generated
  /// or retrieved from storage. This allows callers to detect key loss
  /// (e.g., if database file exists but key is newly generated).
  ///
  /// Throws [KeyStorageCorruptedException] if stored key is invalid.
  Future<KeyResult> getKey(String businessId) async {
    final storageKey = _storageKeyFor(businessId);

    // Try to retrieve existing key
    final existing = await _storage.read(storageKey);
    if (existing != null) {
      try {
        final bytes = base64.decode(existing);
        if (bytes.length == _keyLengthBytes) {
          return KeyResult.retrieved(Uint8List.fromList(bytes));
        } else {
          throw KeyStorageCorruptedException(
            businessId,
            'Stored key has invalid length: ${bytes.length} bytes '
            '(expected $_keyLengthBytes)',
          );
        }
      } on FormatException catch (e) {
        throw KeyStorageCorruptedException(
          businessId,
          'Stored key is not valid base64: ${e.message}',
        );
      }
    }

    // Generate new 256-bit key using cryptographically secure random
    final keyBytes = Uint8List(_keyLengthBytes);
    final random = Random.secure();
    for (int i = 0; i < _keyLengthBytes; i++) {
      keyBytes[i] = random.nextInt(256);
    }

    // Store the key
    await _storage.write(storageKey, base64.encode(keyBytes));

    return KeyResult.generated(keyBytes);
  }

  /// Check if a key exists for the given business without generating one.
  ///
  /// Returns true if a key is stored, false otherwise.
  /// This is used by the database opener to detect key-loss situations
  /// before calling getKey().
  Future<bool> hasKey(String businessId) async {
    final storageKey = _storageKeyFor(businessId);
    final existing = await _storage.read(storageKey);
    return existing != null;
  }
}
