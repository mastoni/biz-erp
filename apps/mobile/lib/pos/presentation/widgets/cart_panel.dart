import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/demo_context.dart';
import 'package:biz_erp_mobile/sales/domain/calculation/calc_models.dart';
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
            // UBAH DARI ListView
            child: Column(
              // UBAH DARI ListView children
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'KERANJANG',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const Divider(),
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
                                  DemoContext.formatIDR(item.unitPriceMinor),
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
                    DemoContext.formatIDR(calc.subtotalMinor),
                  ),
                  _buildRow(
                    'Diskon',
                    DemoContext.formatIDR(calc.discountMinor),
                  ),
                  _buildRow(
                    'Pajak (11%)',
                    DemoContext.formatIDR(calc.taxMinor),
                  ),
                  const SizedBox(height: 8),
                  _buildRow(
                    'TOTAL',
                    DemoContext.formatIDR(calc.grandTotalMinor),
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
        result.method,
        result.cashReceived,
      );
      if (success && context.mounted) {
        showDialog(
          context: context,
          builder: (_) => ReceiptDialog(result: controller.lastReceipt!),
        );
      }
    }
  }
}
