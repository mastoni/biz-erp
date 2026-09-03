import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/inventory/data/stock_repository.dart';
import 'package:biz_erp_mobile/inventory/domain/stock.dart';
import 'package:biz_erp_mobile/inventory/domain/stock_movement.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:uuid/uuid.dart';

class StockDetailScreen extends StatefulWidget {
  final String businessId;
  final String branchId;
  final String productId;
  final StockRepository stockRepo;
  final SyncApiClient apiClient;
  final String userRole;

  const StockDetailScreen({
    super.key,
    required this.businessId,
    required this.branchId,
    required this.productId,
    required this.stockRepo,
    required this.apiClient,
    required this.userRole,
  });

  @override
  State<StockDetailScreen> createState() => _StockDetailScreenState();
}

class _StockDetailScreenState extends State<StockDetailScreen> {
  Stock? _stock;
  List<StockMovement> _movements = [];
  bool _isLoading = true;
  bool _isLoadingMovements = false;
  bool _isAdjusting = false;
  String? _error;
  String? _adjustError;
  String? _adjustSuccess;

  final TextEditingController _adjustmentController = TextEditingController();
  final TextEditingController _referenceController = TextEditingController();
  String _movementType = 'ADJUSTMENT';

  @override
  void initState() {
    super.initState();
    _loadStock();
    _loadMovements();
  }

  @override
  void dispose() {
    _adjustmentController.dispose();
    _referenceController.dispose();
    super.dispose();
  }

  Future<void> _loadStock() async {
    setState(() => _isLoading = true);
    try {
      final stock = await widget.stockRepo.getStockByProductId(
        widget.businessId,
        widget.branchId,
        widget.productId,
      );
      if (!mounted) return;
      setState(() {
        _stock = stock;
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

  Future<void> _loadMovements() async {
    setState(() => _isLoadingMovements = true);
    try {
      final movements = await widget.stockRepo.listMovements(
        widget.businessId,
        widget.branchId,
        productId: widget.productId,
        limit: 100,
      );
      if (!mounted) return;
      setState(() {
        _movements = movements;
        _isLoadingMovements = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoadingMovements = false);
    }
  }

  Future<void> _adjustStock() async {
    final qtyStr = _adjustmentController.text.trim();
    final qty = int.tryParse(qtyStr);
    if (qty == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Masukkan jumlah yang valid')));
      return;
    }

    final ref = _referenceController.text.trim().isEmpty ? null : _referenceController.text.trim();

    setState(() {
      _isAdjusting = true;
      _adjustError = null;
      _adjustSuccess = null;
    });

    try {
      final request = StockAdjustmentRequest(
        businessId: widget.businessId,
        branchId: widget.branchId,
        productId: widget.productId,
        quantityChange: qty,
        expectedServerVersion: _stock?.serverVersion ?? 0,
        reference: ref,
        movementType: _movementType,
      );

      final result = await widget.apiClient.adjustStock(
        request,
        idempotencyKey: const Uuid().v4(),
      );

      if (!mounted) return;

      if (result.ok) {
        setState(() {
          _adjustSuccess = 'Stok berhasil disesuaikan';
          _isAdjusting = false;
          _adjustmentController.clear();
          _referenceController.clear();
        });
        await _loadStock();
        await _loadMovements();
      } else if (result.conflict) {
        setState(() {
          _adjustError = 'Konflik stok: data telah berubah. Silakan muat ulang dan coba lagi.';
          _isAdjusting = false;
        });
      } else {
        setState(() {
          _adjustError = result.error ?? 'Gagal menyesuaikan stok';
          _isAdjusting = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _adjustError = e.toString();
        _isAdjusting = false;
      });
    }
  }

  bool get _canAdjust => widget.userRole == 'OWNER' && widget.businessId.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_stock?.productName ?? 'Detail Stok',
            style: const TextStyle(color: Colors.white, fontSize: 18)),
        backgroundColor: Colors.blueGrey[800],
        foregroundColor: Colors.white,
        actions: [
          if (_canAdjust)
            IconButton(
              icon: const Icon(Icons.swap_horiz),
              onPressed: _stock != null ? () => _showAdjustmentDialog() : null,
              tooltip: 'Sesuaikan Stok',
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : _buildContent(),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.error_outline, size: 48, color: Colors.red),
          const SizedBox(height: 12),
          Text('Gagal memuat detail stok', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
          const SizedBox(height: 16),
          ElevatedButton.icon(onPressed: _loadStock, icon: const Icon(Icons.refresh), label: const Text('Coba Lagi')),
        ]),
      ),
    );
  }

  Widget _buildContent() {
    final stock = _stock;
    if (stock == null) {
      return const Center(child: Text('Stok tidak ditemukan.'));
    }

    final isLow = stock.isLowStock;
    final isOutOfStock = stock.isOutOfStock;
    Color statusColor;
    String statusText;
    if (isOutOfStock) {
      statusColor = Colors.red;
      statusText = 'HABIS';
    } else if (isLow) {
      statusColor = Colors.orange;
      statusText = 'RENDAH';
    } else {
      statusColor = Colors.green;
      statusText = 'CUKUP';
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _buildStockCard(stock, statusColor, statusText),
        const SizedBox(height: 16),
        if (_canAdjust) _buildAdjustmentCard(),
        if (_canAdjust) const SizedBox(height: 16),
        _buildMovementsCard(stock),
        const SizedBox(height: 24),
      ]),
    );
  }

  Widget _buildStockCard(Stock stock, Color statusColor, String statusText) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(stock.productName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          if (stock.sku != null && stock.sku!.isNotEmpty)
            Text('SKU: ${stock.sku}', style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
          const SizedBox(height: 12),
          Wrap(alignment: WrapAlignment.spaceBetween, runSpacing: 8, children: [
            _buildInfoItem('Kuantitas', '${stock.quantity}', valueColor: statusColor, valueWeight: FontWeight.bold),
            _buildStatusBadge(statusColor, statusText),
            _buildInfoItem('Harga Jual', CurrencyFormatter.formatIDR(stock.priceMinor)),
            if (stock.costMinor != null) _buildInfoItem('HPP', CurrencyFormatter.formatIDR(stock.costMinor!)),
            _buildInfoItem('Versi Server', '${stock.serverVersion}'),
            _buildInfoItem('Barcode', stock.barcode ?? '-'),
          ]),
        ]),
      ),
    );
  }

  Widget _buildInfoItem(String label, String value, {Color? valueColor, FontWeight? valueWeight}) {
    return SizedBox(width: 140, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
      Text(value, style: TextStyle(fontSize: 14, color: valueColor, fontWeight: valueWeight)),
    ]));
  }

  Widget _buildStatusBadge(Color color, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }

  Widget _buildAdjustmentCard() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade300)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Row(children: [
            Icon(Icons.swap_horiz, size: 20, color: Colors.blueGrey),
            SizedBox(width: 8),
            Text('Sesuaikan Stok', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          ]),
          const SizedBox(height: 12),
          if (_adjustError != null) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
              child: Text(_adjustError!, style: TextStyle(color: Colors.red.shade900, fontSize: 12)),
            ),
            const SizedBox(height: 8),
          ],
          if (_adjustSuccess != null) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8)),
              child: Text(_adjustSuccess!, style: TextStyle(color: Colors.green.shade900, fontSize: 12)),
            ),
            const SizedBox(height: 8),
          ],
          TextFormField(
            key: const Key('adjustment_qty_field'),
            controller: _adjustmentController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Perubahan Kuantitas',
              hintText: 'Contoh: 10 atau -5',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              isDense: true,
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _movementType,
            items: const [
              DropdownMenuItem(value: 'ADJUSTMENT', child: Text('ADJUSTMENT')),
              DropdownMenuItem(value: 'STOCK_IN', child: Text('STOCK_IN')),
              DropdownMenuItem(value: 'STOCK_OUT', child: Text('STOCK_OUT')),
            ],
            onChanged: (v) => setState(() => _movementType = v ?? 'ADJUSTMENT'),
            decoration: InputDecoration(
              labelText: 'Tipe Pergerakan',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              isDense: true,
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _referenceController,
            decoration: InputDecoration(
              labelText: 'Referensi (opsional)',
              hintText: 'Alasan penyesuaian',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              isDense: true,
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _isAdjusting ? null : _adjustStock,
            child: _isAdjusting
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Simpan Penyesuaian'),
            style: FilledButton.styleFrom(
              backgroundColor: Colors.blueGrey[800],
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ]),
      ),
    );
  }

  void _showAdjustmentDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sesuaikan Stok'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextFormField(
            controller: _adjustmentController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Perubahan Kuantitas', hintText: 'Contoh: 10'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _referenceController,
            decoration: const InputDecoration(labelText: 'Referensi (opsional)'),
          ),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
          FilledButton(onPressed: () {
            Navigator.pop(ctx);
            _adjustStock();
          }, child: _isAdjusting ? const CircularProgressIndicator() : const Text('Simpan')),
        ],
      ),
    );
  }

  Widget _buildMovementsCard(Stock stock) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade300)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Row(children: [
            Icon(Icons.history, size: 20, color: Colors.blueGrey),
            SizedBox(width: 8),
            Text('Riwayat Pergerakan Stok', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          ]),
          const SizedBox(height: 12),
          if (_isLoadingMovements)
            const Center(child: CircularProgressIndicator())
          else if (_movements.isEmpty)
            const Text('Belum ada riwayat pergerakan.', style: TextStyle(fontSize: 13, color: Colors.grey))
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _movements.length,
              separatorBuilder: (_, _) => const Divider(height: 12),
              itemBuilder: (context, i) {
                final m = _movements[i];
                final isPositive = m.quantity >= 0;
                return Row(children: [
                  Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(color: Colors.blueGrey.shade100, borderRadius: BorderRadius.circular(6)),
                    child: Icon(isPositive ? Icons.trending_up : Icons.trending_down, size: 16, color: isPositive ? Colors.green : Colors.red),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(m.movementType, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      if (m.reference != null && m.reference!.isNotEmpty)
                        Text(m.reference!, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                      Text('Oleh: ${m.actor}', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                    ]),
                  ),
                  const SizedBox(width: 8),
                  Text('${isPositive ? '+' : ''}${m.quantity}', style: TextStyle(fontWeight: FontWeight.bold, color: isPositive ? Colors.green : Colors.red, fontSize: 14)),
                ]);
              },
            ),
        ]),
      ),
    );
  }
}
