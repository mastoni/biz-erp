import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'sync_api_client.dart';
import 'sync_meta_repository.dart';
import 'sync_models.dart';
import 'sync_outbox_repository.dart';
import '../../products/data/product_repository.dart';
import '../../sales/data/sales_sync_repository.dart';

class SyncSummary {
  final bool reachable;
  final int pushed;
  final int pulledProducts;
  final int pulledSales;
  final SyncCounts counts;
  const SyncSummary({
    required this.reachable,
    required this.pushed,
    required this.pulledProducts,
    required this.pulledSales,
    required this.counts,
  });
}

class SyncEngine extends ChangeNotifier {
  SyncEngine({
    required SyncOutboxRepository outbox,
    required SyncMetaRepository meta,
    required SyncApiClient api,
    required ProductRepository products,
    required SalesSyncRepository salesSync,
    required String businessId,
  }) : _outbox = outbox,
       _meta = meta,
       _api = api,
       _products = products,
       _salesSync = salesSync,
       _businessId = businessId;

  final SyncOutboxRepository _outbox;
  final SyncMetaRepository _meta;
  final SyncApiClient _api;
  final ProductRepository _products;
  final SalesSyncRepository _salesSync;
  final String _businessId;

  Future<SyncSummary> syncNow() async {
    bool reachable = false;
    int pushed = 0, pulledP = 0, pulledS = 0;
    try {
      reachable = await _api.health();
    } catch (_) {
      reachable = false;
    }

    if (reachable) {
      pushed = await _push();
      final pull = await _pull();
      pulledP = pull.$1;
      pulledS = pull.$2;
    }

    final counts = await _outbox.counts();
    notifyListeners();
    return SyncSummary(
      reachable: reachable,
      pushed: pushed,
      pulledProducts: pulledP,
      pulledSales: pulledS,
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

      for (final item in productItems) {
        await _pushProduct(item);
        pushed++;
      }
      if (saleItems.isNotEmpty) {
        await _pushSales(saleItems);
        pushed += saleItems.length;
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
      } else if (res.error == 'BARCODE_CONFLICT' || res.error == 'VALIDATION_ERROR' || res.error == 'IDEMPOTENCY_KEY_REUSE') {
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
    } catch (e) {
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
        } else {
          await _outbox.markRetry(item.id, now, r.error ?? 'failed');
        }
      }
    } catch (e) {
      for (final item in items) {
        await _outbox.markRetry(item.id, now, e.toString());
      }
    }
  }

  Future<(int, int)> _pull() async {
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

    // Pull sales (append-only, never overwrite)
    int pulledS = 0;
    final sinceMs = await _meta.getInt('sales_pull_cursor');
    final sres = await _api.pullSales(
      businessId: _businessId,
      sinceMs: sinceMs,
    );
    int maxCursor = sinceMs;
    for (final sale in sres.sales) {
      if (await _salesSync.insertIfAbsent(sale, _businessId)) pulledS++;
      final ts = sale.serverCreatedAt ?? sale.clientCreatedAt;
      if (ts > maxCursor) maxCursor = ts;
    }
    await _meta.setInt('sales_pull_cursor', maxCursor);

    return (pulledP, pulledS);
  }
}
