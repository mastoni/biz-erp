// apps/mobile/lib/core/sync/http_sync_api_client.dart

import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'sync_api_client.dart';
import 'sync_models.dart';
import 'store_settings_models.dart';

import '../auth/auth_models.dart';

typedef TokenProvider = String? Function();
typedef RefreshCallback = Future<RefreshResult> Function();

class HttpSyncApiClient implements SyncApiClient {
  final String baseUrl;
  final http.Client _client;
  final Duration _timeout;
  final String? _businessId;
  final TokenProvider? _tokenProvider;
  final RefreshCallback? _onRefresh;

  HttpSyncApiClient({
    required this.baseUrl,
    http.Client? client,
    this._timeout = const Duration(seconds: 30),
    this._businessId,
    this._tokenProvider,
    this._onRefresh,
  }) : _client = client ?? http.Client();

  Map<String, String> get _headers {
    final token = _tokenProvider?.call();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  @override
  Future<bool> health() async {
    try {
      final response = await _client
          .get(Uri.parse('$baseUrl/health'), headers: _headers)
          .timeout(const Duration(seconds: 5));

      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  @override
  Future<PullProductsResponse> pullProducts({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async {
    final uri = Uri.parse('$baseUrl/v1/sync/products').replace(
      queryParameters: {
        'business_id': businessId,
        'after_version': sinceVersion.toString(),
        'limit': limit.clamp(1, 500).toString(),
      },
    );

    http.Response? response;
    for (int attempt = 1; attempt <= 2; attempt++) {
      response = await _client
          .get(uri, headers: _headers)
          .timeout(_timeout);

      if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
        final result = await _onRefresh();
        if (result == RefreshResult.success) {
          continue; // retry
        } else {
          break; // do not retry
        }
      }
      break; // exit loop if not 401 or attempt > 1
    }

    if (response!.statusCode != 200) {
      throw HttpException(
        'Failed to pull products: HTTP ${response.statusCode}',
        statusCode: response.statusCode,
        requestId: response.headers['x-request-id'],
      );
    }

    try {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      final items = json['items'] as List? ?? [];
      final hasMore = json['has_more'] as bool? ?? false;
      final currentVersion = json['current_version'] as int? ?? 0;

      final products = items
          .map((item) => _parseProductDto(item as Map<String, dynamic>))
          .toList();

      return PullProductsResponse(products, hasMore, currentVersion);
    } catch (e) {
      throw MalformedResponseException(
        'Failed to parse pull products response',
        e,
      );
    }
  }

  @override
  Future<PullBranchesResponse> pullBranches({
    required String businessId,
  }) async {
    final uri = Uri.parse('$baseUrl/v1/branches').replace(
      queryParameters: {
        'business_id': businessId,
      },
    );

    http.Response? response;
    for (int attempt = 1; attempt <= 2; attempt++) {
      response = await _client
          .get(uri, headers: _headers)
          .timeout(_timeout);

      if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
        final result = await _onRefresh();
        if (result == RefreshResult.success) {
          continue; // retry
        } else {
          break; // do not retry
        }
      }
      break; // exit loop if not 401 or attempt > 1
    }

    if (response!.statusCode != 200) {
      throw HttpException(
        'Failed to pull branches: HTTP ${response.statusCode}',
        statusCode: response.statusCode,
        requestId: response.headers['x-request-id'],
      );
    }

    try {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      final items = json['items'] as List? ?? [];

      final branches = items
          .map((item) => BranchDto.fromJson(item as Map<String, dynamic>))
          .toList();

      return PullBranchesResponse(branches);
    } catch (e) {
      throw MalformedResponseException(
        'Failed to parse pull branches response',
        e,
      );
    }
  }

  @override
  Future<StoreSettingsDto?> getStoreSettings({
    required String businessId,
    required String branchId,
  }) async {
    final uri = Uri.parse('$baseUrl/v1/settings/store').replace(
      queryParameters: {
        'business_id': businessId,
        'branch_id': branchId,
      },
    );

    http.Response? response;
    for (int attempt = 1; attempt <= 2; attempt++) {
      response = await _client
          .get(uri, headers: _headers)
          .timeout(_timeout);

      if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
        final result = await _onRefresh();
        if (result == RefreshResult.success) {
          continue;
        }
        break;
      }
      break;
    }

    if (response!.statusCode == 404) {
      return null;
    }

    if (response.statusCode != 200) {
      throw HttpException(
        'Failed to get store settings: HTTP ${response.statusCode}',
        statusCode: response.statusCode,
        requestId: response.headers['x-request-id'],
      );
    }

    try {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      return StoreSettingsDto.fromJson(json);
    } catch (e) {
      throw MalformedResponseException(
        'Failed to parse store settings response',
        e,
      );
    }
  }

  @override
  Future<PullCustomersResponse> pullCustomers({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async {
    final uri = Uri.parse('$baseUrl/v1/sync/customers').replace(
      queryParameters: {
        'business_id': businessId,
        'after_version': sinceVersion.toString(),
        'limit': limit.clamp(1, 500).toString(),
      },
    );

    http.Response? response;
    for (int attempt = 1; attempt <= 2; attempt++) {
      response = await _client
          .get(uri, headers: _headers)
          .timeout(_timeout);

      if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
        final result = await _onRefresh();
        if (result == RefreshResult.success) {
          continue; // retry
        } else {
          break; // do not retry
        }
      }
      break; // exit loop if not 401 or attempt > 1
    }

    if (response!.statusCode != 200) {
      throw HttpException(
        'Failed to pull customers: HTTP ${response.statusCode}',
        statusCode: response.statusCode,
        requestId: response.headers['x-request-id'],
      );
    }

    try {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      final items = json['items'] as List? ?? [];
      final hasMore = json['has_more'] as bool? ?? false;
      final currentVersion = json['current_version'] as int? ?? 0;

      final customers = items
          .map((item) => CustomerDto.fromJson(item as Map<String, dynamic>))
          .toList();

      return PullCustomersResponse(customers, hasMore, currentVersion);
    } catch (e) {
      throw MalformedResponseException(
        'Failed to parse pull customers response',
        e,
      );
    }
  }

  @override
  Future<PullSuppliersResponse> pullSuppliers({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  }) async {
    final uri = Uri.parse('$baseUrl/v1/sync/suppliers').replace(
      queryParameters: {
        'business_id': businessId,
        'after_version': sinceVersion.toString(),
        'limit': limit.clamp(1, 500).toString(),
      },
    );

    http.Response? response;
    for (int attempt = 1; attempt <= 2; attempt++) {
      response = await _client
          .get(uri, headers: _headers)
          .timeout(_timeout);

      if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
        final result = await _onRefresh();
        if (result == RefreshResult.success) {
          continue;
        } else {
          break;
        }
      }
      break;
    }

    if (response!.statusCode != 200) {
      throw HttpException(
        'Failed to pull suppliers: HTTP ${response.statusCode}',
        statusCode: response.statusCode,
        requestId: response.headers['x-request-id'],
      );
    }

    try {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      final items = json['items'] as List? ?? [];
      final hasMore = json['has_more'] as bool? ?? false;
      final currentVersion = json['current_version'] as int? ?? 0;

      final suppliers = items
          .map((item) => SupplierDto.fromJson(item as Map<String, dynamic>))
          .toList();

      return PullSuppliersResponse(suppliers, hasMore, currentVersion);
    } catch (e) {
      throw MalformedResponseException(
        'Failed to parse pull suppliers response',
        e,
      );
    }
  }

  @override
  Future<PullSalesResponse> pullSales({
    required String businessId,
    required int sinceMs,
    int limit = 100,
  }) async {
    final uri = Uri.parse('$baseUrl/v1/sync/sales').replace(
      queryParameters: {
        'business_id': businessId,
        'since': sinceMs.toString(),
        'limit': limit.clamp(1, 500).toString(),
      },
    );

    http.Response? response;
    for (int attempt = 1; attempt <= 2; attempt++) {
      response = await _client
          .get(uri, headers: _headers)
          .timeout(_timeout);

      if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
        final result = await _onRefresh();
        if (result == RefreshResult.success) {
          continue;
        } else {
          break;
        }
      }
      break;
    }

    if (response!.statusCode != 200) {
      throw HttpException(
        'Failed to pull sales: HTTP ${response.statusCode}',
        statusCode: response.statusCode,
        requestId: response.headers['x-request-id'],
      );
    }

    try {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      final sales = (json['sales'] as List? ?? [])
          .map((item) => SaleDto.fromJson(item as Map<String, dynamic>))
          .toList();
      final hasMore = json['has_more'] as bool? ?? false;

      return PullSalesResponse(sales, hasMore);
    } catch (e) {
      throw MalformedResponseException(
        'Failed to parse pull sales response',
        e,
      );
    }
  }

  @override
  Future<ProductPushResult> pushProduct(
    ProductDto product, {
    int? ifMatchVersion,
  }) async {
    final uri = Uri.parse('$baseUrl/v1/sync/products/${product.id}');
    final body = {
      'business_id': _businessId ?? '',
      'id': product.id,
      'name': product.name,
      'description': product.description,
      'barcode': product.barcode,
      'price_minor': product.priceMinor,
      'category': product.category,
      'is_active': product.isActive,
      'expected_server_version': ifMatchVersion ?? product.serverVersion,
    };

    try {
      http.Response? response;
      for (int attempt = 1; attempt <= 2; attempt++) {
        response = await _client
            .put(uri, headers: _headers, body: jsonEncode(body))
            .timeout(_timeout);

        if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
          final result = await _onRefresh();
          if (result == RefreshResult.success) {
            continue;
          } else {
            break;
          }
        }
        break;
      }

      if (response!.statusCode == 200 || response.statusCode == 201) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return ProductPushResult(
          ok: true,
          serverVersion: json['server_version'] as int?,
        );
      } else if (response.statusCode == 409) {
        // VERSION_CONFLICT
        try {
          final json = jsonDecode(response.body) as Map<String, dynamic>;
          final errorObj = json['error'] as Map<String, dynamic>?;
          final code = errorObj?['code'] as String? ?? 'VERSION_CONFLICT';
          final details = errorObj?['details'] as Map<String, dynamic>?;
          final currentProduct = details?['current_product'] as Map<String, dynamic>?;

          final serverState = currentProduct != null
              ? _parseProductDto(currentProduct)
              : null;

          return ProductPushResult(
            ok: false,
            conflict: true,
            serverState: serverState,
            error: code,
          );
        } catch (e) {
          return ProductPushResult(
            ok: false,
            conflict: true,
            error: 'VERSION_CONFLICT (malformed response)',
          );
        }
      } else if (response.statusCode == 422) {
        // Validation error
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return ProductPushResult(
          ok: false,
          error: json['error'] as String? ?? 'Validation error',
        );
      } else if (response.statusCode >= 500) {
        if (response.statusCode == 404 || response.statusCode == 401) {
          return ProductPushResult(ok: false, error: 'HTTP ${response.statusCode}');
        }
        if (response.statusCode == 403) {
          return ProductPushResult(ok: false, error: 'INSUFFICIENT_PERMISSIONS');
        }
      throw HttpException(
          'Server error: HTTP ${response.statusCode}',
          statusCode: response.statusCode,
          requestId: response.headers['x-request-id'],
        );
      } else if (response.statusCode == 404 || response.statusCode == 401) {
        return ProductPushResult(ok: false, error: 'HTTP ${response.statusCode}');
      } else if (response.statusCode == 403) {
        return ProductPushResult(ok: false, error: 'INSUFFICIENT_PERMISSIONS');
      } else {
        throw HttpException(
          'Unexpected error: HTTP ${response.statusCode}',
          statusCode: response.statusCode,
          requestId: response.headers['x-request-id'],
        );
      }
    } catch (e) {
      if (e is HttpException || e is MalformedResponseException) {
        rethrow;
      }
      throw NetworkException('Network error during push product', e);
    }
  }

  @override
  Future<ProductPushResult> createProduct(ProductDto product, {required String idempotencyKey}) async {
    final uri = Uri.parse('$baseUrl/v1/sync/products');
    final body = { 'business_id': _businessId ?? '', 'id': product.id, 'name': product.name, 'description': product.description, 'barcode': product.barcode, 'price_minor': product.priceMinor, 'category': product.category, 'is_active': product.isActive };
    try {
      http.Response? response;
      for (int attempt = 1; attempt <= 2; attempt++) {
        response = await _client.post(uri, headers: {..._headers, 'Idempotency-Key': idempotencyKey}, body: jsonEncode(body)).timeout(_timeout);

        if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
          final result = await _onRefresh();
          if (result == RefreshResult.success) {
            continue;
          } else {
            break;
          }
        }
        break;
      }
      
      if (response!.statusCode == 201) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return ProductPushResult(ok: true, serverVersion: json['server_version'] as int?);
      } else if (response.statusCode == 409) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final code = (json['error'] as Map<String, dynamic>?)?['code'] as String?;
        if (code == 'BARCODE_CONFLICT' || code == 'IDEMPOTENCY_KEY_REUSE') return ProductPushResult(ok: false, error: code);
        return ProductPushResult(ok: false, conflict: true, error: code ?? 'VERSION_CONFLICT');
      } else if (response.statusCode == 400) {
        return ProductPushResult(ok: false, error: 'VALIDATION_ERROR');
      } else if (response.statusCode == 403) {
        return ProductPushResult(ok: false, error: 'INSUFFICIENT_PERMISSIONS');
      }
      return ProductPushResult(ok: false, error: 'HTTP ${response.statusCode}');
    } catch (e) {
      return ProductPushResult(ok: false, error: e.toString());
    }
  }

  @override
  Future<List<SalePushResultItem>> pushSalesBatch(List<SaleDto> sales) async {
    if (sales.isEmpty) return [];

    final uri = Uri.parse('$baseUrl/v1/sync/sales/batch');
    final body = {
      'business_id': _businessId ?? '',
      'items': sales.map(_saleDtoToBatchItem).toList(),
    };

    try {
      http.Response? response;
      for (int attempt = 1; attempt <= 2; attempt++) {
        response = await _client
            .post(uri, headers: _headers, body: jsonEncode(body))
            .timeout(_timeout);

        if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
          final result = await _onRefresh();
          if (result == RefreshResult.success) {
            continue;
          } else {
            break;
          }
        }
        break;
      }

      if (response!.statusCode == 200 || response.statusCode == 207) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final results = json['results'] as List? ?? [];

        return results.map((item) {
          final map = item as Map<String, dynamic>;
          final status = map['status'] as String;

          // Map both 'created' and 'replayed' to success
          final isSuccess = status == 'created' || status == 'replayed';

          return SalePushResultItem(
            map['idempotency_key'] as String,
            isSuccess ? 'created' : status,
            saleId: map['sale_id'] as String?,
            error: isSuccess ? null : (map['error'] as String?),
          );
        }).toList();
      } else if (response.statusCode >= 500) {
        throw HttpException(
          'Server error: HTTP ${response.statusCode}',
          statusCode: response.statusCode,
          requestId: response.headers['x-request-id'],
        );
      } else {
        throw HttpException(
          'Unexpected error: HTTP ${response.statusCode}',
          statusCode: response.statusCode,
          requestId: response.headers['x-request-id'],
        );
      }
    } catch (e) {
      if (e is HttpException || e is MalformedResponseException) {
        rethrow;
      }
      throw NetworkException('Network error during push sales batch', e);
    }
  }

  ProductDto _parseProductDto(Map<String, dynamic> json) {
    // Handle is_active as both boolean and integer
    final isActiveRaw = json['is_active'];
    final isActive = isActiveRaw is bool
        ? isActiveRaw
        : (isActiveRaw is int ? isActiveRaw == 1 : false);

    return ProductDto(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      barcode: json['barcode'] as String?,
      priceMinor: json['price_minor'] as int,
      category: json['category'] as String?,
      isActive: isActive,
      serverVersion: json['server_version'] as int,
    );
  }

  String _computeSaleRequestHash(SaleDto sale) {
    final itemStrs = sale.items.map((item) {
      return '${item.productId}|${item.productNameSnapshot}|${item.quantity}|${item.unitPriceMinor}';
    }).join(',');
    final hashStr = '${sale.idempotencyKey}|${sale.receiptNumber}|${sale.subtotalMinor}|${sale.discountMinor}|${sale.taxMinor}|${sale.grandTotalMinor}|${sale.paymentMethod}|${sale.cashReceivedMinor}|${sale.changeMinor}|${sale.cashierId ?? ''}|${sale.customerId ?? ''}|${sale.clientCreatedAt}|$itemStrs';
    final bytes = sha256.convert(utf8.encode(hashStr));
    return bytes.toString();
  }

Map<String, dynamic> _saleDtoToBatchItem(SaleDto sale) {
    final items = sale.items.map((item) {
      return {
        'product_id': item.productId,
        'product_name': item.productNameSnapshot,
        'quantity': item.quantity,
        'unit_price_minor': item.unitPriceMinor,
        'subtotal_minor': item.quantity * item.unitPriceMinor,
      };
    }).toList();

    final salePayload = {
      'id': sale.id,
      'receipt_number': sale.receiptNumber,
      'subtotal_minor': sale.subtotalMinor,
      'discount_minor': sale.discountMinor,
      'tax_minor': sale.taxMinor,
      'total_minor': sale.grandTotalMinor,
      'payment_method': sale.paymentMethod,
      'paid_minor': sale.cashReceivedMinor,
      'change_minor': sale.changeMinor,
      'cashier_id': sale.cashierId,
      'customer_id': sale.customerId,
      'branch_id': sale.branchId,
      'created_at': DateTime.fromMillisecondsSinceEpoch(sale.clientCreatedAt, isUtc: true).toIso8601String(),
      'client_created_at': DateTime.fromMillisecondsSinceEpoch(sale.clientCreatedAt, isUtc: true).toIso8601String(),
    };

    return {
      'idempotency_key': sale.idempotencyKey,
      'request_hash': _computeSaleRequestHash(sale),
      'sale': salePayload,
      'sale_items': items,
    };
  }

  @override
  Future<CustomerPushResult> pushCustomer(
    CustomerDto customer, {
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async {
    final uri = Uri.parse('$baseUrl/v1/customers/${customer.id}');
    final body = {
      'business_id': _businessId ?? '',
      'expected_server_version': ifMatchVersion ?? customer.serverVersion,
      'name': customer.name,
      'phone': customer.phone,
      'email': customer.email,
    };

    try {
      http.Response? response;
      for (int attempt = 1; attempt <= 2; attempt++) {
        response = await _client
            .put(uri, headers: {..._headers, 'Idempotency-Key': idempotencyKey}, body: jsonEncode(body))
            .timeout(_timeout);

        if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
          final result = await _onRefresh();
          if (result == RefreshResult.success) {
            continue;
          } else {
            break;
          }
        }
        break;
      }

      if (response!.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return CustomerPushResult(
          ok: true,
          serverVersion: json['server_version'] as int?,
        );
      } else if (response.statusCode == 409) {
        // VERSION_CONFLICT
        try {
          final json = jsonDecode(response.body) as Map<String, dynamic>;
          final errorObj = json['error'] as Map<String, dynamic>?;
          final code = errorObj?['code'] as String? ?? 'CUSTOMER_VERSION_CONFLICT';
          final details = errorObj?['details'] as Map<String, dynamic>?;
          final currentCustomer = details?['current_customer'] as Map<String, dynamic>?;

          final serverState = currentCustomer != null
              ? CustomerDto.fromJson(currentCustomer)
              : null;

          return CustomerPushResult(
            ok: false,
            conflict: true,
            serverState: serverState,
            error: code,
          );
        } catch (e) {
          return CustomerPushResult(
            ok: false,
            conflict: true,
            error: 'CUSTOMER_VERSION_CONFLICT (malformed response)',
          );
        }
      } else if (response.statusCode == 400) {
        // Validation error
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return CustomerPushResult(
          ok: false,
          error: json['error'] as String? ?? 'Validation error',
        );
      } else if (response.statusCode == 403) {
        return CustomerPushResult(ok: false, error: 'INSUFFICIENT_PERMISSIONS');
      } else if (response.statusCode == 404) {
        return CustomerPushResult(ok: false, error: 'NOT_FOUND');
      } else if (response.statusCode >= 500) {
        throw HttpException(
          'Server error: HTTP ${response.statusCode}',
          statusCode: response.statusCode,
          requestId: response.headers['x-request-id'],
        );
      } else {
        throw HttpException(
          'Unexpected error: HTTP ${response.statusCode}',
          statusCode: response.statusCode,
          requestId: response.headers['x-request-id'],
        );
      }
    } catch (e) {
      if (e is HttpException || e is MalformedResponseException) {
        rethrow;
      }
      throw NetworkException('Network error during push customer', e);
    }
  }

  @override
  Future<CustomerPushResult> createCustomer(CustomerDto customer, {required String idempotencyKey}) async {
    final uri = Uri.parse('$baseUrl/v1/customers');
    final body = {
      'business_id': _businessId ?? '',
      'id': customer.id,
      'name': customer.name,
      'phone': customer.phone,
      'email': customer.email,
    };
    try {
      http.Response? response;
      for (int attempt = 1; attempt <= 2; attempt++) {
        response = await _client.post(uri, headers: {..._headers, 'Idempotency-Key': idempotencyKey}, body: jsonEncode(body)).timeout(_timeout);

        if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
          final result = await _onRefresh();
          if (result == RefreshResult.success) {
            continue;
          } else {
            break;
          }
        }
        break;
      }

      if (response!.statusCode == 201) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return CustomerPushResult(ok: true, serverVersion: json['server_version'] as int?);
      } else if (response.statusCode == 409) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final code = (json['error'] as Map<String, dynamic>?)?['code'] as String?;
        if (code == 'CUSTOMER_ID_CONFLICT' || code == 'IDEMPOTENCY_KEY_REUSE') return CustomerPushResult(ok: false, error: code);
        return CustomerPushResult(ok: false, conflict: true, error: code ?? 'VERSION_CONFLICT');
      } else if (response.statusCode == 400) {
        return CustomerPushResult(ok: false, error: 'VALIDATION_ERROR');
      } else if (response.statusCode == 403) {
        return CustomerPushResult(ok: false, error: 'INSUFFICIENT_PERMISSIONS');
      }
      return CustomerPushResult(ok: false, error: 'HTTP ${response.statusCode}');
    } catch (e) {
      return CustomerPushResult(ok: false, error: e.toString());
    }
  }

  @override
  Future<CustomerPushResult> deleteCustomer(CustomerDto customer, {required String idempotencyKey}) async {
    final uri = Uri.parse('$baseUrl/v1/customers/${customer.id}');
    try {
      http.Response? response;
      for (int attempt = 1; attempt <= 2; attempt++) {
        response = await _client.delete(uri, headers: {..._headers, 'Idempotency-Key': idempotencyKey}).timeout(_timeout);

        if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
          final result = await _onRefresh();
          if (result == RefreshResult.success) {
            continue;
          } else {
            break;
          }
        }
        break;
      }

      if (response!.statusCode == 204) {
        return CustomerPushResult(ok: true, serverVersion: customer.serverVersion + 1);
      } else if (response.statusCode == 404) {
        // Already deleted - treat as success (idempotent)
        return CustomerPushResult(ok: true, serverVersion: customer.serverVersion + 1);
      } else if (response.statusCode == 409) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final code = (json['error'] as Map<String, dynamic>?)?['code'] as String?;
        if (code == 'IDEMPOTENCY_KEY_REUSE') return CustomerPushResult(ok: false, error: code);
        return CustomerPushResult(ok: false, conflict: true, error: code ?? 'VERSION_CONFLICT');
      } else if (response.statusCode == 403) {
        return CustomerPushResult(ok: false, error: 'INSUFFICIENT_PERMISSIONS');
      }
      return CustomerPushResult(ok: false, error: 'HTTP ${response.statusCode}');
    } catch (e) {
      return CustomerPushResult(ok: false, error: e.toString());
    }
  }

  @override
  Future<SupplierPushResult> pushSupplier(
    SupplierDto supplier, {
    int? ifMatchVersion,
    required String idempotencyKey,
  }) async {
    final uri = Uri.parse('$baseUrl/v1/sync/suppliers/${supplier.id}');
    final body = {
      'business_id': _businessId ?? '',
      'expected_server_version': ifMatchVersion ?? supplier.serverVersion,
      'name': supplier.name,
      'code': supplier.code,
      'contact': supplier.contact,
      'phone': supplier.phone,
      'email': supplier.email,
      'category': supplier.category,
      'term': supplier.term,
      'is_active': supplier.isActive ? 1 : 0,
    };

    try {
      http.Response? response;
      for (int attempt = 1; attempt <= 2; attempt++) {
        response = await _client
            .put(uri, headers: {..._headers, 'Idempotency-Key': idempotencyKey}, body: jsonEncode(body))
            .timeout(_timeout);

        if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
          final result = await _onRefresh();
          if (result == RefreshResult.success) {
            continue;
          } else {
            break;
          }
        }
        break;
      }

      if (response!.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return SupplierPushResult(
          ok: true,
          serverVersion: json['server_version'] as int?,
        );
      } else if (response.statusCode == 409) {
        try {
          final json = jsonDecode(response.body) as Map<String, dynamic>;
          final errorObj = json['error'] as Map<String, dynamic>?;
          final code = errorObj?['code'] as String? ?? 'VERSION_CONFLICT';
          final details = errorObj?['details'] as Map<String, dynamic>?;
          final currentSupplier = details?['current_supplier'] as Map<String, dynamic>?;

          final serverState = currentSupplier != null
              ? SupplierDto.fromJson(currentSupplier)
              : null;

          return SupplierPushResult(
            ok: false,
            conflict: true,
            serverState: serverState,
            error: code,
          );
        } catch (e) {
          return SupplierPushResult(
            ok: false,
            conflict: true,
            error: 'VERSION_CONFLICT (malformed response)',
          );
        }
      } else if (response.statusCode == 400) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return SupplierPushResult(
          ok: false,
          error: json['error'] as String? ?? 'Validation error',
        );
      } else if (response.statusCode == 403) {
        return SupplierPushResult(ok: false, error: 'INSUFFICIENT_PERMISSIONS');
      } else if (response.statusCode == 404) {
        return SupplierPushResult(ok: false, error: 'NOT_FOUND');
      } else if (response.statusCode >= 500) {
        throw HttpException(
          'Server error: HTTP ${response.statusCode}',
          statusCode: response.statusCode,
          requestId: response.headers['x-request-id'],
        );
      } else {
        throw HttpException(
          'Unexpected error: HTTP ${response.statusCode}',
          statusCode: response.statusCode,
          requestId: response.headers['x-request-id'],
        );
      }
    } catch (e) {
      if (e is HttpException || e is MalformedResponseException) {
        rethrow;
      }
      throw NetworkException('Network error during push supplier', e);
    }
  }

  @override
  Future<SupplierPushResult> createSupplier(SupplierDto supplier, {required String idempotencyKey}) async {
    final uri = Uri.parse('$baseUrl/v1/sync/suppliers');
    final body = {
      'business_id': _businessId ?? '',
      'id': supplier.id,
      'name': supplier.name,
      'code': supplier.code,
      'contact': supplier.contact,
      'phone': supplier.phone,
      'email': supplier.email,
      'category': supplier.category,
      'term': supplier.term,
      'is_active': supplier.isActive ? 1 : 0,
    };
    try {
      http.Response? response;
      for (int attempt = 1; attempt <= 2; attempt++) {
        response = await _client.post(uri, headers: {..._headers, 'Idempotency-Key': idempotencyKey}, body: jsonEncode(body)).timeout(_timeout);

        if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
          final result = await _onRefresh();
          if (result == RefreshResult.success) {
            continue;
          } else {
            break;
          }
        }
        break;
      }

      if (response!.statusCode == 201) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        return SupplierPushResult(ok: true, serverVersion: json['server_version'] as int?);
      } else if (response.statusCode == 409) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final code = (json['error'] as Map<String, dynamic>?)?['code'] as String?;
        if (code == 'IDEMPOTENCY_KEY_REUSE' || code == 'SUPPLIER_ID_CONFLICT') return SupplierPushResult(ok: false, error: code);
        return SupplierPushResult(ok: false, conflict: true, error: code ?? 'VERSION_CONFLICT');
      } else if (response.statusCode == 400) {
        return SupplierPushResult(ok: false, error: 'VALIDATION_ERROR');
      } else if (response.statusCode == 403) {
        return SupplierPushResult(ok: false, error: 'INSUFFICIENT_PERMISSIONS');
      }
      return SupplierPushResult(ok: false, error: 'HTTP ${response.statusCode}');
    } catch (e) {
      return SupplierPushResult(ok: false, error: e.toString());
    }
  }

  @override
  Future<SupplierPushResult> deleteSupplier(SupplierDto supplier, {required String idempotencyKey}) async {
    final uri = Uri.parse('$baseUrl/v1/sync/suppliers/${supplier.id}');
    try {
      http.Response? response;
      for (int attempt = 1; attempt <= 2; attempt++) {
        response = await _client.delete(uri, headers: {..._headers, 'Idempotency-Key': idempotencyKey}).timeout(_timeout);

        if (response.statusCode == 401 && attempt == 1 && _onRefresh != null) {
          final result = await _onRefresh();
          if (result == RefreshResult.success) {
            continue;
          } else {
            break;
          }
        }
        break;
      }

      if (response!.statusCode == 204) {
        return SupplierPushResult(ok: true, serverVersion: supplier.serverVersion + 1);
      } else if (response.statusCode == 404) {
        return SupplierPushResult(ok: true, serverVersion: supplier.serverVersion + 1);
      } else if (response.statusCode == 409) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        final code = (json['error'] as Map<String, dynamic>?)?['code'] as String?;
        if (code == 'IDEMPOTENCY_KEY_REUSE') return SupplierPushResult(ok: false, error: code);
        return SupplierPushResult(ok: false, conflict: true, error: code ?? 'VERSION_CONFLICT');
      } else if (response.statusCode == 403) {
        return SupplierPushResult(ok: false, error: 'INSUFFICIENT_PERMISSIONS');
      }
      return SupplierPushResult(ok: false, error: 'HTTP ${response.statusCode}');
    } catch (e) {
      return SupplierPushResult(ok: false, error: e.toString());
    }
  }

  void close() {
    _client.close();
  }
}

// Custom exception classes
class HttpException implements Exception {
  final String message;
  final int? statusCode;
  final String? requestId;

  HttpException(this.message, {this.statusCode, this.requestId});

  @override
  String toString() => 'HttpException: $message (status: $statusCode, request_id: $requestId)';
}

class NetworkException implements Exception {
  final String message;
  final dynamic cause;

  NetworkException(this.message, this.cause);

  @override
  String toString() => 'NetworkException: $message (cause: $cause)';
}

class MalformedResponseException implements Exception {
  final String message;
  final dynamic cause;

  MalformedResponseException(this.message, this.cause);

  @override
  String toString() => 'MalformedResponseException: $message (cause: $cause)';
}
