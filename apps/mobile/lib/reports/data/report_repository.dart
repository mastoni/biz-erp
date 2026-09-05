import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/reports/domain/sales_report.dart';

/// Preset periode untuk laporan operasional.
enum ReportPeriodPreset {
  today,
  yesterday,
  last7Days,
  thisMonth,
  custom,
}

/// Repository untuk Laporan & Rekap Penjualan Operasional (MOB-REPORTS-1).
class ReportRepository {
  final SyncApiClient _apiClient;

  ReportRepository(this._apiClient);

  /// Helper untuk format tanggal `YYYY-MM-DD`.
  static String formatDate(DateTime dt) {
    final y = dt.year.toString().padLeft(4, '0');
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  /// Menghitung rentang tanggal `from` dan `to` berdasarkan preset.
  DateTimeRange getDateRangeForPreset(
    ReportPeriodPreset preset, {
    DateTimeRange? customRange,
    DateTime? referenceDate,
  }) {
    final now = referenceDate ?? DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    switch (preset) {
      case ReportPeriodPreset.today:
        return DateTimeRange(start: today, end: today);
      case ReportPeriodPreset.yesterday:
        final yesterday = today.subtract(const Duration(days: 1));
        return DateTimeRange(start: yesterday, end: yesterday);
      case ReportPeriodPreset.last7Days:
        final start7 = today.subtract(const Duration(days: 6));
        return DateTimeRange(start: start7, end: today);
      case ReportPeriodPreset.thisMonth:
        final startMonth = DateTime(today.year, today.month, 1);
        return DateTimeRange(start: startMonth, end: today);
      case ReportPeriodPreset.custom:
        return customRange ?? DateTimeRange(start: today, end: today);
    }
  }

  /// Mengambil ringkasan penjualan operasional (omset, transaksi, item, AOV, payment methods).
  Future<SalesSummary> getSalesSummary({
    required String from,
    required String to,
    String? branchId,
  }) async {
    final dto = await _apiClient.pullSalesSummary(
      from: from,
      to: to,
      branchId: branchId,
    );
    return SalesSummary.fromDto(dto);
  }

  /// Mengambil laporan produk terlaris.
  Future<List<ProductSaleItem>> getProductSales({
    required String from,
    required String to,
    String? branchId,
  }) async {
    final list = await _apiClient.pullProductSalesReport(
      from: from,
      to: to,
      branchId: branchId,
    );
    return list.map((dto) => ProductSaleItem.fromDto(dto)).toList();
  }

  /// Mengambil data distribusi penjualan per jam (jam ramai toko).
  Future<List<HourlySalesPoint>> getHourlySales({
    required String from,
    required String to,
    String? branchId,
  }) async {
    final list = await _apiClient.pullHourlySalesReport(
      from: from,
      to: to,
      branchId: branchId,
    );
    return list.map((dto) => HourlySalesPoint.fromDto(dto)).toList();
  }
}
