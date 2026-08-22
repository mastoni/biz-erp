/// Konstanta sync
const int kMaxSyncAttempts = 10;
const int kBatchSize = 50;

/// Exponential backoff: 1s,2s,4s,8s,16s,32s,64→cap 60s
int backoffMillis(int attempt) {
  final ms = 1000 * (1 << attempt.clamp(0, 6));
  return ms > 60000 ? 60000 : ms;
}

class SyncOutboxItem {
  final String id;
  final String entityType;
  final String operation;
  final String payloadJson;
  final String? idempotencyKey;
  final int attemptCount;
  final int nextAttemptAt;
  final String? lastError;
  final String status;
  final int createdAt;

  const SyncOutboxItem({
    required this.id,
    required this.entityType,
    required this.operation,
    required this.payloadJson,
    this.idempotencyKey,
    required this.attemptCount,
    required this.nextAttemptAt,
    this.lastError,
    required this.status,
    required this.createdAt,
  });
}

class SyncCounts {
  final int pending;
  final int conflict;
  final int failed;
  const SyncCounts(this.pending, this.conflict, this.failed);
}

// ===== DTOs =====

class ProductDto {
  final String id;
  final String name;
  final String? description;
  final String? barcode;
  final int priceMinor;
  final String? category;
  final bool isActive;
  final int serverVersion;
  final int? deletedAt;

  const ProductDto({
    required this.id,
    required this.name,
    this.description,
    this.barcode,
    required this.priceMinor,
    this.category,
    required this.isActive,
    required this.serverVersion,
    this.deletedAt,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'barcode': barcode,
    'price_minor': priceMinor,
    'category': category,
    'is_active': isActive ? 1 : 0,
    'server_version': serverVersion,
    'deleted_at': deletedAt,
  };

  factory ProductDto.fromJson(Map<String, dynamic> j) => ProductDto(
    id: j['id'] as String,
    name: j['name'] as String,
    description: j['description'] as String?,
    barcode: j['barcode'] as String?,
    priceMinor: (j['price_minor'] as num).toInt(),
    category: j['category'] as String?,
    isActive: (j['is_active'] as int) == 1,
    serverVersion: (j['server_version'] as num).toInt(),
    deletedAt: (j['deleted_at'] as num?)?.toInt(),
  );
}

class SaleItemDto {
  final String productId;
  final String productNameSnapshot;
  final int quantity;
  final int unitPriceMinor;
  const SaleItemDto({
    required this.productId,
    required this.productNameSnapshot,
    required this.quantity,
    required this.unitPriceMinor,
  });

  Map<String, dynamic> toJson() => {
    'product_id': productId,
    'product_name_snapshot': productNameSnapshot,
    'quantity': quantity,
    'unit_price_minor': unitPriceMinor,
  };

  factory SaleItemDto.fromJson(Map<String, dynamic> j) => SaleItemDto(
    productId: j['product_id'] as String,
    productNameSnapshot: j['product_name_snapshot'] as String,
    quantity: (j['quantity'] as num).toInt(),
    unitPriceMinor: (j['unit_price_minor'] as num).toInt(),
  );
}

class SaleDto {
  final String id;
  final String idempotencyKey;
  final String receiptNumber;
  final int subtotalMinor;
  final int discountMinor;
  final int taxMinor;
  final int grandTotalMinor;
  final String paymentMethod;
  final int cashReceivedMinor;
  final int changeMinor;
  final String? cashierId;
  final String? customerId;
  final int clientCreatedAt;
  final int? serverCreatedAt;
  final List<SaleItemDto> items;

  const SaleDto({
    required this.id,
    required this.idempotencyKey,
    required this.receiptNumber,
    required this.subtotalMinor,
    required this.discountMinor,
    required this.taxMinor,
    required this.grandTotalMinor,
    required this.paymentMethod,
    required this.cashReceivedMinor,
    required this.changeMinor,
    this.cashierId,
    this.customerId,
    required this.clientCreatedAt,
    this.serverCreatedAt,
    required this.items,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'idempotency_key': idempotencyKey,
    'receipt_number': receiptNumber,
    'subtotal_minor': subtotalMinor,
    'discount_minor': discountMinor,
    'tax_minor': taxMinor,
    'grand_total_minor': grandTotalMinor,
    'payment_method': paymentMethod,
    'cash_received_minor': cashReceivedMinor,
    'change_minor': changeMinor,
    'cashier_id': cashierId,
    'customer_id': customerId,
    'client_created_at': clientCreatedAt,
    'items': items.map((e) => e.toJson()).toList(),
  };

  factory SaleDto.fromJson(Map<String, dynamic> j) => SaleDto(
    id: j['id'] as String,
    idempotencyKey: j['idempotency_key'] as String,
    receiptNumber: j['receipt_number'] as String,
    subtotalMinor: (j['subtotal_minor'] as num).toInt(),
    discountMinor: (j['discount_minor'] as num).toInt(),
    taxMinor: (j['tax_minor'] as num).toInt(),
    grandTotalMinor: (j['grand_total_minor'] as num).toInt(),
    paymentMethod: j['payment_method'] as String,
    cashReceivedMinor: (j['cash_received_minor'] as num).toInt(),
    changeMinor: (j['change_minor'] as num).toInt(),
    cashierId: j['cashier_id'] as String?,
    customerId: j['customer_id'] as String?,
    clientCreatedAt: (j['client_created_at'] as num).toInt(),
    serverCreatedAt: (j['server_created_at'] as num?)?.toInt(),
    items: (j['items'] as List)
        .map((e) => SaleItemDto.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class PullProductsResponse {
  final List<ProductDto> products;
  final bool hasMore;
  final int currentVersion;
  const PullProductsResponse(this.products, this.hasMore, this.currentVersion);
}

class PullSalesResponse {
  final List<SaleDto> sales;
  final bool hasMore;
  const PullSalesResponse(this.sales, this.hasMore);
}

class CustomerDto {
  final String id;
  final String name;
  final String? phone;
  final String? email;
  final bool isActive;
  final int serverVersion;
  final int? deletedAt;

  const CustomerDto({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    required this.isActive,
    required this.serverVersion,
    this.deletedAt,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'phone': phone,
    'email': email,
    'is_active': isActive ? 1 : 0,
    'server_version': serverVersion,
    'deleted_at': deletedAt,
  };

  factory CustomerDto.fromJson(Map<String, dynamic> j) => CustomerDto(
    id: j['id'] as String,
    name: j['name'] as String,
    phone: j['phone'] as String?,
    email: j['email'] as String?,
    isActive: (j['is_active'] as int?) == 1,
    serverVersion: (j['server_version'] as num).toInt(),
    deletedAt: (j['deleted_at'] as num?)?.toInt(),
  );
}

class PullCustomersResponse {
  final List<CustomerDto> customers;
  final bool hasMore;
  final int currentVersion;
  const PullCustomersResponse(this.customers, this.hasMore, this.currentVersion);
}

class ProductPushResult {
  final bool ok;
  final int? serverVersion;
  final bool conflict;
  final ProductDto? serverState;
  final String? error;
  const ProductPushResult({
    this.ok = false,
    this.serverVersion,
    this.conflict = false,
    this.serverState,
    this.error,
  });
}

class SalePushResultItem {
  final String idempotencyKey;
  final String status; // created | duplicate | failed | receipt_conflict
  final String? saleId;
  final String? error;
  final String receiptNumber;
  const SalePushResultItem(
    this.idempotencyKey,
    this.status, {
    this.saleId,
    this.error,
    this.receiptNumber = '',
  });
}

class CustomerPushResult {
  final bool ok;
  final int? serverVersion;
  final bool conflict;
  final CustomerDto? serverState;
  final String? error;
  const CustomerPushResult({
    this.ok = false,
    this.serverVersion,
    this.conflict = false,
    this.serverState,
    this.error,
  });
}
