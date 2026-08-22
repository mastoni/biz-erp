import 'sync_models.dart';

abstract class SyncApiClient {
  Future<bool> health();

  Future<PullProductsResponse> pullProducts({
    required String businessId,
    required int sinceVersion,
    int limit = 500,
  });

  Future<PullCustomersResponse> pullCustomers({
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


  Future<ProductPushResult> createProduct(
    ProductDto product, {
    required String idempotencyKey,
  });

  Future<List<SalePushResultItem>> pushSalesBatch(List<SaleDto> sales);
}
