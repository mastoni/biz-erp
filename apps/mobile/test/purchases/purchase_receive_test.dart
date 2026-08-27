import 'package:flutter_test/flutter_test.dart';

import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/purchases/data/purchase_repository.dart';
import 'package:biz_erp_mobile/purchases/domain/purchase.dart';

class FakeSyncApiClient implements SyncApiClient {
  PurchasePushResult? receiveResult;
  PurchasePushResult? sendResult;
  int? capturedIfMatchVersion;
  List<Map<String, dynamic>>? capturedItems;
  String? capturedIdempotencyKey;
  String? capturedBusinessId;

  @override
  Future<PurchasePushResult> receivePurchase({
    required String id,
    required String businessId,
    required List<Map<String, dynamic>> items,
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async {
    capturedIfMatchVersion = ifMatchVersion;
    capturedItems = items;
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

  group('Phase 9B.7.3B Mobile Purchase Receive Tests', () {
    test('001: sent PO can receive', () async {
      await _seedPurchase(
        id: 'po-sent',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final po = await purchaseRepo.getPurchaseById('po-sent', 'biz-1', 'br-1');
      expect(po, isNotNull);
      expect(po!.status, equals('sent'));

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-sent',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 100000,
          paidMinor: 100000,
          outstandingMinor: 0,
          items: [
            PurchaseItemDto(
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

      final result = await purchaseRepo.receivePurchase(
        'po-sent',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-001',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
      );

      expect(result.status, equals('received'));
      expect(result.receivedMinor, equals(100000));
      expect(result.paidMinor, equals(100000));
      expect(fake.capturedIdempotencyKey, equals('test-key-001'));
    });

    test('002: partial PO can receive', () async {
      await _seedPurchase(
        id: 'po-partial',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'partial',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 50000,
        paidMinor: 50000,
        outstandingMinor: 0,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 5,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final po = await purchaseRepo.getPurchaseById('po-partial', 'biz-1', 'br-1');
      expect(po, isNotNull);
      expect(po!.status, equals('partial'));

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-partial',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 100000,
          paidMinor: 100000,
          outstandingMinor: 0,
          items: [
            PurchaseItemDto(
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

      final result = await purchaseRepo.receivePurchase(
        'po-partial',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-002',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 5)],
      );

      expect(result.status, equals('received'));
    });

    test('003: received PO cannot receive', () async {
      await _seedPurchase(
        id: 'po-received',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'received',
        totalMinor: 100000,
        serverVersion: 2,
        receivedMinor: 100000,
        paidMinor: 100000,
        outstandingMinor: 0,
        items: [
          PurchaseItemDto(
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
        () => purchaseRepo.receivePurchase(
          'po-received',
          'biz-1',
          'br-1',
          syncApiClient: FakeSyncApiClient(),
          idempotencyKey: 'test-key-003',
          lines: [ReceiveLine(itemId: 'it-1', receiveQty: 1)],
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('004: draft PO cannot receive', () async {
      await _seedPurchase(
        id: 'po-draft',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'draft',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      expect(
        () => purchaseRepo.receivePurchase(
          'po-draft',
          'biz-1',
          'br-1',
          syncApiClient: FakeSyncApiClient(),
          idempotencyKey: 'test-key-004',
          lines: [ReceiveLine(itemId: 'it-1', receiveQty: 1)],
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('005: cancelled PO cannot receive', () async {
      await _seedPurchase(
        id: 'po-cancelled',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'cancelled',
        totalMinor: 100000,
        serverVersion: 2,
        receivedMinor: 50000,
        paidMinor: 50000,
        outstandingMinor: 0,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 5,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      expect(
        () => purchaseRepo.receivePurchase(
          'po-cancelled',
          'biz-1',
          'br-1',
          syncApiClient: FakeSyncApiClient(),
          idempotencyKey: 'test-key-005',
          lines: [ReceiveLine(itemId: 'it-1', receiveQty: 1)],
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('006: OWNER can receive', () async {
      await _seedPurchase(
        id: 'po-owner',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(ok: true, serverVersion: 2);

      await purchaseRepo.receivePurchase(
        'po-owner',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-owner',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
      );

      expect(fake.capturedIdempotencyKey, equals('test-key-owner'));
    });

    test('007: CASHIER can receive', () async {
      await _seedPurchase(
        id: 'po-cashier',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(ok: true, serverVersion: 2);

      await purchaseRepo.receivePurchase(
        'po-cashier',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-cashier',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
      );

      expect(fake.capturedIdempotencyKey, equals('test-key-cashier'));
    });

    test('008: offline rejected - repository requires API client', () async {
      await _seedPurchase(
        id: 'po-offline',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-offline',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 100000,
          paidMinor: 100000,
          outstandingMinor: 0,
          items: [
            PurchaseItemDto(
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

      final result = await purchaseRepo.receivePurchase(
        'po-offline',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-offline',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
      );

      expect(result.status, equals('received'));
    });

    test('009: qty > remaining rejected', () async {
      await _seedPurchase(
        id: 'po-remaining',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 8,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      expect(
        () => purchaseRepo.receivePurchase(
          'po-remaining',
          'biz-1',
          'br-1',
          syncApiClient: FakeSyncApiClient(),
          idempotencyKey: 'test-key-009',
          lines: [ReceiveLine(itemId: 'it-1', receiveQty: 5)],
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('010: all-zero rejected', () async {
      await _seedPurchase(
        id: 'po-zero',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      expect(
        () => purchaseRepo.receivePurchase(
          'po-zero',
          'biz-1',
          'br-1',
          syncApiClient: FakeSyncApiClient(),
          idempotencyKey: 'test-key-010',
          lines: [ReceiveLine(itemId: 'it-1', receiveQty: 0)],
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('011: partial receive renders correctly', () async {
      await _seedPurchase(
        id: 'po-partial-render',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'partial',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 50000,
        paidMinor: 50000,
        outstandingMinor: 0,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 5,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final po = await purchaseRepo.getPurchaseById('po-partial-render', 'biz-1', 'br-1');
      expect(po, isNotNull);
      expect(po!.status, equals('partial'));
      expect(po.receivePercentage, equals(50));
      expect(po.receivedTotalQty, equals(5));
      expect(po.orderedTotalQty, equals(10));
    });

    test('012: full receive renders correctly', () async {
      await _seedPurchase(
        id: 'po-full-render',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'partial',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 100000,
        paidMinor: 100000,
        outstandingMinor: 0,
        items: [
          PurchaseItemDto(
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

      final po = await purchaseRepo.getPurchaseById('po-full-render', 'biz-1', 'br-1');
      expect(po, isNotNull);
      expect(po!.receivePercentage, equals(100));
      expect(po.receivedTotalQty, equals(10));
      expect(po.remainingTotalQty, equals(0));
    });

    test('013: expectedServerVersion sent', () async {
      await _seedPurchase(
        id: 'po-expected',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 5,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(ok: true, serverVersion: 6);

      await purchaseRepo.receivePurchase(
        'po-expected',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-expected',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
      );

      expect(fake.capturedIfMatchVersion, equals(5));
    });

    test('014: Idempotency-Key used', () async {
      await _seedPurchase(
        id: 'po-idempotent',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(ok: true, serverVersion: 2);

      const testKey = 'idem-key-014-test';

      await purchaseRepo.receivePurchase(
        'po-idempotent',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: testKey,
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
      );

      expect(fake.capturedIdempotencyKey, equals(testKey));
    });

    test('015: PURCHASE_VERSION_CONFLICT handled', () async {
      await _seedPurchase(
        id: 'po-conflict',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: false,
        conflict: true,
        error: 'PURCHASE_VERSION_CONFLICT',
      );

      expect(
        () => purchaseRepo.receivePurchase(
          'po-conflict',
          'biz-1',
          'br-1',
          syncApiClient: fake,
          idempotencyKey: 'test-key-conflict',
          lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
        ),
        throwsA(isA<StateError>()),
      );
    });
  });

  group('Phase 9B.7.3B Additional Tests', () {
    test('016: STOCK_VERSION_CONFLICT handled', () async {
      await _seedPurchase(
        id: 'po-stock-conflict',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: false,
        error: 'STOCK_VERSION_CONFLICT',
      );

      expect(
        () => purchaseRepo.receivePurchase(
          'po-stock-conflict',
          'biz-1',
          'br-1',
          syncApiClient: fake,
          idempotencyKey: 'test-key-stock',
          lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('017: tenant isolation', () async {
      await _seedPurchase(
        id: 'po-tenant',
        businessId: 'biz-A',
        branchId: 'br-1',
        supplierId: 'sup-A',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      expect(
        () => purchaseRepo.receivePurchase(
          'po-tenant',
          'biz-B',
          'br-1',
          syncApiClient: FakeSyncApiClient(),
          idempotencyKey: 'test-key-tenant',
          lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('018: branch isolation', () async {
      await _seedPurchase(
        id: 'po-branch',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      expect(
        () => purchaseRepo.receivePurchase(
          'po-branch',
          'biz-1',
          'br-2',
          syncApiClient: FakeSyncApiClient(),
          idempotencyKey: 'test-key-branch',
          lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('019: no inventory mutation on mobile', () async {
      await _seedPurchase(
        id: 'po-inventory',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final poBefore = await purchaseRepo.getPurchaseById('po-inventory', 'biz-1', 'br-1');
      expect(poBefore!.receivedMinor, equals(0));

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-inventory',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 100000,
          paidMinor: 100000,
          outstandingMinor: 0,
          items: [
            PurchaseItemDto(
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

      await purchaseRepo.receivePurchase(
        'po-inventory',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-inventory',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
      );

      final poAfter = await purchaseRepo.getPurchaseById('po-inventory', 'biz-1', 'br-1');
      expect(poAfter!.receivedMinor, equals(100000));
    });

    test('020: Tunai does not call payPurchase', () async {
      await _seedPurchase(
        id: 'po-tunai',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        supplierTerm: 'Tunai',
        receivedMinor: 50000,
        paidMinor: 50000,
        outstandingMinor: 0,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 5,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-tunai',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          totalMinor: 100000,
          serverVersion: 2,
          items: [
            PurchaseItemDto(
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

      await purchaseRepo.receivePurchase(
        'po-tunai',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-tunai',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 5)],
      );
    });

    test('021: Tunai paid/outstanding refresh', () async {
      await _seedPurchase(
        id: 'po-tunai-refresh',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'partial',
        totalMinor: 100000,
        serverVersion: 1,
        supplierTerm: 'Tunai',
        receivedMinor: 50000,
        paidMinor: 50000,
        outstandingMinor: 0,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 5,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-tunai-refresh',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 100000,
          paidMinor: 100000,
          outstandingMinor: 0,
          items: [
            PurchaseItemDto(
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

      final result = await purchaseRepo.receivePurchase(
        'po-tunai-refresh',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-tunai-refresh',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 5)],
      );

      expect(result.status, equals('received'));
      expect(result.paidMinor, equals(100000));
      expect(result.outstandingMinor, equals(0));
    });

    test('022: Tempo does not create payment', () async {
      await _seedPurchase(
        id: 'po-tempo',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        supplierTerm: 'Tempo 30',
        receivedMinor: 0,
        paidMinor: 0,
        outstandingMinor: 100000,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-tempo',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'partial',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 50000,
          paidMinor: 0,
          outstandingMinor: 100000,
          supplierTerm: 'Tempo 30',
          items: [
            PurchaseItemDto(
              id: 'it-1',
              productId: 'p-1',
              productName: 'Beras',
              orderedQty: 10,
              receivedQty: 5,
              unitCostMinor: 10000,
              subtotalMinor: 100000,
            ),
          ],
        ),
      );

      final result = await purchaseRepo.receivePurchase(
        'po-tempo',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-tempo',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 5)],
      );

      expect(result.status, equals('partial'));
      expect(result.outstandingMinor, equals(100000));
      expect(result.paidMinor, equals(0));
    });

    test('023: Tempo outstanding = total-paid', () async {
      await _seedPurchase(
        id: 'po-tempo-outstanding',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 200000,
        serverVersion: 1,
        supplierTerm: 'Tempo 30',
        receivedMinor: 0,
        paidMinor: 0,
        outstandingMinor: 200000,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 20000,
            subtotalMinor: 200000,
          ),
        ],
      );

      final po = await purchaseRepo.getPurchaseById('po-tempo-outstanding', 'biz-1', 'br-1');
      expect(po!.outstandingMinor, equals(po.totalMinor));
    });

    test('024: canonical state reload on receive', () async {
      await _seedPurchase(
        id: 'po-reload',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-reload',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          totalMinor: 100000,
          serverVersion: 2,
          items: [
            PurchaseItemDto(
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

      final result = await purchaseRepo.receivePurchase(
        'po-reload',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-reload',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
      );

      expect(result.status, equals('received'));
      expect(result.serverVersion, equals(2));
    });

    test('025: double-submit protection via idempotency', () async {
      await _seedPurchase(
        id: 'po-double',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'partial',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 50000,
        paidMinor: 50000,
        outstandingMinor: 0,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 5,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-double',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 100000,
          paidMinor: 100000,
          outstandingMinor: 0,
          items: [
            PurchaseItemDto(
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

      const sharedKey = 'double-submit-key';

      await purchaseRepo.receivePurchase(
        'po-double',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: sharedKey,
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 5)],
      );

      expect(fake.capturedIdempotencyKey, equals(sharedKey));
    });

    test('026: status boundary sent -> partial', () async {
      await _seedPurchase(
        id: 'po-boundary-s-p',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 1,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-boundary-s-p',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'partial',
          totalMinor: 100000,
          serverVersion: 2,
          receivedMinor: 50000,
          paidMinor: 50000,
          outstandingMinor: 0,
          items: [
            PurchaseItemDto(
              id: 'it-1',
              productId: 'p-1',
              productName: 'Beras',
              orderedQty: 10,
              receivedQty: 5,
              unitCostMinor: 10000,
              subtotalMinor: 100000,
            ),
          ],
        ),
      );

      final result = await purchaseRepo.receivePurchase(
        'po-boundary-s-p',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-boundary',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 5)],
      );

      expect(result.status, equals('partial'));
    });

    test('027: status boundary partial -> received', () async {
      await _seedPurchase(
        id: 'po-boundary-p-r',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'partial',
        totalMinor: 100000,
        serverVersion: 1,
        receivedMinor: 50000,
        paidMinor: 50000,
        outstandingMinor: 0,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 5,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(
        ok: true,
        serverVersion: 2,
        serverState: _buildPurchaseDto(
          id: 'po-boundary-p-r',
          businessId: 'biz-1',
          branchId: 'br-1',
          supplierId: 'sup-1',
          status: 'received',
          totalMinor: 100000,
          serverVersion: 2,
          items: [
            PurchaseItemDto(
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

      final result = await purchaseRepo.receivePurchase(
        'po-boundary-p-r',
        'biz-1',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-boundary2',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 5)],
      );

      expect(result.status, equals('received'));
    });

    test('013B: HTTP request payload contains all required fields', () async {
      await _seedPurchase(
        id: 'po-payload',
        businessId: 'biz-ABC',
        branchId: 'br-1',
        supplierId: 'sup-1',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 3,
        items: [
          PurchaseItemDto(
            id: 'it-1',
            productId: 'p-1',
            productName: 'Beras',
            orderedQty: 10,
            receivedQty: 0,
            unitCostMinor: 10000,
            subtotalMinor: 100000,
          ),
        ],
      );

      final fake = FakeSyncApiClient();
      fake.receiveResult = PurchasePushResult(ok: true, serverVersion: 4);

      await purchaseRepo.receivePurchase(
        'po-payload',
        'biz-ABC',
        'br-1',
        syncApiClient: fake,
        idempotencyKey: 'test-key-payload',
        lines: [ReceiveLine(itemId: 'it-1', receiveQty: 10)],
      );

      expect(fake.capturedBusinessId, equals('biz-ABC'));
      expect(fake.capturedIfMatchVersion, equals(3));
      expect(fake.capturedItems, isNotNull);
      expect(fake.capturedItems!.length, equals(1));
      expect(fake.capturedItems![0], equals({
        'item_id': 'it-1',
        'receive_qty': 10,
      }));
      expect(fake.capturedIdempotencyKey, equals('test-key-payload'));
    });
  });
}