// apps/mobile/lib/core/sync/http_sync_api_client.dart

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'sync_api_client.dart';
import 'sync_models.dart';

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
      'sales': sales.map((s) => s.toJson()).toList(),
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
