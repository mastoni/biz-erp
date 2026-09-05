import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/income/domain/income.dart';

/// Summary KPI model untuk daftar pendapatan operasional.
class IncomeSummary {
  final int totalMinor;
  final int totalCount;
  final int draftCount;
  final int postedCount;
  final int draftMinor;
  final int postedMinor;

  const IncomeSummary({
    required this.totalMinor,
    required this.totalCount,
    required this.draftCount,
    required this.postedCount,
    required this.draftMinor,
    required this.postedMinor,
  });

  factory IncomeSummary.fromItems(List<Income> items) {
    int total = 0;
    int draftCnt = 0;
    int postedCnt = 0;
    int draftMin = 0;
    int postedMin = 0;

    for (final item in items) {
      total += item.amountMinor;
      if (item.isDraft) {
        draftCnt++;
        draftMin += item.amountMinor;
      } else if (item.isPosted) {
        postedCnt++;
        postedMin += item.amountMinor;
      }
    }

    return IncomeSummary(
      totalMinor: total,
      totalCount: items.length,
      draftCount: draftCnt,
      postedCount: postedCnt,
      draftMinor: draftMin,
      postedMinor: postedMin,
    );
  }
}

/// Repository untuk Pendapatan Operasional (MOB-INCOME-1).
/// Online-only, backend canonical is authoritative.
class IncomeRepository {
  final SyncApiClient _apiClient;

  IncomeRepository(this._apiClient);

  /// Mengambil daftar pendapatan dari backend canonical.
  Future<List<Income>> listIncome({
    required String businessId,
    String? branchId,
    String? status,
    String? category,
    String? dateFrom,
    String? dateTo,
    String? search,
    int limit = 100,
    int offset = 0,
  }) async {
    final response = await _apiClient.pullIncome(
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

    return response.items.map((dto) => Income.fromDto(dto)).toList();
  }

  /// Mengambil detail satu pendapatan berdasarkan ID.
  Future<Income?> getIncomeById(String id) async {
    final dto = await _apiClient.getIncome(id: id);
    if (dto == null) return null;
    return Income.fromDto(dto);
  }

  /// Membuat entri pendapatan baru secara online ke backend.
  /// Memvalidasi nominal > 0 dan deskripsi tidak kosong sebelum kirim.
  Future<Income> createIncomeOnline({
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
      throw ArgumentError('Nominal pendapatan harus lebih dari 0');
    }
    if (description.trim().isEmpty) {
      throw ArgumentError('Keterangan pendapatan tidak boleh kosong');
    }
    if (date.trim().isEmpty) {
      throw ArgumentError('Tanggal pendapatan tidak boleh kosong');
    }

    final dto = await _apiClient.createIncome(
      businessId: businessId,
      branchId: branchId,
      date: date.trim(),
      amountMinor: amountMinor,
      method: method.trim(),
      category: category?.trim(),
      reference: reference?.trim(),
      description: description.trim(),
    );

    return Income.fromDto(dto);
  }

  /// Menghitung ringkasan KPI dari daftar pendapatan.
  IncomeSummary computeSummary(List<Income> items) {
    return IncomeSummary.fromItems(items);
  }
}
