import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/income/domain/income.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_data.dart';
import 'package:biz_erp_mobile/pos/presentation/widgets/printer_selector_sheet.dart';

class IncomeDetailScreen extends StatefulWidget {
  final Income income;
  final String? businessName;
  final String? branchName;
  final PrintingService? printingService;
  final String userRole;

  const IncomeDetailScreen({
    super.key,
    required this.income,
    this.businessName,
    this.branchName,
    this.printingService,
    this.userRole = 'CASHIER',
  });

  @override
  State<IncomeDetailScreen> createState() => _IncomeDetailScreenState();
}

class _IncomeDetailScreenState extends State<IncomeDetailScreen> {
  bool _isPrinting = false;

  Future<void> _printVoucher() async {
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

    final inc = widget.income;
    setState(() => _isPrinting = true);

    try {
      final dt = DateTime.tryParse(inc.createdAt) ?? DateTime.now();
      final incIdShort = inc.id.length > 8 ? inc.id.substring(0, 8) : inc.id;
      final receiptData = ReceiptData(
        receiptNumber: inc.reference ?? 'INC-${incIdShort.toUpperCase()}',
        businessName: widget.businessName ?? 'BIZ-ERP',
        branchName: widget.branchName ?? 'Cabang',
        cashierId: widget.userRole,
        createdAtEpochMs: dt.millisecondsSinceEpoch,
        subtotalMinor: inc.amountMinor,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: inc.amountMinor,
        cashReceivedMinor: inc.amountMinor,
        changeMinor: 0,
        items: [
          ReceiptItemData(
            productId: 'INCOME-ITEM',
            displayName: '${inc.category ?? 'Pendapatan'}: ${inc.description}',
            quantity: 1,
            unitPriceMinor: inc.amountMinor,
          ),
        ],
      );

      await printingService.printReceipt(receiptData);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Bukti pendapatan berhasil dicetak'),
            backgroundColor: Color(0xFF0D9488),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Kesalahan cetak: $e. Data di server tetap aman.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isPrinting = false);
      }
    }
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
    final income = widget.income;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Detail Pendapatan'),
        actions: [
          if (widget.printingService != null)
            IconButton(
              icon: _isPrinting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.print),
              tooltip: 'Cetak Bukti Pendapatan',
              onPressed: _isPrinting ? null : _printVoucher,
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          income.category ?? 'Pendapatan Operasional',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0D9488),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: _getStatusColor(income.status).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: _getStatusColor(income.status)),
                          ),
                          child: Text(
                            income.formattedStatus,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: _getStatusColor(income.status),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      CurrencyFormatter.formatIDR(income.amountMinor),
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0D9488),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      income.description,
                      style: const TextStyle(fontSize: 14, color: Color(0xFF334155)),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Metadata Information Card
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Informasi Transaksi',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                    ),
                    const Divider(height: 24),
                    _buildMetaRow('Tanggal Transaksi', income.date),
                    _buildMetaRow('Metode Pembayaran', income.formattedMethod),
                    if (income.reference != null && income.reference!.isNotEmpty)
                      _buildMetaRow('Nomor Referensi', income.reference!),
                    if (income.branchId != null)
                      _buildMetaRow('Cabang (Branch ID)', income.branchId!),
                    _buildMetaRow('ID Pendapatan', income.id),
                    _buildMetaRow('Versi Server', 'v${income.serverVersion}'),
                    if (income.createdAt.isNotEmpty)
                      _buildMetaRow('Waktu Dibuat', income.createdAt),
                    if (income.updatedAt.isNotEmpty)
                      _buildMetaRow('Terakhir Diperbarui', income.updatedAt),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Print Button Action
            if (widget.printingService != null)
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0D9488),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: _isPrinting ? null : _printVoucher,
                icon: const Icon(Icons.print),
                label: Text(_isPrinting ? 'Mencetak...' : 'Cetak Bukti Voucher'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetaRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF1E293B)),
            ),
          ),
        ],
      ),
    );
  }
}
