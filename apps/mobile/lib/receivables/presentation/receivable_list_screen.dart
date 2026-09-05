import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/receivables/data/receivable_repository.dart';
import 'package:biz_erp_mobile/receivables/domain/receivable.dart';
import 'receivable_detail_screen.dart';

enum ReceivableFilterStatus {
  all,
  unpaid, // OPEN or PARTIAL
  paid, // PAID
}

class ReceivableListScreen extends StatefulWidget {
  final String businessId;
  final String? branchId;
  final String? businessName;
  final String? branchName;
  final ReceivableRepository receivableRepo;
  final PrintingService? printingService;
  final String userRole;

  const ReceivableListScreen({
    super.key,
    required this.businessId,
    this.branchId,
    this.businessName,
    this.branchName,
    required this.receivableRepo,
    this.printingService,
    this.userRole = 'CASHIER',
  });

  @override
  State<ReceivableListScreen> createState() => _ReceivableListScreenState();
}

class _ReceivableListScreenState extends State<ReceivableListScreen> {
  List<Receivable> _allReceivables = [];
  List<Receivable> _filteredReceivables = [];
  bool _isLoading = true;
  String? _errorMessage;

  ReceivableFilterStatus _selectedStatus = ReceivableFilterStatus.all;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadReceivables();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadReceivables() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await widget.receivableRepo.listReceivables(
        businessId: widget.businessId,
        branchId: widget.branchId,
      );

      if (mounted) {
        setState(() {
          _allReceivables = list;
          _applyFilters();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Gagal memuat data piutang live. Pastikan perangkat terhubung ke internet.';
        });
      }
    }
  }

  void _applyFilters() {
    final query = _searchController.text.trim().toLowerCase();

    _filteredReceivables = _allReceivables.where((r) {
      // 1. Status Filter
      if (_selectedStatus == ReceivableFilterStatus.unpaid) {
        if (r.status != 'OPEN' && r.status != 'PARTIAL') return false;
      } else if (_selectedStatus == ReceivableFilterStatus.paid) {
        if (r.status != 'PAID') return false;
      }

      // 2. Search Query Filter
      if (query.isNotEmpty) {
        final refMatch = r.reference?.toLowerCase().contains(query) ?? false;
        final custMatch = r.customerName?.toLowerCase().contains(query) ?? false;
        final idMatch = r.id.toLowerCase().contains(query);
        final descMatch = r.description.toLowerCase().contains(query);
        return refMatch || custMatch || idMatch || descMatch;
      }

      return true;
    }).toList();
  }

  void _onStatusFilterChanged(ReceivableFilterStatus status) {
    setState(() {
      _selectedStatus = status;
      _applyFilters();
    });
  }

  @override
  Widget build(BuildContext context) {
    final summary = widget.receivableRepo.computeSummary(_allReceivables);
    final totalOutstanding = summary['totalOutstandingMinor'] as int? ?? 0;
    final openCount = summary['openCount'] as int? ?? 0;
    final totalCount = summary['totalCount'] as int? ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Piutang Usaha'),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _isLoading ? null : _loadReceivables,
          ),
        ],
      ),
      body: Column(
        children: [
          // 1. Top Summary Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Color(0xFF1565C0),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(20),
                bottomRight: Radius.circular(20),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Total Sisa Piutang',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
                const SizedBox(height: 4),
                Text(
                  CurrencyFormatter.formatIDR(totalOutstanding),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _buildSummaryMiniCard(
                      title: 'Belum Lunas',
                      value: '$openCount Transaksi',
                      color: const Color(0xFFFFCC80),
                    ),
                    const SizedBox(width: 8),
                    _buildSummaryMiniCard(
                      title: 'Total Piutang',
                      value: '$totalCount Transaksi',
                      color: Colors.white70,
                    ),
                  ],
                ),
              ],
            ),
          ),

          // 2. Search & Filter Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Cari nomor struk atau pelanggan...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _applyFilters());
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: Colors.grey[100],
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                  ),
                  onChanged: (_) => setState(() => _applyFilters()),
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip('Semua', ReceivableFilterStatus.all),
                      const SizedBox(width: 6),
                      _buildFilterChip('Belum Lunas', ReceivableFilterStatus.unpaid),
                      const SizedBox(width: 6),
                      _buildFilterChip('Lunas', ReceivableFilterStatus.paid),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 16),

          // 3. Content List / States
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.wifi_off, size: 48, color: Colors.orange),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 13),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _loadReceivables,
                                child: const Text('Coba Muat Ulang'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _filteredReceivables.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.receipt_long_outlined, size: 48, color: Colors.grey[400]),
                                const SizedBox(height: 12),
                                Text(
                                  _searchController.text.isNotEmpty
                                      ? 'Tidak ada piutang yang cocok dengan pencarian'
                                      : 'Belum ada data piutang tercatat',
                                  style: TextStyle(color: Colors.grey[600]),
                                ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _loadReceivables,
                            child: ListView.separated(
                              padding: const EdgeInsets.all(12),
                              itemCount: _filteredReceivables.length,
                              separatorBuilder: (context, index) => const SizedBox(height: 8),
                              itemBuilder: (context, index) {
                                final item = _filteredReceivables[index];
                                return _buildReceivableCard(item);
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryMiniCard({
    required String title,
    required String value,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
        decoration: BoxDecoration(
          color: const Color(0x1FFFFFFF),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(color: Colors.white70, fontSize: 10)),
            const SizedBox(height: 2),
            Text(
              value,
              style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, ReceivableFilterStatus status) {
    final isSelected = _selectedStatus == status;
    return ChoiceChip(
      label: Text(label, style: TextStyle(fontSize: 12, color: isSelected ? Colors.white : Colors.black87)),
      selected: isSelected,
      selectedColor: const Color(0xFF1565C0),
      backgroundColor: Colors.grey[200],
      onSelected: (_) => _onStatusFilterChanged(status),
    );
  }

  Widget _buildReceivableCard(Receivable item) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ReceivableDetailScreen(
                receivableId: item.id,
                businessId: widget.businessId,
                businessName: widget.businessName,
                branchName: widget.branchName,
                receivableRepo: widget.receivableRepo,
                printingService: widget.printingService,
                userRole: widget.userRole,
              ),
            ),
          );
          _loadReceivables();
        },
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    item.reference ?? 'REC-${(item.id.length > 8 ? item.id.substring(0, 8) : item.id).toUpperCase()}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: Color(0xFF1565C0),
                    ),
                  ),
                  _buildStatusBadge(item.status),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.person, size: 14, color: Colors.grey),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      item.customerName ?? 'Pelanggan #${item.customerId.length > 8 ? item.customerId.substring(0, 8) : item.customerId}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    item.date,
                    style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                  ),
                ],
              ),
              const Divider(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Total Tagihan', style: TextStyle(fontSize: 10, color: Colors.grey)),
                      Text(
                        CurrencyFormatter.formatIDR(item.amountMinor),
                        style: const TextStyle(fontSize: 12, color: Colors.black87),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text('Sisa Tagihan', style: TextStyle(fontSize: 10, color: Colors.grey)),
                      Text(
                        CurrencyFormatter.formatIDR(item.outstandingMinor),
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: item.outstandingMinor > 0 ? const Color(0xFFC62828) : const Color(0xFF2E7D32),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg;
    Color text;
    String label;

    switch (status.toUpperCase()) {
      case 'OPEN':
        bg = const Color(0xFFFFEBEE);
        text = const Color(0xFFC62828);
        label = 'BELUM LUNAS';
        break;
      case 'PARTIAL':
        bg = const Color(0xFFFFF3E0);
        text = const Color(0xFFE65100);
        label = 'SEBAGIAN';
        break;
      case 'PAID':
        bg = const Color(0xFFE8F5E9);
        text = const Color(0xFF2E7D32);
        label = 'LUNAS';
        break;
      case 'REVERSED':
        bg = const Color(0xFFECEFF1);
        text = const Color(0xFF546E7A);
        label = 'DIBATALKAN';
        break;
      default:
        bg = const Color(0xFFF5F5F5);
        text = Colors.grey;
        label = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: text),
      ),
    );
  }
}
