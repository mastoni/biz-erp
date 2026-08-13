import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../core/database/app_database.dart';
import '../../core/demo_context.dart';
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
              branchId: DemoContext.branchId,
              cashierId: sale.cashierId ?? 'UNKNOWN',
              receiptNumber: Value(sale.receiptNumber),
              status: 'SYNCED',
              subtotalMinor: sale.subtotalMinor,
              discountMinor: Value(sale.discountMinor),
              taxMinor: Value(sale.taxMinor),
              totalMinor: sale.grandTotalMinor,
              currencyCode: DemoContext.currencyCode,
              currencyMinorUnits: DemoContext.currencyMinorUnits,
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
}
