import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';
import 'package:biz_erp_mobile/purchases/data/purchase_repository.dart';
import 'package:biz_erp_mobile/purchases/domain/purchase.dart';
import 'purchase_detail_screen.dart';
import 'purchase_status_badge.dart';

enum PurchaseStatusFilter {
  all(null, 'Semua'),
  draft('draft', 'Draft'),
  sent('sent', 'Dikirim'),
  partial('partial', 'Parsial'),
  received('received', 'Diterima'),
  cancelled('cancelled', 'Dibatalkan');

  final String? statusCode;
  final String label;
  const PurchaseStatusFilter(this.statusCode, this.label);
}

class PurchaseListScreen extends StatefulWidget {
  final String businessId;
  final String branchId;
  final PurchaseRepository purchaseRepo;
  final SyncApiClient? syncApiClient;
  final SyncStatusNotifier? syncStatusNotifier;
  final String userRole;
  final bool isOnline;
  final void Function(Purchase purchase)? onPurchaseSelected;

  const PurchaseListScreen({
    super.key,
    required this.businessId,
    required this.branchId,
    required this.purchaseRepo,
    this.syncApiClient,
    this.syncStatusNotifier,
    required this.userRole,
    this.isOnline = true,
    this.onPurchaseSelected,
  });

  @override
  State<PurchaseListScreen> createState() => _PurchaseListScreenState();
}

class _PurchaseListScreenState extends State<PurchaseListScreen> {
  List<Purchase> _allPurchases = [];
  bool _isLoading = true;
  String? _error;
  PurchaseStatusFilter _selectedFilter = PurchaseStatusFilter.all;
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    widget.syncStatusNotifier?.addListener(_onSyncChanged);
  }

  @override
  void didUpdateWidget(covariant PurchaseListScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.businessId != widget.businessId || oldWidget.branchId != widget.branchId) {
      _load();
    }
  }

  @override
  void dispose() {
    widget.syncStatusNotifier?.removeListener(_onSyncChanged);
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSyncChanged() {
    if (mounted) _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final list = await widget.purchaseRepo.listPurchases(
        widget.businessId,
        widget.branchId,
      );

      if (!mounted) return;
      setState(() {
        _allPurchases = list;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  List<Purchase> get _filteredPurchases {
    var list = _allPurchases;

    if (_selectedFilter.statusCode != null) {
      list = list.where((p) => p.status.toLowerCase() == _selectedFilter.statusCode!.toLowerCase()).toList();
    }

    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.trim().toLowerCase();
      list = list.where((p) {
        final matchCode = p.code.toLowerCase().contains(q);
        final matchSupplier = (p.supplierName ?? '').toLowerCase().contains(q);
        final matchSupplierCode = (p.supplierCode ?? '').toLowerCase().contains(q);
        final matchNote = (p.note ?? '').toLowerCase().contains(q);
        final matchProduct = p.items.any((i) => i.productName.toLowerCase().contains(q));
        return matchCode || matchSupplier || matchSupplierCode || matchNote || matchProduct;
      }).toList();
    }

    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Pembelian (PO)',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _load,
            tooltip: 'Segarkan',
          ),
        ],
      ),
      body: Column(
        children: [
          if (!widget.isOnline) _buildOfflineBanner(),
          _buildSearchAndFilters(),
          Expanded(child: _buildContent()),
        ],
      ),
    );
  }

  Widget _buildOfflineBanner() {
    return Container(
      width: double.infinity,
      color: Colors.amber.shade100,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: [
          Icon(Icons.wifi_off, size: 16, color: Colors.amber.shade900),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Mode Offline — Menampilkan cache data lokal.',
              style: TextStyle(fontSize: 12, color: Colors.amber.shade900, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchAndFilters() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Column(
        children: [
          TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: 'Cari no. PO, supplier, atau catatan...',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      onPressed: () {
                        setState(() {
                          _searchCtrl.clear();
                          _searchQuery = '';
                        });
                      },
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
              filled: true,
              fillColor: Colors.grey.shade100,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (val) {
              setState(() {
                _searchQuery = val;
              });
            },
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: PurchaseStatusFilter.values.map((filter) {
                final isSelected = _selectedFilter == filter;
                return Padding(
                  padding: const EdgeInsets.only(right: 6.0),
                  child: FilterChip(
                    label: Text(
                      filter.label,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        color: isSelected ? Colors.white : Colors.black87,
                      ),
                    ),
                    selected: isSelected,
                    selectedColor: const Color(0xFF17593E),
                    backgroundColor: Colors.grey.shade100,
                    showCheckmark: false,
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    onSelected: (selected) {
                      setState(() {
                        _selectedFilter = filter;
                      });
                    },
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
              const SizedBox(height: 12),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15, color: Colors.black87),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Coba Lagi'),
              ),
            ],
          ),
        ),
      );
    }

    final purchases = _filteredPurchases;

    if (purchases.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.shopping_bag_outlined, size: 54, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              const Text(
                'Tidak ada data pembelian',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black87),
              ),
              const SizedBox(height: 6),
              Text(
                _searchQuery.isNotEmpty || _selectedFilter != PurchaseStatusFilter.all
                    ? 'Tidak ada transaksi yang cocok dengan filter.'
                    : 'Belum ada pesanan pembelian di cabang ini.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: purchases.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final po = purchases[index];
        return _buildPurchaseCard(po);
      },
    );
  }

  Widget _buildPurchaseCard(Purchase po) {
    final totalOrdered = po.items.fold<int>(0, (sum, i) => sum + i.orderedQty);
    final totalReceived = po.items.fold<int>(0, (sum, i) => sum + i.receivedQty);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () {
          if (widget.onPurchaseSelected != null) {
            widget.onPurchaseSelected!(po);
          } else {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => PurchaseDetailScreen(
                  purchaseId: po.id,
                  businessId: widget.businessId,
                  branchId: widget.branchId,
                  purchaseRepo: widget.purchaseRepo,
                  syncApiClient: widget.syncApiClient,
                  userRole: widget.userRole,
                  isOnline: widget.isOnline,
                ),
              ),
            );
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(14.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      po.code,
                      key: Key('po_code_${po.id}'),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  PurchaseStatusBadge(status: po.status),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.store_outlined, size: 15, color: Colors.grey.shade700),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      po.supplierName ?? po.supplierId,
                      key: Key('supplier_name_${po.id}'),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.blueGrey.shade50,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: Colors.blueGrey.shade200),
                    ),
                    child: Text(
                      po.supplierTerm,
                      style: TextStyle(fontSize: 11, color: Colors.blueGrey.shade900, fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                spacing: 8,
                runSpacing: 4,
                children: [
                  Text(
                    'Tgl: ${po.date}',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  Text(
                    'Jatuh Tempo: ${po.dueDate}',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
              const Divider(height: 16),
              Text(
                'Penerimaan barang: $totalReceived / $totalOrdered item',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
              ),
              const SizedBox(height: 8),
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                spacing: 12,
                runSpacing: 6,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Total', style: TextStyle(fontSize: 11, color: Colors.grey)),
                      Text(
                        CurrencyFormatter.formatIDR(po.totalMinor),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Diterima', style: TextStyle(fontSize: 11, color: Colors.grey)),
                      Text(
                        CurrencyFormatter.formatIDR(po.receivedMinor),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF17593E),
                        ),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Terbayar', style: TextStyle(fontSize: 11, color: Colors.grey)),
                      Text(
                        CurrencyFormatter.formatIDR(po.paidMinor),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF17593E),
                        ),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Sisa', style: TextStyle(fontSize: 11, color: Colors.grey)),
                      Text(
                        CurrencyFormatter.formatIDR(po.outstandingMinor),
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: po.outstandingMinor > 0 ? FontWeight.bold : FontWeight.normal,
                          color: po.outstandingMinor > 0 ? Colors.red.shade700 : Colors.grey.shade600,
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
}
