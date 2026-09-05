import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:uuid/uuid.dart';
import 'package:biz_erp_mobile/core/database/app_database.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/receivables/domain/receivable.dart';

class ReceivableRepository {
  final SyncApiClient _apiClient;
  final AppDatabase _db;
  static const _uuid = Uuid();

  ReceivableRepository(this._apiClient, this._db);

  /// List receivables with multi-tenant context, active branch filter, status, date, and search
  Future<List<Receivable>> listReceivables({
    required String businessId,
    String? branchId,
    String? customerId,
    String? status,
    String? dateFrom,
    String? dateTo,
    String? searchQuery,
    int limit = 100,
    int offset = 0,
  }) async {
    // 1. Fetch live receivables from backend API
    final response = await _apiClient.pullReceivables(
      businessId: businessId,
      branchId: branchId,
      customerId: customerId,
      status: status,
      dateFrom: dateFrom,
      dateTo: dateTo,
      limit: limit,
      offset: offset,
    );

    // 2. Pre-fetch local customers for fast name lookup
    final localCustomers = await (_db.select(_db.customersLocal)
          ..where((c) => c.businessId.equals(businessId)))
        .get();

    final customerMap = {
      for (final c in localCustomers) c.id: c.name,
    };

    // 3. Map DTOs to Domain objects
    final items = response.items.map((dto) {
      final name = customerMap[dto.customerId];
      return Receivable(
        id: dto.id,
        businessId: dto.businessId,
        saleId: dto.saleId,
        customerId: dto.customerId,
        branchId: dto.branchId,
        amountMinor: dto.amountMinor,
        paidMinor: dto.paidMinor,
        outstandingMinor: dto.outstandingMinor,
        date: dto.date,
        reference: dto.reference,
        description: dto.description,
        status: dto.status,
        serverVersion: dto.serverVersion,
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,
        deletedAt: dto.deletedAt,
        customerName: name,
      );
    }).toList();

    // 4. Apply client-side search query if present
    if (searchQuery != null && searchQuery.trim().isNotEmpty) {
      final q = searchQuery.trim().toLowerCase();
      return items.where((r) {
        final refMatch = r.reference?.toLowerCase().contains(q) ?? false;
        final custMatch = r.customerName?.toLowerCase().contains(q) ?? false;
        final idMatch = r.id.toLowerCase().contains(q);
        final descMatch = r.description.toLowerCase().contains(q);
        return refMatch || custMatch || idMatch || descMatch;
      }).toList();
    }

    return items;
  }

  /// Get single receivable by ID
  Future<Receivable?> getReceivableById(
    String id, {
    required String businessId,
  }) async {
    final dto = await _apiClient.getReceivable(id: id);
    if (dto == null) return null;

    // Resolve customer name
    final localCust = await (_db.select(_db.customersLocal)
          ..where((c) =>
              c.businessId.equals(businessId) & c.id.equals(dto.customerId)))
        .getSingleOrNull();

    return Receivable(
      id: dto.id,
      businessId: dto.businessId,
      saleId: dto.saleId,
      customerId: dto.customerId,
      branchId: dto.branchId,
      amountMinor: dto.amountMinor,
      paidMinor: dto.paidMinor,
      outstandingMinor: dto.outstandingMinor,
      date: dto.date,
      reference: dto.reference,
      description: dto.description,
      status: dto.status,
      serverVersion: dto.serverVersion,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      deletedAt: dto.deletedAt,
      customerName: localCust?.name,
    );
  }

  /// Fetch payment/collection history for a receivable
  Future<List<CustomerPayment>> getPaymentHistory(String receivableId) async {
    final payments = await _apiClient.pullCustomerPayments(
      receivableId: receivableId,
    );

    return payments.map((p) => CustomerPayment(
          id: p.id,
          businessId: p.businessId,
          receivableId: p.receivableId,
          customerId: p.customerId,
          branchId: p.branchId,
          amountMinor: p.amountMinor,
          method: p.method,
          reference: p.reference,
          idempotencyKey: p.idempotencyKey,
          createdAt: p.createdAt,
        )).toList();
  }

  /// Collect payment online against an open receivable
  Future<PaymentCollectionResult> collectPayment({
    required String receivableId,
    required int amountMinor,
    required String method,
    String? customerId,
    String? reference,
    String? date,
    String? idempotencyKey,
  }) async {
    final idemKey = idempotencyKey ?? _uuid.v4();

    final result = await _apiClient.collectReceivablePayment(
      receivableId: receivableId,
      amountMinor: amountMinor,
      method: method,
      customerId: customerId,
      reference: reference,
      date: date,
      idempotencyKey: idemKey,
    );

    if (!result.ok) {
      throw Exception(result.error ?? 'Gagal memproses pembayaran piutang');
    }

    return PaymentCollectionResult(
      paymentId: result.paymentId ?? '',
      journalId: result.journalId ?? '',
      receivableId: result.receivableId ?? receivableId,
      newStatus: result.newStatus ?? '',
    );
  }

  /// Compute summary KPIs from list of receivables
  Map<String, dynamic> computeSummary(List<Receivable> items) {
    int totalAmount = 0;
    int totalPaid = 0;
    int totalOutstanding = 0;
    int openCount = 0;
    int paidCount = 0;

    for (final it in items) {
      totalAmount += it.amountMinor;
      totalPaid += it.paidMinor;
      totalOutstanding += it.outstandingMinor;
      if (it.isPaid) {
        paidCount++;
      } else if (!it.isReversed) {
        openCount++;
      }
    }

    return {
      'totalCount': items.length,
      'totalAmountMinor': totalAmount,
      'totalPaidMinor': totalPaid,
      'totalOutstandingMinor': totalOutstanding,
      'openCount': openCount,
      'paidCount': paidCount,
    };
  }
}
