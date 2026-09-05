import 'package:biz_erp_mobile/core/sync/sync_models.dart';

/// Ringkasan Penjualan Operasional (Sales Summary Report).
class SalesSummary {
  final int totalSales;
  final int totalRevenueMinor;
  final int totalItemsSold;
  final int averageOrderValueMinor;
  final List<PaymentMethodSummary> paymentMethods;

  const SalesSummary({
    required this.totalSales,
    required this.totalRevenueMinor,
    required this.totalItemsSold,
    required this.averageOrderValueMinor,
    required this.paymentMethods,
  });

  factory SalesSummary.fromDto(SalesSummaryDto dto) {
    return SalesSummary(
      totalSales: dto.totalSales,
      totalRevenueMinor: dto.totalRevenueMinor,
      totalItemsSold: dto.totalItemsSold,
      averageOrderValueMinor: dto.averageOrderValueMinor,
      paymentMethods: dto.paymentMethods
          .map((pm) => PaymentMethodSummary.fromDto(pm))
          .toList(),
    );
  }
}

/// Rincian Transaksi per Metode Pembayaran.
class PaymentMethodSummary {
  final String paymentMethod;
  final int count;
  final int totalMinor;

  const PaymentMethodSummary({
    required this.paymentMethod,
    required this.count,
    required this.totalMinor,
  });

  factory PaymentMethodSummary.fromDto(PaymentMethodSummaryDto dto) {
    return PaymentMethodSummary(
      paymentMethod: dto.paymentMethod,
      count: dto.count,
      totalMinor: dto.totalMinor,
    );
  }

  String get formattedMethod {
    switch (paymentMethod.toLowerCase()) {
      case 'cash':
        return 'Tunai';
      case 'bank_transfer':
        return 'Transfer Bank';
      case 'debit':
        return 'Kartu Debit';
      case 'credit':
        return 'Kartu Kredit';
      case 'qris':
        return 'QRIS';
      default:
        return paymentMethod;
    }
  }
}

/// Laporan Penjualan per Produk / Produk Terlaris.
class ProductSaleItem {
  final String productId;
  final String productName;
  final String? category;
  final int totalQuantity;
  final int totalRevenueMinor;

  const ProductSaleItem({
    required this.productId,
    required this.productName,
    this.category,
    required this.totalQuantity,
    required this.totalRevenueMinor,
  });

  factory ProductSaleItem.fromDto(ProductSalesReportDto dto) {
    return ProductSaleItem(
      productId: dto.productId,
      productName: dto.productName,
      category: dto.category,
      totalQuantity: dto.totalQuantity,
      totalRevenueMinor: dto.totalRevenueMinor,
    );
  }
}

/// Data Distribusi Penjualan per Jam (Hourly Sales Traffic).
class HourlySalesPoint {
  final int hour;
  final int totalRevenueMinor;
  final int transactionCount;

  const HourlySalesPoint({
    required this.hour,
    required this.totalRevenueMinor,
    required this.transactionCount,
  });

  factory HourlySalesPoint.fromDto(HourlySalesBucketDto dto) {
    return HourlySalesPoint(
      hour: dto.hour,
      totalRevenueMinor: dto.totalRevenueMinor,
      transactionCount: dto.transactionCount,
    );
  }

  String get formattedHour => '${hour.toString().padLeft(2, '0')}:00';
}
