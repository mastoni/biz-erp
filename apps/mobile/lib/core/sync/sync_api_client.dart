import 'sync_models.dart';

/// Abstraksi transport sync. Implementasi HTTP nyata di Phase 3.0.3;
/// 3.0.1 menggunakan mock di tests.
abstract class SyncApiClient {
  Future<bool> health();

  Future<PullProductsResponse> pullProducts({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  });

  Future<PullSalesResponse> pullSales({
    required String businessId,
    required int sinceMs,
    int limit = 100,
  });

  Future<ProductPushResult> pushProduct(
    ProductDto product, {
    int? ifMatchVersion,
  });

  Future<List<SalePushResultItem>> pushSalesBatch(List<SaleDto> sales);
}
