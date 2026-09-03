import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/inventory/data/stock_repository.dart';
import 'package:biz_erp_mobile/inventory/domain/stock.dart';
import 'package:biz_erp_mobile/inventory/presentation/stock_detail_screen.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';

class StockListScreen extends StatefulWidget {
  final String businessId;
  final String branchId;
  final StockRepository stockRepo;
  final SyncApiClient apiClient;
  final String userRole;

  const StockListScreen({
    super.key,
    required this.businessId,
    required this.branchId,
    required this.stockRepo,
    required this.apiClient,
    required this.userRole,
  });

  @override
  State<StockListScreen> createState() => _StockListScreenState();
}

class _StockListScreenState extends State<StockListScreen> {
  List<Stock> _stocks = [];
  bool _isLoading = true;
  String? _error;
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final stocks = await widget.stockRepo.listStocks(widget.businessId, widget.branchId);
      if (!mounted) return;
      setState(() {
        _stocks = stocks;
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

  List<Stock> get _filtered {
    var list = _stocks;
    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.trim().toLowerCase();
      list = list.where((s) =>
          s.productName.toLowerCase().contains(q) ||
          (s.sku?.toLowerCase().contains(q) ?? false) ||
          (s.barcode?.toLowerCase().contains(q) ?? false)).toList();
    }
    return list;
  }

  void _openDetail(Stock stock) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => StockDetailScreen(
          businessId: widget.businessId,
          branchId: widget.branchId,
          productId: stock.productId,
          stockRepo: widget.stockRepo,
          apiClient: widget.apiClient,
          userRole: widget.userRole,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Stok Barang', style: TextStyle(color: Colors.white)),
        backgroundColor: Colors.blueGrey[800],
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load, tooltip: 'Muat Ulang'),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Cari nama produk, SKU, atau barcode...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onChanged: (v) => setState(() => _searchQuery = v),
            ),
          ),
          Expanded(child: _buildBody(filtered)),
        ],
      ),
    );
  }

  Widget _buildBody(List<Stock> filtered) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 12),
            Text('Gagal memuat stok', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 16),
            ElevatedButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Coba Lagi')),
          ]),
        ),
      );
    }
    if (filtered.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.inventory_2_outlined, size: 64, color: Colors.grey),
            SizedBox(height: 12),
            Text('Belum ada data stok', style: TextStyle(fontSize: 16, color: Colors.grey)),
          ]),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      itemCount: filtered.length,
      separatorBuilder: (_, _) => const SizedBox(height: 4),
      itemBuilder: (context, i) => _StockListItem(stock: filtered[i], onTap: () => _openDetail(filtered[i])),
    );
  }
}

class _StockListItem extends StatelessWidget {
  final Stock stock;
  final VoidCallback onTap;
  const _StockListItem({required this.stock, required this.onTap});

  Color _statusColor() {
    if (stock.isOutOfStock) return Colors.red;
    if (stock.isLowStock) return Colors.orange;
    return Colors.green;
  }

  String _statusText() {
    if (stock.isOutOfStock) return 'Habis';
    if (stock.isLowStock) return 'Stok Rendah';
    return 'Tersedia';
  }

  @override
  Widget build(BuildContext context) {
    final color = _statusColor();
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(color: Colors.blueGrey[100], borderRadius: BorderRadius.circular(8)),
              child: Icon(Icons.inventory_2, color: Colors.blueGrey[700]),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(stock.productName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                if (stock.sku != null && stock.sku!.isNotEmpty)
                  Text('SKU: ${stock.sku}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                const SizedBox(height: 4),
                Row(children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: color.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(4)),
                    child: Text(_statusText(), style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
                  ),
                ]),
              ]),
            ),
            const SizedBox(width: 8),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('${stock.quantity}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              Text('Qty', style: TextStyle(fontSize: 10, color: Colors.grey.shade600)),
              const SizedBox(height: 2),
              Text(CurrencyFormatter.formatIDR(stock.priceMinor), style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
            ]),
          ]),
        ),
      ),
    );
  }
}
