import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/receivables/data/receivable_repository.dart';
import 'package:biz_erp_mobile/receivables/domain/receivable.dart';

class _MockSyncApi implements SyncApiClient {
  List<ReceivableDto> mockReceivables = [];
  Map<String, ReceivableDto> mockReceivableById = {};
  List<CustomerPaymentDto> mockPayments = [];
  PaymentCollectionResultDto mockCollectionResult = const PaymentCollectionResultDto(
    ok: true,
    paymentId: 'pay-001-uuid',
    journalId: 'jour-001-uuid',
    receivableId: 'rec-001-uuid',
    newStatus: 'PARTIAL',
  );

  String? lastIdempotencyKey;
  int? lastCollectedAmount;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<PullReceivablesResponse> pullReceivables({
    required String businessId,
    String? branchId,
    String? customerId,
    String? status,
    String? dateFrom,
    String? dateTo,
    int limit = 50,
    int offset = 0,
  }) async {
    var items = mockReceivables.where((r) => r.businessId == businessId).toList();
    if (branchId != null && branchId.isNotEmpty) {
      items = items.where((r) => r.branchId == branchId).toList();
    }
    if (customerId != null && customerId.isNotEmpty) {
      items = items.where((r) => r.customerId == customerId).toList();
    }
    if (status != null && status.isNotEmpty) {
      items = items.where((r) => r.status == status).toList();
    }
    if (dateFrom != null && dateFrom.isNotEmpty) {
      items = items.where((r) => r.date.compareTo(dateFrom) >= 0).toList();
    }
    if (dateTo != null && dateTo.isNotEmpty) {
      items = items.where((r) => r.date.compareTo(dateTo) <= 0).toList();
    }
    return PullReceivablesResponse(items, items.length);
  }

  @override
  Future<ReceivableDto?> getReceivable({required String id}) async {
    return mockReceivableById[id];
  }

  @override
  Future<List<CustomerPaymentDto>> pullCustomerPayments({
    required String receivableId,
    int limit = 50,
    int offset = 0,
  }) async {
    return mockPayments.where((p) => p.receivableId == receivableId).toList();
  }

  @override
  Future<PaymentCollectionResultDto> collectReceivablePayment({
    required String receivableId,
    required int amountMinor,
    required String method,
    String? customerId,
    String? reference,
    String? date,
    required String idempotencyKey,
  }) async {
    lastIdempotencyKey = idempotencyKey;
    lastCollectedAmount = amountMinor;
    return mockCollectionResult;
  }
}

void main() {
  const bizId = '11111111-1111-1111-1111-111111111111';
  const otherBizId = '22222222-2222-2222-2222-222222222222';
  const branchId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const otherBranchId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

  late AppDatabase db;
  late _MockSyncApi mockApi;
  late ReceivableRepository repo;

  setUp(() async {
    db = AppDatabase(NativeDatabase.memory());
    mockApi = _MockSyncApi();
    repo = ReceivableRepository(mockApi, db);

    // Seed local customers for join resolution
    await db.into(db.customersLocal).insert(
      CustomersLocalCompanion.insert(
        id: 'cust-001',
        businessId: bizId,
        name: 'PT Maju Bersama',
        phone: const Value('08123456789'),
      ),
    );

    await db.into(db.customersLocal).insert(
      CustomersLocalCompanion.insert(
        id: 'cust-002',
        businessId: bizId,
        name: 'CV Berkah Abadi',
      ),
    );

    // Seed mock backend receivables
    final rec1 = ReceivableDto(
      id: 'rec-001-uuid',
      businessId: bizId,
      saleId: 'sale-001',
      customerId: 'cust-001',
      branchId: branchId,
      amountMinor: 5000000,
      paidMinor: 2000000,
      outstandingMinor: 3000000,
      date: '2026-09-01',
      reference: 'INV/2026/09/001',
      description: 'Penjualan tempo 30 hari',
      status: 'PARTIAL',
      serverVersion: 2,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
    );

    final rec2 = ReceivableDto(
      id: 'rec-002-uuid',
      businessId: bizId,
      saleId: 'sale-002',
      customerId: 'cust-002',
      branchId: branchId,
      amountMinor: 1500000,
      paidMinor: 0,
      outstandingMinor: 1500000,
      date: '2026-09-03',
      reference: 'INV/2026/09/002',
      description: 'Pesanan kopi bulk',
      status: 'OPEN',
      serverVersion: 1,
      createdAt: '2026-09-03T09:00:00.000Z',
      updatedAt: '2026-09-03T09:00:00.000Z',
    );

    final recOtherBranch = ReceivableDto(
      id: 'rec-other-branch',
      businessId: bizId,
      saleId: 'sale-003',
      customerId: 'cust-001',
      branchId: otherBranchId,
      amountMinor: 800000,
      paidMinor: 800000,
      outstandingMinor: 0,
      date: '2026-09-04',
      reference: 'INV/2026/09/003',
      description: 'Cabang lain',
      status: 'PAID',
      serverVersion: 3,
      createdAt: '2026-09-04T10:00:00.000Z',
      updatedAt: '2026-09-04T11:00:00.000Z',
    );

    final recOtherBiz = ReceivableDto(
      id: 'rec-other-biz',
      businessId: otherBizId,
      saleId: 'sale-004',
      customerId: 'cust-999',
      branchId: branchId,
      amountMinor: 9999999,
      paidMinor: 0,
      outstandingMinor: 9999999,
      date: '2026-09-01',
      reference: 'INV/OTHER/001',
      description: 'Tenant lain',
      status: 'OPEN',
      serverVersion: 1,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    );

    mockApi.mockReceivables = [rec1, rec2, recOtherBranch, recOtherBiz];
    mockApi.mockReceivableById = {
      'rec-001-uuid': rec1,
      'rec-002-uuid': rec2,
      'rec-other-branch': recOtherBranch,
      'rec-other-biz': recOtherBiz,
    };

    mockApi.mockPayments = [
      const CustomerPaymentDto(
        id: 'pay-001',
        businessId: bizId,
        receivableId: 'rec-001-uuid',
        customerId: 'cust-001',
        branchId: branchId,
        amountMinor: 2000000,
        method: 'bank_transfer',
        reference: 'TRF-BCA-9876',
        idempotencyKey: 'idem-pay-001',
        createdAt: '2026-09-02T10:00:00.000Z',
      ),
    ];
  });

  tearDown(() async {
    await db.close();
  });

  group('ReceivableRepository Unit Tests', () {
    test('MOB-AR-001: listReceivables returns mapped receivables with resolved customer names', () async {
      final list = await repo.listReceivables(
        businessId: bizId,
        branchId: branchId,
      );

      expect(list.length, 2);

      final first = list.firstWhere((r) => r.id == 'rec-001-uuid');
      expect(first.reference, 'INV/2026/09/001');
      expect(first.customerName, 'PT Maju Bersama');
      expect(first.amountMinor, 5000000);
      expect(first.paidMinor, 2000000);
      expect(first.outstandingMinor, 3000000);
      expect(first.status, 'PARTIAL');
      expect(first.isPartial, isTrue);
      expect(first.isOpen, isFalse);

      final second = list.firstWhere((r) => r.id == 'rec-002-uuid');
      expect(second.customerName, 'CV Berkah Abadi');
      expect(second.isOpen, isTrue);
    });

    test('MOB-AR-002: tenant and branch isolation enforces zero cross-talk', () async {
      // Query for branchId
      final branchList = await repo.listReceivables(
        businessId: bizId,
        branchId: branchId,
      );
      expect(branchList.any((r) => r.id == 'rec-other-biz'), isFalse);
      expect(branchList.any((r) => r.id == 'rec-other-branch'), isFalse);

      // Query for otherBizId
      final otherBizList = await repo.listReceivables(
        businessId: otherBizId,
      );
      expect(otherBizList.length, 1);
      expect(otherBizList.first.id, 'rec-other-biz');
    });

    test('MOB-AR-003: status and date filtering works correctly', () async {
      final openOnly = await repo.listReceivables(
        businessId: bizId,
        status: 'OPEN',
      );
      expect(openOnly.length, 1);
      expect(openOnly.first.id, 'rec-002-uuid');

      final dateFiltered = await repo.listReceivables(
        businessId: bizId,
        dateFrom: '2026-09-02',
        dateTo: '2026-09-04',
      );
      expect(dateFiltered.length, 2); // rec-002 (09-03) and rec-other-branch (09-04)
    });

    test('MOB-AR-004: search query filters by customer name and invoice reference', () async {
      final searchByCustomer = await repo.listReceivables(
        businessId: bizId,
        searchQuery: 'Berkah',
      );
      expect(searchByCustomer.length, 1);
      expect(searchByCustomer.first.id, 'rec-002-uuid');

      final searchByRef = await repo.listReceivables(
        businessId: bizId,
        searchQuery: '09/001',
      );
      expect(searchByRef.length, 1);
      expect(searchByRef.first.id, 'rec-001-uuid');
    });

    test('MOB-AR-005: getReceivableById resolves single receivable and customer name', () async {
      final rec = await repo.getReceivableById('rec-001-uuid', businessId: bizId);
      expect(rec, isNotNull);
      expect(rec!.reference, 'INV/2026/09/001');
      expect(rec.customerName, 'PT Maju Bersama');

      final nonExistent = await repo.getReceivableById('non-existent-id', businessId: bizId);
      expect(nonExistent, isNull);
    });

    test('MOB-AR-006: getPaymentHistory returns list of CustomerPayments', () async {
      final payments = await repo.getPaymentHistory('rec-001-uuid');
      expect(payments.length, 1);
      expect(payments.first.amountMinor, 2000000);
      expect(payments.first.method, 'bank_transfer');
      expect(payments.first.reference, 'TRF-BCA-9876');
    });

    test('MOB-AR-007: collectPayment generates idempotencyKey and returns PaymentCollectionResult', () async {
      final result = await repo.collectPayment(
        receivableId: 'rec-001-uuid',
        amountMinor: 1000000,
        method: 'cash',
        customerId: 'cust-001',
        reference: 'KAS-01',
        idempotencyKey: 'test-idem-key-123',
      );

      expect(result.paymentId, 'pay-001-uuid');
      expect(result.newStatus, 'PARTIAL');
      expect(mockApi.lastIdempotencyKey, 'test-idem-key-123');
      expect(mockApi.lastCollectedAmount, 1000000);
    });

    test('MOB-AR-008: collectPayment throws Exception when backend returns error without mutating local db', () async {
      mockApi.mockCollectionResult = const PaymentCollectionResultDto(
        ok: false,
        error: 'Nominal pembayaran melebihi sisa tagihan',
      );

      expect(
        () => repo.collectPayment(
          receivableId: 'rec-001-uuid',
          amountMinor: 10000000,
          method: 'cash',
        ),
        throwsA(isA<Exception>()),
      );
    });

    test('MOB-AR-009: computeSummary aggregates totals accurately', () {
      final items = [
        const Receivable(
          id: '1',
          businessId: bizId,
          saleId: 's1',
          customerId: 'c1',
          amountMinor: 1000000,
          paidMinor: 400000,
          outstandingMinor: 600000,
          date: '2026-09-01',
          description: '',
          status: 'PARTIAL',
          serverVersion: 1,
          createdAt: '',
          updatedAt: '',
        ),
        const Receivable(
          id: '2',
          businessId: bizId,
          saleId: 's2',
          customerId: 'c2',
          amountMinor: 2000000,
          paidMinor: 2000000,
          outstandingMinor: 0,
          date: '2026-09-01',
          description: '',
          status: 'PAID',
          serverVersion: 1,
          createdAt: '',
          updatedAt: '',
        ),
      ];

      final summary = repo.computeSummary(items);
      expect(summary['totalCount'], 2);
      expect(summary['totalAmountMinor'], 3000000);
      expect(summary['totalPaidMinor'], 2400000);
      expect(summary['totalOutstandingMinor'], 600000);
      expect(summary['openCount'], 1);
      expect(summary['paidCount'], 1);
    });
  });
}
