import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/core/hardware/printing/printing_service.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_data.dart';
import 'package:biz_erp_mobile/sales/domain/checkout/checkout_models.dart';
import 'printer_selector_sheet.dart';

class ReceiptDialog extends StatelessWidget {
  final CheckoutResult result;
  final ReceiptData receiptData;
  final PrintingService printingService;

  const ReceiptDialog({
    super.key,
    required this.result,
    required this.receiptData,
    required this.printingService,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(
        children: [
          const Icon(Icons.check_circle, color: Colors.green, size: 32),
          const SizedBox(width: 8),
          const Expanded(
            child: Text('Transaksi Sukses', overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Nomor Struk:',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          Text(
            result.receiptNumber,
            style: const TextStyle(fontSize: 18, fontFamily: 'monospace'),
          ),
          const Divider(height: 24),
          _row('Total Bayar', CurrencyFormatter.formatIDR(result.grandTotalMinor)),
          _row('Kembalian', CurrencyFormatter.formatIDR(result.changeMinor)),
          const Divider(height: 24),
          ListenableBuilder(
            listenable: printingService,
            builder: (context, _) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Text(
                      _statusLabel(),
                      style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                    ),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blueGrey[700],
                      foregroundColor: Colors.white,
                    ),
                    onPressed:
                        (printingService.status == PrinterStatus.printing ||
                            printingService.status == PrinterStatus.connecting)
                        ? null
                        : () => _onPrint(context),
                    icon: const Icon(Icons.print),
                    label: const Text('Cetak Struk'),
                  ),
                ],
              );
            },
          ),
        ],
      ),
      actions: [
        ElevatedButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('SELESAI'),
        ),
      ],
    );
  }

  String _statusLabel() {
    switch (printingService.status) {
      case PrinterStatus.connected:
        return 'Terhubung: ${printingService.connectedDevice?.name ?? ''}';
      case PrinterStatus.connecting:
        return 'Menghubungkan...';
      case PrinterStatus.printing:
        return 'Mencetak...';
      case PrinterStatus.error:
        return 'Error: ${printingService.errorMessage ?? '-'}';
      case PrinterStatus.disconnected:
        return 'Printer tidak terhubung';
    }
  }

  /// Retry print diperbolehkan; TIDAK membuat transaksi baru.
  Future<void> _onPrint(BuildContext context) async {
    bool connected = printingService.status == PrinterStatus.connected;
    if (!connected) {
      connected = await showPrinterSelectorSheet(
        context,
        printingService: printingService,
      );
    }
    if (!connected || !context.mounted) return;

    final ok = await printingService.printReceipt(receiptData);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Struk terkirim ke printer'
              : 'Gagal cetak: ${printingService.errorMessage ?? 'tidak diketahui'}',
        ),
        backgroundColor: ok ? Colors.green[700] : Colors.red[700],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Flexible(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.bold),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}
