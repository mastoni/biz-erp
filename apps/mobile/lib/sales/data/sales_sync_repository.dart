import 'package:drift/drift.dart';
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

    final now = DateTime.now().millisecondsSinceEpoch;

      await _db.transaction(() async {
        await _db
            .into(_db.salesLocal)
            .insert(
              SalesLocalCompanion.insert(
                clientTransactionId: sale.idempotencyKey,
                businessId: businessId,
                branchId: 'BRANCH-001',
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
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPriceMinor: item.unitPriceMinor,
                  createdAt: sale.clientCreatedAt,
                ),
              );
        }
      });
    return true;
  }

  Future<void> bumpReceiptSequence(String businessId, String branchId, String sequenceDate) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final existing = await (_db.select(_db.receiptSequencesLocal)
          ..where((t) => t.businessId.equals(businessId) & t.branchId.equals(branchId) & t.sequenceDate.equals(sequenceDate)))
        .getSingleOrNull();
    
    if (existing != null) {
      await (_db.update(_db.receiptSequencesLocal)
            ..where((t) => t.businessId.equals(businessId) & t.branchId.equals(branchId) & t.sequenceDate.equals(sequenceDate)))
          .write(
            ReceiptSequencesLocalCompanion(
              lastSequence: Value(existing.lastSequence + 1),
              updatedAt: Value(now),
            ),
          );
    } else {
      await _db.into(_db.receiptSequencesLocal).insert(
        ReceiptSequencesLocalCompanion.insert(
          id: _uuid.v4(),
          businessId: businessId,
          branchId: branchId,
          sequenceDate: sequenceDate,
          lastSequence: const Value(1),
          updatedAt: now,
        ),
      );
    }
  }

  Future<void> markSaleReceiptConflict(String clientTransactionId) async {
    print('[DEBUG] markSaleReceiptConflict: $clientTransactionId');
    try {
      final result = await (_db.update(_db.salesLocal)
            ..where((t) => t.clientTransactionId.equals(clientTransactionId)))
          .write(
            SalesLocalCompanion(
              status: const Value('RECEIPT_CONFLICT'),
              updatedAt: Value(DateTime.now().millisecondsSinceEpoch),
            ),
          );
      print('[DEBUG] markSaleReceiptConflict updated $result rows');
    } catch (e) {
      print('[DEBUG] markSaleReceiptConflict error: $e');
      rethrow;
    }
  }
}
