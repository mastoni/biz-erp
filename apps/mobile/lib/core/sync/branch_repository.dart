import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:drift/drift.dart';

class BranchRepository {
  BranchRepository(this._db, this._api);
  final AppDatabase _db;
  final SyncApiClient _api;

  Future<List<BranchDto>> fetchBranches(String businessId) async {
    final response = await _api.pullBranches(businessId: businessId);
    return response.branches;
  }

  Future<void> refreshAndCacheBranches(String businessId) async {
    final branches = await fetchBranches(businessId);
    if (branches.isEmpty) return;

    await _db.batch((b) {
      for (final branch in branches) {
        b.insert(
          _db.branchesLocal,
          BranchesLocalCompanion.insert(
            id: branch.id,
            businessId: branch.businessId,
            name: branch.name,
            status: branch.status,
            createdAt: branch.createdAt,
            updatedAt: branch.updatedAt,
            cachedAt: DateTime.now().millisecondsSinceEpoch,
          ),
          mode: InsertMode.insertOrReplace,
        );
      }
    });
  }

  Future<List<BranchDto>> getCachedBranches(String businessId) async {
    final rows = await (_db.select(_db.branchesLocal)
      ..where((t) => t.businessId.equals(businessId)))
      .get();
    return rows
        .map(
          (r) => BranchDto(
            id: r.id,
            businessId: r.businessId,
            name: r.name,
            status: r.status,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          ),
        )
        .toList();
  }

  Future<BranchDto?> getActiveBranch(String businessId) async {
    // Try to get cached branches first (for offline support)
    final cached = await getCachedBranches(businessId);
    if (cached.isNotEmpty) {
      // Return first active branch from cache
      for (final branch in cached) {
        if (branch.status) {
          return branch;
        }
      }
      return cached.first;
    }

    // If no cache, try online
    try {
      return await _getActiveBranchOnline(businessId);
    } catch (_) {
      // If online fails and no cache, return null
      return null;
    }
  }

  Future<BranchDto?> _getActiveBranchOnline(String businessId) async {
    final branches = await fetchBranches(businessId);
    if (branches.isEmpty) return null;

    // Cache the fetched branches
    await _db.batch((b) {
      for (final branch in branches) {
        b.insert(
          _db.branchesLocal,
          BranchesLocalCompanion.insert(
            id: branch.id,
            businessId: branch.businessId,
            name: branch.name,
            status: branch.status,
            createdAt: branch.createdAt,
            updatedAt: branch.updatedAt,
            cachedAt: DateTime.now().millisecondsSinceEpoch,
          ),
          mode: InsertMode.insertOrReplace,
        );
      }
    });

    for (final branch in branches) {
      if (branch.status) {
        return branch;
      }
    }
    return branches.first;
  }

  Future<void> setActiveBranch(String businessId, String branchId) async {
    await _db.into(_db.activeBranchLocal).insertOnConflictUpdate(
      ActiveBranchLocalCompanion.insert(
        businessId: businessId,
        branchId: branchId,
        updatedAt: DateTime.now().millisecondsSinceEpoch,
      ),
    );
  }

  Future<String?> getSelectedBranchId(String businessId) async {
    final row = await (_db.select(_db.activeBranchLocal)
      ..where((t) => t.businessId.equals(businessId)))
      .getSingleOrNull();
    return row?.branchId;
  }
}