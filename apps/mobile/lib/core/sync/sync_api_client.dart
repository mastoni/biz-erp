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

  Future<PullSuppliersResponse> pullSuppliers({
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

  Future<PullStocksResponse> pullStocks({
    required String businessId,
    required String branchId,
  });

  Future<StockSummaryDto> pullStockSummary({
    required String businessId,
    required String branchId,
  });

  Future<StockMovementPaginatedResponse> pullStockMovements({
    required String businessId,
    required String branchId,
    String? productId,
    int? sinceMs,
    int limit = 50,
    int offset = 0,
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

  Future<SupplierPushResult> pushSupplier(
    SupplierDto supplier, {
    int? ifMatchVersion,
    required String idempotencyKey,
  });

  Future<SupplierPushResult> createSupplier(
    SupplierDto supplier, {
    required String idempotencyKey,
  });

  Future<SupplierPushResult> deleteSupplier(
    SupplierDto supplier, {
    required String idempotencyKey,
  });

  Future<PullPurchasesResponse> pullPurchases({
    required String businessId,
    required String branchId,
    required int sinceVersion,
    int limit = 500,
  });

  Future<PurchasePushResult> createPurchaseDraft(
    PurchaseDto purchase, {
    required String idempotencyKey,
  });

  Future<PurchasePushResult> updatePurchaseDraft(
    PurchaseDto purchase, {
    int? ifMatchVersion,
    required String idempotencyKey,
  });

  Future<PurchaseDto> getPurchase({
    required String id,
  });

  Future<PurchasePushResult> sendPurchase({
    required String id,
    int? ifMatchVersion,
    required String idempotencyKey,
  });

  Future<PurchasePushResult> receivePurchase({
    required String id,
    required String businessId,
    required List<Map<String, dynamic>> items,
    int? ifMatchVersion,
    required String idempotencyKey,
  });

  Future<PurchasePushResult> payPurchase({
    required String id,
    required String businessId,
    required int amountMinor,
    required String method,
    String? reference,
    int? ifMatchVersion,
    required String idempotencyKey,
  });

  Future<PurchasePushResult> cancelPurchase({
    required String id,
    int? ifMatchVersion,
    required String idempotencyKey,
  });

  Future<PurchasePushResult> deleteDraftPurchase({
    required String id,
  });

  Future<StockAdjustmentResult> adjustStock(
    StockAdjustmentRequest request, {
    required String idempotencyKey,
  });
}
