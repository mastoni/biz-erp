import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/reports/data/report_repository.dart';

class MockReportSyncApiClient implements SyncApiClient {
  SalesSummaryDto? mockSalesSummary;
  List<ProductSalesReportDto> mockProductSales = [];
  List<HourlySalesBucketDto> mockHourlySales = [];

  String? lastFrom;
  String? lastTo;
  String? lastBranchId;
  bool shouldThrow = false;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<SalesSummaryDto> pullSalesSummary({
    required String from,
    required String to,
    String? branchId,
  }) async {
    if (shouldThrow) throw Exception('Network error');
    lastFrom = from;
    lastTo = to;
    lastBranchId = branchId;

    return mockSalesSummary ??
        const SalesSummaryDto(
          totalSales: 15,
          totalRevenueMinor: 1500000,
          totalItemsSold: 30,
          averageOrderValueMinor: 100000,
          paymentMethods: [
            PaymentMethodSummaryDto(paymentMethod: 'cash', count: 10, totalMinor: 1000000),
            PaymentMethodSummaryDto(paymentMethod: 'bank_transfer', count: 5, totalMinor: 500000),
          ],
        );
  }

  @override
  Future<List<ProductSalesReportDto>> pullProductSalesReport({
    required String from,
    required String to,
    String? branchId,
  }) async {
    if (shouldThrow) throw Exception('Network error');
    return mockProductSales;
  }

  @override
  Future<List<HourlySalesBucketDto>> pullHourlySalesReport({
    required String from,
    required String to,
    String? branchId,
  }) async {
    if (shouldThrow) throw Exception('Network error');
    return mockHourlySales;
  }
}

void main() {
  group('ReportRepository Unit Tests (MOB-REPORTS-1)', () {
    late MockReportSyncApiClient mockApi;
    late ReportRepository repo;

    setUp(() {
      mockApi = MockReportSyncApiClient();
      repo = ReportRepository(mockApi);
    });

    test('MOB-REP-001: getDateRangeForPreset correctly calculates preset date boundaries', () {
      final refDate = DateTime(2026, 9, 5, 14, 30);

      final todayRange = repo.getDateRangeForPreset(ReportPeriodPreset.today, referenceDate: refDate);
      expect(ReportRepository.formatDate(todayRange.start), equals('2026-09-05'));
      expect(ReportRepository.formatDate(todayRange.end), equals('2026-09-05'));

      final yesterdayRange = repo.getDateRangeForPreset(ReportPeriodPreset.yesterday, referenceDate: refDate);
      expect(ReportRepository.formatDate(yesterdayRange.start), equals('2026-09-04'));
      expect(ReportRepository.formatDate(yesterdayRange.end), equals('2026-09-04'));

      final last7DaysRange = repo.getDateRangeForPreset(ReportPeriodPreset.last7Days, referenceDate: refDate);
      expect(ReportRepository.formatDate(last7DaysRange.start), equals('2026-08-30'));
      expect(ReportRepository.formatDate(last7DaysRange.end), equals('2026-09-05'));

      final thisMonthRange = repo.getDateRangeForPreset(ReportPeriodPreset.thisMonth, referenceDate: refDate);
      expect(ReportRepository.formatDate(thisMonthRange.start), equals('2026-09-01'));
      expect(ReportRepository.formatDate(thisMonthRange.end), equals('2026-09-05'));

      final custom = DateTimeRange(start: DateTime(2026, 8, 1), end: DateTime(2026, 8, 15));
      final customRange = repo.getDateRangeForPreset(ReportPeriodPreset.custom, customRange: custom);
      expect(ReportRepository.formatDate(customRange.start), equals('2026-08-01'));
      expect(ReportRepository.formatDate(customRange.end), equals('2026-08-15'));
    });

    test('MOB-REP-002: getSalesSummary correctly maps canonical DTO and payment channels', () async {
      final summary = await repo.getSalesSummary(
        from: '2026-09-01',
        to: '2026-09-05',
        branchId: 'branch-001',
      );

      expect(mockApi.lastFrom, equals('2026-09-01'));
      expect(mockApi.lastTo, equals('2026-09-05'));
      expect(mockApi.lastBranchId, equals('branch-001'));

      expect(summary.totalSales, equals(15));
      expect(summary.totalRevenueMinor, equals(1500000));
      expect(summary.totalItemsSold, equals(30));
      expect(summary.averageOrderValueMinor, equals(100000));
      expect(summary.paymentMethods.length, equals(2));
      expect(summary.paymentMethods[0].formattedMethod, equals('Tunai'));
      expect(summary.paymentMethods[1].formattedMethod, equals('Transfer Bank'));
    });

    test('MOB-REP-003: getProductSales correctly maps product ranking and revenue', () async {
      mockApi.mockProductSales = [
        const ProductSalesReportDto(
          productId: 'p-1',
          productName: 'Kopi Susu Gula Aren',
          category: 'Minuman',
          totalQuantity: 45,
          totalRevenueMinor: 900000,
        ),
        const ProductSalesReportDto(
          productId: 'p-2',
          productName: 'Roti Bakar Cokelat',
          category: 'Makanan',
          totalQuantity: 20,
          totalRevenueMinor: 400000,
        ),
      ];

      final products = await repo.getProductSales(
        from: '2026-09-01',
        to: '2026-09-05',
      );

      expect(products.length, equals(2));
      expect(products[0].productName, equals('Kopi Susu Gula Aren'));
      expect(products[0].totalQuantity, equals(45));
      expect(products[0].totalRevenueMinor, equals(900000));
      expect(products[1].productName, equals('Roti Bakar Cokelat'));
    });

    test('MOB-REP-004: getHourlySales correctly maps hourly traffic points', () async {
      mockApi.mockHourlySales = [
        const HourlySalesBucketDto(hour: 9, totalRevenueMinor: 200000, transactionCount: 4),
        const HourlySalesBucketDto(hour: 13, totalRevenueMinor: 650000, transactionCount: 12),
      ];

      final hourly = await repo.getHourlySales(
        from: '2026-09-05',
        to: '2026-09-05',
      );

      expect(hourly.length, equals(2));
      expect(hourly[0].formattedHour, equals('09:00'));
      expect(hourly[0].transactionCount, equals(4));
      expect(hourly[1].formattedHour, equals('13:00'));
      expect(hourly[1].totalRevenueMinor, equals(650000));
    });

    test('MOB-REP-005: network error cleanly throws without corrupting state', () async {
      mockApi.shouldThrow = true;

      expect(
        () => repo.getSalesSummary(from: '2026-09-05', to: '2026-09-05'),
        throwsA(isA<Exception>()),
      );
    });
  });
}
