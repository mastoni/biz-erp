import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/demo_context.dart';
import 'package:biz_erp_mobile/sales/domain/checkout/checkout_models.dart';

class ReceiptDialog extends StatelessWidget {
  final CheckoutResult result;
  const ReceiptDialog({super.key, required this.result});

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
          _row('Total Bayar', DemoContext.formatIDR(result.grandTotalMinor)),
          _row('Kembalian', DemoContext.formatIDR(result.changeMinor)),
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
