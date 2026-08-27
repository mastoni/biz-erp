import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/core/sync/sync_api_client.dart';
import 'package:biz_erp_mobile/core/sync/sync_models.dart';
import 'package:biz_erp_mobile/purchases/data/purchase_repository.dart';
import 'package:biz_erp_mobile/purchases/domain/purchase.dart';
import 'package:uuid/uuid.dart';
import 'purchase_status_badge.dart';

class PurchaseDetailScreen extends StatefulWidget {
  final String purchaseId;
  final String businessId;
  final String branchId;
  final PurchaseRepository purchaseRepo;
  final SyncApiClient? syncApiClient;
  final String userRole;
  final bool isOnline;

  const PurchaseDetailScreen({
    super.key,
    required this.purchaseId,
    required this.businessId,
    required this.branchId,
    required this.purchaseRepo,
    this.syncApiClient,
    required this.userRole,
    this.isOnline = true,
  });

  @override
  State<PurchaseDetailScreen> createState() => _PurchaseDetailScreenState();
}

class _PurchaseDetailScreenState extends State<PurchaseDetailScreen> {
  Purchase? _purchase;
  bool _isLoading = true;
  String? _error;
  List<PurchasePaymentDto> _onlinePayments = [];
  bool _isLoadingPayments = false;
  bool _isPaymentFetchFailed = false;
  bool _isSending = false;
  bool _isReceiving = false;
  bool _showReceiveForm = false;
  final Map<String, TextEditingController> _receiveQtyControllers = {};
  final Map<String, int> _initialReceivedQty = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final po = await widget.purchaseRepo.getPurchaseById(
        widget.purchaseId,
        widget.businessId,
        widget.branchId,
      );

      if (!mounted) return;

      if (po == null) {
        setState(() {
          _purchase = null;
          _isLoading = false;
          _error = 'Pesanan pembelian tidak ditemukan.';
        });
        return;
      }

      setState(() {
        _purchase = po;
        _isLoading = false;
      });

      if (widget.isOnline && widget.syncApiClient != null) {
        await _loadOnlinePayments();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _loadOnlinePayments() async {
    if (widget.syncApiClient == null) return;
    setState(() {
      _isLoadingPayments = true;
      _isPaymentFetchFailed = false;
    });

    try {
      final detail = await widget.syncApiClient!.getPurchase(id: widget.purchaseId);
      if (!mounted) return;
      setState(() {
        _onlinePayments = detail.payments;
        _isLoadingPayments = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoadingPayments = false;
        _isPaymentFetchFailed = true;
      });
    }
  }

  Future<void> _sendPurchase() async {
    final po = _purchase!;
    if (!widget.isOnline || widget.syncApiClient == null) {
      _showSnackBar('Tidak dapat mengirim PO: mode offline', isError: true);
      return;
    }
    if (widget.userRole != 'OWNER') {
      _showSnackBar('Hanya OWNER yang dapat mengirim PO ke supplier', isError: true);
      return;
    }
    if (po.status != 'draft') {
      _showSnackBar('Hanya PO draft yang dapat dikirim ke supplier', isError: true);
      return;
    }

    setState(() => _isSending = true);

    try {
      final idempotencyKey = const Uuid().v4();
      final updatedPo = await widget.purchaseRepo.sendPurchase(
        po.id,
        widget.businessId,
        widget.branchId,
        syncApiClient: widget.syncApiClient!,
        idempotencyKey: idempotencyKey,
      );

      if (!mounted) return;
      _showSnackBar('PO berhasil dikirim ke supplier', isError: false);
      setState(() {
        _purchase = updatedPo;
        _isSending = false;
      });
    } on StateError catch (e) {
      if (!mounted) return;
      _showSnackBar(e.message, isError: true);
      setState(() => _isSending = false);
    } catch (e) {
      if (!mounted) return;
      _showSnackBar('Gagal mengirim PO: $e', isError: true);
      setState(() => _isSending = false);
    }
  }

  void _showSnackBar(String message, {required bool isError}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red.shade700 : const Color(0xFF17593E),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _toggleReceiveForm() {
    if (_purchase == null) return;
    setState(() {
      _showReceiveForm = !_showReceiveForm;
      if (_showReceiveForm) {
        // Initialize controllers
        for (final item in _purchase!.items) {
          _receiveQtyControllers[item.id] = TextEditingController(text: '0');
          _initialReceivedQty[item.id] = item.receivedQty;
        }
      } else {
        // Dispose controllers
        for (final controller in _receiveQtyControllers.values) {
          controller.dispose();
        }
        _receiveQtyControllers.clear();
        _initialReceivedQty.clear();
      }
    });
  }

  Future<void> _receivePurchase() async {
    final po = _purchase!;
    if (!widget.isOnline || widget.syncApiClient == null) {
      _showSnackBar('Tidak dapat menerima barang: mode offline', isError: true);
      return;
    }
    if (po.status != 'sent' && po.status != 'partial') {
      _showSnackBar('Hanya PO dengan status "sent" atau "partial" yang dapat menerima barang', isError: true);
      return;
    }

    // Validate receive quantities
    final lines = <ReceiveLine>[];
    var hasPositiveQty = false;
    for (final item in po.items) {
      final controller = _receiveQtyControllers[item.id];
      if (controller != null) {
        final qty = int.tryParse(controller.text) ?? 0;
        if (qty < 0) {
          _showSnackBar('Jumlah terima tidak boleh negatif', isError: true);
          return;
        }
        final remaining = item.orderedQty - item.receivedQty;
        if (qty > remaining) {
          _showSnackBar('Jumlah terima (${qty}) melebihi sisa pesanan (${remaining}) untuk ${item.productName}', isError: true);
          return;
        }
        if (qty > 0) {
          hasPositiveQty = true;
          lines.add(ReceiveLine(itemId: item.id, receiveQty: qty));
        }
      }
    }
    if (!hasPositiveQty) {
      _showSnackBar('Minimal satu item harus memiliki jumlah terima > 0', isError: true);
      return;
    }

    setState(() => _isReceiving = true);

    try {
      final idempotencyKey = const Uuid().v4();
      final updatedPo = await widget.purchaseRepo.receivePurchase(
        po.id,
        widget.businessId,
        widget.branchId,
        syncApiClient: widget.syncApiClient!,
        idempotencyKey: idempotencyKey,
        lines: lines,
      );

      if (!mounted) return;
      _showSnackBar('Barang berhasil diterima', isError: false);
      setState(() {
        _purchase = updatedPo;
        _isReceiving = false;
        _showReceiveForm = false;
        for (final controller in _receiveQtyControllers.values) {
          controller.dispose();
        }
        _receiveQtyControllers.clear();
        _initialReceivedQty.clear();
      });
    } on StateError catch (e) {
      if (!mounted) return;
      _showSnackBar(e.message, isError: true);
      setState(() => _isReceiving = false);
    } catch (e) {
      if (!mounted) return;
      _showSnackBar('Gagal menerima barang: $e', isError: true);
      setState(() => _isReceiving = false);
    }
  }

  Widget _buildReceiveActionCard(Purchase po) {
    final canReceive = widget.isOnline && widget.syncApiClient != null &&
        (widget.userRole == 'OWNER' || widget.userRole == 'CASHIER') &&
        (po.status == 'sent' || po.status == 'partial');

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (po.status == 'partial') ...[
              Row(
                children: [
                  Icon(Icons.local_shipping_outlined, size: 20, color: Colors.blue.shade700),
                  const SizedBox(width: 8),
                  Text(
                    'Penerimaan Sebagian (${po.receivePercentage}%)',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.blue.shade800),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              LinearProgressIndicator(
                value: po.receivePercentage / 100,
                backgroundColor: Colors.grey.shade200,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.blue.shade700),
                minHeight: 6,
                borderRadius: BorderRadius.circular(3),
              ),
              const SizedBox(height: 8),
              Text(
                'Diterima: ${po.receivedTotalQty} dari ${po.orderedTotalQty} item',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
              ),
            ] else if (po.status == 'sent') ...[
              Row(
                children: [
                  Icon(Icons.local_shipping_outlined, size: 20, color: Colors.orange.shade700),
                  const SizedBox(width: 8),
                  Text(
                    'Barang Belum Diterima',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.orange.shade800),
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
            const SizedBox(height: 12),
            if (!_showReceiveForm) ...[
              if (canReceive)
                OutlinedButton.icon(
                  key: const Key('receive_po_button'),
                  onPressed: _toggleReceiveForm,
                  icon: const Icon(Icons.inventory_2_outlined, size: 18),
                  label: const Text('Terima Barang'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF17593E),
                    side: const BorderSide(color: Color(0xFF17593E)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                )
              else if (!widget.isOnline || widget.syncApiClient == null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.wifi_off_outlined, size: 18, color: Colors.amber.shade800),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Perlu koneksi internet untuk menerima barang.',
                          style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
                        ),
                      ),
                    ],
                  ),
                )
              else if (widget.userRole != 'OWNER' && widget.userRole != 'CASHIER')
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.lock_outline, size: 18, color: Colors.grey.shade600),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Hanya OWNER/CASHIER yang dapat menerima barang.',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade800),
                        ),
                      ),
                    ],
                  ),
                ),
            ] else ...[
              const Text(
                'Masukkan jumlah terima per item:',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 8),
              ...po.items.map((item) {
                final controller = _receiveQtyControllers[item.id]!;
                final remaining = item.orderedQty - item.receivedQty;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: Text(
                          '${item.productName}\n${CurrencyFormatter.formatIDR(item.unitCostMinor)}',
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 2,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('Pesan: ${item.orderedQty}'),
                            Text('Sisa: $remaining',
                                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      SizedBox(
                        width: 80,
                        child: TextField(
                          controller: controller,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Terima',
                            border: OutlineInputBorder(),
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                          ),
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isReceiving ? null : _toggleReceiveForm,
                      child: const Text('Batal'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _isReceiving ? null : _receivePurchase,
                      child: _isReceiving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Terima'),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF17593E),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Detail Pembelian',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            if (_purchase != null)
              Text(
                _purchase!.code,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _load,
            tooltip: 'Muat Ulang',
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (_error != null || _purchase == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
              const SizedBox(height: 12),
              Text(
                _error ?? 'Pesanan pembelian tidak ditemukan.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16, color: Colors.black87),
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

    final po = _purchase!;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeaderCard(po),
          const SizedBox(height: 16),
          _buildReceivingProgressCard(po),
          const SizedBox(height: 16),
          _buildLineItemsCard(po),
          const SizedBox(height: 16),
          _buildFinancialCard(po),
          const SizedBox(height: 16),
          _buildPaymentHistoryCard(po),
          const SizedBox(height: 16),
          _buildActionCard(po),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildHeaderCard(Purchase po) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 4,
              children: [
                Text(
                  po.code,
                  key: const Key('po_code_text'),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                PurchaseStatusBadge(status: po.status),
              ],
            ),
            const Divider(height: 24),
            _buildInfoRow('Supplier', po.supplierName ?? po.supplierId, key: const Key('supplier_name_text')),
            if (po.supplierCode != null && po.supplierCode!.isNotEmpty)
              _buildInfoRow('Kode Supplier', po.supplierCode!),
            _buildInfoRow('Term Pembayaran', po.supplierTerm, isBadge: true),
            _buildInfoRow('Tanggal Pesan', po.date),
            _buildInfoRow('Jatuh Tempo', po.dueDate),
            if (po.note != null && po.note!.isNotEmpty)
              _buildInfoRow('Catatan', po.note!),
          ],
        ),
      ),
    );
  }

  Widget _buildReceivingProgressCard(Purchase po) {
    final totalOrdered = po.items.fold<int>(0, (sum, item) => sum + item.orderedQty);
    final totalReceived = po.items.fold<int>(0, (sum, item) => sum + item.receivedQty);
    final progress = totalOrdered > 0 ? (totalReceived / totalOrdered).clamp(0.0, 1.0) : 0.0;
    final percent = (progress * 100).toInt();

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              spacing: 8,
              runSpacing: 4,
              children: [
                const Text(
                  'Progres Penerimaan Barang',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
                Text(
                  '$percent%',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: progress == 1.0 ? const Color(0xFF17593E) : Colors.black87,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 8,
                backgroundColor: Colors.grey.shade200,
                valueColor: AlwaysStoppedAnimation<Color>(
                  progress == 1.0 ? const Color(0xFF17593E) : Colors.amber.shade700,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '$totalReceived dari $totalOrdered item telah diterima',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLineItemsCard(Purchase po) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Daftar Barang (${po.items.length})',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            if (po.items.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8.0),
                child: Text(
                  'Tidak ada item dalam pesanan ini.',
                  style: TextStyle(color: Colors.grey.shade600),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: po.items.length,
                separatorBuilder: (_, __) => const Divider(height: 16),
                itemBuilder: (context, index) {
                  final item = po.items[index];
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        alignment: WrapAlignment.spaceBetween,
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          Text(
                            item.productName ?? 'Produk (${item.productId ?? "-"})',
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                          Text(
                            CurrencyFormatter.formatIDR(item.subtotalMinor),
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        alignment: WrapAlignment.spaceBetween,
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          Text(
                            'Pesan: ${item.orderedQty} | Diterima: ${item.receivedQty} | Sisa: ${item.remainingQty}',
                            style: TextStyle(
                              fontSize: 12,
                              color: item.remainingQty > 0 ? Colors.amber.shade900 : Colors.grey.shade700,
                            ),
                          ),
                          Text(
                            '@ ${CurrencyFormatter.formatIDR(item.unitCostMinor)}',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                            ),
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

  Widget _buildFinancialCard(Purchase po) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Ringkasan Keuangan',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            _buildFinancialRow('Total Nilai Pesanan', CurrencyFormatter.formatIDR(po.totalMinor), isBold: true),
            _buildFinancialRow('Nilai Barang Diterima', CurrencyFormatter.formatIDR(po.receivedMinor)),
            _buildFinancialRow('Total Terbayar', CurrencyFormatter.formatIDR(po.paidMinor), color: const Color(0xFF17593E)),
            const Divider(height: 16),
            _buildFinancialRow(
              'Sisa Tagihan (Outstanding)',
              CurrencyFormatter.formatIDR(po.outstandingMinor),
              isBold: true,
              color: po.outstandingMinor > 0 ? Colors.red.shade700 : const Color(0xFF17593E),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentHistoryCard(Purchase po) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Riwayat Pembayaran',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
                if (_isLoadingPayments)
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (!widget.isOnline || _isPaymentFetchFailed || widget.syncApiClient == null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.wifi_off_outlined, size: 20, color: Colors.grey.shade600),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Riwayat pembayaran tersedia saat online.',
                        style: TextStyle(fontSize: 13, color: Colors.black87),
                      ),
                    ),
                  ],
                ),
              )
            else if (_onlinePayments.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8.0),
                child: Text(
                  'Belum ada riwayat pembayaran.',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _onlinePayments.length,
                separatorBuilder: (_, __) => const Divider(height: 12),
                itemBuilder: (context, index) {
                  final p = _onlinePayments[index];
                  return Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _formatPaymentMethod(p.method),
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            if (p.reference != null && p.reference!.isNotEmpty)
                              Text(
                                'Ref: ${p.reference}',
                                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                              ),
                            Text(
                              p.createdAt,
                              style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        CurrencyFormatter.formatIDR(p.amountMinor),
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF17593E),
                          fontSize: 14,
                        ),
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

  Widget _buildActionCard(Purchase po) {
    final canSend = widget.isOnline &&
        widget.syncApiClient != null &&
        widget.userRole == 'OWNER' &&
        po.status == 'draft';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (po.status == 'draft') ...[
              const Text(
                'PO ini masih berstatus Draft.',
                style: TextStyle(fontSize: 13, color: Colors.black87),
              ),
              const SizedBox(height: 12),
              if (canSend)
                FilledButton.icon(
                  key: const Key('send_po_button'),
                  onPressed: _isSending ? null : _sendPurchase,
                  icon: _isSending
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send_outlined, size: 18),
                  label: Text(_isSending ? 'Mengirim...' : 'Kirim ke Supplier'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF17593E),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                )
              else if (widget.isOnline && widget.syncApiClient != null && widget.userRole != 'OWNER')
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.lock_outline, size: 18, color: Colors.grey.shade600),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Hanya OWNER yang dapat mengirim PO ke supplier.',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade800),
                        ),
                      ),
                    ],
                  ),
                )
              else if (!widget.isOnline || widget.syncApiClient == null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.wifi_off_outlined, size: 18, color: Colors.amber.shade800),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Perlu koneksi internet untuk mengirim PO.',
                          style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
                        ),
                      ),
                    ],
                  ),
                )
              else
                const SizedBox.shrink(),
            ] else if (po.status == 'sent' || po.status == 'partial') ...[
              _buildReceiveActionCard(po),
            ] else if (po.status == 'received') ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0EFE7),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle_outline, size: 20, color: Colors.green.shade700),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Barang sudah diterima sepenuhnya.',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade800),
                      ),
                    ),
                  ],
                ),
              ),
            ] else if (po.status == 'cancelled') ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.cancel_outlined, size: 20, color: Colors.red.shade700),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'PO telah dibatalkan. Tidak ada aksi lebih lanjut.',
                        style: TextStyle(fontSize: 12, color: Colors.red.shade900),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isBadge = false, Key? key}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 3,
            child: isBadge
                ? Align(
                    alignment: Alignment.centerRight,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.blueGrey.shade50,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Colors.blueGrey.shade200),
                      ),
                      child: Text(
                        value,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.blueGrey.shade900,
                        ),
                      ),
                    ),
                  )
                : Text(
                    value,
                    key: key,
                    textAlign: TextAlign.end,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.black87,
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildFinancialRow(String label, String value, {bool isBold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isBold ? FontWeight.w600 : FontWeight.normal,
                color: Colors.black87,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: color ?? Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  String _formatPaymentMethod(String method) {
    switch (method.toLowerCase()) {
      case 'cash':
        return 'Tunai (Cash)';
      case 'bank_transfer':
        return 'Transfer Bank';
      case 'debit':
        return 'Kartu Debit';
      case 'credit':
        return 'Kartu Kredit';
      default:
        return method;
    }
  }
}
