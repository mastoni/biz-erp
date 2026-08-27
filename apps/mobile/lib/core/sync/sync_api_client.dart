import 'sync_models.dart';
import 'store_settings_models.dart';

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

  Future<PullBranchesResponse> pullBranches({
    required String businessId,
  });

  Future<StoreSettingsDto?> getStoreSettings({
    required String businessId,
    required String branchId,
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

  Future<CustomerPushResult> pushCustomer(
    CustomerDto customer, {
    int? ifMatchVersion,
    required String idempotencyKey,
  });

  Future<CustomerPushResult> createCustomer(
    CustomerDto customer, {
    required String idempotencyKey,
  });

  Future<CustomerPushResult> deleteCustomer(
    CustomerDto customer, {
    required String idempotencyKey,
  });
}
