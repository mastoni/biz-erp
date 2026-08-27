// apps/mobile/lib/core/sync/store_settings_repository.dart

import 'dart:convert';

import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:drift/drift.dart';

import 'sync_api_client.dart';
import 'store_settings_models.dart';

/// Resolved branch-level store settings row from [BusinessSettingsLocal].
class ResolvedSettings {
  final StoreSettingsDto settings;
  final int updatedAtMs;

  const ResolvedSettings({
    required this.settings,
    required this.updatedAtMs,
  });
}

/// Repository for fetching, caching, and retrieving canonical store
/// settings from GET /v1/settings/store.
///
/// The server is authoritative for branch override → business default →
/// canonical default resolution. Mobile stores only the resolved result.
class StoreSettingsRepository {
  StoreSettingsRepository(this._db, this._api);
  final AppDatabase _db;
  final SyncApiClient _api;

  /// Fetch resolved settings from server and persist locally.
  /// Throws on network/parsing errors; caller decides fallback.
  Future<StoreSettingsDto> fetchAndCache({
    required String businessId,
    required String branchId,
  }) async {
    final settings = await _api.getStoreSettings(
      businessId: businessId,
      branchId: branchId,
    );

    if (settings == null) {
      throw StateError(
        'No store settings for business=$businessId branch=$branchId',
      );
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    final id = '${businessId}_$branchId';
    final jsonStr = jsonEncode(settings.toJson());

    await _db.into(_db.businessSettingsLocal).insertOnConflictUpdate(
          BusinessSettingsLocalCompanion.insert(
            id: id,
            businessId: businessId,
            branchId: Value(branchId),
            updatedAt: now,
            settingsJson: Value(jsonStr),
            taxRateBps: Value(settings.taxRateBps),
            currencyCode: const Value('IDR'),
            currencyMinorUnits: const Value(0),
            timezone: const Value('Asia/Jakarta'),
          ),
        );

    return settings;
  }

  /// Load cached resolved settings without hitting the network.
  /// Returns null if no cached settings exist for this business+branch.
  Future<ResolvedSettings?> getCached({
    required String businessId,
    required String branchId,
  }) async {
    final id = '${businessId}_$branchId';
    final row = await (_db.select(_db.businessSettingsLocal)
          ..where((t) => t.id.equals(id)))
        .getSingleOrNull();

    if (row == null || row.settingsJson == '{}' || row.settingsJson.isEmpty) {
      return null;
    }

    final dto = StoreSettingsDto.fromJson(
      jsonDecode(row.settingsJson) as Map<String, dynamic>,
    );

    return ResolvedSettings(
      settings: dto,
      updatedAtMs: row.updatedAt,
    );
  }

  /// Fetch from server, fall back to cached settings on network failure.
  /// Throws only if both server and cache are unavailable.
  Future<StoreSettingsDto> getSettings({
    required String businessId,
    required String branchId,
  }) async {
    try {
      return await fetchAndCache(
        businessId: businessId,
        branchId: branchId,
      );
    } catch (e) {
      final cached = await getCached(businessId: businessId, branchId: branchId);
      if (cached != null) {
        return cached.settings;
      }
      rethrow;
    }
  }

  /// Clear all cached settings for a business (called on tenant switch).
  Future<void> clearAllForBusiness(String businessId) async {
    await (_db.delete(_db.businessSettingsLocal)
          ..where((t) => t.businessId.equals(businessId)))
        .go();
  }

  /// Clear cached settings for a specific business+branch (called on branch switch).
  Future<void> clearBranchSettings({
    required String businessId,
    required String branchId,
  }) async {
    final id = '${businessId}_$branchId';
    await (_db.delete(_db.businessSettingsLocal)
          ..where((t) => t.id.equals(id)))
        .go();
  }
}
