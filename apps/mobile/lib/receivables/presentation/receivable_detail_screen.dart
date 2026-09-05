import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_data.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/pos/presentation/widgets/printer_selector_sheet.dart';
import 'package:biz_erp_mobile/receivables/data/receivable_repository.dart';
import 'package:biz_erp_mobile/receivables/domain/receivable.dart';
import 'widgets/payment_collection_dialog.dart';

class ReceivableDetailScreen extends StatefulWidget {
  final String receivableId;
  final String businessId;
  final String? businessName;
  final String? branchName;
  final ReceivableRepository receivableRepo;
  final PrintingService? printingService;
  final String userRole;

  const ReceivableDetailScreen({
    super.key,
    required this.receivableId,
    required this.businessId,
    this.businessName,
    this.branchName,
    required this.receivableRepo,
    this.printingService,
    this.userRole = 'CASHIER',
  });

  @override
  State<ReceivableDetailScreen> createState() => _ReceivableDetailScreenState();
}

class _ReceivableDetailScreenState extends State<ReceivableDetailScreen> {
  Receivable? _receivable;
  List<CustomerPayment> _payments = [];
  bool _isLoading = true;
  String? _errorMessage;
  bool _isPrinting = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final rec = await widget.receivableRepo.getReceivableById(
        widget.receivableId,
        businessId: widget.businessId,
      );

      if (rec == null) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Data piutang tidak ditemukan.';
        });
        return;
      }

      final payments = await widget.receivableRepo.getPaymentHistory(widget.receivableId);

      if (mounted) {
        setState(() {
          _receivable = rec;
          _payments = payments;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Gagal memuat data piutang: $e';
        });
      }
    }
  }

  Future<void> _openCollectionDialog() async {
    if (_receivable == null) return;

    final result = await showDialog<PaymentCollectionResult>(
      context: context,
      builder: (_) => PaymentCollectionDialog(
        receivable: _receivable!,
        receivableRepo: widget.receivableRepo,
        userRole: widget.userRole,
      ),
    );

    if (result != null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Pembayaran piutang berhasil dicatat.'),
            backgroundColor: Color(0xFF2E7D32),
          ),
        );
      }
      await _loadData();
    }
  }

  Future<void> _printPaymentProof(CustomerPayment payment) async {
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

    if (_receivable == null) return;

    setState(() => _isPrinting = true);

    try {
      final dt = DateTime.tryParse(payment.createdAt) ?? DateTime.now();
      final payIdShort = payment.id.length > 8 ? payment.id.substring(0, 8) : payment.id;
      final recShort = (_receivable != null && _receivable!.id.length > 8) ? _receivable!.id.substring(0, 8) : (_receivable?.id ?? '');
      final receiptData = ReceiptData(
        receiptNumber: 'PAY-${payIdShort.toUpperCase()}',
        businessName: widget.businessName ?? 'BIZ-ERP',
        branchName: widget.branchName ?? 'Cabang',
        cashierId: widget.userRole,
        createdAtEpochMs: dt.millisecondsSinceEpoch,
        subtotalMinor: payment.amountMinor,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: payment.amountMinor,
        cashReceivedMinor: payment.amountMinor,
        changeMinor: 0,
        items: [
          ReceiptItemData(
            productId: 'AR-PAYMENT',
            displayName: 'Bayar Piutang (${_receivable?.reference ?? recShort})',
            quantity: 1,
            unitPriceMinor: payment.amountMinor,
          ),
        ],
      );

      await printingService.printReceipt(receiptData);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Bukti pembayaran berhasil dicetak'),
            backgroundColor: Color(0xFF2E7D32),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal mencetak struk: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isPrinting = false);
    }
  }

  String _formatMethod(String method) {
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
        return method.toUpperCase();
    }
  }

  @override
  Widget build(BuildContext context) {
    final rec = _receivable;
    final isOwner = widget.userRole.toUpperCase() == 'OWNER';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Detail Piutang'),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _isLoading ? null : _loadData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: Colors.red),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadData,
                          child: const Text('Coba Lagi'),
                        ),
                      ],
                    ),
                  ),
                )
              : rec == null
                  ? const Center(child: Text('Data tidak ditemukan'))
                  : RefreshIndicator(
                      onRefresh: _loadData,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          // 1. Header Card
                          Card(
                            elevation: 1,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        rec.reference ?? 'REC-${(rec.id.length > 8 ? rec.id.substring(0, 8) : rec.id).toUpperCase()}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: Color(0xFF1565C0),
                                        ),
                                      ),
                                      _buildStatusBadge(rec.status),
                                    ],
                                  ),
                                  const Divider(height: 20),
                                  _buildInfoRow('Pelanggan', rec.customerName ?? rec.customerId),
                                  _buildInfoRow('Tanggal Transaksi', rec.date),
                                  _buildInfoRow('ID Penjualan (Sale)', rec.saleId),
                                  if (rec.description.isNotEmpty)
                                    _buildInfoRow('Keterangan', rec.description),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // 2. Financial Breakdown Card
                          Card(
                            elevation: 1,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Ringkasan Finansial',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                  const SizedBox(height: 12),
                                  _buildAmountRow('Total Tagihan Awal', rec.amountMinor, isBold: false),
                                  const SizedBox(height: 6),
                                  _buildAmountRow('Total Sudah Dibayar', rec.paidMinor, color: const Color(0xFF2E7D32)),
                                  const Divider(height: 20),
                                  _buildAmountRow(
                                    'Sisa Tagihan (Piutang)',
                                    rec.outstandingMinor,
                                    isBold: true,
                                    color: rec.outstandingMinor > 0 ? const Color(0xFFC62828) : const Color(0xFF2E7D32),
                                    fontSize: 16,
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // 3. Payment History Card
                          Card(
                            elevation: 1,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text(
                                        'Riwayat Pembayaran',
                                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                      ),
                                      Text(
                                        '${_payments.length} transaksi',
                                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  if (_payments.isEmpty)
                                    const Padding(
                                      padding: EdgeInsets.symmetric(vertical: 16),
                                      child: Center(
                                        child: Text(
                                          'Belum ada pembayaran yang tercatat.',
                                          style: TextStyle(color: Colors.grey, fontSize: 13),
                                        ),
                                      ),
                                    )
                                  else
                                    ListView.separated(
                                      shrinkWrap: true,
                                      physics: const NeverScrollableScrollPhysics(),
                                      itemCount: _payments.length,
                                      separatorBuilder: (context, index) => const Divider(height: 16),
                                      itemBuilder: (context, index) {
                                        final pay = _payments[index];
                                        return Row(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    CurrencyFormatter.formatIDR(pay.amountMinor),
                                                    style: const TextStyle(
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 14,
                                                      color: Color(0xFF2E7D32),
                                                    ),
                                                  ),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    '${_formatMethod(pay.method)} • ${pay.createdAt.split('T').first}',
                                                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                                                  ),
                                                  if (pay.reference != null && pay.reference!.isNotEmpty)
                                                    Text(
                                                      'Ref: ${pay.reference}',
                                                      style: const TextStyle(fontSize: 11, color: Colors.black54),
                                                    ),
                                                ],
                                              ),
                                            ),
                                            if (widget.printingService != null)
                                              IconButton(
                                                icon: const Icon(Icons.print, size: 20, color: Color(0xFF1565C0)),
                                                tooltip: 'Cetak Bukti',
                                                onPressed: _isPrinting ? null : () => _printPaymentProof(pay),
                                              ),
                                          ],
                                        );
                                      },
                                    ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 80), // bottom space
                        ],
                      ),
                    ),
      bottomNavigationBar: (rec != null && rec.outstandingMinor > 0 && !rec.isReversed)
          ? Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0D000000),
                    offset: Offset(0, -2),
                    blurRadius: 6,
                  ),
                ],
              ),
              child: SafeArea(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isOwner ? const Color(0xFF1565C0) : Colors.grey,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.payment),
                  label: Text(
                    isOwner ? 'Terima Pembayaran (${CurrencyFormatter.formatIDR(rec.outstandingMinor)})' : 'Hanya Owner Yang Dapat Menerima Pembayaran',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  onPressed: isOwner ? _openCollectionDialog : null,
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmountRow(String label, int amountMinor, {bool isBold = false, Color? color, double fontSize = 13}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        Text(
          CurrencyFormatter.formatIDR(amountMinor),
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            color: color,
          ),
        ),
      ],
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: text),
      ),
    );
  }
}
