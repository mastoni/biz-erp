import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:biz_erp_mobile/core/demo_context.dart';
import 'package:biz_erp_mobile/sales/domain/checkout/checkout_models.dart';

class CheckoutAction {
  final PaymentMethod method;
  final int cashReceived;
  CheckoutAction(this.method, this.cashReceived);
}

class PaymentDialog extends StatefulWidget {
  final int totalMinor;
  const PaymentDialog({super.key, required this.totalMinor});

  @override
  State<PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<PaymentDialog> {
  PaymentMethod _method = PaymentMethod.cash;
  final _cashController = TextEditingController();

  @override
  void dispose() {
    _cashController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Pilih Pembayaran'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Total: ${DemoContext.formatIDR(widget.totalMinor)}',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 24),
          RadioGroup<PaymentMethod>(
            groupValue: _method,
            onChanged: (PaymentMethod? value) {
              if (value != null) {
                setState(() => _method = value);
              }
            },
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                RadioListTile<PaymentMethod>(
                  title: const Text('Tunai (Cash)'),
                  value: PaymentMethod.cash,
                ),
                RadioListTile<PaymentMethod>(
                  title: const Text('Transfer / Non-Tunai'),
                  value: PaymentMethod.transfer,
                ),
              ],
            ),
          ),
          if (_method == PaymentMethod.cash) ...[
            const SizedBox(height: 16),
            TextField(
              controller: _cashController,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                labelText: 'Jumlah Uang Diterima',
              ),
              onChanged: (_) => setState(() {}),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('BATAL'),
        ),
        ElevatedButton(
          onPressed: () {
            final cash = _method == PaymentMethod.cash
                ? int.tryParse(_cashController.text) ?? 0
                : widget.totalMinor;
            if (_method == PaymentMethod.cash && cash < widget.totalMinor) {
              return;
            }
            Navigator.pop(context, CheckoutAction(_method, cash));
          },
          child: const Text('KONFIRMASI'),
        ),
      ],
    );
  }
}
