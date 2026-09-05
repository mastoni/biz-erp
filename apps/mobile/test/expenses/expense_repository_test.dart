import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/expenses/data/expense_repository.dart';
import 'package:biz_erp_mobile/expenses/domain/expense.dart';

class _MockSyncApi implements SyncApiClient {
  List<ExpenseDto> mockExpenses = [];
  Map<String, ExpenseDto> mockExpenseById = {};
  bool throwOnCreate = false;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<PullExpensesResponse> pullExpenses({
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
    var items = mockExpenses.where((e) => e.businessId == businessId).toList();
    if (branchId != null && branchId.isNotEmpty) {
      items = items.where((e) => e.branchId == branchId).toList();
    }
    if (status != null && status.isNotEmpty) {
      items = items.where((e) => e.status == status).toList();
    }
    if (category != null && category.isNotEmpty) {
      items = items.where((e) => e.category == category).toList();
    }
    if (dateFrom != null && dateFrom.isNotEmpty) {
      items = items.where((e) => e.date.compareTo(dateFrom) >= 0).toList();
    }
    if (dateTo != null && dateTo.isNotEmpty) {
      items = items.where((e) => e.date.compareTo(dateTo) <= 0).toList();
    }
    if (search != null && search.isNotEmpty) {
      final q = search.toLowerCase();
      items = items.where((e) =>
          (e.reference ?? '').toLowerCase().contains(q) ||
          e.description.toLowerCase().contains(q) ||
          (e.category ?? '').toLowerCase().contains(q)).toList();
    }
    return PullExpensesResponse(items, items.length);
  }

  @override
  Future<ExpenseDto?> getExpense({required String id}) async {
    return mockExpenseById[id];
  }

  @override
  Future<ExpenseDto> createExpense({
    required String businessId,
    String? branchId,
    required String date,
    required int amountMinor,
    required String method,
    String? category,
    String? reference,
    required String description,
  }) async {
    if (throwOnCreate) {
      throw Exception('Server error: 500 Internal Server Error');
    }
    final created = ExpenseDto(
      id: 'exp-new-001',
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
      createdAt: '2026-09-05T10:00:00.000Z',
      updatedAt: '2026-09-05T10:00:00.000Z',
    );
    mockExpenses.add(created);
    mockExpenseById[created.id] = created;
    return created;
  }
}

void main() {
  const bizIdA = '11111111-1111-1111-1111-111111111111';
  const bizIdB = '22222222-2222-2222-2222-222222222222';
  const branchIdA = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const branchIdB = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

  late _MockSyncApi mockApi;
  late ExpenseRepository repo;

  setUp(() {
    mockApi = _MockSyncApi();
    repo = ExpenseRepository(mockApi);

    final exp1 = ExpenseDto(
      id: 'exp-001',
      businessId: bizIdA,
      branchId: branchIdA,
      date: '2026-09-01',
      amountMinor: 150000,
      method: 'cash',
      category: 'Operasional',
      reference: 'EXP/2026/09/001',
      description: 'Listrik & Air',
      status: 'posted',
      serverVersion: 2,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:30:00.000Z',
    );

    final exp2 = ExpenseDto(
      id: 'exp-002',
      businessId: bizIdA,
      branchId: branchIdB,
      date: '2026-09-02',
      amountMinor: 50000,
      method: 'cash',
      category: 'Plastik & Kemasan',
      reference: 'EXP/2026/09/002',
      description: 'Plastik HD 10 pack',
      status: 'draft',
      serverVersion: 1,
      createdAt: '2026-09-02T08:00:00.000Z',
      updatedAt: '2026-09-02T08:00:00.000Z',
    );

    final exp3 = ExpenseDto(
      id: 'exp-003',
      businessId: bizIdB,
      branchId: branchIdA,
      date: '2026-09-03',
      amountMinor: 300000,
      method: 'bank_transfer',
      category: 'Gaji Karyawan',
      reference: 'EXP/2026/09/003',
      description: 'Uang makan staff',
      status: 'posted',
      serverVersion: 1,
      createdAt: '2026-09-03T08:00:00.000Z',
      updatedAt: '2026-09-03T08:00:00.000Z',
    );

    mockApi.mockExpenses = [exp1, exp2, exp3];
    mockApi.mockExpenseById = {
      'exp-001': exp1,
      'exp-002': exp2,
      'exp-003': exp3,
    };
  });

  group('ExpenseRepository Unit Tests', () {
    test('MOB-EXP-001: listExpenses returns mapped domain models', () async {
      final list = await repo.listExpenses(businessId: bizIdA);
      expect(list.length, 2);
      expect(list[0].id, 'exp-001');
      expect(list[0].description, 'Listrik & Air');
      expect(list[0].amountMinor, 150000);
      expect(list[0].isPosted, isTrue);
      expect(list[1].id, 'exp-002');
      expect(list[1].isDraft, isTrue);
    });

    test('MOB-EXP-002: tenant and branch isolation enforces zero data leak', () async {
      final listTenantA = await repo.listExpenses(businessId: bizIdA);
      expect(listTenantA.every((e) => e.businessId == bizIdA), isTrue);

      final listBranchA = await repo.listExpenses(businessId: bizIdA, branchId: branchIdA);
      expect(listBranchA.length, 1);
      expect(listBranchA.first.id, 'exp-001');

      final listTenantB = await repo.listExpenses(businessId: bizIdB);
      expect(listTenantB.length, 1);
      expect(listTenantB.first.id, 'exp-003');
    });

    test('MOB-EXP-003: status, category, date, and search filtering work correctly', () async {
      final draftOnly = await repo.listExpenses(businessId: bizIdA, status: 'draft');
      expect(draftOnly.length, 1);
      expect(draftOnly.first.id, 'exp-002');

      final categoryFilter = await repo.listExpenses(businessId: bizIdA, category: 'Operasional');
      expect(categoryFilter.length, 1);
      expect(categoryFilter.first.category, 'Operasional');

      final dateFilter = await repo.listExpenses(businessId: bizIdA, dateFrom: '2026-09-02', dateTo: '2026-09-02');
      expect(dateFilter.length, 1);
      expect(dateFilter.first.id, 'exp-002');

      final searchFilter = await repo.listExpenses(businessId: bizIdA, search: 'Plastik');
      expect(searchFilter.length, 1);
      expect(searchFilter.first.id, 'exp-002');
    });

    test('MOB-EXP-004: getExpenseById returns mapped expense or null', () async {
      final item = await repo.getExpenseById('exp-001');
      expect(item, isNotNull);
      expect(item!.id, 'exp-001');
      expect(item.amountMinor, 150000);

      final missing = await repo.getExpenseById('exp-nonexistent');
      expect(missing, isNull);
    });

    test('MOB-EXP-005: createExpenseOnline validates inputs and creates draft expense', () async {
      final created = await repo.createExpenseOnline(
        businessId: bizIdA,
        branchId: branchIdA,
        date: '2026-09-05',
        amountMinor: 75000,
        method: 'cash',
        category: 'Operasional',
        reference: 'EXP/2026/09/004',
        description: 'Beli galon air & kopi',
      );

      expect(created.id, 'exp-new-001');
      expect(created.amountMinor, 75000);
      expect(created.status, 'draft');
      expect(created.isDraft, isTrue);
      expect(created.description, 'Beli galon air & kopi');

      // Verify added to mock list
      final list = await repo.listExpenses(businessId: bizIdA);
      expect(list.length, 3);
    });

    test('MOB-EXP-006: createExpenseOnline rejects non-positive amount and empty description', () async {
      expect(
        () => repo.createExpenseOnline(
          businessId: bizIdA,
          date: '2026-09-05',
          amountMinor: 0,
          method: 'cash',
          description: 'Valid description',
        ),
        throwsArgumentError,
      );

      expect(
        () => repo.createExpenseOnline(
          businessId: bizIdA,
          date: '2026-09-05',
          amountMinor: 50000,
          method: 'cash',
          description: '   ',
        ),
        throwsArgumentError,
      );
    });

    test('MOB-EXP-007: createExpenseOnline propagates server/network errors', () async {
      mockApi.throwOnCreate = true;
      expect(
        () => repo.createExpenseOnline(
          businessId: bizIdA,
          date: '2026-09-05',
          amountMinor: 50000,
          method: 'cash',
          description: 'Test failure',
        ),
        throwsException,
      );
    });

    test('MOB-EXP-008: computeSummary aggregates totals correctly', () {
      final expenses = [
        const Expense(
          id: '1',
          businessId: bizIdA,
          date: '2026-09-01',
          amountMinor: 100000,
          method: 'cash',
          description: 'd1',
          status: 'posted',
          serverVersion: 1,
          createdAt: '',
          updatedAt: '',
        ),
        const Expense(
          id: '2',
          businessId: bizIdA,
          date: '2026-09-02',
          amountMinor: 50000,
          method: 'cash',
          description: 'd2',
          status: 'draft',
          serverVersion: 1,
          createdAt: '',
          updatedAt: '',
        ),
        const Expense(
          id: '3',
          businessId: bizIdA,
          date: '2026-09-03',
          amountMinor: 25000,
          method: 'cash',
          description: 'd3',
          status: 'reversed',
          serverVersion: 1,
          createdAt: '',
          updatedAt: '',
        ),
      ];

      final summary = repo.computeSummary(expenses);
      expect(summary.totalAmountMinor, 150000); // excludes reversed
      expect(summary.postedAmountMinor, 100000);
      expect(summary.draftAmountMinor, 50000);
      expect(summary.count, 3);
    });
  });
}
