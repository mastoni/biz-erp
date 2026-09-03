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

class BranchDto {
  final String id;
  final String businessId;
  final String name;
  final bool status;
  final String createdAt;
  final String updatedAt;

  const BranchDto({
    required this.id,
    required this.businessId,
    required this.name,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  factory BranchDto.fromJson(Map<String, dynamic> j) => BranchDto(
    id: j['id'] as String,
    businessId: j['business_id'] as String,
    name: j['name'] as String,
    status: j['status'] as bool,
    createdAt: j['created_at'] as String,
    updatedAt: j['updated_at'] as String,
  );
}

class ProductDto {
  final String id;
  final String name;
  final String? description;
  final String? barcode;
  final int priceMinor;
  final int? costMinor;
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
    this.costMinor,
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
    'cost_minor': costMinor,
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
    costMinor: (j['cost_minor'] as num?)?.toInt(),
    category: j['category'] as String?,
    isActive: (j['is_active'] as int) == 1,
    serverVersion: (j['server_version'] as num).toInt(),
    deletedAt: (j['deleted_at'] as num?)?.toInt(),
  );
}

class SaleItemDto {
  final String? productId;
  final String productNameSnapshot;
  final int quantity;
  final int unitPriceMinor;
  const SaleItemDto({
    this.productId,
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
    productId: j['product_id'] as String?,
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
  final String? branchId;
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
    this.branchId,
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
    'branch_id': branchId,
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
    branchId: j['branch_id'] as String?,
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

class PullBranchesResponse {
  final List<BranchDto> branches;
  const PullBranchesResponse(this.branches);
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

class SupplierDto {
  final String id;
  final String name;
  final String? code;
  final String? contact;
  final String? phone;
  final String? email;
  final String category;
  final String term;
  final bool isActive;
  final int serverVersion;
  final int? deletedAt;

  const SupplierDto({
    required this.id,
    required this.name,
    this.code,
    this.contact,
    this.phone,
    this.email,
    required this.category,
    required this.term,
    required this.isActive,
    required this.serverVersion,
    this.deletedAt,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'code': code,
    'contact': contact,
    'phone': phone,
    'email': email,
    'category': category,
    'term': term,
    'is_active': isActive ? 1 : 0,
    'server_version': serverVersion,
    'deleted_at': deletedAt,
  };

  factory SupplierDto.fromJson(Map<String, dynamic> j) => SupplierDto(
    id: j['id'] as String,
    name: j['name'] as String,
    code: j['code'] as String?,
    contact: j['contact'] as String?,
    phone: j['phone'] as String?,
    email: j['email'] as String?,
    category: j['category'] as String? ?? '',
    term: j['term'] as String? ?? 'tunai',
    isActive: (j['is_active'] as int?) == 1,
    serverVersion: (j['server_version'] as num).toInt(),
    deletedAt: (j['deleted_at'] as num?)?.toInt(),
  );
}

class PullSuppliersResponse {
  final List<SupplierDto> suppliers;
  final bool hasMore;
  final int currentVersion;
  const PullSuppliersResponse(this.suppliers, this.hasMore, this.currentVersion);
}

class SupplierPushResult {
  final bool ok;
  final int? serverVersion;
  final bool conflict;
  final SupplierDto? serverState;
  final String? error;
  const SupplierPushResult({
    this.ok = false,
    this.serverVersion,
    this.conflict = false,
    this.serverState,
    this.error,
  });
}

// ---------------------------------------------------------------------------
// Purchase DTOs (Phase 9B.6)
// ---------------------------------------------------------------------------

class PurchaseItemDto {
  final String id;
  final String? purchaseId;
  final String? productId;
  final String productName;
  final int orderedQty;
  final int receivedQty;
  final int unitCostMinor;
  final int subtotalMinor;

  const PurchaseItemDto({
    required this.id,
    this.purchaseId,
    this.productId,
    required this.productName,
    required this.orderedQty,
    this.receivedQty = 0,
    required this.unitCostMinor,
    required this.subtotalMinor,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    if (purchaseId != null) 'purchase_id': purchaseId,
    'product_id': productId,
    'product_name': productName,
    'ordered_qty': orderedQty,
    'received_qty': receivedQty,
    'unit_cost_minor': unitCostMinor,
    'subtotal_minor': subtotalMinor,
  };

  factory PurchaseItemDto.fromJson(Map<String, dynamic> j) => PurchaseItemDto(
    id: j['id'] as String,
    purchaseId: j['purchase_id'] as String?,
    productId: j['product_id'] as String?,
    productName: j['product_name'] as String? ?? 'Item',
    orderedQty: (j['ordered_qty'] as num?)?.toInt() ?? 0,
    receivedQty: (j['received_qty'] as num?)?.toInt() ?? 0,
    unitCostMinor: (j['unit_cost_minor'] as num?)?.toInt() ?? 0,
    subtotalMinor: (j['subtotal_minor'] as num?)?.toInt() ?? 0,
  );
}

class PurchasePaymentDto {
  final String id;
  final String businessId;
  final String purchaseId;
  final int amountMinor;
  final String method;
  final String? reference;
  final String idempotencyKey;
  final String createdAt;

  const PurchasePaymentDto({
    required this.id,
    required this.businessId,
    required this.purchaseId,
    required this.amountMinor,
    required this.method,
    this.reference,
    required this.idempotencyKey,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'business_id': businessId,
    'purchase_id': purchaseId,
    'amount_minor': amountMinor,
    'method': method,
    'reference': reference,
    'idempotency_key': idempotencyKey,
    'created_at': createdAt,
  };

  factory PurchasePaymentDto.fromJson(Map<String, dynamic> j) => PurchasePaymentDto(
    id: j['id'] as String,
    businessId: j['business_id'] as String? ?? '',
    purchaseId: j['purchase_id'] as String? ?? '',
    amountMinor: (j['amount_minor'] as num?)?.toInt() ?? 0,
    method: j['method'] as String? ?? 'cash',
    reference: j['reference'] as String?,
    idempotencyKey: j['idempotency_key'] as String? ?? '',
    createdAt: j['created_at']?.toString() ?? '',
  );
}

class PurchaseDto {
  final String id;
  final String businessId;
  final String branchId;
  final String supplierId;
  final String? supplierName;
  final String? supplierCode;
  final String code;
  final String date;
  final String dueDate;
  final String supplierTerm;
  final String status;
  final int totalMinor;
  final int receivedMinor;
  final int paidMinor;
  final int outstandingMinor;
  final String? note;
  final int serverVersion;
  final int? createdAt;
  final int? updatedAt;
  final int? deletedAt;
  final List<PurchaseItemDto> items;
  final List<PurchasePaymentDto> payments;

  const PurchaseDto({
    required this.id,
    required this.businessId,
    required this.branchId,
    required this.supplierId,
    this.supplierName,
    this.supplierCode,
    required this.code,
    required this.date,
    required this.dueDate,
    required this.supplierTerm,
    required this.status,
    required this.totalMinor,
    this.receivedMinor = 0,
    this.paidMinor = 0,
    this.outstandingMinor = 0,
    this.note,
    required this.serverVersion,
    this.createdAt,
    this.updatedAt,
    this.deletedAt,
    this.items = const [],
    this.payments = const [],
  });

  static int? _parseTimestamp(dynamic val) {
    if (val == null) return null;
    if (val is num) return val.toInt();
    if (val is String) {
      final parsed = DateTime.tryParse(val);
      if (parsed != null) return parsed.millisecondsSinceEpoch;
    }
    return null;
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'business_id': businessId,
    'branch_id': branchId,
    'supplier_id': supplierId,
    'supplier_name': supplierName,
    'supplier_code': supplierCode,
    'code': code,
    'date': date,
    'due_date': dueDate,
    'supplier_term': supplierTerm,
    'status': status,
    'total_minor': totalMinor,
    'received_minor': receivedMinor,
    'paid_minor': paidMinor,
    'outstanding_minor': outstandingMinor,
    'note': note,
    'server_version': serverVersion,
    'created_at': createdAt,
    'updated_at': updatedAt,
    'deleted_at': deletedAt,
    'items': items.map((e) => e.toJson()).toList(),
    'payments': payments.map((e) => e.toJson()).toList(),
  };

  factory PurchaseDto.fromJson(Map<String, dynamic> j) => PurchaseDto(
    id: j['id'] as String,
    businessId: j['business_id'] as String? ?? '',
    branchId: j['branch_id'] as String? ?? '',
    supplierId: j['supplier_id'] as String? ?? '',
    supplierName: j['supplier_name'] as String?,
    supplierCode: j['supplier_code'] as String?,
    code: j['code'] as String? ?? '',
    date: j['date'] as String? ?? '',
    dueDate: j['due_date'] as String? ?? '',
    supplierTerm: j['supplier_term'] as String? ?? 'Tunai',
    status: j['status'] as String? ?? 'draft',
    totalMinor: (j['total_minor'] as num?)?.toInt() ?? 0,
    receivedMinor: (j['received_minor'] as num?)?.toInt() ?? 0,
    paidMinor: (j['paid_minor'] as num?)?.toInt() ?? 0,
    outstandingMinor: (j['outstanding_minor'] as num?)?.toInt() ?? 0,
    note: j['note'] as String?,
    serverVersion: (j['server_version'] as num?)?.toInt() ?? 1,
    createdAt: _parseTimestamp(j['created_at']),
    updatedAt: _parseTimestamp(j['updated_at']),
    deletedAt: _parseTimestamp(j['deleted_at']),
    items: (j['items'] as List?)
            ?.map((e) => PurchaseItemDto.fromJson(e as Map<String, dynamic>))
            .toList() ??
        const [],
    payments: (j['payments'] as List?)
            ?.map((e) => PurchasePaymentDto.fromJson(e as Map<String, dynamic>))
            .toList() ??
        const [],
  );
}

class PullPurchasesResponse {
  final List<PurchaseDto> purchases;
  final bool hasMore;
  final int currentVersion;
  const PullPurchasesResponse(this.purchases, this.hasMore, this.currentVersion);
}

class PurchasePushResult {
  final bool ok;
  final int? serverVersion;
  final bool conflict;
  final PurchaseDto? serverState;
  final String? error;
  const PurchasePushResult({
    this.ok = false,
    this.serverVersion,
    this.conflict = false,
    this.serverState,
    this.error,
  });
}

// ---------------------------------------------------------------------------
// Inventory DTOs (reusing backend Inventory API)
// ---------------------------------------------------------------------------

int? _parseTs(dynamic val) {
  if (val == null) return null;
  if (val is num) return val.toInt();
  if (val is String) {
    final parsed = DateTime.tryParse(val);
    if (parsed != null) return parsed.millisecondsSinceEpoch;
  }
  return null;
}

/// Mirrors backend StockDto (single stock query: /v1/inventory/stock).
class StockDto {
  final String? id;
  final String? businessId;
  final String? branchId;
  final String productId;
  final int quantity;
  final int serverVersion;
  final int? createdAt;
  final int? updatedAt;

  const StockDto({
    this.id,
    this.businessId,
    this.branchId,
    required this.productId,
    required this.quantity,
    required this.serverVersion,
    this.createdAt,
    this.updatedAt,
  });

  factory StockDto.fromJson(Map<String, dynamic> j) => StockDto(
        id: j['id'] as String?,
        businessId: j['business_id'] as String?,
        branchId: j['branch_id'] as String?,
        productId: j['product_id'] as String? ?? '',
        quantity: (j['quantity'] as num?)?.toInt() ?? 0,
        serverVersion: (j['server_version'] as num?)?.toInt() ?? 0,
        createdAt: _parseTs(j['created_at']),
        updatedAt: _parseTs(j['updated_at']),
      );
}

/// Mirrors backend StockWithProductDto (list endpoint: /v1/inventory/stocks).
class StockWithProductDto {
  final String id;
  final String businessId;
  final String branchId;
  final String productId;
  final String productName;
  final String? sku;
  final String? category;
  final String? barcode;
  final int priceMinor;
  final int? costMinor;
  final int quantity;
  final int serverVersion;
  final int? createdAt;
  final int? updatedAt;

  const StockWithProductDto({
    required this.id,
    required this.businessId,
    required this.branchId,
    required this.productId,
    required this.productName,
    this.sku,
    this.category,
    this.barcode,
    required this.priceMinor,
    this.costMinor,
    required this.quantity,
    required this.serverVersion,
    this.createdAt,
    this.updatedAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'business_id': businessId,
        'branch_id': branchId,
        'product_id': productId,
        'product_name': productName,
        'sku': sku,
        'category': category,
        'barcode': barcode,
        'price_minor': priceMinor,
        'cost_minor': costMinor,
        'quantity': quantity,
        'server_version': serverVersion,
        'created_at': createdAt,
        'updated_at': updatedAt,
      };

  factory StockWithProductDto.fromJson(Map<String, dynamic> j) => StockWithProductDto(
        id: j['id'] as String? ?? '',
        businessId: j['business_id'] as String? ?? '',
        branchId: j['branch_id'] as String? ?? '',
        productId: j['product_id'] as String? ?? '',
        productName: j['product_name'] as String? ?? '',
        sku: j['sku'] as String?,
        category: j['category'] as String?,
        barcode: j['barcode'] as String?,
        priceMinor: (j['price_minor'] as num?)?.toInt() ?? 0,
        costMinor: (j['cost_minor'] as num?)?.toInt(),
        quantity: (j['quantity'] as num?)?.toInt() ?? 0,
        serverVersion: (j['server_version'] as num?)?.toInt() ?? 0,
        createdAt: _parseTs(j['created_at']),
        updatedAt: _parseTs(j['updated_at']),
      );
}

/// Mirrors backend StockMovementDto (GET /v1/inventory/movements).
class StockMovementDto {
  final String id;
  final String businessId;
  final String branchId;
  final String productId;
  final int quantity;
  final String movementType;
  final String? reference;
  final String actor;
  final int? timestamp;

  const StockMovementDto({
    required this.id,
    required this.businessId,
    required this.branchId,
    required this.productId,
    required this.quantity,
    required this.movementType,
    this.reference,
    required this.actor,
    this.timestamp,
  });

  factory StockMovementDto.fromJson(Map<String, dynamic> j) => StockMovementDto(
        id: j['id'] as String? ?? '',
        businessId: j['business_id'] as String? ?? '',
        branchId: j['branch_id'] as String? ?? '',
        productId: j['product_id'] as String? ?? '',
        quantity: (j['quantity'] as num?)?.toInt() ?? 0,
        movementType: j['movement_type'] as String? ?? '',
        reference: j['reference'] as String?,
        actor: j['actor'] as String? ?? '',
        timestamp: _parseTs(j['timestamp']),
      );
}

/// Mirrors backend StockMovementPaginatedResponse.
class StockMovementPaginatedResponse {
  final List<StockMovementDto> items;
  final int total;
  final int limit;
  final int offset;
  final bool hasMore;

  const StockMovementPaginatedResponse({
    required this.items,
    required this.total,
    required this.limit,
    final int? offset,
    required this.hasMore,
  }) : offset = offset ?? 0;

  factory StockMovementPaginatedResponse.fromJson(Map<String, dynamic> j) =>
      StockMovementPaginatedResponse(
        items: (j['items'] as List? ?? [])
            .map((e) => StockMovementDto.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: (j['total'] as num?)?.toInt() ?? 0,
        limit: (j['limit'] as num?)?.toInt() ?? 50,
        offset: (j['offset'] as num?)?.toInt() ?? 0,
        hasMore: j['has_more'] as bool? ?? false,
      );
}

/// Mirrors backend StockSummaryDto (GET /v1/inventory/summary).
class StockSummaryDto {
  final int totalStockValueMinor;
  final int lowStockCount;
  final int outOfStockCount;
  final int totalSkus;

  const StockSummaryDto({
    required this.totalStockValueMinor,
    required this.lowStockCount,
    required this.outOfStockCount,
    required this.totalSkus,
  });

  factory StockSummaryDto.fromJson(Map<String, dynamic> j) => StockSummaryDto(
        totalStockValueMinor: (j['total_stock_value_minor'] as num?)?.toInt() ?? 0,
        lowStockCount: (j['low_stock_count'] as num?)?.toInt() ?? 0,
        outOfStockCount: (j['out_of_stock_count'] as num?)?.toInt() ?? 0,
        totalSkus: (j['total_skus'] as num?)?.toInt() ?? 0,
      );
}

/// Mirrors backend StockAdjustmentRequest (POST /v1/inventory/adjustment).
class StockAdjustmentRequest {
  final String businessId;
  final String branchId;
  final String productId;
  final int quantityChange;
  final int expectedServerVersion;
  final String? reference;
  final String? movementType;

  const StockAdjustmentRequest({
    required this.businessId,
    required this.branchId,
    required this.productId,
    required this.quantityChange,
    required this.expectedServerVersion,
    this.reference,
    this.movementType,
  });

  Map<String, dynamic> toJson() => {
        'business_id': businessId,
        'branch_id': branchId,
        'product_id': productId,
        'quantity_change': quantityChange,
        'expected_server_version': expectedServerVersion,
        if (reference != null) 'reference': reference,
        if (movementType != null) 'movement_type': movementType,
      };
}

/// Result of POST /v1/inventory/adjustment.
class StockAdjustmentResult {
  final bool ok;
  final bool conflict;
  final String? error;
  final StockDto? stock;
  final StockMovementDto? movement;

  const StockAdjustmentResult({
    this.ok = false,
    this.conflict = false,
    this.error,
    this.stock,
    this.movement,
  });
}

/// Response wrapper for GET /v1/inventory/stocks.
class PullStocksResponse {
  final List<StockWithProductDto> items;
  final bool hasMore;

  const PullStocksResponse(this.items, this.hasMore);

  factory PullStocksResponse.fromJson(Map<String, dynamic> j) => PullStocksResponse(
        (j['items'] as List? ?? [])
            .map((e) => StockWithProductDto.fromJson(e as Map<String, dynamic>))
            .toList(),
        j['has_more'] as bool? ?? false,
      );
}

