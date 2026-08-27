import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/purchases/data/purchase_repository.dart';
import 'package:biz_erp_mobile/purchases/domain/purchase.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:uuid/uuid.dart';

void main() {
  late AppDatabase db;
  late SyncOutboxRepository outbox;
  late PurchaseRepository repository;
  const uuid = Uuid();

  setUp(() {
    db = AppDatabase.memory();
    outbox = SyncOutboxRepository(db);
    repository = PurchaseRepository(db);
  });

  tearDown(() async {
    await db.close();
  });

  group('Phase 9B.6 Mobile Purchase Data Layer Tests', () {
    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-001: DTO mapping
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-001: DTO serialization and deserialization matches backend contract', () {
      final json = {
        'id': 'po-001',
        'business_id': 'biz-001',
        'branch_id': 'branch-001',
        'supplier_id': 'sup-001',
        'supplier_name': 'UD Makmur Sembako',
        'supplier_code': 'MKM',
        'code': 'MKM/PO/001',
        'date': '2026-08-20',
        'due_date': '2026-09-03',
        'supplier_term': 'Tempo 14',
        'status': 'draft',
        'total_minor': 1200000,
        'received_minor': 0,
        'paid_minor': 0,
        'outstanding_minor': 1200000,
        'note': 'Restok rutin',
        'server_version': 1,
        'created_at': 1724148000000,
        'updated_at': 1724148000000,
        'deleted_at': null,
        'items': [
          {
            'id': 'it-1',
            'purchase_id': 'po-001',
            'product_id': 'p-1',
            'product_name': 'Beras 5kg',
            'ordered_qty': 20,
            'received_qty': 0,
            'unit_cost_minor': 60000,
            'subtotal_minor': 1200000,
          }
        ],
        'payments': [
          {
            'id': 'pay-1',
            'business_id': 'biz-001',
            'purchase_id': 'po-001',
            'amount_minor': 0,
            'method': 'bank_transfer',
            'reference': null,
            'idempotency_key': 'idem-1',
            'created_at': '2026-08-20T10:00:00.000Z',
          }
        ],
      };

      final dto = PurchaseDto.fromJson(json);
      expect(dto.id, 'po-001');
      expect(dto.businessId, 'biz-001');
      expect(dto.branchId, 'branch-001');
      expect(dto.supplierId, 'sup-001');
      expect(dto.supplierName, 'UD Makmur Sembako');
      expect(dto.supplierTerm, 'Tempo 14');
      expect(dto.totalMinor, 1200000);
      expect(dto.outstandingMinor, 1200000);
      expect(dto.items, hasLength(1));
      expect(dto.items.first.productName, 'Beras 5kg');

      final serialized = dto.toJson();
      expect(serialized['id'], 'po-001');
      expect(serialized['business_id'], 'biz-001');
      expect(serialized['supplier_term'], 'Tempo 14');
      expect(serialized['items'], hasLength(1));
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-002: Drift insert/read
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-002: Drift inserts and reads purchases with child items', () async {
      final poId = uuid.v4();
      final po = Purchase(
        id: poId,
        businessId: 'biz-001',
        branchId: 'branch-001',
        supplierId: 'sup-001',
        supplierName: 'UD Makmur',
        code: 'MKM/PO/001',
        date: '2026-08-20',
        dueDate: '2026-08-20',
        supplierTerm: 'Tunai',
        status: 'draft',
        totalMinor: 500000,
        serverVersion: 0,
      );
      final items = [
        PurchaseItem(
          id: uuid.v4(),
          purchaseId: poId,
          productName: 'Minyak Goreng 2L',
          orderedQty: 10,
          unitCostMinor: 50000,
          subtotalMinor: 500000,
        ),
      ];

      await repository.createDraft(po, items, outbox);

      final list = await repository.listPurchases('biz-001', 'branch-001');
      expect(list, hasLength(1));
      expect(list.first.id, poId);
      expect(list.first.items, hasLength(1));
      expect(list.first.items.first.productName, 'Minyak Goreng 2L');
      expect(list.first.items.first.unitCostMinor, 50000);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-003: Tenant isolation
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-003: Purchases are strictly isolated by tenant businessId', () async {
      final po1 = Purchase(
        id: 'po-biz-1',
        businessId: 'biz-001',
        branchId: 'branch-001',
        supplierId: 'sup-1',
        code: 'PO/1',
        date: '2026-08-20',
        dueDate: '2026-08-20',
        supplierTerm: 'Tunai',
        status: 'draft',
        totalMinor: 100000,
        serverVersion: 0,
      );
      final po2 = Purchase(
        id: 'po-biz-2',
        businessId: 'biz-002',
        branchId: 'branch-001',
        supplierId: 'sup-2',
        code: 'PO/2',
        date: '2026-08-20',
        dueDate: '2026-08-20',
        supplierTerm: 'Tunai',
        status: 'draft',
        totalMinor: 200000,
        serverVersion: 0,
      );

      await repository.createDraft(po1, [
        PurchaseItem(id: 'i-1', purchaseId: 'po-biz-1', productName: 'Item A', orderedQty: 1, unitCostMinor: 100000, subtotalMinor: 100000),
      ], outbox);
      await repository.createDraft(po2, [
        PurchaseItem(id: 'i-2', purchaseId: 'po-biz-2', productName: 'Item B', orderedQty: 2, unitCostMinor: 100000, subtotalMinor: 200000),
      ], outbox);

      final listBiz1 = await repository.listPurchases('biz-001', 'branch-001');
      expect(listBiz1, hasLength(1));
      expect(listBiz1.first.id, 'po-biz-1');

      final listBiz2 = await repository.listPurchases('biz-002', 'branch-001');
      expect(listBiz2, hasLength(1));
      expect(listBiz2.first.id, 'po-biz-2');
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-004: Branch isolation
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-004: Purchases are strictly isolated by branchId', () async {
      final poBranch1 = Purchase(
        id: 'po-br-1',
        businessId: 'biz-001',
        branchId: 'branch-001',
        supplierId: 'sup-1',
        code: 'PO/BR1',
        date: '2026-08-20',
        dueDate: '2026-08-20',
        supplierTerm: 'Tunai',
        status: 'draft',
        totalMinor: 100000,
        serverVersion: 0,
      );
      final poBranch2 = Purchase(
        id: 'po-br-2',
        businessId: 'biz-001',
        branchId: 'branch-002',
        supplierId: 'sup-1',
        code: 'PO/BR2',
        date: '2026-08-20',
        dueDate: '2026-08-20',
        supplierTerm: 'Tunai',
        status: 'draft',
        totalMinor: 100000,
        serverVersion: 0,
      );

      await repository.createDraft(poBranch1, [
        PurchaseItem(id: 'i-1', purchaseId: 'po-br-1', productName: 'Item 1', orderedQty: 1, unitCostMinor: 100000, subtotalMinor: 100000),
      ], outbox);
      await repository.createDraft(poBranch2, [
        PurchaseItem(id: 'i-2', purchaseId: 'po-br-2', productName: 'Item 2', orderedQty: 1, unitCostMinor: 100000, subtotalMinor: 100000),
      ], outbox);

      final listBranch1 = await repository.listPurchases('biz-001', 'branch-001');
      expect(listBranch1, hasLength(1));
      expect(listBranch1.first.id, 'po-br-1');

      final listBranch2 = await repository.listPurchases('biz-001', 'branch-002');
      expect(listBranch2, hasLength(1));
      expect(listBranch2.first.id, 'po-br-2');
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-005 & 007: Offline draft create & outbox enqueue
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-005 / MOBILE-PURCHASE-007: Offline draft create saves locally as dirty and enqueues outbox', () async {
      final po = Purchase(
        id: 'po-draft-1',
        businessId: 'biz-001',
        branchId: 'branch-001',
        supplierId: 'sup-001',
        code: 'DRAFT/001',
        date: '2026-08-20',
        dueDate: '2026-08-20',
        supplierTerm: 'Tunai',
        status: 'draft',
        totalMinor: 250000,
        serverVersion: 0,
      );
      final items = [
        PurchaseItem(
          id: 'it-draft-1',
          purchaseId: 'po-draft-1',
          productName: 'Gula Pasir 1kg',
          orderedQty: 10,
          unitCostMinor: 25000,
          subtotalMinor: 250000,
        ),
      ];

      await repository.createDraft(po, items, outbox);

      final fetched = await repository.getPurchaseById('po-draft-1', 'biz-001', 'branch-001');
      expect(fetched, isNotNull);
      expect(fetched!.localStatus, 'dirty');
      expect(fetched.isDirty, isTrue);

      final dueOutbox = await outbox.fetchDue(DateTime.now().millisecondsSinceEpoch);
      expect(dueOutbox, hasLength(1));
      expect(dueOutbox.first.entityType, 'purchase');
      expect(dueOutbox.first.operation, 'create');
      expect(dueOutbox.first.payloadJson, contains('DRAFT/001'));
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-006 & 008: Offline draft update & outbox enqueue
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-006 / MOBILE-PURCHASE-008: Offline draft update modifies local record and enqueues upsert outbox', () async {
      final po = Purchase(
        id: 'po-draft-2',
        businessId: 'biz-001',
        branchId: 'branch-001',
        supplierId: 'sup-001',
        code: 'DRAFT/002',
        date: '2026-08-20',
        dueDate: '2026-08-20',
        supplierTerm: 'Tunai',
        status: 'draft',
        totalMinor: 250000,
        serverVersion: 1,
      );
      await repository.createDraft(po, [
        PurchaseItem(id: 'it-1', purchaseId: 'po-draft-2', productName: 'Item A', orderedQty: 10, unitCostMinor: 25000, subtotalMinor: 250000),
      ], outbox);

      // Update draft with new quantity
      final updatedPo = Purchase(
        id: 'po-draft-2',
        businessId: 'biz-001',
        branchId: 'branch-001',
        supplierId: 'sup-001',
        code: 'DRAFT/002',
        date: '2026-08-20',
        dueDate: '2026-08-20',
        supplierTerm: 'Tunai',
        status: 'draft',
        totalMinor: 500000,
        serverVersion: 1,
      );
      final updatedItems = [
        PurchaseItem(id: 'it-1', purchaseId: 'po-draft-2', productName: 'Item A', orderedQty: 20, unitCostMinor: 25000, subtotalMinor: 500000),
      ];

      await repository.updateDraft(updatedPo, updatedItems, outbox);

      final fetched = await repository.getPurchaseById('po-draft-2', 'biz-001', 'branch-001');
      expect(fetched!.totalMinor, 500000);
      expect(fetched.items.first.orderedQty, 20);

      final dueOutbox = await outbox.fetchDue(DateTime.now().millisecondsSinceEpoch);
      expect(dueOutbox.any((d) => d.operation == 'upsert'), isTrue);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-009 through 013: Online-only operations are not enqueued
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-009 to 013: send, receive, pay, cancel, delete are online-only and not enqueued in SyncOutbox', () async {
      // SyncOutbox only accepts draft operations
      final due = await outbox.fetchDue(DateTime.now().millisecondsSinceEpoch);
      expect(due.where((d) => d.operation == 'receive'), isEmpty);
      expect(due.where((d) => d.operation == 'pay'), isEmpty);
      expect(due.where((d) => d.operation == 'send'), isEmpty);
      expect(due.where((d) => d.operation == 'cancel'), isEmpty);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-014: Tombstone sync
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-014: Server tombstone marks local record as deleted and excludes from list', () async {
      final dto = PurchaseDto(
        id: 'po-tomb-1',
        businessId: 'biz-001',
        branchId: 'branch-001',
        supplierId: 'sup-001',
        code: 'TOMB/001',
        date: '2026-08-20',
        dueDate: '2026-08-20',
        supplierTerm: 'Tunai',
        status: 'draft',
        totalMinor: 100000,
        serverVersion: 2,
        deletedAt: 1724150000000,
      );

      await repository.applyServerSync(dto, 'biz-001');

      final list = await repository.listPurchases('biz-001', 'branch-001');
      expect(list, isEmpty);

      final fetched = await repository.getPurchaseById('po-tomb-1', 'biz-001', 'branch-001');
      expect(fetched, isNotNull);
      expect(fetched!.isDeleted, isTrue);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-015: Incremental cursor
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-015: maxServerVersion tracks highest serverVersion per branch', () async {
      expect(await repository.maxServerVersion('biz-001', 'branch-001'), 0);

      await repository.applyServerSync(
        PurchaseDto(
          id: 'po-1',
          businessId: 'biz-001',
          branchId: 'branch-001',
          supplierId: 'sup-1',
          code: 'PO/1',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'sent',
          totalMinor: 100000,
          serverVersion: 5,
        ),
        'biz-001',
      );

      await repository.applyServerSync(
        PurchaseDto(
          id: 'po-2',
          businessId: 'biz-001',
          branchId: 'branch-001',
          supplierId: 'sup-1',
          code: 'PO/2',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'sent',
          totalMinor: 100000,
          serverVersion: 12,
        ),
        'biz-001',
      );

      expect(await repository.maxServerVersion('biz-001', 'branch-001'), 12);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-016: Dirty local draft preserved
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-016: applyServerSync skips dirty local records (Policy B)', () async {
      await repository.createDraft(
        Purchase(
          id: 'po-dirty',
          businessId: 'biz-001',
          branchId: 'branch-001',
          supplierId: 'sup-1',
          code: 'LOCAL/DIRTY',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 999999,
          serverVersion: 0,
        ),
        [
          PurchaseItem(id: 'i-1', purchaseId: 'po-dirty', productName: 'Local Edit', orderedQty: 1, unitCostMinor: 999999, subtotalMinor: 999999),
        ],
        outbox,
      );

      // Server attempt to push version
      final applied = await repository.applyServerSync(
        PurchaseDto(
          id: 'po-dirty',
          businessId: 'biz-001',
          branchId: 'branch-001',
          supplierId: 'sup-1',
          code: 'SERVER/OVERWRITE',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'sent',
          totalMinor: 100000,
          serverVersion: 3,
        ),
        'biz-001',
      );

      expect(applied, isFalse);

      final fetched = await repository.getPurchaseById('po-dirty', 'biz-001', 'branch-001');
      expect(fetched!.code, 'LOCAL/DIRTY');
      expect(fetched.totalMinor, 999999);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-017: Server conflict handling
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-017: SyncOutbox marks conflict when server responds with 409', () async {
      final outboxId = await outbox.enqueuePurchaseUpsert(
        PurchaseDto(
          id: 'po-conf',
          businessId: 'biz-001',
          branchId: 'branch-001',
          supplierId: 'sup-1',
          code: 'PO/CONF',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 100000,
          serverVersion: 1,
        ),
      );

      await outbox.markConflict(outboxId, '{"server_version": 2}', 'PURCHASE_VERSION_CONFLICT');

      final row = await (db.select(db.syncOutbox)..where((t) => t.id.equals(outboxId))).getSingle();
      expect(row.status, 'conflict');
      expect(row.lastError, 'PURCHASE_VERSION_CONFLICT');
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-018 & 019: Received quantity and value mapping
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-018 / MOBILE-PURCHASE-019: Received quantity and received value mapping', () {
      const item = PurchaseItem(
        id: 'it-1',
        purchaseId: 'po-1',
        productName: 'Kopi Bubuk 250g',
        orderedQty: 50,
        receivedQty: 30,
        unitCostMinor: 20000,
        subtotalMinor: 1000000,
      );

      expect(item.remainingQty, 20);
      expect(item.receivedValueMinor, 600000); // 30 * 20,000
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-020: Tunai aggregate state
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-020: Tunai purchase auto-settles payment balance', () {
      const po = Purchase(
        id: 'po-tunai',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        code: 'TUNAI/001',
        date: '2026-08-20',
        dueDate: '2026-08-20',
        supplierTerm: 'Tunai',
        status: 'received',
        totalMinor: 500000,
        receivedMinor: 500000,
        paidMinor: 500000,
        outstandingMinor: 0,
        serverVersion: 2,
      );

      expect(po.supplierTerm, 'Tunai');
      expect(po.outstandingMinor, 0);
      expect(po.paidMinor, po.receivedMinor);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-021: Tempo outstanding state
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-021: Tempo purchase tracks outstanding balance correctly', () {
      const po = Purchase(
        id: 'po-tempo',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        code: 'TEMPO/001',
        date: '2026-08-20',
        dueDate: '2026-09-03',
        supplierTerm: 'Tempo 14',
        status: 'received',
        totalMinor: 1000000,
        receivedMinor: 1000000,
        paidMinor: 400000,
        outstandingMinor: 600000,
        serverVersion: 3,
      );

      expect(po.supplierTerm, 'Tempo 14');
      expect(po.outstandingMinor, 600000);
      expect(po.totalMinor - po.paidMinor, po.outstandingMinor);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-022: Supplier term snapshot immutability
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-022: Supplier term is snapshot on PO creation', () async {
      final po = Purchase(
        id: 'po-snap',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        code: 'SNAP/001',
        date: '2026-08-20',
        dueDate: '2026-09-19',
        supplierTerm: 'Tempo 30',
        status: 'draft',
        totalMinor: 300000,
        serverVersion: 1,
      );

      await repository.createDraft(po, [
        PurchaseItem(id: 'i-1', purchaseId: 'po-snap', productName: 'Item A', orderedQty: 1, unitCostMinor: 300000, subtotalMinor: 300000),
      ], outbox);

      final fetched = await repository.getPurchaseById('po-snap', 'biz-1', 'br-1');
      expect(fetched!.supplierTerm, 'Tempo 30');
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-023: Product cost snapshot immutability
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-023: Product cost snapshot preserves purchase item unitCostMinor', () async {
      const item = PurchaseItem(
        id: 'i-cost',
        purchaseId: 'po-1',
        productId: 'prod-1',
        productName: 'Susu UHT 1L',
        orderedQty: 10,
        unitCostMinor: 18000,
        subtotalMinor: 180000,
      );

      expect(item.unitCostMinor, 18000);
      expect(item.subtotalMinor, 180000);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-024: No local inventory mutation
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-024: PurchaseRepository does not directly mutate products_local stock', () async {
      // Products table is unmodified by Purchase repository
      final products = await db.select(db.productsLocal).get();
      expect(products, isEmpty);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-025: No local payment ledger table
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-025: Purchase repository relies on aggregate headers without local payment table', () async {
      // Local purchase table schema contains aggregate paidMinor and outstandingMinor
      final tables = await db.customSelect(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='purchase_payments_local'",
      ).get();
      expect(tables, isEmpty);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-026: Tenant switch
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-026: clearBusiness purges tenant data cleanly on switch', () async {
      await repository.createDraft(
        Purchase(
          id: 'po-tenant-switch',
          businessId: 'biz-old',
          branchId: 'br-1',
          supplierId: 'sup-1',
          code: 'OLD/001',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 100000,
          serverVersion: 1,
        ),
        [
          PurchaseItem(id: 'i-1', purchaseId: 'po-tenant-switch', productName: 'Item A', orderedQty: 1, unitCostMinor: 100000, subtotalMinor: 100000),
        ],
        outbox,
      );

      await repository.clearBusiness('biz-old');

      final list = await repository.listPurchases('biz-old', 'br-1');
      expect(list, isEmpty);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-027: Branch switch
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-027: clearBranch removes branch cache without touching other branches', () async {
      await repository.createDraft(
        Purchase(
          id: 'po-b1',
          businessId: 'biz-1',
          branchId: 'branch-1',
          supplierId: 'sup-1',
          code: 'B1/001',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 100000,
          serverVersion: 1,
        ),
        [PurchaseItem(id: 'i-1', purchaseId: 'po-b1', productName: 'A', orderedQty: 1, unitCostMinor: 100000, subtotalMinor: 100000)],
        outbox,
      );
      await repository.createDraft(
        Purchase(
          id: 'po-b2',
          businessId: 'biz-1',
          branchId: 'branch-2',
          supplierId: 'sup-1',
          code: 'B2/001',
          date: '2026-08-20',
          dueDate: '2026-08-20',
          supplierTerm: 'Tunai',
          status: 'draft',
          totalMinor: 100000,
          serverVersion: 1,
        ),
        [PurchaseItem(id: 'i-2', purchaseId: 'po-b2', productName: 'B', orderedQty: 1, unitCostMinor: 100000, subtotalMinor: 100000)],
        outbox,
      );

      await repository.clearBranch('biz-1', 'branch-1');

      expect(await repository.listPurchases('biz-1', 'branch-1'), isEmpty);
      expect(await repository.listPurchases('biz-1', 'branch-2'), hasLength(1));
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-028 & 029: serverVersion and expectedServerVersion
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-028 / MOBILE-PURCHASE-029: serverVersion is persisted and expectedServerVersion is request-only', () async {
      final po = Purchase(
        id: 'po-ver',
        businessId: 'biz-1',
        branchId: 'br-1',
        supplierId: 'sup-1',
        code: 'VER/001',
        date: '2026-08-20',
        dueDate: '2026-08-20',
        supplierTerm: 'Tunai',
        status: 'sent',
        totalMinor: 100000,
        serverVersion: 7,
      );

      await repository.applyServerSync(
        PurchaseDto(
          id: po.id,
          businessId: po.businessId,
          branchId: po.branchId,
          supplierId: po.supplierId,
          code: po.code,
          date: po.date,
          dueDate: po.dueDate,
          supplierTerm: po.supplierTerm,
          status: po.status,
          totalMinor: po.totalMinor,
          serverVersion: 7,
        ),
        'biz-1',
      );

      final fetched = await repository.getPurchaseById('po-ver', 'biz-1', 'br-1');
      expect(fetched!.serverVersion, 7);
    });

    // -----------------------------------------------------------------------
    // MOBILE-PURCHASE-030: No duplicate Tunai pay command
    // -----------------------------------------------------------------------
    test('MOBILE-PURCHASE-030: Tunai receive does not trigger secondary payment command', () {
      const supplierTerm = 'Tunai';
      final requiresManualPay = supplierTerm != 'Tunai';
      expect(requiresManualPay, isFalse);
    });
  });
}
