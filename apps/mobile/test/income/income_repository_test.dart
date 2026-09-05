import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/income/data/income_repository.dart';
import 'package:biz_erp_mobile/income/domain/income.dart';

class MockIncomeSyncApiClient implements SyncApiClient {
  List<IncomeDto> mockIncomes = [];
  IncomeDto? mockGetIncome;
  IncomeDto? lastCreated;
  bool shouldThrow = false;
  String? lastPulledBusinessId;
  String? lastPulledBranchId;
  String? lastPulledStatus;
  String? lastPulledCategory;
  String? lastPulledDateFrom;
  String? lastPulledDateTo;
  String? lastPulledSearch;

  @override
  Future<PullIncomeResponse> pullIncome({
    required String businessId,
    String? branchId,
    String? status,
    String? category,
    String? dateFrom,
    String? dateTo,
    String? search,
    int limit = 50,
    int offset = 0,
  }) async {
    if (shouldThrow) {
      throw Exception('Network error');
    }
    lastPulledBusinessId = businessId;
    lastPulledBranchId = branchId;
    lastPulledStatus = status;
    lastPulledCategory = category;
    lastPulledDateFrom = dateFrom;
    lastPulledDateTo = dateTo;
    lastPulledSearch = search;

    var filtered = List<IncomeDto>.from(mockIncomes);
    if (branchId != null) {
      filtered = filtered.where((i) => i.branchId == branchId).toList();
    }
    if (status != null) {
      filtered = filtered.where((i) => i.status.toLowerCase() == status.toLowerCase()).toList();
    }
    if (category != null) {
      filtered = filtered.where((i) => i.category == category).toList();
    }
    if (search != null && search.isNotEmpty) {
      final q = search.toLowerCase();
      filtered = filtered.where((i) =>
          i.description.toLowerCase().contains(q) ||
          (i.reference != null && i.reference!.toLowerCase().contains(q)) ||
          (i.category != null && i.category!.toLowerCase().contains(q))).toList();
    }

    return PullIncomeResponse(filtered, filtered.length);
  }

  @override
  Future<IncomeDto?> getIncome({required String id}) async {
    if (shouldThrow) throw Exception('Network error');
    return mockGetIncome ?? mockIncomes.firstWhere((i) => i.id == id, orElse: () => throw Exception('Not found'));
  }

  @override
  Future<IncomeDto> createIncome({
    required String businessId,
    String? branchId,
    required String date,
    required int amountMinor,
    required String method,
    String? category,
    String? reference,
    required String description,
  }) async {
    if (shouldThrow) throw Exception('Network error');
    final dto = IncomeDto(
      id: 'inc-new-123',
      businessId: businessId,
      branchId: branchId,
      date: date,
      amountMinor: amountMinor,
      method: method,
      category: category,
      reference: reference,
      description: description,
      status: 'draft',
      serverVersion: 1,
      createdAt: '2026-09-05T10:00:00Z',
      updatedAt: '2026-09-05T10:00:00Z',
    );
    lastCreated = dto;
    return dto;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  group('IncomeRepository Tests (MOB-INCOME-1)', () {
    late MockIncomeSyncApiClient mockApi;
    late IncomeRepository repo;

    const testBizId = 'biz-test-123';
    const testBranchId = 'branch-main-01';

    setUp(() {
      mockApi = MockIncomeSyncApiClient();
      repo = IncomeRepository(mockApi);
    });

    test('MOB-INCOME-001: listIncome correctly maps DTOs and propagates tenant/branch filters', () async {
      mockApi.mockIncomes = [
        const IncomeDto(
          id: 'inc-1',
          businessId: testBizId,
          branchId: testBranchId,
          date: '2026-09-05',
          amountMinor: 500000,
          method: 'cash',
          category: 'Jasa & Servis',
          reference: 'REF-001',
          description: 'Servis printer kasir',
          status: 'posted',
          serverVersion: 1,
          createdAt: '2026-09-05T08:00:00Z',
          updatedAt: '2026-09-05T08:00:00Z',
        ),
        const IncomeDto(
          id: 'inc-2',
          businessId: testBizId,
          branchId: 'branch-other',
          date: '2026-09-05',
          amountMinor: 250000,
          method: 'bank_transfer',
          category: 'Komisi & Fee',
          reference: null,
          description: 'Komisi agen',
          status: 'draft',
          serverVersion: 1,
          createdAt: '2026-09-05T09:00:00Z',
          updatedAt: '2026-09-05T09:00:00Z',
        ),
      ];

      final result = await repo.listIncome(
        businessId: testBizId,
        branchId: testBranchId,
        status: 'posted',
        category: 'Jasa & Servis',
      );

      expect(mockApi.lastPulledBusinessId, equals(testBizId));
      expect(mockApi.lastPulledBranchId, equals(testBranchId));
      expect(mockApi.lastPulledStatus, equals('posted'));
      expect(mockApi.lastPulledCategory, equals('Jasa & Servis'));
      expect(result.length, equals(1));
      expect(result.first.id, equals('inc-1'));
      expect(result.first.amountMinor, equals(500000));
      expect(result.first.formattedMethod, equals('Tunai'));
      expect(result.first.isPosted, isTrue);
    });

    test('MOB-INCOME-002: search filtering matches description, reference, or category', () async {
      mockApi.mockIncomes = [
        const IncomeDto(
          id: 'inc-1',
          businessId: testBizId,
          date: '2026-09-05',
          amountMinor: 100000,
          method: 'cash',
          category: 'Sewa & Titipan',
          reference: 'SEWA-A1',
          description: 'Titip jual kue basah',
          status: 'posted',
          serverVersion: 1,
          createdAt: '',
          updatedAt: '',
        ),
        const IncomeDto(
          id: 'inc-2',
          businessId: testBizId,
          date: '2026-09-05',
          amountMinor: 200000,
          method: 'bank_transfer',
          category: 'Penjualan Non-POS',
          reference: 'INV-NP-02',
          description: 'Penjualan kardus bekas',
          status: 'draft',
          serverVersion: 1,
          createdAt: '',
          updatedAt: '',
        ),
      ];

      final res1 = await repo.listIncome(businessId: testBizId, search: 'kardus');
      expect(res1.length, equals(1));
      expect(res1.first.id, equals('inc-2'));

      final res2 = await repo.listIncome(businessId: testBizId, search: 'SEWA-A1');
      expect(res2.length, equals(1));
      expect(res2.first.id, equals('inc-1'));
    });

    test('MOB-INCOME-003: getIncomeById retrieves single income domain model', () async {
      mockApi.mockGetIncome = const IncomeDto(
        id: 'inc-detail-1',
        businessId: testBizId,
        branchId: testBranchId,
        date: '2026-09-05',
        amountMinor: 750000,
        method: 'debit',
        category: 'Jasa & Servis',
        reference: 'SRV-77',
        description: 'Jasa instalasi jaringan',
        status: 'posted',
        serverVersion: 2,
        createdAt: '2026-09-05T01:00:00Z',
        updatedAt: '2026-09-05T01:00:00Z',
      );

      final detail = await repo.getIncomeById('inc-detail-1');
      expect(detail, isNotNull);
      expect(detail!.id, equals('inc-detail-1'));
      expect(detail.amountMinor, equals(750000));
      expect(detail.formattedMethod, equals('Kartu Debit'));
      expect(detail.serverVersion, equals(2));
    });

    test('MOB-INCOME-004: createIncomeOnline validates amount and description before submission', () async {
      expect(
        () => repo.createIncomeOnline(
          businessId: testBizId,
          date: '2026-09-05',
          amountMinor: 0,
          method: 'cash',
          description: 'Valid description',
        ),
        throwsArgumentError,
      );

      expect(
        () => repo.createIncomeOnline(
          businessId: testBizId,
          date: '2026-09-05',
          amountMinor: -5000,
          method: 'cash',
          description: 'Valid description',
        ),
        throwsArgumentError,
      );

      expect(
        () => repo.createIncomeOnline(
          businessId: testBizId,
          date: '2026-09-05',
          amountMinor: 50000,
          method: 'cash',
          description: '   ',
        ),
        throwsArgumentError,
      );
    });

    test('MOB-INCOME-005: createIncomeOnline calls API client and returns created Income', () async {
      final created = await repo.createIncomeOnline(
        businessId: testBizId,
        branchId: testBranchId,
        date: '2026-09-05',
        amountMinor: 350000,
        method: 'bank_transfer',
        category: 'Komisi & Fee',
        reference: 'REF-FEE-9',
        description: 'Fee transaksi kemitraan',
      );

      expect(mockApi.lastCreated, isNotNull);
      expect(mockApi.lastCreated!.amountMinor, equals(350000));
      expect(mockApi.lastCreated!.method, equals('bank_transfer'));
      expect(mockApi.lastCreated!.category, equals('Komisi & Fee'));
      expect(mockApi.lastCreated!.reference, equals('REF-FEE-9'));
      expect(created.id, equals('inc-new-123'));
      expect(created.isDraft, isTrue);
    });

    test('MOB-INCOME-006: computeSummary calculates totals, counts, and draft/posted distributions correctly', () {
      final items = [
        const Income(
          id: '1',
          businessId: testBizId,
          date: '2026-09-05',
          amountMinor: 100000,
          method: 'cash',
          description: 'Item 1',
          status: 'draft',
          serverVersion: 1,
          createdAt: '',
          updatedAt: '',
        ),
        const Income(
          id: '2',
          businessId: testBizId,
          date: '2026-09-05',
          amountMinor: 300000,
          method: 'bank_transfer',
          description: 'Item 2',
          status: 'posted',
          serverVersion: 1,
          createdAt: '',
          updatedAt: '',
        ),
        const Income(
          id: '3',
          businessId: testBizId,
          date: '2026-09-05',
          amountMinor: 150000,
          method: 'cash',
          description: 'Item 3',
          status: 'posted',
          serverVersion: 1,
          createdAt: '',
          updatedAt: '',
        ),
      ];

      final summary = repo.computeSummary(items);
      expect(summary.totalMinor, equals(550000));
      expect(summary.totalCount, equals(3));
      expect(summary.draftCount, equals(1));
      expect(summary.draftMinor, equals(100000));
      expect(summary.postedCount, equals(2));
      expect(summary.postedMinor, equals(450000));
    });

    test('MOB-INCOME-007: network failure throws clean exception without mutating state', () async {
      mockApi.shouldThrow = true;

      expect(
        () => repo.listIncome(businessId: testBizId),
        throwsA(isA<Exception>()),
      );

      expect(
        () => repo.createIncomeOnline(
          businessId: testBizId,
          date: '2026-09-05',
          amountMinor: 100000,
          method: 'cash',
          description: 'Offline fail',
        ),
        throwsA(isA<Exception>()),
      );
    });
  });
}
