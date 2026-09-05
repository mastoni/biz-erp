import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/expenses/data/expense_repository.dart';
import 'package:biz_erp_mobile/expenses/domain/expense.dart';
import 'expense_detail_screen.dart';
import 'widgets/expense_create_dialog.dart';

class ExpenseListScreen extends StatefulWidget {
  final String businessId;
  final String? branchId;
  final String? businessName;
  final String? branchName;
  final ExpenseRepository expenseRepo;
  final PrintingService? printingService;
  final String userRole;

  const ExpenseListScreen({
    super.key,
    required this.businessId,
    this.branchId,
    this.businessName,
    this.branchName,
    required this.expenseRepo,
    this.printingService,
    this.userRole = 'CASHIER',
  });

  @override
  State<ExpenseListScreen> createState() => _ExpenseListScreenState();
}

class _ExpenseListScreenState extends State<ExpenseListScreen> {
  List<Expense> _allExpenses = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _selectedStatusFilter = 'ALL';
  String? _selectedCategoryFilter;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadExpenses();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadExpenses() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final expenses = await widget.expenseRepo.listExpenses(
        businessId: widget.businessId,
        branchId: widget.branchId,
        search: _searchQuery.isNotEmpty ? _searchQuery : null,
      );

      if (mounted) {
        setState(() {
          _allExpenses = expenses;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage =
              'Gagal memuat data pengeluaran operasional. Pastikan perangkat terhubung dengan server ERP.\n($e)';
        });
      }
    }
  }

  List<Expense> get _filteredExpenses {
    var list = _allExpenses;

    // Status filter
    if (_selectedStatusFilter == 'DRAFT') {
      list = list.where((e) => e.isDraft).toList();
    } else if (_selectedStatusFilter == 'POSTED') {
      list = list.where((e) => e.isPosted).toList();
    }

    // Category filter
    if (_selectedCategoryFilter != null && _selectedCategoryFilter!.isNotEmpty && _selectedCategoryFilter != 'SEMUA') {
      list = list.where((e) => e.category == _selectedCategoryFilter).toList();
    }

    // Search query filter (local refinement)
    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.toLowerCase().trim();
      list = list.where((e) {
        final ref = (e.reference ?? '').toLowerCase();
        final desc = e.description.toLowerCase();
        final cat = (e.category ?? '').toLowerCase();
        return ref.contains(q) || desc.contains(q) || cat.contains(q);
      }).toList();
    }

    return list;
  }

  Future<void> _openCreateDialog() async {
    final created = await showDialog<Expense>(
      context: context,
      builder: (_) => ExpenseCreateDialog(
        businessId: widget.businessId,
        branchId: widget.branchId,
        expenseRepo: widget.expenseRepo,
        userRole: widget.userRole,
      ),
    );

    if (created != null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Pengeluaran operasional berhasil dicatat.'),
            backgroundColor: Color(0xFF2E7D32),
          ),
        );
      }
      await _loadExpenses();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = widget.userRole.toUpperCase() == 'OWNER';
    final summary = widget.expenseRepo.computeSummary(_allExpenses);
    final displayedItems = _filteredExpenses;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pengeluaran Operasional'),
        backgroundColor: const Color(0xFFC62828),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _isLoading ? null : _loadExpenses,
          ),
        ],
      ),
      floatingActionButton: isOwner
          ? FloatingActionButton.extended(
              onPressed: _openCreateDialog,
              backgroundColor: const Color(0xFFC62828),
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: const Text('Catat Biaya', style: TextStyle(fontWeight: FontWeight.bold)),
            )
          : null,
      body: Column(
        children: [
          // 1. KPI Summary Card
          _buildSummaryCard(summary),

          // 2. Search & Category / Status Filters
          _buildFilterBar(),

          // 3. Main List Content
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                    ? _buildErrorState()
                    : displayedItems.isEmpty
                        ? _buildEmptyState()
                        : RefreshIndicator(
                            onRefresh: _loadExpenses,
                            child: ListView.separated(
                              padding: const EdgeInsets.only(left: 16, right: 16, top: 8, bottom: 80),
                              itemCount: displayedItems.length,
                              separatorBuilder: (context, index) => const SizedBox(height: 8),
                              itemBuilder: (context, index) {
                                final item = displayedItems[index];
                                return _buildExpenseCard(item);
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(ExpenseSummary summary) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFC62828), Color(0xFFE53935)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x29000000),
            blurRadius: 8,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Flexible(
                child: Text(
                  'Total Pengeluaran Toko',
                  style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0x1FFFFFFF),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${summary.count} transaksi',
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            CurrencyFormatter.formatIDR(summary.totalAmountMinor),
            style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _buildMetricPill(
                title: 'Draft',
                amountMinor: summary.draftAmountMinor,
                color: Colors.amber,
              ),
              const SizedBox(width: 8),
              _buildMetricPill(
                title: 'Posted (GL)',
                amountMinor: summary.postedAmountMinor,
                color: Colors.lightGreenAccent,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricPill({
    required String title,
    required int amountMinor,
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
              CurrencyFormatter.formatIDR(amountMinor),
              style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          // Search box
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Cari deskripsi, kategori, atau referensi...',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () {
                        setState(() {
                          _searchQuery = '';
                          _searchController.clear();
                        });
                        _loadExpenses();
                      },
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onChanged: (val) {
              setState(() => _searchQuery = val);
            },
            onSubmitted: (_) => _loadExpenses(),
          ),
          const SizedBox(height: 8),

          // Filter Chips (Status & Category)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                ChoiceChip(
                  label: const Text('Semua'),
                  selected: _selectedStatusFilter == 'ALL' && _selectedCategoryFilter == null,
                  onSelected: (selected) {
                    if (selected) {
                      setState(() {
                        _selectedStatusFilter = 'ALL';
                        _selectedCategoryFilter = null;
                      });
                    }
                  },
                ),
                const SizedBox(width: 6),
                ChoiceChip(
                  label: const Text('Draft'),
                  selected: _selectedStatusFilter == 'DRAFT',
                  onSelected: (selected) {
                    setState(() => _selectedStatusFilter = selected ? 'DRAFT' : 'ALL');
                  },
                ),
                const SizedBox(width: 6),
                ChoiceChip(
                  label: const Text('Posted'),
                  selected: _selectedStatusFilter == 'POSTED',
                  onSelected: (selected) {
                    setState(() => _selectedStatusFilter = selected ? 'POSTED' : 'ALL');
                  },
                ),
                const SizedBox(width: 12),
                const Text('|', style: TextStyle(color: Colors.grey)),
                const SizedBox(width: 12),
                ...kExpenseCategories.map((cat) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: FilterChip(
                      label: Text(cat),
                      selected: _selectedCategoryFilter == cat,
                      onSelected: (selected) {
                        setState(() => _selectedCategoryFilter = selected ? cat : null);
                      },
                    ),
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildExpenseCard(Expense item) {
    final expIdShort = item.id.length > 8 ? item.id.substring(0, 8) : item.id;

    return Card(
      elevation: 0.8,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFEEEEEE)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ExpenseDetailScreen(
                expenseId: item.id,
                businessId: widget.businessId,
                businessName: widget.businessName,
                branchName: widget.branchName,
                expenseRepo: widget.expenseRepo,
                printingService: widget.printingService,
                userRole: widget.userRole,
              ),
            ),
          ).then((_) => _loadExpenses());
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    item.reference ?? 'EXP-${expIdShort.toUpperCase()}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: Color(0xFFC62828),
                    ),
                  ),
                  _buildStatusBadge(item.status),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                item.description,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.category, size: 13, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text(
                    item.category ?? 'Operasional',
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                  const Spacer(),
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
                  Text(
                    item.method.toUpperCase(),
                    style: const TextStyle(fontSize: 11, color: Colors.black54, fontWeight: FontWeight.w500),
                  ),
                  Text(
                    CurrencyFormatter.formatIDR(item.amountMinor),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFC62828),
                    ),
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

    switch (status.toLowerCase()) {
      case 'draft':
        bg = const Color(0xFFFFF3E0);
        text = const Color(0xFFE65100);
        label = 'DRAFT';
        break;
      case 'posted':
        bg = const Color(0xFFE8F5E9);
        text = const Color(0xFF2E7D32);
        label = 'POSTED';
        break;
      case 'reversed':
        bg = const Color(0xFFECEFF1);
        text = const Color(0xFF546E7A);
        label = 'DIBATALKAN';
        break;
      default:
        bg = const Color(0xFFF5F5F5);
        text = Colors.grey;
        label = status.toUpperCase();
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

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.receipt_long_outlined, size: 56, color: Colors.grey),
            const SizedBox(height: 12),
            const Text(
              'Belum ada catatan pengeluaran operasional.',
              style: TextStyle(color: Colors.grey, fontSize: 14),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              _searchQuery.isNotEmpty
                  ? 'Coba ubah kata kunci pencarian atau filter status/kategori.'
                  : 'Gunakan tombol "Catat Biaya" untuk menambahkan pengeluaran baru.',
              style: const TextStyle(color: Colors.grey, fontSize: 12),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off, size: 56, color: Colors.red),
            const SizedBox(height: 12),
            const Text(
              'Memerlukan Koneksi Server',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 8),
            Text(
              _errorMessage!,
              style: const TextStyle(color: Colors.grey, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _loadExpenses,
              icon: const Icon(Icons.refresh),
              label: const Text('Coba Lagi'),
            ),
          ],
        ),
      ),
    );
  }
}
