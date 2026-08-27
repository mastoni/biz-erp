import 'package:drift/drift.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/purchases/domain/purchase.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:uuid/uuid.dart';

class PurchaseRepository {
  PurchaseRepository(this._db);
  final AppDatabase _db;
  final _uuid = const Uuid();

  Purchase _mapToDomain(
    PurchasesLocalData data,
    List<PurchaseItemsLocalData> itemRows,
  ) {
    final items = itemRows
        .map(
          (it) => PurchaseItem(
            id: it.id,
            purchaseId: it.purchaseId,
            productId: it.productId,
            productName: it.productName,
            orderedQty: it.orderedQty,
            receivedQty: it.receivedQty,
            unitCostMinor: it.unitCostMinor,
            subtotalMinor: it.subtotalMinor,
          ),
        )
        .toList();

    return Purchase(
      id: data.id,
      businessId: data.businessId,
      branchId: data.branchId,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      supplierCode: data.supplierCode,
      code: data.code,
      date: data.date,
      dueDate: data.dueDate,
      supplierTerm: data.supplierTerm,
      status: data.status,
      totalMinor: data.totalMinor,
      receivedMinor: data.receivedMinor,
      paidMinor: data.paidMinor,
      outstandingMinor: data.outstandingMinor,
      note: data.note,
      serverVersion: data.serverVersion,
      localStatus: data.localStatus,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      deletedAt: data.deletedAt,
      lastSyncedAt: data.lastSyncedAt,
      items: items,
      payments: const [],
    );
  }

  Future<List<Purchase>> listPurchases(
    String businessId,
    String branchId, {
    String? status,
    String? search,
  }) async {
    var query = _db.select(_db.purchasesLocal)
      ..where(
        (t) =>
            t.businessId.equals(businessId) &
            t.branchId.equals(branchId) &
            t.deletedAt.isNull(),
      );

    if (status != null && status.isNotEmpty && status != 'Semua') {
      query = query..where((t) => t.status.equals(status.toLowerCase()));
    }

    if (search != null && search.trim().isNotEmpty) {
      final s = '%${search.trim().toLowerCase()}%';
      query = query
        ..where(
          (t) =>
              t.code.lower().like(s) |
              t.supplierName.lower().like(s) |
              t.note.lower().like(s),
        );
    }

    query = query..orderBy([(t) => OrderingTerm.desc(t.date), (t) => OrderingTerm.desc(t.createdAt)]);

    final poRows = await query.get();
    if (poRows.isEmpty) return [];

    final poIds = poRows.map((r) => r.id).toList();
    final itemRows = await (_db.select(_db.purchaseItemsLocal)
          ..where((t) => t.purchaseId.isIn(poIds)))
        .get();

    final itemMap = <String, List<PurchaseItemsLocalData>>{};
    for (final it in itemRows) {
      itemMap.putIfAbsent(it.purchaseId, () => []).add(it);
    }

    return poRows.map((po) => _mapToDomain(po, itemMap[po.id] ?? [])).toList();
  }

  Future<Purchase?> getPurchaseById(
    String id,
    String businessId,
    String branchId,
  ) async {
    final query = _db.select(_db.purchasesLocal)
      ..where(
        (t) =>
            t.id.equals(id) &
            t.businessId.equals(businessId) &
            t.branchId.equals(branchId),
      );

    final poRow = await query.getSingleOrNull();
    if (poRow == null) return null;

    final itemRows = await (_db.select(_db.purchaseItemsLocal)
          ..where((t) => t.purchaseId.equals(id)))
        .get();

    return _mapToDomain(poRow, itemRows);
  }

  Future<int> maxServerVersion(String businessId, String branchId) async {
    final row = await _db.customSelect(
      'SELECT COALESCE(MAX(server_version), 0) AS v FROM purchases_local WHERE business_id = ? AND branch_id = ?',
      variables: [Variable.withString(businessId), Variable.withString(branchId)],
    ).getSingle();
    return row.read<int>('v');
  }

  Future<void> createDraft(
    Purchase purchase,
    List<PurchaseItem> items,
    SyncOutboxRepository outbox,
  ) async {
    if (items.isEmpty) {
      throw ArgumentError('Pesanan pembelian minimal memiliki 1 item barang');
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    final mutationId = _uuid.v4();

    await _db.transaction(() async {
      await _db.into(_db.purchasesLocal).insert(
        PurchasesLocalCompanion.insert(
          id: purchase.id,
          businessId: purchase.businessId,
          branchId: purchase.branchId,
          supplierId: purchase.supplierId,
          supplierName: Value(purchase.supplierName),
          supplierCode: Value(purchase.supplierCode),
          code: purchase.code,
          date: purchase.date,
          dueDate: purchase.dueDate,
          supplierTerm: Value(purchase.supplierTerm),
          status: const Value('draft'),
          totalMinor: Value(purchase.totalMinor),
          receivedMinor: const Value(0),
          paidMinor: const Value(0),
          outstandingMinor: Value(purchase.outstandingMinor),
          note: Value(purchase.note),
          serverVersion: const Value(0),
          localStatus: const Value('dirty'),
          createdAt: Value(purchase.createdAt ?? now),
          updatedAt: Value(purchase.updatedAt ?? now),
          deletedAt: Value(purchase.deletedAt),
          lastSyncedAt: Value(purchase.lastSyncedAt),
        ),
      );

      for (final it in items) {
        await _db.into(_db.purchaseItemsLocal).insert(
          PurchaseItemsLocalCompanion.insert(
            id: it.id,
            purchaseId: purchase.id,
            productId: Value(it.productId),
            productName: it.productName,
            orderedQty: it.orderedQty,
            receivedQty: const Value(0),
            unitCostMinor: it.unitCostMinor,
            subtotalMinor: it.subtotalMinor,
          ),
        );
      }

      final dto = PurchaseDto(
        id: purchase.id,
        businessId: purchase.businessId,
        branchId: purchase.branchId,
        supplierId: purchase.supplierId,
        supplierName: purchase.supplierName,
        supplierCode: purchase.supplierCode,
        code: purchase.code,
        date: purchase.date,
        dueDate: purchase.dueDate,
        supplierTerm: purchase.supplierTerm,
        status: 'draft',
        totalMinor: purchase.totalMinor,
        receivedMinor: 0,
        paidMinor: 0,
        outstandingMinor: purchase.outstandingMinor,
        note: purchase.note,
        serverVersion: 0,
        items: items
            .map(
              (i) => PurchaseItemDto(
                id: i.id,
                purchaseId: purchase.id,
                productId: i.productId,
                productName: i.productName,
                orderedQty: i.orderedQty,
                receivedQty: 0,
                unitCostMinor: i.unitCostMinor,
                subtotalMinor: i.subtotalMinor,
              ),
            )
            .toList(),
      );

      await outbox.enqueuePurchaseCreate(dto, idempotencyKey: mutationId);
    });
  }

  Future<void> updateDraft(
    Purchase purchase,
    List<PurchaseItem> items,
    SyncOutboxRepository outbox,
  ) async {
    final existing = await getPurchaseById(
      purchase.id,
      purchase.businessId,
      purchase.branchId,
    );
    if (existing == null) {
      throw ArgumentError('Pesanan pembelian tidak ditemukan');
    }
    if (existing.status != 'draft') {
      throw StateError('Hanya PO draft yang dapat diubah secara offline');
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    final mutationId = _uuid.v4();

    await _db.transaction(() async {
      await _db.into(_db.purchasesLocal).insertOnConflictUpdate(
        PurchasesLocalCompanion(
          id: Value(purchase.id),
          businessId: Value(purchase.businessId),
          branchId: Value(purchase.branchId),
          supplierId: Value(purchase.supplierId),
          supplierName: Value(purchase.supplierName ?? existing.supplierName),
          supplierCode: Value(purchase.supplierCode ?? existing.supplierCode),
          code: Value(existing.code),
          date: Value(purchase.date),
          dueDate: Value(purchase.dueDate),
          supplierTerm: Value(purchase.supplierTerm),
          status: const Value('draft'),
          totalMinor: Value(purchase.totalMinor),
          receivedMinor: const Value(0),
          paidMinor: const Value(0),
          outstandingMinor: Value(purchase.outstandingMinor),
          note: Value(purchase.note),
          serverVersion: Value(existing.serverVersion),
          localStatus: const Value('dirty'),
          createdAt: Value(existing.createdAt ?? now),
          updatedAt: Value(now),
          deletedAt: Value(purchase.deletedAt),
          lastSyncedAt: Value(existing.lastSyncedAt),
        ),
      );

      // Re-insert line items
      await (_db.delete(_db.purchaseItemsLocal)
            ..where((t) => t.purchaseId.equals(purchase.id)))
          .go();

      for (final it in items) {
        await _db.into(_db.purchaseItemsLocal).insert(
          PurchaseItemsLocalCompanion.insert(
            id: it.id,
            purchaseId: purchase.id,
            productId: Value(it.productId),
            productName: it.productName,
            orderedQty: it.orderedQty,
            receivedQty: const Value(0),
            unitCostMinor: it.unitCostMinor,
            subtotalMinor: it.subtotalMinor,
          ),
        );
      }

      final dto = PurchaseDto(
        id: purchase.id,
        businessId: purchase.businessId,
        branchId: purchase.branchId,
        supplierId: purchase.supplierId,
        supplierName: purchase.supplierName ?? existing.supplierName,
        supplierCode: purchase.supplierCode ?? existing.supplierCode,
        code: existing.code,
        date: purchase.date,
        dueDate: purchase.dueDate,
        supplierTerm: purchase.supplierTerm,
        status: 'draft',
        totalMinor: purchase.totalMinor,
        receivedMinor: 0,
        paidMinor: 0,
        outstandingMinor: purchase.outstandingMinor,
        note: purchase.note,
        serverVersion: existing.serverVersion,
        items: items
            .map(
              (i) => PurchaseItemDto(
                id: i.id,
                purchaseId: purchase.id,
                productId: i.productId,
                productName: i.productName,
                orderedQty: i.orderedQty,
                receivedQty: 0,
                unitCostMinor: i.unitCostMinor,
                subtotalMinor: i.subtotalMinor,
              ),
            )
            .toList(),
      );

      await outbox.enqueuePurchaseUpsert(dto, idempotencyKey: mutationId);
    });
  }

  Future<bool> applyServerSync(PurchaseDto dto, String businessId) async {
    final existing = await (_db.select(_db.purchasesLocal)
          ..where((t) => t.id.equals(dto.id) & t.businessId.equals(businessId)))
        .getSingleOrNull();

    // Policy B: If local is dirty, do not silently overwrite
    if (existing != null && existing.localStatus == 'dirty') {
      return false;
    }

    final now = DateTime.now().millisecondsSinceEpoch;

    await _db.transaction(() async {
      await _db.into(_db.purchasesLocal).insertOnConflictUpdate(
        PurchasesLocalCompanion(
          id: Value(dto.id),
          businessId: Value(businessId),
          branchId: Value(dto.branchId),
          supplierId: Value(dto.supplierId),
          supplierName: Value(dto.supplierName),
          supplierCode: Value(dto.supplierCode),
          code: Value(dto.code),
          date: Value(dto.date),
          dueDate: Value(dto.dueDate),
          supplierTerm: Value(dto.supplierTerm),
          status: Value(dto.status),
          totalMinor: Value(dto.totalMinor),
          receivedMinor: Value(dto.receivedMinor),
          paidMinor: Value(dto.paidMinor),
          outstandingMinor: Value(dto.outstandingMinor),
          note: Value(dto.note),
          serverVersion: Value(dto.serverVersion),
          localStatus: const Value('synced'),
          createdAt: Value(dto.createdAt ?? now),
          updatedAt: Value(dto.updatedAt ?? now),
          deletedAt: Value(dto.deletedAt),
          lastSyncedAt: Value(now),
        ),
      );

      if (dto.items.isNotEmpty) {
        await (_db.delete(_db.purchaseItemsLocal)
              ..where((t) => t.purchaseId.equals(dto.id)))
            .go();

        for (final it in dto.items) {
          await _db.into(_db.purchaseItemsLocal).insert(
            PurchaseItemsLocalCompanion.insert(
              id: it.id,
              purchaseId: dto.id,
              productId: Value(it.productId),
              productName: it.productName,
              orderedQty: it.orderedQty,
              receivedQty: Value(it.receivedQty),
              unitCostMinor: it.unitCostMinor,
              subtotalMinor: it.subtotalMinor,
            ),
          );
        }
      }
    });

    return true;
  }

  Future<void> markSyncedAfterPush(String id, int serverVersion) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    await (_db.update(_db.purchasesLocal)..where((t) => t.id.equals(id))).write(
      PurchasesLocalCompanion(
        localStatus: const Value('synced'),
        serverVersion: Value(serverVersion),
        lastSyncedAt: Value(now),
      ),
    );
  }

  Future<void> clearBranch(String businessId, String branchId) async {
    final rows = await (_db.select(_db.purchasesLocal)
          ..where((t) => t.businessId.equals(businessId) & t.branchId.equals(branchId)))
        .get();
    final ids = rows.map((r) => r.id).toList();

    await _db.transaction(() async {
      if (ids.isNotEmpty) {
        await (_db.delete(_db.purchaseItemsLocal)
              ..where((t) => t.purchaseId.isIn(ids)))
            .go();
      }
      await (_db.delete(_db.purchasesLocal)
            ..where((t) => t.businessId.equals(businessId) & t.branchId.equals(branchId)))
          .go();
    });
  }

  Future<void> clearBusiness(String businessId) async {
    final rows = await (_db.select(_db.purchasesLocal)
          ..where((t) => t.businessId.equals(businessId)))
        .get();
    final ids = rows.map((r) => r.id).toList();

    await _db.transaction(() async {
      if (ids.isNotEmpty) {
        await (_db.delete(_db.purchaseItemsLocal)
              ..where((t) => t.purchaseId.isIn(ids)))
            .go();
      }
      await (_db.delete(_db.purchasesLocal)
            ..where((t) => t.businessId.equals(businessId)))
          .go();
    });
  }

  /// Sends a draft PO to the supplier (draft -> sent).
  /// This is an ONLINE ONLY operation. If offline, throws StateError.
  /// Uses optimistic concurrency with expected server version.
  /// Returns the updated Purchase on success, throws on conflict/error.
  Future<Purchase> sendPurchase(
    String id,
    String businessId,
    String branchId, {
    required SyncApiClient syncApiClient,
    required String idempotencyKey,
  }) async {
    // Verify local PO exists and is in draft status
    final existing = await getPurchaseById(id, businessId, branchId);
    if (existing == null) {
      throw ArgumentError('Pesanan pembelian tidak ditemukan');
    }
    if (existing.status != 'draft') {
      throw StateError('Hanya PO draft yang dapat dikirim ke supplier');
    }
    if (!existing.isDirty) {
      // If already synced, use server version
    }
    
    // Call API to send purchase
    final result = await syncApiClient.sendPurchase(
      id: id,
      ifMatchVersion: existing.serverVersion > 0 ? existing.serverVersion : null,
      idempotencyKey: idempotencyKey,
    );

    if (!result.ok) {
      if (result.conflict) {
        throw StateError('Konflik versi: data di server telah berubah. Silakan muat ulang dan coba lagi.');
      }
      throw StateError('Gagal mengirim PO: ${result.error ?? 'Unknown error'}');
    }

    // If server returned new state, apply it
    if (result.serverState != null) {
      await applyServerSync(result.serverState!, businessId);
      // Re-fetch to get updated local data
      return (await getPurchaseById(id, businessId, branchId))!;
    } else {
      // Mark as synced with new version
      await markSyncedAfterPush(id, result.serverVersion ?? existing.serverVersion + 1);
      return (await getPurchaseById(id, businessId, branchId))!;
    }
  }
}
