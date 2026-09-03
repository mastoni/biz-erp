import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'sync_api_client.dart';
import 'sync_meta_repository.dart';
import 'sync_models.dart';
import 'sync_outbox_repository.dart';
import '../../products/data/product_repository.dart';
import '../../sales/data/sales_sync_repository.dart';
import '../../customers/data/customer_repository.dart';
import '../../suppliers/data/supplier_repository.dart';
import '../../purchases/data/purchase_repository.dart';
import '../../inventory/data/stock_repository.dart';
import 'http_sync_api_client.dart' show HttpException, NetworkException;
import 'package:sentry_flutter/sentry_flutter.dart';

class SyncSummary {
  final bool reachable;
  final int pushed;
  final int pulledProducts;
  final int pulledCustomers;
  final int pulledSuppliers;
  final int pulledPurchases;
  final int pulledSales;
  final int pulledStocks;
  final SyncCounts counts;
  const SyncSummary({
    required this.reachable,
    required this.pushed,
    required this.pulledProducts,
    required this.pulledCustomers,
    required this.pulledSuppliers,
    this.pulledPurchases = 0,
    required this.pulledSales,
    this.pulledStocks = 0,
    required this.counts,
  });
}

class SyncEngine extends ChangeNotifier {
  SyncEngine({
    required this._outbox,
    required this._meta,
    required this._api,
    required this._products,
    required this._salesSync,
    required this._customers,
    required this._suppliers,
    this.purchases,
    this.stocks,
    this.branchId,
    required this._businessId,
  });

  final SyncOutboxRepository _outbox;
  final SyncMetaRepository _meta;
  final SyncApiClient _api;
  final ProductRepository _products;
  final SalesSyncRepository _salesSync;
  final CustomerRepository _customers;
  final SupplierRepository _suppliers;
  final PurchaseRepository? purchases;
  final StockRepository? stocks;
  final String? branchId;
  final String _businessId;

  SyncApiClient get apiClient => _api;

  Future<SyncSummary> syncNow() async {
    bool reachable = false;
    int pushed = 0, pulledP = 0, pulledC = 0, pulledS = 0, pulledSup = 0, pulledPurchases = 0, pulledStocks = 0;
    try {
      reachable = await _api.health();
    } catch (_) {
      reachable = false;
    }

    if (reachable) {
      pushed = await _push();
      try {
        final pull = await _pull();
        pulledP = pull.$1;
        pulledC = pull.$2;
        pulledSup = pull.$3;
        pulledPurchases = pull.$4;
        pulledS = pull.$5;
        pulledStocks = pull.$6;
      } on HttpException catch (e, st) {
        if (e.statusCode == 401) {
          // Graceful abort on auth error. Session expiry is handled by AuthStateNotifier.
        } else if (e.statusCode != null && e.statusCode! >= 500) {
          Sentry.captureException(e, stackTrace: st, withScope: (scope) {
            scope.setTag('operation', 'pull');
            if (e.requestId != null) scope.setTag('request_id', e.requestId!);
          });
          rethrow;
        } else {
          rethrow;
        }
      } catch (e, st) {
        if (e is! NetworkException) {
          Sentry.captureException(e, stackTrace: st, withScope: (scope) => scope.setTag('operation', 'pull'));
        }
        rethrow;
      }
    }

    final counts = await _outbox.counts();
    notifyListeners();
    return SyncSummary(
      reachable: reachable,
      pushed: pushed,
      pulledProducts: pulledP,
      pulledCustomers: pulledC,
      pulledSuppliers: pulledSup,
       pulledPurchases: pulledPurchases,
       pulledSales: pulledS,
       pulledStocks: pulledStocks,
       counts: counts,
    );
  }

  Future<int> _push() async {
    int pushed = 0;
    while (true) {
      final due = await _outbox.fetchDue(DateTime.now().millisecondsSinceEpoch);
      if (due.isEmpty) break;

      final productItems = due.where((d) => d.entityType == 'product').toList();
      final saleItems = due.where((d) => d.entityType == 'sale').toList();
      final customerItems = due.where((d) => d.entityType == 'customer').toList();
      final supplierItems = due.where((d) => d.entityType == 'supplier').toList();
      final purchaseItems = due.where((d) => d.entityType == 'purchase').toList();

      for (final item in productItems) {
        await _pushProduct(item);
        pushed++;
      }
      if (saleItems.isNotEmpty) {
        await _pushSales(saleItems);
        pushed += saleItems.length;
      }
      for (final item in customerItems) {
        await _pushCustomer(item);
        pushed++;
      }
      for (final item in supplierItems) {
        await _pushSupplier(item);
        pushed++;
      }
      for (final item in purchaseItems) {
        await _pushPurchase(item);
        pushed++;
      }
    }
    return pushed;
  }

  Future<void> _pushProduct(SyncOutboxItem item) async {
    final dto = ProductDto.fromJson(
      jsonDecode(item.payloadJson) as Map<String, dynamic>,
    );
    final now = DateTime.now().millisecondsSinceEpoch;
    try {
      ProductPushResult res;
      if (item.operation == 'create') {
        res = await _api.createProduct(dto, idempotencyKey: item.idempotencyKey!);
      } else {
        res = await _api.pushProduct(dto, ifMatchVersion: dto.serverVersion);
      }
      if (res.ok) {
        await _outbox.markSynced(item.id);
        await _products.markSyncedAfterPush(
          dto.id,
          res.serverVersion ?? dto.serverVersion,
        );
      } else if (res.error == 'BARCODE_CONFLICT' || res.error == 'VALIDATION_ERROR' || res.error == 'IDEMPOTENCY_KEY_REUSE' || res.error == 'INSUFFICIENT_PERMISSIONS') {
        await _outbox.markFailed(item.id, res.error!);
      } else if (res.conflict) {
        // Policy B: keep local, jangan retry otomatis
        await _outbox.markConflict(
          item.id,
          jsonEncode(res.serverState?.toJson() ?? {}),
          res.error ?? 'VERSION_CONFLICT',
        );
      } else {
        await _outbox.markRetry(item.id, now, res.error ?? 'unknown');
      }
    } catch (e, st) {
      if (e is HttpException && e.statusCode != null && e.statusCode! >= 500) {
        Sentry.captureException(e, stackTrace: st, withScope: (scope) {
          scope.setTag('operation', 'pushProduct');
          if (e.requestId != null) scope.setTag('request_id', e.requestId!);
        });
      } else if (e is! HttpException && e is! NetworkException) {
        Sentry.captureException(e, stackTrace: st, withScope: (scope) => scope.setTag('operation', 'pushProduct'));
      }
      await _outbox.markRetry(item.id, now, e.toString());
    }
  }

  Future<void> _pushSales(List<SyncOutboxItem> items) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final sales = items
        .map(
          (i) => SaleDto.fromJson(
            jsonDecode(i.payloadJson) as Map<String, dynamic>,
          ),
        )
        .toList();
    try {
      final results = await _api.pushSalesBatch(sales);
      final byKey = {for (final r in results) r.idempotencyKey: r};
      for (final item in items) {
        final r = byKey[item.idempotencyKey];
        if (r == null) {
          await _outbox.markRetry(item.id, now, 'no result');
        } else if (r.status == 'created' || r.status == 'duplicate') {
          await _outbox.markSynced(item.id);
        } else if (r.status == 'receipt_conflict') {
          print('[DEBUG] receipt_conflict: item.id=${item.id}, item.key=${item.idempotencyKey}');
          await _outbox.markFailed(item.id, 'RECEIPT_NUMBER_CONFLICT');
          if (item.idempotencyKey != null) {
            await _salesSync.markSaleReceiptConflict(item.idempotencyKey!);
          }
          final parts = r.receiptNumber.split('-');
          print('[DEBUG] parts=$parts');
          if (parts.length >= 3) {
            final sequence = parts.last;
            final dateStr = parts[parts.length - 2];
            final branchId = parts.sublist(0, parts.length - 2).join('-');
            print('[DEBUG] bumping sequence for business=$_businessId, branch=$branchId, date=$dateStr');
            await _salesSync.bumpReceiptSequence(_businessId, branchId, dateStr, int.parse(sequence));
            print('[DEBUG] bump done');
          }
        } else {
          await _outbox.markRetry(item.id, now, r.error ?? 'failed');
        }
      }
    } catch (e, st) {
      if (e is HttpException && e.statusCode != null && e.statusCode! >= 500) {
        Sentry.captureException(e, stackTrace: st, withScope: (scope) {
          scope.setTag('operation', 'pushSalesBatch');
          if (e.requestId != null) scope.setTag('request_id', e.requestId!);
        });
      } else if (e is! HttpException && e is! NetworkException) {
        Sentry.captureException(e, stackTrace: st, withScope: (scope) => scope.setTag('operation', 'pushSalesBatch'));
      }
      for (final item in items) {
        if (e is HttpException && e.statusCode == 403) {
          await _outbox.markFailed(item.id, 'INSUFFICIENT_PERMISSIONS');
        } else {
          await _outbox.markRetry(item.id, now, e.toString());
        }
      }
    }
  }

  Future<void> _pushCustomer(SyncOutboxItem item) async {
    final dto = CustomerDto.fromJson(
      jsonDecode(item.payloadJson) as Map<String, dynamic>,
    );
    final now = DateTime.now().millisecondsSinceEpoch;
    try {
      CustomerPushResult res;
      if (item.operation == 'create') {
        res = await _api.createCustomer(dto, idempotencyKey: item.idempotencyKey!);
      } else if (item.operation == 'delete') {
        res = await _api.deleteCustomer(dto, idempotencyKey: item.idempotencyKey!);
      } else {
        // upsert (update)
        res = await _api.pushCustomer(dto, ifMatchVersion: dto.serverVersion, idempotencyKey: item.idempotencyKey!);
      }
      if (res.ok) {
        await _outbox.markSynced(item.id);
        await _customers.markSyncedAfterPush(
          dto.id,
          res.serverVersion ?? dto.serverVersion,
        );
      } else if (res.error == 'VALIDATION_ERROR' || res.error == 'IDEMPOTENCY_KEY_REUSE' || res.error == 'INSUFFICIENT_PERMISSIONS' || res.error == 'CUSTOMER_ID_CONFLICT') {
        await _outbox.markFailed(item.id, res.error!);
      } else if (res.conflict) {
        // Policy B: keep local, don't auto-retry
        await _outbox.markConflict(
          item.id,
          jsonEncode(res.serverState?.toJson() ?? {}),
          res.error ?? 'CUSTOMER_VERSION_CONFLICT',
        );
      } else {
        await _outbox.markRetry(item.id, now, res.error ?? 'unknown');
      }
    } catch (e, st) {
      if (e is HttpException && e.statusCode != null && e.statusCode! >= 500) {
        Sentry.captureException(e, stackTrace: st, withScope: (scope) {
          scope.setTag('operation', 'pushCustomer');
          if (e.requestId != null) scope.setTag('request_id', e.requestId!);
        });
      } else if (e is! HttpException && e is! NetworkException) {
        Sentry.captureException(e, stackTrace: st, withScope: (scope) => scope.setTag('operation', 'pushCustomer'));
      }
      await _outbox.markRetry(item.id, now, e.toString());
    }
  }

  Future<void> _pushSupplier(SyncOutboxItem item) async {
    final dto = SupplierDto.fromJson(
      jsonDecode(item.payloadJson) as Map<String, dynamic>,
    );
    final now = DateTime.now().millisecondsSinceEpoch;
    try {
      SupplierPushResult res;
      if (item.operation == 'create') {
        res = await _api.createSupplier(dto, idempotencyKey: item.idempotencyKey!);
      } else if (item.operation == 'delete') {
        res = await _api.deleteSupplier(dto, idempotencyKey: item.idempotencyKey!);
      } else {
        res = await _api.pushSupplier(dto, ifMatchVersion: dto.serverVersion, idempotencyKey: item.idempotencyKey!);
      }
      if (res.ok) {
        await _outbox.markSynced(item.id);
        await _suppliers.markSyncedAfterPush(
          dto.id,
          res.serverVersion ?? dto.serverVersion,
        );
      } else if (res.error == 'VALIDATION_ERROR' || res.error == 'IDEMPOTENCY_KEY_REUSE' || res.error == 'INSUFFICIENT_PERMISSIONS' || res.error == 'SUPPLIER_ID_CONFLICT') {
        await _outbox.markFailed(item.id, res.error!);
      } else if (res.conflict) {
        await _outbox.markConflict(
          item.id,
          jsonEncode(res.serverState?.toJson() ?? {}),
          res.error ?? 'SUPPLIER_VERSION_CONFLICT',
        );
      } else {
        await _outbox.markRetry(item.id, now, res.error ?? 'unknown');
      }
    } catch (e, st) {
      if (e is HttpException && e.statusCode != null && e.statusCode! >= 500) {
        Sentry.captureException(e, stackTrace: st, withScope: (scope) {
          scope.setTag('operation', 'pushSupplier');
          if (e.requestId != null) scope.setTag('request_id', e.requestId!);
        });
      } else if (e is! HttpException && e is! NetworkException) {
        Sentry.captureException(e, stackTrace: st, withScope: (scope) => scope.setTag('operation', 'pushSupplier'));
      }
      await _outbox.markRetry(item.id, now, e.toString());
    }
  }

  Future<void> _pushPurchase(SyncOutboxItem item) async {
    final dto = PurchaseDto.fromJson(
      jsonDecode(item.payloadJson) as Map<String, dynamic>,
    );
    final now = DateTime.now().millisecondsSinceEpoch;
    try {
      PurchasePushResult res;
      if (item.operation == 'create') {
        res = await _api.createPurchaseDraft(dto, idempotencyKey: item.idempotencyKey!);
      } else {
        res = await _api.updatePurchaseDraft(dto, ifMatchVersion: dto.serverVersion, idempotencyKey: item.idempotencyKey!);
      }
      if (res.ok) {
        await _outbox.markSynced(item.id);
        if (purchases != null) {
          await purchases!.markSyncedAfterPush(
            dto.id,
            res.serverVersion ?? dto.serverVersion,
          );
        }
      } else if (res.conflict) {
        await _outbox.markConflict(
          item.id,
          jsonEncode(res.serverState?.toJson() ?? {}),
          res.error ?? 'PURCHASE_VERSION_CONFLICT',
        );
      } else if (res.error == 'VALIDATION_ERROR') {
        await _outbox.markFailed(item.id, res.error!);
      } else {
        await _outbox.markRetry(item.id, now, res.error ?? 'unknown');
      }
    } catch (e, st) {
      if (e is HttpException && e.statusCode != null && e.statusCode! >= 500) {
        Sentry.captureException(e, stackTrace: st, withScope: (scope) {
          scope.setTag('operation', 'pushPurchase');
          if (e.requestId != null) scope.setTag('request_id', e.requestId!);
        });
      } else if (e is! HttpException && e is! NetworkException) {
        Sentry.captureException(e, stackTrace: st, withScope: (scope) => scope.setTag('operation', 'pushPurchase'));
      }
      await _outbox.markRetry(item.id, now, e.toString());
    }
  }

  Future<(int, int, int, int, int, int)> _pull() async {
    // Pull products (skip local dirty — policy B)
    int pulledP = 0;
    final sinceV = await _products.maxServerVersion(_businessId);
    final pres = await _api.pullProducts(
      businessId: _businessId,
      sinceVersion: sinceV,
    );
    for (final dto in pres.products) {
      if (await _products.applyServerSync(dto, _businessId)) pulledP++;
    }

    // Pull customers (skip local dirty)
    int pulledC = 0;
    final sinceCV = await _customers.maxServerVersion(_businessId);
    final cres = await _api.pullCustomers(
      businessId: _businessId,
      sinceVersion: sinceCV,
    );
    for (final dto in cres.customers) {
      if (await _customers.applyServerSync(dto, _businessId)) pulledC++;
    }

    // Pull suppliers (skip local dirty — policy B)
    int pulledSup = 0;
    final sinceSV = await _suppliers.maxServerVersion(_businessId);
    final sres = await _api.pullSuppliers(
      businessId: _businessId,
      sinceVersion: sinceSV,
    );
    for (final dto in sres.suppliers) {
      if (await _suppliers.applyServerSync(dto, _businessId)) pulledSup++;
    }

    // Pull purchases (skip local dirty — policy B)
    int pulledPur = 0;
    if (purchases != null && branchId != null) {
      final sincePV = await purchases!.maxServerVersion(_businessId, branchId!);
      final purRes = await _api.pullPurchases(
        businessId: _businessId,
        branchId: branchId!,
        sinceVersion: sincePV,
      );
      for (final dto in purRes.purchases) {
        if (await purchases!.applyServerSync(dto, _businessId)) pulledPur++;
      }
    }

    // Pull sales (append-only, never overwrite)
    int pulledS = 0;
    final sinceMs = await _meta.getInt('sales_pull_cursor');
    final salesRes = await _api.pullSales(
      businessId: _businessId,
      sinceMs: sinceMs,
    );
    int maxCursor = sinceMs;
    for (final sale in salesRes.sales) {
      if (await _salesSync.insertIfAbsent(sale, _businessId)) pulledS++;
      final ts = sale.serverCreatedAt ?? sale.clientCreatedAt;
      if (ts > maxCursor) maxCursor = ts;
    }
    await _meta.setInt('sales_pull_cursor', maxCursor);

    // Pull inventory stocks + movements (full pull, server-authoritative)
    int pulledStocks = 0;
    if (stocks != null && branchId != null) {
      final res = await _api.pullStocks(
        businessId: _businessId,
        branchId: branchId!,
      );
      pulledStocks = await stocks!.applyStocksPull(res.items, _businessId, branchId!);

      final movementsRes = await _api.pullStockMovements(
        businessId: _businessId,
        branchId: branchId!,
      );
      await stocks!.applyMovementsPull(movementsRes.items, _businessId, branchId!);
    }

    return (pulledP, pulledC, pulledSup, pulledPur, pulledS, pulledStocks);
  }
}
