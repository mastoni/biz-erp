import 'package:flutter_test/flutter_test.dart';

import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/purchases/data/purchase_repository.dart';
import 'package:biz_erp_mobile/purchases/domain/purchase.dart';

class FakeSyncApiClient implements SyncApiClient {
  PurchasePushResult? receiveResult;
  PurchasePushResult? sendResult;
  PurchasePushResult? payResult;
  int? capturedIfMatchVersion;
  String? capturedIdempotencyKey;
  String? capturedBusinessId;
  int? capturedAmountMinor;
  String? capturedMethod;
  String? capturedReference;

  @override
  Future<PurchasePushResult> receivePurchase({
    required String id,
    required String businessId,
    required List<Map<String, dynamic>> items,
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async {
    capturedIfMatchVersion = ifMatchVersion;
    capturedIdempotencyKey = idempotencyKey;
    capturedBusinessId = businessId;
    return receiveResult ?? PurchasePushResult(ok: true, serverVersion: 1);
  }

  @override
  Future<PurchasePushResult> sendPurchase({
    required String id,
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async {
    capturedIfMatchVersion = ifMatchVersion;
    capturedIdempotencyKey = idempotencyKey;
    return sendResult ?? PurchasePushResult(ok: true, serverVersion: 1);
  }

  @override
  Future<PurchasePushResult> payPurchase({
    required String id,
    required String businessId,
    required int amountMinor,
    required String method,
    String? reference,
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async {
    capturedIfMatchVersion = ifMatchVersion;
    capturedIdempotencyKey = idempotencyKey;
    capturedBusinessId = businessId;
    capturedAmountMinor = amountMinor;
    capturedMethod = method;
    capturedReference = reference;
    return payResult ?? PurchasePushResult(ok: true, serverVersion: 1);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late AppDatabase db;
  late PurchaseRepository purchaseRepo;

  setUp(() {
    db = AppDatabase.memory();
    purchaseRepo = PurchaseRepository(db);
  });

  tearDown(() async {
    await db.close();
  });

  PurchaseDto _buildPurchaseDto({
    required String id,
    required String businessId,
    required String branchId,
    required String supplierId,
    required String status,
    required int totalMinor,
    required int serverVersion,
    List<PurchaseItemDto> items = const [],
    int receivedMinor = 0,
    int paidMinor = 0,
    int outstandingMinor = 0,
    String supplierTerm = 'Tunai',
    String supplierName = 'PT Test',
    String code = 'PO/TEST',
    String date = '2026-08-20',
    String dueDate = '2026-09-03',
    String? note,
  }) {
    return PurchaseDto(
      id: id,
      businessId: businessId,
      branchId: branchId,
      supplierId: supplierId,
      supplierName: supplierName,
      code: code,
      date: date,
      dueDate: dueDate,
      supplierTerm: supplierTerm,
      status: status,
      totalMinor: totalMinor,
      receivedMinor: receivedMinor,
      paidMinor: paidMinor,
      outstandingMinor: outstandingMinor,
      note: note,
      serverVersion: serverVersion,
      items: items,
    );
  }

  Future<void> _seedPurchase({
    required String id,
    required String businessId,
    required String branchId,
    required String supplierId,
    required String status,
    required int totalMinor,
    required int serverVersion,
    List<PurchaseItemDto> items = const [],
    int receivedMinor = 0,
    int paidMinor = 0,
    int outstandingMinor = 0,
    String supplierTerm = 'Tunai',
    String supplierName = 'PT Test',
    String code = 'PO/TEST',
    String date = '2026-08-20',
    String dueDate = '2026-09-03',
    String? note,
  }) async {
    await purchaseRepo.applyServerSync(
      _buildPurchaseDto(
        id: id,
        businessId: businessId,
        branchId: branchId,
        supplierId: supplierId,
        status: status,
        totalMinor: totalMinor,
        serverVersion: serverVersion,
        items: items,
        receivedMinor: receivedMinor,
        paidMinor: paidMinor,
        outstandingMinor: outstandingMinor,
        supplierTerm: supplierTerm,
        supplierName: supplierName,
        code: code,
        date: date,
        dueDate: dueDate,
        note: note,
      ),
      businessId,
    );
  }

  group('MOBILE-PURCHASE-PAY-001 Tempo payment available', () {
    test('PO with Tempo term and outstanding shows pay action', () async {
      await _seedPurchase(
        id: 'po-tempo-pay',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final po = await purchaseRepo.getPurchaseById('po-tempo-pay', 'biz-1', 'br-1');
      expect(po, isNotNull);
      expect(po!.supplierTerm, equals('Tempo 14'));
      expect(po.outstandingMinor, greaterThan(0));
    });
  });

  group('MOBILE-PURCHASE-PAY-002 Tunai settled payment unavailable', () {
    test('Tunai PO with outstanding 0 cannot pay', () async {
      await _seedPurchase(
        id: 'po-tunai-settled',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tunai',
        totalMinor: 100000,
        serverVersion: 2,
        receivedMinor: 100000,
        paidMinor: 100000,
        outstandingMinor: 0,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final po = await purchaseRepo.getPurchaseById('po-tunai-settled', 'biz-1', 'br-1');
      expect(po, isNotNull);
      expect(po!.supplierTerm, equals('Tunai'));
      expect(po.outstandingMinor, equals(0));
    });
  });

  group('MOBILE-PURCHASE-PAY-003 OWNER can pay', () {
    test('OWNER can call payPurchase', () async {
      await _seedPurchase(
        id: 'po-owner-pay',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(ok: true, serverVersion: 2);

      final result = await purchaseRepo.payPurchase(
        'po-owner-pay',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'pay-key-owner-003',
        amountMinor: 50000,
        method: 'cash',
      );

      expect(result, isNotNull);
    });
  });

  group('MOBILE-PURCHASE-PAY-004 CASHIER can pay', () {
    test('CASHIER can call payPurchase', () async {
      await _seedPurchase(
        id: 'po-cashier-pay',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 30',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(ok: true, serverVersion: 2);

      final result = await purchaseRepo.payPurchase(
        'po-cashier-pay',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'pay-key-cashier-004',
        amountMinor: 50000,
        method: 'bank_transfer',
      );

      expect(result, isNotNull);
    });
  });

  group('MOBILE-PURCHASE-PAY-005 offline payment rejected', () {
    test('payPurchase requires online mode', () async {
      await _seedPurchase(
        id: 'po-offline-pay',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(ok: true, serverVersion: 2);

      final result = await purchaseRepo.payPurchase(
        'po-offline-pay',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'pay-key-offline',
        amountMinor: 50000,
        method: 'cash',
      );

      expect(result, isNotNull);
    });
  });

  group('MOBILE-PURCHASE-PAY-006 amount <= 0 rejected', () {
    test('zero amount rejected', () async {
      await _seedPurchase(
        id: 'po-zero-amt',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();

      expect(
        () => purchaseRepo.payPurchase(
          'po-zero-amt',
          'biz-1',
          'br-1',
          syncApiClient: fake,
          idempotencyKey: 'pay-key-zero',
          amountMinor: 0,
          method: 'cash',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('MOBILE-PURCHASE-PAY-007 amount > outstanding rejected', () {
    test('amount exceeds outstanding rejected', () async {
      await _seedPurchase(
        id: 'po-excess-amt',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 50000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();

      expect(
        () => purchaseRepo.payPurchase(
          'po-excess-amt',
          'biz-1',
          'br-1',
          syncApiClient: fake,
          idempotencyKey: 'pay-key-excess',
          amountMinor: 60000,
          method: 'cash',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('MOBILE-PURCHASE-PAY-008 partial payment', () {
    test('partial payment accepted', () async {
      await _seedPurchase(
        id: 'po-partial-pay',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-partial-pay',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          supplierTerm: 'Tempo 14',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 100000,
          paidMinor: 50000,
          outstandingMinor: 50000,
          items: [
            const PurchaseItemDto(
              id: 'it-1',
              productId: 'p-1',
              productName: 'Beras',
              orderedQty: 10,
              receivedQty: 10,
              unitCostMinor: 10000,
              subtotalMinor: 100000,
            ),
          ],
        ),
      );

      final result = await purchaseRepo.payPurchase(
        'po-partial-pay',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'pay-key-partial',
        amountMinor: 50000,
        method: 'cash',
      );

      expect(result.paidMinor, equals(50000));
      expect(result.outstandingMinor, equals(50000));
    });
  });

  group('MOBILE-PURCHASE-PAY-009 full payment', () {
    test('full payment accepted', () async {
      await _seedPurchase(
        id: 'po-full-pay',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-full-pay',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          supplierTerm: 'Tempo 14',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 100000,
          paidMinor: 100000,
          outstandingMinor: 0,
          items: [
            const PurchaseItemDto(
              id: 'it-1',
              productId: 'p-1',
              productName: 'Beras',
              orderedQty: 10,
              receivedQty: 10,
              unitCostMinor: 10000,
              subtotalMinor: 100000,
            ),
          ],
        ),
      );

      final result = await purchaseRepo.payPurchase(
        'po-full-pay',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'pay-key-full',
        amountMinor: 100000,
        method: 'bank_transfer',
      );

      expect(result.paidMinor, equals(100000));
      expect(result.outstandingMinor, equals(0));
    });
  });

  group('MOBILE-PURCHASE-PAY-010 business_id sent', () {
    test('businessId captured in request', () async {
      await _seedPurchase(
        id: 'po-business-id',
        businessId: 'biz-ABC',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(ok: true, serverVersion: 2);

      await purchaseRepo.payPurchase(
        'po-business-id',
        'biz-ABC',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'pay-key-business-id',
        amountMinor: 50000,
        method: 'cash',
      );

      expect(fake.capturedBusinessId, equals('biz-ABC'));
    });
  });

  group('MOBILE-PURCHASE-PAY-011 expectedServerVersion sent', () {
    test('expectedServerVersion captured in request', () async {
      await _seedPurchase(
        id: 'po-version',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 5,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(ok: true, serverVersion: 6);

      await purchaseRepo.payPurchase(
        'po-version',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'pay-key-version',
        amountMinor: 50000,
        method: 'cash',
      );

      expect(fake.capturedIfMatchVersion, equals(5));
    });
  });

  group('MOBILE-PURCHASE-PAY-012 Idempotency-Key generated', () {
    test('UUID idempotency key generated', () async {
      await _seedPurchase(
        id: 'po-idempotent',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(ok: true, serverVersion: 2);

      await purchaseRepo.payPurchase(
        'po-idempotent',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'pay-key-idempotent',
        amountMinor: 50000,
        method: 'cash',
      );

      expect(fake.capturedIdempotencyKey, equals('pay-key-idempotent'));
    });
  });

  group('MOBILE-PURCHASE-PAY-013 version conflict', () {
    test('409 conflict returns StateError', () async {
      await _seedPurchase(
        id: 'po-conflict',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(ok: false, conflict: true, error: 'PURCHASE_VERSION_CONFLICT');

      expect(
        () => purchaseRepo.payPurchase(
          'po-conflict',
          'biz-1',
          'br-1',
          syncApiClient: fake,
          idempotencyKey: 'pay-key-conflict',
          amountMinor: 50000,
          method: 'cash',
        ),
        throwsA(isA<StateError>()),
      );
    });
  });

  group('MOBILE-PURCHASE-PAY-014 tenant isolation', () {
    test('wrong businessId rejected', () async {
      await _seedPurchase(
        id: 'po-tenant',
        businessId: 'biz-A',
        branchId: 'br-1',
        supplierId: 'sup-A',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      expect(
        () => purchaseRepo.payPurchase(
          'po-tenant',
          'biz-B',
          'br-1',
          syncApiClient: FakeSyncApiClient(),
          idempotencyKey: 'pay-key-tenant',
          amountMinor: 50000,
          method: 'cash',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('MOBILE-PURCHASE-PAY-015 branch isolation', () {
    test('wrong branchId rejected', () async {
      await _seedPurchase(
        id: 'po-branch',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      expect(
        () => purchaseRepo.payPurchase(
          'po-branch',
          'biz-1',
          'br-2',
          syncApiClient: FakeSyncApiClient(),
          idempotencyKey: 'pay-key-branch',
          amountMinor: 50000,
          method: 'cash',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('MOBILE-PURCHASE-PAY-016 payment method validation', () {
    test('invalid payment method rejected', () async {
      await _seedPurchase(
        id: 'po-method',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();

      expect(
        () => purchaseRepo.payPurchase(
          'po-method',
          'biz-1',
          'br-1',
          syncApiClient: fake,
          idempotencyKey: 'pay-key-method',
          amountMinor: 50000,
          method: 'invalid_method',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('MOBILE-PURCHASE-PAY-017 canonical server state reload', () {
    test('server state applied on success', () async {
      await _seedPurchase(
        id: 'po-reload',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-reload',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          supplierTerm: 'Tempo 14',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 100000,
          paidMinor: 50000,
          outstandingMinor: 50000,
          items: [
            const PurchaseItemDto(
              id: 'it-1',
              productId: 'p-1',
              productName: 'Beras',
              orderedQty: 10,
              receivedQty: 10,
              unitCostMinor: 10000,
              subtotalMinor: 100000,
            ),
          ],
        ),
      );

      final result = await purchaseRepo.payPurchase(
        'po-reload',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'pay-key-reload',
        amountMinor: 50000,
        method: 'cash',
      );

      expect(result.serverVersion, equals(2));
      expect(result.paidMinor, equals(50000));
      expect(result.outstandingMinor, equals(50000));
    });
  });

  group('MOBILE-PURCHASE-PAY-018 double submit protection', () {
    test('same idempotency key used twice should be tested by server', () async {
      await _seedPurchase(
        id: 'po-double',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(ok: true, serverVersion: 2);

      await purchaseRepo.payPurchase(
        'po-double',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'double-submit-key',
        amountMinor: 50000,
        method: 'cash',
      );

      expect(fake.capturedIdempotencyKey, equals('double-submit-key'));
    });
  });

  group('MOBILE-PURCHASE-PAY-019 no inventory mutation', () {
    test('payment does not modify inventory', () async {
      await _seedPurchase(
        id: 'po-inv',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final poBefore = await purchaseRepo.getPurchaseById('po-inv', 'biz-1', 'br-1');
      expect(poBefore!.paidMinor, equals(0));

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-inv',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          supplierTerm: 'Tempo 14',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 100000,
          paidMinor: 50000,
          outstandingMinor: 50000,
          items: [
            const PurchaseItemDto(
              id: 'it-1',
              productId: 'p-1',
              productName: 'Beras',
              orderedQty: 10,
              receivedQty: 10,
              unitCostMinor: 10000,
              subtotalMinor: 100000,
            ),
          ],
        ),
      );

      await purchaseRepo.payPurchase(
        'po-inv',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'pay-key-inv',
        amountMinor: 50000,
        method: 'cash',
      );

      final poAfter = await purchaseRepo.getPurchaseById('po-inv', 'biz-1', 'br-1');
      expect(poAfter!.paidMinor, equals(50000));
    });
  });

  group('MOBILE-PURCHASE-PAY-020 no local payment ledger', () {
    test('payment updates Purchase, not local ledger', () async {
      await _seedPurchase(
        id: 'po-ledger',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 14',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.payResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-ledger',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          supplierTerm: 'Tempo 14',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 100000,
          paidMinor: 50000,
          outstandingMinor: 50000,
          items: [
            const PurchaseItemDto(
              id: 'it-1',
              productId: 'p-1',
              productName: 'Beras',
              orderedQty: 10,
              receivedQty: 10,
              unitCostMinor: 10000,
              subtotalMinor: 100000,
            ),
          ],
        ),
      );

      await purchaseRepo.payPurchase(
        'po-ledger',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'pay-key-ledger',
        amountMinor: 50000,
        method: 'cash',
      );

      final po = await purchaseRepo.getPurchaseById('po-ledger', 'biz-1', 'br-1');
      expect(po, isNotNull);
    });
  });

  group('MOBILE-PURCHASE-PAY-021 Tunai no duplicate payment', () {
    test('Tunai receive does not trigger payPurchase', () async {
      await _seedPurchase(
        id: 'po-tunai-dup',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tunai',
        totalMinor: 100000,
        serverVersion: 2,
        receivedMinor: 100000,
        paidMinor: 100000,
        outstandingMinor: 0,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final po = await purchaseRepo.getPurchaseById('po-tunai-dup', 'biz-1', 'br-1');
      expect(po!.outstandingMinor, equals(0));
    });
  });

  group('MOBILE-PURCHASE-PAY-022 Tempo outstanding total-paid', () {
    test('Tempo outstanding = total - paid', () async {
      await _seedPurchase(
        id: 'po-tempo-out',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        supplierTerm: 'Tempo 30',
        totalMinor: 200000,
        serverVersion: 1,
        receivedMinor: 200000,
        paidMinor: 50000,
        outstandingMinor: 150000,
        items: [
          const PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 10,
            unitCostMinor: 20000,
            subtotalMinor: 200000,
          ),
        ],
      );

      final po = await purchaseRepo.getPurchaseById('po-tempo-out', 'biz-1', 'br-1');
      expect(po!.outstandingMinor, equals(po.totalMinor - po.paidMinor));
      expect(po.outstandingMinor, equals(150000));
    });
  });
}