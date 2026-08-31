import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/utils/currency_formatter.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/calc_models.dart';
import 'package:biz_erp_mobile/customers/domain/customer.dart';
import '../pos_controller.dart';
import 'payment_dialog.dart';
import 'receipt_dialog.dart';

class CartPanel extends StatelessWidget {
  final PosController controller;
  const CartPanel({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final cart = controller.currentCart;
        final calc = controller.calculation;

        return Container(
          color: Colors.grey[100],
          padding: const EdgeInsets.all(16),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'KERANJANG',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const Divider(),
                OutlinedButton.icon(
                  onPressed: () => _showCustomerPicker(context),
                  icon: const Icon(Icons.person_outline),
                  label: Text(
                    controller.selectedCustomerName ?? 'Pilih Pelanggan',
                    style: TextStyle(
                      color: controller.selectedCustomerName != null
                          ? Colors.blueGrey[800]
                          : Colors.grey[600],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                if (cart == null || cart.items.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Center(
                      child: Text(
                        'Keranjang Kosong',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ),
                  )
                else
                  ...cart.items.map((item) {
                    final prod = controller.products
                        .where((p) => p.id == item.productId)
                        .firstOrNull;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  prod?.name ?? 'Unknown',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  CurrencyFormatter.formatIDR(item.unitPriceMinor),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey[600],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          InkWell(
                            onTap: () => controller.updateQty(
                              item.id,
                              item.quantity - 1,
                            ),
                            child: const Padding(
                              padding: EdgeInsets.all(4.0),
                              child: Icon(
                                Icons.remove_circle_outline,
                                size: 20,
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Text(
                              '${item.quantity}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          InkWell(
                            onTap: () => controller.updateQty(
                              item.id,
                              item.quantity + 1,
                            ),
                            child: const Padding(
                              padding: EdgeInsets.all(4.0),
                              child: Icon(Icons.add_circle_outline, size: 20),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                const Divider(thickness: 2),
                if (calc != null) ...[
                  _buildRow(
                    'Subtotal',
                    CurrencyFormatter.formatIDR(calc.subtotalMinor),
                  ),
                  _buildRow(
                    'Diskon',
                    CurrencyFormatter.formatIDR(calc.discountMinor),
                  ),
                  _buildRow(
                    'Pajak (11%)',
                    CurrencyFormatter.formatIDR(calc.taxMinor),
                  ),
                  const SizedBox(height: 8),
                  _buildRow(
                    'TOTAL',
                    CurrencyFormatter.formatIDR(calc.grandTotalMinor),
                    isBold: true,
                    size: 24,
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: controller.isLoading
                        ? null
                        : controller.toggleMemberDiscount,
                    child: Text(
                      controller.currentDiscount.type == DiscountType.none
                          ? 'Diskon Member (10%)'
                          : 'Hapus Diskon',
                    ),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green[700],
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    onPressed: controller.canCheckout
                        ? () => _handleCheckout(context)
                        : null,
                    child: controller.isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'BAYAR SEKARANG',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                  if (controller.errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        controller.errorMessage!,
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildRow(
    String label,
    String value, {
    bool isBold = false,
    double size = 16,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: size,
                fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: size,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleCheckout(BuildContext context) async {
    final total = controller.calculation!.grandTotalMinor;
    final result = await showDialog<CheckoutAction>(
      context: context,
      barrierDismissible: false,
      builder: (_) => PaymentDialog(totalMinor: total),
    );

    if (result != null) {
      final success = await controller.performCheckout(
        paymentMethod: result.method,
        cashReceivedMinor: result.cashReceived,
      );
      if (success != null && context.mounted) {
        showDialog(
          context: context,
          builder: (_) => ReceiptDialog(
            result: controller.lastReceipt!,
            receiptData: controller.lastReceiptData!,
            printingService: controller.printingService,
          ),
        );
      }
    }
  }

  void _showCustomerPicker(BuildContext context) {
    final walkIn = const Customer(id: '', businessId: '', name: 'Pelanggan Umum (Tanpa Nama)', isActive: true, serverVersion: 0);
    final customers = [walkIn, ...controller.customers];

    showModalBottomSheet(
      context: context,
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Cari pelanggan',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: (query) {
                // In a real implementation, we would filter the list here.
                // For now, the list is static within the builder, so we would
                // need to lift state up. Given the MVP scope, we show all
                // active customers and rely on the user scrolling.
              },
            ),
          ),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: customers.map((c) {
                final isSelected = controller.selectedCustomerId == c.id;
                return ListTile(
                  title: Text(c.name),
                  subtitle: c.phone != null ? Text(c.phone!) : null,
                  trailing: isSelected ? const Icon(Icons.check, color: Colors.green) : null,
                  onTap: () {
                    controller.selectCustomer(
                      c.id.isEmpty ? null : c.id,
                      c.name,
                    );
                    Navigator.pop(ctx);
                  },
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
