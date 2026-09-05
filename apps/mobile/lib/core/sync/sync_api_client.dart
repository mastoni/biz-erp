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

  Future<PullReceivablesResponse> pullReceivables({
    required String businessId,
    String? branchId,
    String? customerId,
    String? status,
    String? dateFrom,
    String? dateTo,
    int limit = 50,
    int offset = 0,
  });

  Future<ReceivableDto?> getReceivable({
    required String id,
  });

  Future<List<CustomerPaymentDto>> pullCustomerPayments({
    required String receivableId,
    int limit = 50,
    int offset = 0,
  });

  Future<PaymentCollectionResultDto> collectReceivablePayment({
    required String receivableId,
    required int amountMinor,
    required String method,
    String? customerId,
    String? reference,
    String? date,
    required String idempotencyKey,
  });

  Future<PullExpensesResponse> pullExpenses({
    required String businessId,
    String? branchId,
    String? status,
    String? category,
    String? dateFrom,
    String? dateTo,
    String? search,
    int limit = 50,
    int offset = 0,
  });

  Future<ExpenseDto?> getExpense({
    required String id,
  });

  Future<ExpenseDto> createExpense({
    required String businessId,
    String? branchId,
    required String date,
    required int amountMinor,
    required String method,
    String? category,
    String? reference,
    required String description,
  });

  Future<PullIncomeResponse> pullIncome({
    required String businessId,
    String? branchId,
    String? status,
    String? category,
    String? dateFrom,
    String? dateTo,
    String? search,
    int limit = 50,
    int offset = 0,
  });

  Future<IncomeDto?> getIncome({
    required String id,
  });

  Future<IncomeDto> createIncome({
    required String businessId,
    String? branchId,
    required String date,
    required int amountMinor,
    required String method,
    String? category,
    String? reference,
    required String description,
  });
}


