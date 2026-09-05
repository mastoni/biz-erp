import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_data.dart';
import 'package:biz_erp_mobile/pos/presentation/widgets/printer_selector_sheet.dart';
import 'package:biz_erp_mobile/sales/data/sale_repository.dart';
import 'package:biz_erp_mobile/sales/domain/sale.dart';

class SaleDetailScreen extends StatefulWidget {
  final String saleId;
  final String businessId;
  final String? businessName;
  final String? branchName;
  final SaleRepository saleRepo;
  final PrintingService? printingService;

  const SaleDetailScreen({
    super.key,
    required this.saleId,
    required this.businessId,
    this.businessName,
    this.branchName,
    required this.saleRepo,
    this.printingService,
  });

  @override
  State<SaleDetailScreen> createState() => _SaleDetailScreenState();
}

class _SaleDetailScreenState extends State<SaleDetailScreen> {
  Sale? _sale;
  bool _isLoading = true;
  String? _error;
  bool _isPrinting = false;

  @override
  void initState() {
    super.initState();
    _loadSale();
  }

  Future<void> _loadSale() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await widget.saleRepo.getSaleById(
        widget.saleId,
        businessId: widget.businessId,
      );

      if (!mounted) return;
      if (result == null) {
        setState(() {
          _error = 'Transaksi tidak ditemukan';
          _isLoading = false;
        });
      } else {
        setState(() {
          _sale = result;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal memuat detail transaksi: $e';
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
    final sec = dt.second.toString().padLeft(2, '0');
    return '$day/$month/$year $hour:$min:$sec';
  }

  ReceiptData _buildReceiptData(Sale sale) {
    final items = sale.items.map((item) {
      return ReceiptItemData(
        productId: item.productId,
        displayName: item.productName,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
      );
    }).toList();

    return ReceiptData(
      receiptNumber: sale.displayReceiptNumber,
      businessName: widget.businessName ?? 'BIZ-ERP STORE',
      branchName: widget.branchName ?? 'Branch Utama',
      cashierId: sale.cashierId,
      createdAtEpochMs: sale.createdAt.millisecondsSinceEpoch,
      subtotalMinor: sale.subtotalMinor,
      discountMinor: sale.discountMinor,
      taxMinor: sale.taxMinor,
      totalMinor: sale.totalMinor,
      cashReceivedMinor: sale.totalMinor, // Full payment snapshot for history
      changeMinor: 0,
      items: items,
    );
  }

  Future<void> _handleReprint() async {
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

    if (_sale == null) return;

    setState(() => _isPrinting = true);

    try {
      final receiptData = _buildReceiptData(_sale!);
      final success = await printingService.printReceipt(receiptData);

      if (!mounted) return;
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Struk berhasil dicetak ulang'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              printingService.errorMessage ?? 'Gagal mencetak struk',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Terjadi kesalahan saat mencetak: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isPrinting = false);
      }
    }
  }

  Widget _buildRow(String label, String value, {bool isBold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey[700],
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sale = _sale;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Detail Transaksi'),
        backgroundColor: Colors.blueGrey[800],
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null || sale == null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _error ?? 'Terjadi kesalahan',
                        style: const TextStyle(color: Colors.red),
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: _loadSale,
                        child: const Text('Coba Lagi'),
                      ),
                    ],
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // 1. Transaction Header Card
                    Card(
                      elevation: 1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Nomor Struk',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.grey,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      sale.displayReceiptNumber,
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        fontFamily: 'monospace',
                                      ),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: sale.isSynced
                                        ? const Color(0xFFE8F5E9)
                                        : const Color(0xFFFFF8E1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    sale.isSynced ? 'SYNCED' : sale.status,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: sale.isSynced
                                          ? const Color(0xFF2E7D32)
                                          : const Color(0xFFF57F17),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const Divider(height: 24),
                            _buildRow('Waktu', _formatDateTime(sale.createdAt)),
                            _buildRow('Kasir', sale.cashierId),
                            if (sale.customerName != null)
                              _buildRow('Pelanggan', sale.customerName!),
                            if (sale.syncedAt != null)
                              _buildRow('Tersinkron', _formatDateTime(sale.syncedAt!)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // 2. Line Items Card
                    Card(
                      elevation: 1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Item Produk',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 12),
                            if (sale.items.isEmpty)
                              const Padding(
                                padding: EdgeInsets.all(8.0),
                                child: Text('Tidak ada rincian item'),
                              )
                            else
                              ListView.separated(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                itemCount: sale.items.length,
                                separatorBuilder: (context, index) =>
                                    const Divider(height: 16),
                                itemBuilder: (context, index) {
                                  final item = sale.items[index];
                                  return Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              item.productName,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w600,
                                                fontSize: 13,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              '${item.quantity} x ${CurrencyFormatter.formatIDR(item.unitPriceMinor)}',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.grey[600],
                                              ),
                                            ),
                                            if (item.discountMinor > 0)
                                              Text(
                                                'Diskon: -${CurrencyFormatter.formatIDR(item.discountMinor)}',
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  color: Colors.orange,
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                      Text(
                                        CurrencyFormatter.formatIDR(
                                          item.subtotalMinor,
                                        ),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  );
                                },
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // 3. Financial Summary Card
                    Card(
                      elevation: 1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Ringkasan Pembayaran',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 12),
                            _buildRow(
                              'Subtotal',
                              CurrencyFormatter.formatIDR(sale.subtotalMinor),
                            ),
                            if (sale.discountMinor > 0)
                              _buildRow(
                                'Diskon',
                                '-${CurrencyFormatter.formatIDR(sale.discountMinor)}',
                                color: Colors.orange,
                              ),
                            if (sale.taxMinor > 0)
                              _buildRow(
                                'Pajak',
                                CurrencyFormatter.formatIDR(sale.taxMinor),
                              ),
                            const Divider(height: 20),
                            _buildRow(
                              'Total Akhir',
                              CurrencyFormatter.formatIDR(sale.totalMinor),
                              isBold: true,
                              color: const Color(0xFF1B5E20),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // 4. Action: Reprint Receipt
                    SizedBox(
                      height: 48,
                      child: ElevatedButton.icon(
                        icon: _isPrinting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.print_outlined),
                        label: Text(
                          _isPrinting
                              ? 'Mencetak Struk...'
                              : 'Cetak Ulang Struk',
                          style: const TextStyle(fontSize: 15),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blueGrey[800],
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onPressed: _isPrinting ? null : _handleReprint,
                      ),
                    ),
                  ],
                ),
    );
  }
}
