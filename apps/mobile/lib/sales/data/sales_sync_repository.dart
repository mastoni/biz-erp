import 'package:drift/drift.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../../core/database/app_database.dart';
import '../../core/sync/sync_models.dart';

/// Insert sales dari server. Append-only: tidak pernah overwrite lokal.
class SalesSyncRepository {
  SalesSyncRepository(this._db);
  final AppDatabase _db;
  final _uuid = const Uuid();

  Future<bool> insertIfAbsent(SaleDto sale, String businessId) async {
    final existing =
        await (_db.select(_db.salesLocal)
              ..where((t) => t.clientTransactionId.equals(sale.idempotencyKey)))
            .getSingleOrNull();
    if (existing != null) {
      return false;
    }

    // If historical sale from server lacks branch_id or any item lacks product_id,
    // current SQLite schema (NOT NULL) cannot represent NULL without schema migration.
    // We do not invent fake branch values; we gracefully skip local table insertion
    // while allowing sync cursor to advance.
    if (sale.branchId == null || sale.items.any((i) => i.productId == null)) {
      return false;
    }

    final now = DateTime.now().millisecondsSinceEpoch;

    await _db.transaction(() async {
      await _db
          .into(_db.salesLocal)
          .insert(
            SalesLocalCompanion.insert(
              clientTransactionId: sale.idempotencyKey,
              businessId: businessId,
              branchId: sale.branchId!,
              cashierId: sale.cashierId ?? 'UNKNOWN',
              customerId: Value(sale.customerId),
              receiptNumber: Value(sale.receiptNumber),
              status: 'SYNCED',
              subtotalMinor: sale.subtotalMinor,
              discountMinor: Value(sale.discountMinor),
              taxMinor: Value(sale.taxMinor),
              totalMinor: sale.grandTotalMinor,
              currencyCode: 'IDR',
              currencyMinorUnits: 0,
              deviceId: 'SERVER_PULL',
              createdAt: now,
              updatedAt: now,
              syncedAt: Value(now),
            ),
          );

      for (final item in sale.items) {
        await _db
            .into(_db.saleItemsLocal)
            .insert(
              SaleItemsLocalCompanion.insert(
                id: _uuid.v4(),
                clientTransactionId: sale.idempotencyKey,
                productId: item.productId!,
                quantity: item.quantity,
                unitPriceMinor: item.unitPriceMinor,
                createdAt: sale.clientCreatedAt,
              ),
            );
      }
    });
    return true;
  }

  Future<void> bumpReceiptSequence(String businessId, String branchId, String sequenceDate, int conflictingSequence) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final existing = await (_db.select(_db.receiptSequencesLocal)
          ..where((t) => t.businessId.equals(businessId) & t.branchId.equals(branchId) & t.sequenceDate.equals(sequenceDate)))
        .getSingleOrNull();
    
    if (existing != null) {
      final nextSequence = existing.lastSequence + 1;
      final advancedSequence = nextSequence > conflictingSequence ? nextSequence : conflictingSequence;
      await (_db.update(_db.receiptSequencesLocal)
            ..where((t) => t.businessId.equals(businessId) & t.branchId.equals(branchId) & t.sequenceDate.equals(sequenceDate)))
          .write(
            ReceiptSequencesLocalCompanion(
              lastSequence: Value(advancedSequence),
              updatedAt: Value(now),
            ),
          );
    } else {
      final advancedSequence = conflictingSequence > 1 ? conflictingSequence : 1;
      await _db.into(_db.receiptSequencesLocal).insert(
        ReceiptSequencesLocalCompanion.insert(
          id: _uuid.v4(),
          businessId: businessId,
          branchId: branchId,
          sequenceDate: sequenceDate,
          lastSequence: Value(advancedSequence),
          updatedAt: now,
        ),
      );
    }
  }

  Future<void> markSaleReceiptConflict(String clientTransactionId) async {
    debugPrint('[DEBUG] markSaleReceiptConflict: $clientTransactionId');
    try {
      final result = await (_db.update(_db.salesLocal)
            ..where((t) => t.clientTransactionId.equals(clientTransactionId)))
          .write(
            SalesLocalCompanion(
              status: const Value('RECEIPT_CONFLICT'),
              updatedAt: Value(DateTime.now().millisecondsSinceEpoch),
            ),
          );
      debugPrint('[DEBUG] markSaleReceiptConflict updated $result rows');
    } catch (e) {
      debugPrint('[DEBUG] markSaleReceiptConflict error: $e');
      rethrow;
    }
  }
}
