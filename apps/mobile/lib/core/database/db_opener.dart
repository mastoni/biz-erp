import 'dart:convert';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:path/path.dart' as p;

import 'app_database.dart';
import 'db_key_service.dart';

/// Exception thrown when a database file exists but its encryption key
/// is missing. This indicates potential data loss and must be handled
/// explicitly by the caller.
///
/// This exception NEVER contains key material.
class KeyLossException implements Exception {
  final String businessId;

  KeyLossException(this.businessId);

  @override
  String toString() =>
      'KeyLossException: Database file exists but encryption key is '
      'missing for business $businessId. Data may be unrecoverable. '
      'Manual intervention required.';
}

/// Exception thrown when a business ID has an invalid format.
///
/// This exception NEVER contains key material.
class InvalidBusinessIdException implements Exception {
  final String businessId;

  InvalidBusinessIdException(this.businessId);

  @override
  String toString() =>
      'InvalidBusinessIdException: Business ID does not match UUID format: '
      '$businessId';
}

/// Production database opener that combines DbKeyService,
/// SQLite3MultipleCiphers, Drift NativeDatabase, and per-business
/// database isolation.
///
/// Database layout:
/// `[appRoot]/business_[business_uuid]/pos.db`
///
/// Key flow:
/// business UUID → DbKeyService → 256-bit key → NativeDatabase
/// → PRAGMA key → SQLite3MultipleCiphers → Drift AppDatabase
class DbOpener {
  final DbKeyService _keyService;
  final Directory _appRoot;
  final Map<String, AppDatabase> _openDatabases = {};

  DbOpener({required this._keyService, required this._appRoot});

  /// Construct the database directory path for a business.
  Directory _dbDirFor(String businessId) {
    return Directory(p.join(_appRoot.path, 'business_$businessId'));
  }

  /// Construct the database file path for a business.
  File _dbFileFor(String businessId) {
    return File(p.join(_dbDirFor(businessId).path, 'pos.db'));
  }

  /// Validate that a business ID is a well-formed UUID.
  ///
  /// Prevents path traversal, arbitrary filesystem paths, and
  /// user-controlled absolute paths.
  void _validateBusinessId(String businessId) {
    final uuidRegex = RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      caseSensitive: false,
    );
    if (!uuidRegex.hasMatch(businessId)) {
      throw InvalidBusinessIdException(businessId);
    }
  }

  /// Open the encrypted database for a business.
  ///
  /// If the database is already open, returns the existing instance.
  ///
  /// Throws [InvalidBusinessIdException] if the business ID is malformed.
  /// Throws [KeyLossException] if the database file exists but the key
  /// is missing (financial data-loss protection).
  Future<AppDatabase> open(String businessId) async {
    _validateBusinessId(businessId);

    // Return existing instance if already open
    if (_openDatabases.containsKey(businessId)) {
      return _openDatabases[businessId]!;
    }

    final dbFile = _dbFileFor(businessId);
    final dbExists = dbFile.existsSync();
    final keyExists = await _keyService.hasKey(businessId);

    // CRITICAL KEY-LOSS RULE:
    // If database file exists but key is missing, do NOT generate
    // a replacement key. This is a financial data-loss protection.
    if (dbExists && !keyExists) {
      throw KeyLossException(businessId);
    }

    // Get or generate the encryption key.
    // If DB doesn't exist and key doesn't exist, this is first-time
    // creation (approved behavior from Phase 1B.2).
    final keyResult = await _keyService.getKey(businessId);

    // Ensure the database directory exists
    final dbDir = _dbDirFor(businessId);
    if (!dbDir.existsSync()) {
      dbDir.createSync(recursive: true);
    }

    // Encode key for PRAGMA (base64 string, safe for SQL quoting)
    final keyString = base64.encode(keyResult.key);

    // Open encrypted database via NativeDatabase with PRAGMA key setup
    final nativeDb = NativeDatabase(
      dbFile,
      setup: (db) {
        // SQLite3MultipleCiphers encryption initialization.
        // This syntax was verified in Phase 1B.0 and 1B.1.
        db.execute("PRAGMA key = '$keyString'");
      },
    );

    final appDb = AppDatabase(nativeDb);
    _openDatabases[businessId] = appDb;
    return appDb;
  }

  /// Close the database for a business.
  ///
  /// Does NOT delete the database file or the encryption key.
  Future<void> close(String businessId) async {
    final db = _openDatabases.remove(businessId);
    if (db != null) {
      await db.close();
    }
  }

  /// Close all open databases.
  ///
  /// Does NOT delete any database files or encryption keys.
  Future<void> closeAll() async {
    for (final entry in _openDatabases.entries) {
      await entry.value.close();
    }
    _openDatabases.clear();
  }

  /// Get the database path for a business (for diagnostics/testing).
  String dbPathFor(String businessId) {
    _validateBusinessId(businessId);
    return _dbFileFor(businessId).path;
  }
}
