import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/sales/data/sale_repository.dart';
import 'package:biz_erp_mobile/sales/domain/sale.dart';
import 'sale_detail_screen.dart';

enum SaleDateFilter {
  all(null, 'Semua'),
  today(0, 'Hari Ini'),
  last7Days(7, '7 Hari'),
  last30Days(30, '30 Hari');

  final int? days;
  final String label;
  const SaleDateFilter(this.days, this.label);
}

class SaleListScreen extends StatefulWidget {
  final String businessId;
  final String branchId;
  final String? businessName;
  final String? branchName;
  final SaleRepository saleRepo;
  final PrintingService? printingService;

  const SaleListScreen({
    super.key,
    required this.businessId,
    required this.branchId,
    this.businessName,
    this.branchName,
    required this.saleRepo,
    this.printingService,
  });

  @override
  State<SaleListScreen> createState() => _SaleListScreenState();
}

class _SaleListScreenState extends State<SaleListScreen> {
  List<Sale> _sales = [];
  bool _isLoading = true;
  String? _error;
  SaleDateFilter _activeFilter = SaleDateFilter.all;
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();

  int _totalCount = 0;
  int _totalAmountMinor = 0;
  int _pendingCount = 0;

  @override
  void initState() {
    super.initState();
    _loadSales();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  DateTime? get _startDate {
    if (_activeFilter.days == null) return null;
    final now = DateTime.now();
    if (_activeFilter.days == 0) {
      return DateTime(now.year, now.month, now.day);
    }
    return now.subtract(Duration(days: _activeFilter.days!));
  }

  Future<void> _loadSales() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final results = await widget.saleRepo.listSales(
        businessId: widget.businessId,
        branchId: widget.branchId,
        startDate: _startDate,
        searchQuery: _searchQuery,
      );

      final summary = await widget.saleRepo.getSalesSummary(
        businessId: widget.businessId,
        branchId: widget.branchId,
        startDate: _startDate,
      );

      if (!mounted) return;
      setState(() {
        _sales = results;
        _totalCount = summary['totalCount'] ?? 0;
        _totalAmountMinor = summary['totalAmountMinor'] ?? 0;
        _pendingCount = summary['pendingCount'] ?? 0;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal memuat riwayat penjualan: $e';
        _isLoading = false;
      });
    }
  }

  String _formatDateTime(DateTime dt) {
    final day = dt.day.toString().padLeft(2, '0');
    final month = dt.month.toString().padLeft(2, '0');
    final year = dt.year;
    final hour = dt.hour.toString().padLeft(2, '0');
    final min = dt.minute.toString().padLeft(2, '0');
    return '$day/$month/$year $hour:$min';
  }

  Widget _buildStatusBadge(Sale sale) {
    Color bg;
    Color fg;
    String label;

    if (sale.isSynced) {
      bg = const Color(0xFFE8F5E9);
      fg = const Color(0xFF2E7D32);
      label = 'Tersinkron';
    } else if (sale.isPending) {
      bg = const Color(0xFFFFF8E1);
      fg = const Color(0xFFF57F17);
      label = 'Pending';
    } else if (sale.isConflict) {
      bg = const Color(0xFFFFEBEE);
      fg = const Color(0xFFC62828);
      label = 'Konflik';
    } else {
      bg = Colors.grey.shade200;
      fg = Colors.grey.shade800;
      label = sale.status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: fg.withValues(alpha: 0.2)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Riwayat Penjualan'),
        backgroundColor: Colors.blueGrey[800],
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // 1. Summary Header Card
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.blueGrey.shade50,
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total Penjualan',
                        style: TextStyle(fontSize: 12, color: Colors.blueGrey),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        CurrencyFormatter.formatIDR(_totalAmountMinor),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1B5E20),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  height: 36,
                  width: 1,
                  color: Colors.blueGrey.shade200,
                ),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '$_totalCount Transaksi',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (_pendingCount > 0) ...[
                      const SizedBox(height: 2),
                      Text(
                        '$_pendingCount Belum Sync',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Colors.orange,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),

          // 2. Search & Filter Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              children: [
                TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Cari nomor struk / ID...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _searchQuery = '');
                              _loadSales();
                            },
                          )
                        : null,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  onChanged: (val) {
                    setState(() => _searchQuery = val);
                    _loadSales();
                  },
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: SaleDateFilter.values.map((f) {
                      final isSelected = _activeFilter == f;
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text(f.label),
                          selected: isSelected,
                          onSelected: (sel) {
                            if (sel) {
                              setState(() => _activeFilter = f);
                              _loadSales();
                            }
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

          // 3. Transactions List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _error!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.red),
                            ),
                            const SizedBox(height: 12),
                            ElevatedButton(
                              onPressed: _loadSales,
                              child: const Text('Coba Lagi'),
                            ),
                          ],
                        ),
                      )
                    : _sales.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.receipt_long_outlined,
                                  size: 56,
                                  color: Colors.grey[400],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  _searchQuery.isNotEmpty
                                      ? 'Tidak ada transaksi dengan nomor tersebut'
                                      : 'Belum ada riwayat transaksi penjualan',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: Colors.grey[600],
                                  ),
                                ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _loadSales,
                            child: ListView.separated(
                              padding: const EdgeInsets.all(12),
                              itemCount: _sales.length,
                              separatorBuilder: (context, index) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (context, index) {
                                final sale = _sales[index];
                                return Card(
                                  elevation: 1,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(10),
                                    onTap: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) => SaleDetailScreen(
                                            saleId: sale.clientTransactionId,
                                            businessId: widget.businessId,
                                            businessName: widget.businessName,
                                            branchName: widget.branchName,
                                            saleRepo: widget.saleRepo,
                                            printingService:
                                                widget.printingService,
                                          ),
                                        ),
                                      ).then((_) => _loadSales());
                                    },
                                    child: Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                sale.displayReceiptNumber,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 15,
                                                  fontFamily: 'monospace',
                                                ),
                                              ),
                                              _buildStatusBadge(sale),
                                            ],
                                          ),
                                          const SizedBox(height: 6),
                                          Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                _formatDateTime(sale.createdAt),
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.grey[600],
                                                ),
                                              ),
                                              Text(
                                                CurrencyFormatter.formatIDR(
                                                  sale.totalMinor,
                                                ),
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 15,
                                                  color: Color(0xFF1B5E20),
                                                ),
                                              ),
                                            ],
                                          ),
                                          if (sale.customerName != null) ...[
                                            const SizedBox(height: 4),
                                            Row(
                                              children: [
                                                Icon(
                                                  Icons.person_outline,
                                                  size: 14,
                                                  color: Colors.grey[600],
                                                ),
                                                const SizedBox(width: 4),
                                                Text(
                                                  sale.customerName!,
                                                  style: TextStyle(
                                                    fontSize: 12,
                                                    color: Colors.grey[700],
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
