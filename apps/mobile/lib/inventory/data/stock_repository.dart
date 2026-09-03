import 'package:drift/drift.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/inventory/domain/stock.dart';
import 'package:biz_erp_mobile/inventory/domain/stock_movement.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';

class StockRepository {
  final AppDatabase _db;
  StockRepository(this._db);

  Stock _mapStock(StocksLocalData d) {
    return Stock(
      id: d.id,
      businessId: d.businessId,
      branchId: d.branchId,
      productId: d.productId,
      productName: d.productName,
      sku: d.sku,
      category: d.category,
      barcode: d.barcode,
      priceMinor: d.priceMinor,
      costMinor: d.costMinor,
      quantity: d.quantity,
      serverVersion: d.serverVersion,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      cachedAt: d.cachedAt,
    );
  }

  StockMovement _mapMovement(StockMovementsLocalData d) {
    return StockMovement(
      id: d.id,
      businessId: d.businessId,
      branchId: d.branchId,
      productId: d.productId,
      quantity: d.quantity,
      movementType: d.movementType,
      reference: d.reference,
      actor: d.actor,
      timestamp: d.timestamp,
      cachedAt: d.cachedAt,
    );
  }

  Future<List<Stock>> listStocks(String businessId, String branchId) async {
    final rows = await (_db.select(_db.stocksLocal)
          ..where((t) => t.businessId.equals(businessId) & t.branchId.equals(branchId))
          ..orderBy([(t) => OrderingTerm.desc(t.quantity), (t) => OrderingTerm.asc(t.productName)]))
        .get();
    return rows.map(_mapStock).toList();
  }

  Future<Stock?> getStockByProductId(String businessId, String branchId, String productId) async {
    final row = await (_db.select(_db.stocksLocal)
          ..where((t) =>
              t.businessId.equals(businessId) &
              t.branchId.equals(branchId) &
              t.productId.equals(productId)))
        .getSingleOrNull();
    return row == null ? null : _mapStock(row);
  }

  Future<List<StockMovement>> listMovements(String businessId, String branchId, {String? productId, int limit = 50, int offset = 0}) async {
    final query = _db.select(_db.stockMovementsLocal)
      ..where((t) => t.businessId.equals(businessId) & t.branchId.equals(branchId))
      ..orderBy([(t) => OrderingTerm.desc(t.timestamp)])
      ..limit(limit, offset: offset);
    final rows = productId != null
        ? await (query..where((t) => t.productId.equals(productId))).get()
        : await query.get();
    return rows.map(_mapMovement).toList();
  }

  Future<int> maxServerVersion(String businessId, String branchId) async {
    final row = await _db.customSelect(
      'SELECT COALESCE(MAX(server_version), 0) AS v FROM stocks_local WHERE business_id = ? AND branch_id = ?',
      variables: [Variable.withString(businessId), Variable.withString(branchId)],
    ).getSingle();
    return row.read<int>('v');
  }

  Future<int> applyStocksPull(List<StockWithProductDto> items, String businessId, String branchId) async {
    var count = 0;
    final now = DateTime.now().millisecondsSinceEpoch;
    await _db.transaction(() async {
      for (final dto in items) {
        if (dto.quantity > 0 || dto.serverVersion > 0) {
          await _db.into(_db.stocksLocal).insertOnConflictUpdate(
            StocksLocalCompanion.insert(
              id: dto.id,
              businessId: dto.businessId,
              branchId: dto.branchId,
              productId: dto.productId,
              productName: dto.productName,
              sku: Value(dto.sku),
              category: Value(dto.category),
              barcode: Value(dto.barcode),
              priceMinor: dto.priceMinor,
              costMinor: Value(dto.costMinor),
              quantity: dto.quantity,
              serverVersion: Value(dto.serverVersion),
              createdAt: Value(dto.createdAt),
              updatedAt: Value(dto.updatedAt),
              cachedAt: Value(now),
            ),
          );
          count++;
        }
      }
    });
    return count;
  }

  /// Computes a StockSummaryDto locally from cached stocks data.
  /// D3 decision: summary is derived locally from stocks_local,
  /// mirroring backend's LOW_STOCK_THRESHOLD = 5.
  Future<StockSummaryDto> getStockSummary(String businessId, String branchId) async {
    final rows = await (_db.select(_db.stocksLocal)
          ..where((t) => t.businessId.equals(businessId) & t.branchId.equals(branchId)))
        .get();

    var totalValue = 0;
    var lowStock = 0;
    var outOfStock = 0;

    for (final r in rows) {
      final costMinor = r.costMinor ?? 0;
      totalValue += costMinor * r.quantity;
      if (r.quantity <= 0) {
        outOfStock++;
      } else if (r.quantity <= Stock.lowStockThreshold) {
        lowStock++;
      }
    }

    return StockSummaryDto(
      totalStockValueMinor: totalValue,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
      totalSkus: rows.length,
    );
  }

  Future<void> applyMovementsPull(List<StockMovementDto> items, String businessId, String branchId) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    await _db.transaction(() async {
      for (final dto in items) {
        await _db.into(_db.stockMovementsLocal).insertOnConflictUpdate(
          StockMovementsLocalCompanion.insert(
            id: dto.id,
            businessId: dto.businessId,
            branchId: dto.branchId,
            productId: dto.productId,
            quantity: dto.quantity,
            movementType: dto.movementType,
            reference: Value(dto.reference),
            actor: dto.actor,
            timestamp: Value(dto.timestamp),
            cachedAt: Value(now),
          ),
        );
      }
    });
  }

  Future<void> clearBranch(String businessId, String branchId) async {
    await _db.transaction(() async {
      await (_db.delete(_db.stocksLocal)
            ..where((t) => t.businessId.equals(businessId) & t.branchId.equals(branchId)))
          .go();
      await (_db.delete(_db.stockMovementsLocal)
            ..where((t) => t.businessId.equals(businessId) & t.branchId.equals(branchId)))
          .go();
    });
  }
}
