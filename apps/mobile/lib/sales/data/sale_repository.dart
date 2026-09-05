import 'package:drift/drift.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/sales/domain/sale.dart';

/// Repository for reading local POS sales and transaction history.
/// Reads from local encrypted SQLite (Drift) only for offline-first reliability.
class SaleRepository {
  final AppDatabase _db;

  SaleRepository(this._db);

  Sale _mapSale(SalesLocalData row, {String? customerName, List<SaleItem> items = const []}) {
    return Sale(
      clientTransactionId: row.clientTransactionId,
      businessId: row.businessId,
      branchId: row.branchId,
      cashierId: row.cashierId,
      customerId: row.customerId,
      customerName: customerName,
      receiptNumber: row.receiptNumber,
      receiptSequence: row.receiptSequence,
      receiptDate: row.receiptDate,
      status: row.status,
      subtotalMinor: row.subtotalMinor,
      discountMinor: row.discountMinor,
      taxMinor: row.taxMinor,
      totalMinor: row.totalMinor,
      currencyCode: row.currencyCode,
      currencyMinorUnits: row.currencyMinorUnits,
      deviceId: row.deviceId,
      createdAt: DateTime.fromMillisecondsSinceEpoch(row.createdAt),
      updatedAt: DateTime.fromMillisecondsSinceEpoch(row.updatedAt),
      syncedAt: row.syncedAt != null
          ? DateTime.fromMillisecondsSinceEpoch(row.syncedAt!)
          : null,
      items: items,
    );
  }

  /// Lists sales filtered by tenant, branch, optional date range, and search query.
  Future<List<Sale>> listSales({
    required String businessId,
    required String branchId,
    DateTime? startDate,
    DateTime? endDate,
    String? searchQuery,
    int limit = 100,
    int offset = 0,
  }) async {
    final query = _db.select(_db.salesLocal)
      ..where((t) => t.businessId.equals(businessId) & t.branchId.equals(branchId));

    if (startDate != null) {
      final startMs = startDate.millisecondsSinceEpoch;
      query.where((t) => t.createdAt.isBiggerOrEqualValue(startMs));
    }

    if (endDate != null) {
      final endMs = endDate.millisecondsSinceEpoch;
      query.where((t) => t.createdAt.isSmallerOrEqualValue(endMs));
    }

    if (searchQuery != null && searchQuery.trim().isNotEmpty) {
      final q = '%${searchQuery.trim()}%';
      query.where((t) => t.receiptNumber.like(q) | t.clientTransactionId.like(q));
    }

    query
      ..orderBy([(t) => OrderingTerm.desc(t.createdAt)])
      ..limit(limit, offset: offset);

    final rows = await query.get();
    if (rows.isEmpty) return [];

    // Resolve customer names in batch
    final customerIds = rows
        .map((r) => r.customerId)
        .where((id) => id != null && id.isNotEmpty)
        .cast<String>()
        .toSet()
        .toList();

    final customerMap = <String, String>{};
    if (customerIds.isNotEmpty) {
      final customers = await (_db.select(_db.customersLocal)
            ..where((t) => t.businessId.equals(businessId) & t.id.isIn(customerIds)))
          .get();
      for (final c in customers) {
        customerMap[c.id] = c.name;
      }
    }

    return rows.map((r) {
      final cName = r.customerId != null ? customerMap[r.customerId!] : null;
      return _mapSale(r, customerName: cName);
    }).toList();
  }

  /// Retrieves a specific sale with all line items and resolved product/customer names.
  Future<Sale?> getSaleById(
    String clientTransactionId, {
    required String businessId,
  }) async {
    final saleRow = await (_db.select(_db.salesLocal)
          ..where((t) =>
              t.clientTransactionId.equals(clientTransactionId) &
              t.businessId.equals(businessId)))
        .getSingleOrNull();

    if (saleRow == null) return null;

    // Resolve customer name
    String? customerName;
    if (saleRow.customerId != null && saleRow.customerId!.isNotEmpty) {
      final c = await (_db.select(_db.customersLocal)
            ..where((t) =>
                t.businessId.equals(businessId) &
                t.id.equals(saleRow.customerId!)))
          .getSingleOrNull();
      customerName = c?.name;
    }

    // Resolve line items with product names
    final items = await getSaleItems(clientTransactionId);

    return _mapSale(saleRow, customerName: customerName, items: items);
  }

  /// Loads line items for a specific sale, joining product names where available.
  Future<List<SaleItem>> getSaleItems(String clientTransactionId) async {
    final itemRows = await (_db.select(_db.saleItemsLocal)
          ..where((t) => t.clientTransactionId.equals(clientTransactionId))
          ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
        .get();

    if (itemRows.isEmpty) return [];

    final productIds = itemRows.map((i) => i.productId).toSet().toList();
    final productMap = <String, String>{};

    if (productIds.isNotEmpty) {
      final products = await (_db.select(_db.productsLocal)
            ..where((t) => t.id.isIn(productIds)))
          .get();
      for (final p in products) {
        productMap[p.id] = p.name;
      }
    }

    return itemRows.map((row) {
      final pName = productMap[row.productId] ?? 'Produk (${row.productId})';
      return SaleItem(
        id: row.id,
        clientTransactionId: row.clientTransactionId,
        productId: row.productId,
        productName: pName,
        quantity: row.quantity,
        unitPriceMinor: row.unitPriceMinor,
        discountMinor: row.discountMinor,
        createdAt: DateTime.fromMillisecondsSinceEpoch(row.createdAt),
      );
    }).toList();
  }

  /// Computes summary metrics for local sales in the specified branch and period.
  Future<Map<String, int>> getSalesSummary({
    required String businessId,
    required String branchId,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final sales = await listSales(
      businessId: businessId,
      branchId: branchId,
      startDate: startDate,
      endDate: endDate,
      limit: 1000,
    );

    int totalAmountMinor = 0;
    int pendingCount = 0;

    for (final s in sales) {
      totalAmountMinor += s.totalMinor;
      if (s.isPending) {
        pendingCount++;
      }
    }

    return {
      'totalCount': sales.length,
      'totalAmountMinor': totalAmountMinor,
      'pendingCount': pendingCount,
    };
  }
}
