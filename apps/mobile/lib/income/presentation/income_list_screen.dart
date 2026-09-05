import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/income/data/income_repository.dart';
import 'package:biz_erp_mobile/income/domain/income.dart';
import 'package:biz_erp_mobile/income/presentation/income_detail_screen.dart';
import 'package:biz_erp_mobile/income/presentation/widgets/income_create_dialog.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';

class IncomeListScreen extends StatefulWidget {
  final String businessId;
  final String? branchId;
  final IncomeRepository incomeRepo;
  final PrintingService? printingService;
  final String userRole;

  const IncomeListScreen({
    super.key,
    required this.businessId,
    this.branchId,
    required this.incomeRepo,
    this.printingService,
    required this.userRole,
  });

  @override
  State<IncomeListScreen> createState() => _IncomeListScreenState();
}

class _IncomeListScreenState extends State<IncomeListScreen> {
  final _searchController = TextEditingController();

  List<Income> _items = [];
  IncomeSummary _summary = const IncomeSummary(
    totalMinor: 0,
    totalCount: 0,
    draftCount: 0,
    postedCount: 0,
    draftMinor: 0,
    postedMinor: 0,
  );

  bool _isLoading = false;
  String? _errorMessage;
  String _selectedStatusFilter = 'all'; // 'all', 'draft', 'posted'
  String? _selectedCategory;
  DateTimeRange? _selectedDateRange;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _formatDateIso(DateTime dt) {
    final y = dt.year.toString().padLeft(4, '0');
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final statusParam = _selectedStatusFilter == 'all' ? null : _selectedStatusFilter;
      final dateFromParam =
          _selectedDateRange != null ? _formatDateIso(_selectedDateRange!.start) : null;
      final dateToParam =
          _selectedDateRange != null ? _formatDateIso(_selectedDateRange!.end) : null;

      final result = await widget.incomeRepo.listIncome(
        businessId: widget.businessId,
        branchId: widget.branchId,
        status: statusParam,
        category: _selectedCategory,
        dateFrom: dateFromParam,
        dateTo: dateToParam,
        search: _searchController.text.trim().isEmpty ? null : _searchController.text.trim(),
      );

      final summary = widget.incomeRepo.computeSummary(result);

      if (mounted) {
        setState(() {
          _items = result;
          _summary = summary;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString().contains('SocketException') ||
                  e.toString().contains('Network error')
              ? 'Tidak dapat terhubung ke server (Offline). Data pendapatan tidak dapat dimuat.'
              : 'Gagal memuat pendapatan: ${e.toString().replaceAll('Exception: ', '').replaceAll('HttpException: ', '')}';
        });
      }
    }
  }

  Future<void> _openCreateDialog() async {
    final created = await showDialog<Income>(
      context: context,
      barrierDismissible: false,
      builder: (_) => IncomeCreateDialog(
        businessId: widget.businessId,
        branchId: widget.branchId,
        incomeRepo: widget.incomeRepo,
        userRole: widget.userRole,
      ),
    );

    if (created != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Pendapatan berhasil dicatat: ${CurrencyFormatter.formatIDR(created.amountMinor)}',
          ),
          backgroundColor: const Color(0xFF0D9488),
        ),
      );
      _loadData();
    }
  }

  Future<void> _pickDateRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDateRange: _selectedDateRange,
    );

    if (picked != null) {
      setState(() => _selectedDateRange = picked);
      _loadData();
    }
  }

  void _clearDateRange() {
    setState(() => _selectedDateRange = null);
    _loadData();
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'posted':
        return Colors.green;
      case 'reversed':
        return Colors.red;
      case 'draft':
      default:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = widget.userRole.toUpperCase() == 'OWNER';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pendapatan Operasional'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Segarkan',
            onPressed: _isLoading ? null : _loadData,
          ),
        ],
      ),
      floatingActionButton: isOwner
          ? FloatingActionButton.extended(
              backgroundColor: const Color(0xFF0D9488),
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: const Text('Catat Pendapatan'),
              onPressed: _openCreateDialog,
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: Column(
          children: [
            // KPI Summary Header
            Container(
              color: Colors.teal.shade50,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Card(
                      elevation: 1,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Total Pendapatan',
                              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                            ),
                            const SizedBox(height: 4),
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Text(
                                CurrencyFormatter.formatIDR(_summary.totalMinor),
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF0D9488),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Card(
                      elevation: 1,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Jumlah Transaksi',
                              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${_summary.totalCount} Entri',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1E293B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Search Bar & Filter Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Cari keterangan, kategori, referensi...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            _loadData();
                          },
                        )
                      : null,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onSubmitted: (_) => _loadData(),
              ),
            ),

            // Filter Chips Bar
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                children: [
                  // Status: Semua
                  ChoiceChip(
                    label: const Text('Semua'),
                    selected: _selectedStatusFilter == 'all',
                    onSelected: (sel) {
                      if (sel) {
                        setState(() => _selectedStatusFilter = 'all');
                        _loadData();
                      }
                    },
                  ),
                  const SizedBox(width: 6),

                  // Status: Draft
                  ChoiceChip(
                    label: Text('Draft (${_summary.draftCount})'),
                    selected: _selectedStatusFilter == 'draft',
                    onSelected: (sel) {
                      if (sel) {
                        setState(() => _selectedStatusFilter = 'draft');
                        _loadData();
                      }
                    },
                  ),
                  const SizedBox(width: 6),

                  // Status: Posted
                  ChoiceChip(
                    label: Text('Posted (${_summary.postedCount})'),
                    selected: _selectedStatusFilter == 'posted',
                    onSelected: (sel) {
                      if (sel) {
                        setState(() => _selectedStatusFilter = 'posted');
                        _loadData();
                      }
                    },
                  ),
                  const SizedBox(width: 8),

                  // Date range picker chip
                  ActionChip(
                    avatar: const Icon(Icons.calendar_today, size: 14),
                    label: Text(
                      _selectedDateRange == null
                          ? 'Rentang Tanggal'
                          : '${_formatDateIso(_selectedDateRange!.start)} - ${_formatDateIso(_selectedDateRange!.end)}',
                    ),
                    onPressed: _pickDateRange,
                  ),
                  if (_selectedDateRange != null) ...[
                    const SizedBox(width: 4),
                    IconButton(
                      icon: const Icon(Icons.close, size: 16),
                      tooltip: 'Hapus filter tanggal',
                      onPressed: _clearDateRange,
                    ),
                  ],
                ],
              ),
            ),
            const Divider(height: 12),

            // Content Area
            Expanded(
              child: _buildBody(),
            ),
          ],
        ),
      ),
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
                onPressed: _loadData,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Coba Lagi'),
              ),
            ],
          ),
        ),
      );
    }

    if (_items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.inbox, size: 48, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              const Text(
                'Belum ada data pendapatan operasional',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 6),
              const Text(
                'Catat pendapatan di luar transaksi kasir untuk memantau arus kas toko.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _items.length,
      separatorBuilder: (context, index) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final item = _items[index];
        return Card(
          elevation: 1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            leading: CircleAvatar(
              backgroundColor: const Color(0xFF0D9488).withValues(alpha: 0.12),
              child: const Icon(Icons.attach_money, color: Color(0xFF0D9488)),
            ),
            title: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    item.description,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                ),
                Text(
                  CurrencyFormatter.formatIDR(item.amountMinor),
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: Color(0xFF0D9488),
                  ),
                ),
              ],
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Text(
                      '${item.date} • ${item.category ?? 'Lainnya'}',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _getStatusColor(item.status).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      item.formattedStatus,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: _getStatusColor(item.status),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => IncomeDetailScreen(
                    income: item,
                    printingService: widget.printingService,
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
