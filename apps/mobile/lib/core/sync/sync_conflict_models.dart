import 'dart:convert';
import 'sync_models.dart';

class SyncConflictInfo {
  final String outboxId;
  final String entityType;
  final String operation;
  final String? productId;
  final String? productName;
  final int? localServerVersion;
  final int? currentServerVersion;
  final String? lastError;
  final int createdAt;
  final ProductDto? serverProduct;

  const SyncConflictInfo({
    required this.outboxId,
    required this.entityType,
    required this.operation,
    this.productId,
    this.productName,
    this.localServerVersion,
    this.currentServerVersion,
    this.lastError,
    required this.createdAt,
    this.serverProduct,
  });

  static SyncConflictInfo fromOutboxAndLocal(
    SyncOutboxItem outbox,
    dynamic localProduct,
  ) {
    int? currentServerVersion;
    ProductDto? serverProduct;
    try {
      if (outbox.payloadJson.isNotEmpty && outbox.payloadJson != '{}') {
        final payload = jsonDecode(outbox.payloadJson) as Map<String, dynamic>;
        if (payload.containsKey('server_version')) {
          currentServerVersion = payload['server_version'] as int?;
        }
        if (payload.containsKey('id') && payload.containsKey('name')) {
           serverProduct = ProductDto.fromJson(payload);
        }
      }
    } catch (_) {}

    String? productName;
    int? localServerVersion;
    if (localProduct != null) {
      try {
        productName = localProduct.name as String?;
        localServerVersion = localProduct.serverVersion as int?;
      } catch (_) {}
    }

    return SyncConflictInfo(
      outboxId: outbox.id,
      entityType: outbox.entityType,
      operation: outbox.operation,
      productId: outbox.idempotencyKey,
      productName: productName ?? 'Unknown Product',
      localServerVersion: localServerVersion,
      currentServerVersion: currentServerVersion,
      lastError: outbox.lastError,
      createdAt: outbox.createdAt,
      serverProduct: serverProduct,
    );
  }
}
