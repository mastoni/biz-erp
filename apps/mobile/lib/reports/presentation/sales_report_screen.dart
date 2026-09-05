import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/reports/data/report_repository.dart';
import 'package:biz_erp_mobile/reports/domain/sales_report.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_data.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/pos/presentation/widgets/printer_selector_sheet.dart';

class SalesReportScreen extends StatefulWidget {
  final String businessId;
  final String? branchId;
  final String? businessName;
  final String? branchName;
  final ReportRepository reportRepo;
  final PrintingService? printingService;
  final String userRole;

  const SalesReportScreen({
    super.key,
    required this.businessId,
    this.branchId,
    this.businessName,
    this.branchName,
    required this.reportRepo,
    this.printingService,
    this.userRole = 'CASHIER',
  });

  @override
  State<SalesReportScreen> createState() => _SalesReportScreenState();
}

class _SalesReportScreenState extends State<SalesReportScreen> {
  ReportPeriodPreset _selectedPreset = ReportPeriodPreset.today;
  DateTimeRange? _customRange;

  bool _isLoading = true;
  String? _errorMessage;
  bool _isPrinting = false;

  SalesSummary? _summary;
  List<ProductSaleItem> _topProducts = [];
  List<HourlySalesPoint> _hourlySales = [];

  @override
  void initState() {
    super.initState();
    _loadReport();
  }

  DateTimeRange get _activeRange => widget.reportRepo.getDateRangeForPreset(
        _selectedPreset,
        customRange: _customRange,
      );

  String get _fromDateString => ReportRepository.formatDate(_activeRange.start);
  String get _toDateString => ReportRepository.formatDate(_activeRange.end);

  Future<void> _loadReport() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final from = _fromDateString;
      final to = _toDateString;
      final branchId = widget.branchId;

      final summaryFuture = widget.reportRepo.getSalesSummary(
        from: from,
        to: to,
        branchId: branchId,
      );

      final productsFuture = widget.reportRepo.getProductSales(
        from: from,
        to: to,
        branchId: branchId,
      );

      final hourlyFuture = widget.reportRepo.getHourlySales(
        from: from,
        to: to,
        branchId: branchId,
      );

      final results = await Future.wait([
        summaryFuture,
        productsFuture,
        hourlyFuture,
      ]);

      if (mounted) {
        setState(() {
          _summary = results[0] as SalesSummary;
          _topProducts = results[1] as List<ProductSaleItem>;
          _hourlySales = results[2] as List<HourlySalesPoint>;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString().contains('SocketException') ||
                  e.toString().contains('Network error')
              ? 'Tidak dapat memuat laporan (Offline). Periksa koneksi internet.'
              : 'Gagal memuat laporan: ${e.toString().replaceAll('Exception: ', '').replaceAll('HttpException: ', '')}';
        });
      }
    }
  }

  Future<void> _pickCustomRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDateRange: _customRange ?? _activeRange,
    );

    if (picked != null) {
      setState(() {
        _customRange = picked;
        _selectedPreset = ReportPeriodPreset.custom;
      });
      _loadReport();
    }
  }

  Future<void> _printClosingSummary() async {
    final printingService = widget.printingService;
    if (printingService == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Layanan printer belum tersedia')),
      );
      return;
    }

    if (printingService.status != PrinterStatus.connected) {
      final selected = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        builder: (_) => PrinterSelectorSheet(printingService: printingService),
      );

      if (selected != true || printingService.status != PrinterStatus.connected) {
        return;
      }
    }

    final summary = _summary;
    if (summary == null) return;

    setState(() => _isPrinting = true);

    try {
      final items = <ReceiptItemData>[];
      for (final pm in summary.paymentMethods) {
        items.add(
          ReceiptItemData(
            productId: 'PM-${pm.paymentMethod}',
            displayName: '${pm.formattedMethod} (${pm.count}x)',
            quantity: 1,
            unitPriceMinor: pm.totalMinor,
          ),
        );
      }

      final receiptData = ReceiptData(
        receiptNumber: 'REKAP-$_fromDateString',
        businessName: widget.businessName ?? 'BIZ-ERP',
        branchName: widget.branchName ?? 'Cabang Toko',
        cashierId: widget.userRole,
        createdAtEpochMs: DateTime.now().millisecondsSinceEpoch,
        subtotalMinor: summary.totalRevenueMinor,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: summary.totalRevenueMinor,
        cashReceivedMinor: summary.totalRevenueMinor,
        changeMinor: 0,
        items: items,
      );

      await printingService.printReceipt(receiptData);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Rekap kasir berhasil dicetak'),
            backgroundColor: Color(0xFF0D9488),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal mencetak rekap: $e. Data laporan tetap aman.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isPrinting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Laporan & Rekap Penjualan'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Segarkan',
            onPressed: _isLoading ? null : _loadReport,
          ),
          if (widget.printingService != null)
            IconButton(
              icon: _isPrinting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.print),
              tooltip: 'Cetak Rekap Kasir',
              onPressed: _isPrinting || _summary == null ? null : _printClosingSummary,
            ),
        ],
      ),
      body: Column(
        children: [
          // Filter Periode Bar
          _buildPeriodSelector(),
          const Divider(height: 1),

          // Main Body
          Expanded(
            child: _buildBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodSelector() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildPresetChip('Hari Ini', ReportPeriodPreset.today),
            const SizedBox(width: 6),
            _buildPresetChip('Kemarin', ReportPeriodPreset.yesterday),
            const SizedBox(width: 6),
            _buildPresetChip('7 Hari Terakhir', ReportPeriodPreset.last7Days),
            const SizedBox(width: 6),
            _buildPresetChip('Bulan Ini', ReportPeriodPreset.thisMonth),
            const SizedBox(width: 6),
            ActionChip(
              avatar: const Icon(Icons.calendar_month, size: 16),
              label: Text(
                _selectedPreset == ReportPeriodPreset.custom
                    ? '$_fromDateString s/d $_toDateString'
                    : 'Kustom Rentang',
              ),
              backgroundColor: _selectedPreset == ReportPeriodPreset.custom
                  ? const Color(0xFF0D9488).withValues(alpha: 0.15)
                  : null,
              onPressed: _pickCustomRange,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPresetChip(String label, ReportPeriodPreset preset) {
    final isSelected = _selectedPreset == preset;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) {
          setState(() {
            _selectedPreset = preset;
          });
          _loadReport();
        }
      },
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off, size: 48, color: Colors.orange),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _loadReport,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Coba Lagi'),
              ),
            ],
          ),
        ),
      );
    }

    final summary = _summary;
    if (summary == null) {
      return const Center(child: Text('Data tidak tersedia'));
    }

    return RefreshIndicator(
      onRefresh: _loadReport,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Section 1: Summary KPI Grid
            _buildSummaryKpiGrid(summary),
            const SizedBox(height: 16),

            // Section 2: Payment Method Breakdown
            _buildPaymentMethodsCard(summary),
            const SizedBox(height: 16),

            // Section 3: Top-Selling Products
            _buildTopProductsCard(),
            const SizedBox(height: 16),

            // Section 4: Hourly Sales Traffic
            _buildHourlyTrafficCard(),
            const SizedBox(height: 24),

            // Section 5: Bottom Print Button
            if (widget.printingService != null)
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0D9488),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: _isPrinting ? null : _printClosingSummary,
                icon: const Icon(Icons.print),
                label: Text(_isPrinting ? 'Mencetak Rekap...' : 'Cetak Rekap Kasir (Thermal)'),
              ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryKpiGrid(SalesSummary summary) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildKpiCard(
                'Total Omset',
                CurrencyFormatter.formatIDR(summary.totalRevenueMinor),
                Icons.monetization_on,
                const Color(0xFF0D9488),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildKpiCard(
                'Total Transaksi',
                '${summary.totalSales} Penjualan',
                Icons.receipt,
                const Color(0xFF2563EB),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildKpiCard(
                'Total Item Terjual',
                '${summary.totalItemsSold} Pcs',
                Icons.shopping_bag,
                const Color(0xFFD97706),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildKpiCard(
                'Rata-rata Transaksi (AOV)',
                CurrencyFormatter.formatIDR(summary.averageOrderValueMinor),
                Icons.analytics,
                const Color(0xFF7C3AED),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildKpiCard(String title, String value, IconData icon, Color color) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: color),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentMethodsCard(SalesSummary summary) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.payment, size: 20, color: Color(0xFF0D9488)),
                SizedBox(width: 8),
                Text(
                  'Metode Pembayaran',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                ),
              ],
            ),
            const Divider(height: 20),
            if (summary.paymentMethods.isEmpty)
              const Text('Belum ada data pembayaran', style: TextStyle(color: Color(0xFF94A3B8)))
            else
              ...summary.paymentMethods.map((pm) {
                final pct = summary.totalRevenueMinor > 0
                    ? (pm.totalMinor / summary.totalRevenueMinor) * 100
                    : 0.0;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0D9488).withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              pm.formattedMethod,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0D9488),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${pm.count}x (${pct.toStringAsFixed(1)}%)',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                      Text(
                        CurrencyFormatter.formatIDR(pm.totalMinor),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  Widget _buildTopProductsCard() {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.star, size: 20, color: Color(0xFFD97706)),
                SizedBox(width: 8),
                Text(
                  'Produk Terlaris',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                ),
              ],
            ),
            const Divider(height: 20),
            if (_topProducts.isEmpty)
              const Text('Belum ada transaksi produk', style: TextStyle(color: Color(0xFF94A3B8)))
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _topProducts.length,
                separatorBuilder: (context, index) => const Divider(height: 12),
                itemBuilder: (context, index) {
                  final p = _topProducts[index];
                  return Row(
                    children: [
                      CircleAvatar(
                        radius: 12,
                        backgroundColor: index < 3 ? const Color(0xFFD97706) : Colors.grey.shade400,
                        child: Text(
                          '${index + 1}',
                          style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              p.productName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                            if (p.category != null)
                              Text(
                                p.category!,
                                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                              ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            CurrencyFormatter.formatIDR(p.totalRevenueMinor),
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            '${p.totalQuantity} Terjual',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildHourlyTrafficCard() {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.access_time, size: 20, color: Color(0xFF2563EB)),
                SizedBox(width: 8),
                Text(
                  'Jam Ramai Toko (Hourly Traffic)',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                ),
              ],
            ),
            const Divider(height: 20),
            if (_hourlySales.isEmpty)
              const Text('Belum ada data aktivitas jam', style: TextStyle(color: Color(0xFF94A3B8)))
            else
              ..._hourlySales.where((h) => h.transactionCount > 0).map((h) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Pukul ${h.formattedHour}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                      Row(
                        children: [
                          Text(
                            '${h.transactionCount} Transaksi',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            CurrencyFormatter.formatIDR(h.totalRevenueMinor),
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2563EB),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
