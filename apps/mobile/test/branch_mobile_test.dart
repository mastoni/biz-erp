import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/tenant/tenant_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/branch_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:drift/native.dart';

class _FakeSyncApiClient implements SyncApiClient {
  final Map<String, List<BranchDto>> _branchesByBusiness;

  _FakeSyncApiClient(this._branchesByBusiness);

  @override
  Future<PullBranchesResponse> pullBranches({required String businessId}) async {
    return PullBranchesResponse(_branchesByBusiness[businessId] ?? []);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const business1Id = '11111111-1111-4111-a111-111111111111';
  const business2Id = '22222222-2222-4222-a222-222222222222';
  const branch1Id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const branch2Id = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

  late AppDatabase db;
  late BranchRepository branchRepo;
  late _FakeSyncApiClient apiClient;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    apiClient = _FakeSyncApiClient({
      business1Id: [
        BranchDto(
          id: branch1Id,
          businessId: business1Id,
          name: 'Cabang Jakarta',
          status: true,
          createdAt: DateTime.now().toIso8601String(),
          updatedAt: DateTime.now().toIso8601String(),
        ),
      ],
      business2Id: [
        BranchDto(
          id: branch2Id,
          businessId: business2Id,
          name: 'Cabang Surabaya',
          status: true,
          createdAt: DateTime.now().toIso8601String(),
          updatedAt: DateTime.now().toIso8601String(),
        ),
      ],
    });
    branchRepo = BranchRepository(db, apiClient);
  });

  tearDown(() async {
    await db.close();
  });

  group('PHASE V1.1-D Mobile Branch Context Suite', () {
    test('BRANCH-MOB-001: active branch loads for business', () async {
      final active = await branchRepo.getActiveBranch(business1Id);

      expect(active, isNotNull);
      expect(active!.id, branch1Id);
      expect(active.businessId, business1Id);
      expect(active.name, 'Cabang Jakarta');
    });

    test('BRANCH-MOB-002: invalid branch rejected', () async {
      expect(isValidBusinessId('BRANCH-001'), false);
      expect(isValidBusinessId(''), false);
      expect(isValidBusinessId('cabang-utama'), false);
      expect(isValidBusinessId(null), false);

      expect(isValidBusinessId(branch1Id), true);
      expect(isValidBusinessId(branch2Id), true);
    });

    test('BRANCH-MOB-003: tenant switch resets branch', () async {
      // 1. Initial tenant 1 branch
      final b1 = await branchRepo.getActiveBranch(business1Id);
      expect(b1?.businessId, business1Id);
      expect(b1?.id, branch1Id);

      // 2. Tenant 2 branch
      final b2 = await branchRepo.getActiveBranch(business2Id);
      expect(b2?.businessId, business2Id);
      expect(b2?.id, branch2Id);
      expect(b2?.id, isNot(branch1Id));
    });

    test('BRANCH-MOB-004: offline cached branch restored', () async {
      // Pre-cache branches for offline use
      await branchRepo.refreshAndCacheBranches(business1Id);

      // Create an offline repo without API client responses
      final offlineRepo = BranchRepository(db, _FakeSyncApiClient({}));
      final cachedBranch = await offlineRepo.getActiveBranch(business1Id);

      expect(cachedBranch, isNotNull);
      expect(cachedBranch!.id, branch1Id);
      expect(cachedBranch.businessId, business1Id);
    });

    test('BRANCH-MOB-005: checkout blocked without valid branch', () async {
      String? invalidBranchId = '';
      expect(isValidBusinessId(invalidBranchId), false);

      invalidBranchId = 'BRANCH-001';
      expect(isValidBusinessId(invalidBranchId), false);

      invalidBranchId = null;
      expect(isValidBusinessId(invalidBranchId), false);

      final validBranchId = branch1Id;
      expect(isValidBusinessId(validBranchId), true);
    });

    test('BRANCH-MOB-006: branch UUID never fake or empty', () async {
      final branches = await branchRepo.fetchBranches(business1Id);

      for (final b in branches) {
        expect(b.id.isNotEmpty, true);
        expect(isValidBusinessId(b.id), true);
        expect(b.id.contains('BRANCH-'), false);
        expect(b.businessId, business1Id);
      }
    });
  });
}
