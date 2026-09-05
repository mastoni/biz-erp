import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/expenses/domain/expense.dart';

class ExpenseSummary {
  final int totalAmountMinor;
  final int count;
  final int postedAmountMinor;
  final int draftAmountMinor;

  const ExpenseSummary({
    required this.totalAmountMinor,
    required this.count,
    required this.postedAmountMinor,
    required this.draftAmountMinor,
  });
}

class ExpenseRepository {
  final SyncApiClient _api;

  ExpenseRepository(this._api);

  Future<List<Expense>> listExpenses({
    required String businessId,
    String? branchId,
    String? status,
    String? category,
    String? dateFrom,
    String? dateTo,
    String? search,
    int limit = 50,
    int offset = 0,
  }) async {
    final response = await _api.pullExpenses(
      businessId: businessId,
      branchId: branchId,
      status: status,
      category: category,
      dateFrom: dateFrom,
      dateTo: dateTo,
      search: search,
      limit: limit,
      offset: offset,
    );

    return response.items.map(_dtoToDomain).toList();
  }

  Future<Expense?> getExpenseById(String id) async {
    final dto = await _api.getExpense(id: id);
    if (dto == null) return null;
    return _dtoToDomain(dto);
  }

  Future<Expense> createExpenseOnline({
    required String businessId,
    String? branchId,
    required String date,
    required int amountMinor,
    required String method,
    String? category,
    String? reference,
    required String description,
  }) async {
    if (amountMinor <= 0) {
      throw ArgumentError('Nominal pengeluaran harus lebih dari 0');
    }
    if (description.trim().isEmpty) {
      throw ArgumentError('Keterangan pengeluaran wajib diisi');
    }

    final dto = await _api.createExpense(
      businessId: businessId,
      branchId: branchId,
      date: date,
      amountMinor: amountMinor,
      method: method,
      category: category,
      reference: reference,
      description: description.trim(),
    );

    return _dtoToDomain(dto);
  }

  ExpenseSummary computeSummary(List<Expense> expenses) {
    int total = 0;
    int posted = 0;
    int draft = 0;

    for (final e in expenses) {
      if (e.isDeleted || e.isReversed) continue;
      total += e.amountMinor;
      if (e.isPosted) {
        posted += e.amountMinor;
      } else if (e.isDraft) {
        draft += e.amountMinor;
      }
    }

    return ExpenseSummary(
      totalAmountMinor: total,
      count: expenses.where((e) => !e.isDeleted).length,
      postedAmountMinor: posted,
      draftAmountMinor: draft,
    );
  }

  Expense _dtoToDomain(ExpenseDto dto) {
    return Expense(
      id: dto.id,
      businessId: dto.businessId,
      branchId: dto.branchId,
      date: dto.date,
      amountMinor: dto.amountMinor,
      method: dto.method,
      category: dto.category,
      reference: dto.reference,
      description: dto.description,
      status: dto.status,
      serverVersion: dto.serverVersion,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      deletedAt: dto.deletedAt,
    );
  }
}
