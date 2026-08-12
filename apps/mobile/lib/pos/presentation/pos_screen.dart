import 'package:flutter/material.dart';
import 'pos_controller.dart';
import 'widgets/product_grid.dart';
import 'widgets/cart_panel.dart';

class PosScreen extends StatelessWidget {
  final PosController controller;
  const PosScreen({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('BizERP POS'),
        backgroundColor: Colors.blueGrey[800],
        foregroundColor: Colors.white,
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          // Responsive: Split screen jika lebar > 600px
          if (constraints.maxWidth > 600) {
            return Row(
              children: [
                Expanded(flex: 6, child: ProductGrid(controller: controller)),
                Expanded(flex: 4, child: CartPanel(controller: controller)),
              ],
            );
          } else {
            return Column(
              children: [
                Expanded(flex: 3, child: ProductGrid(controller: controller)),
                Expanded(flex: 2, child: CartPanel(controller: controller)),
              ],
            );
          }
        },
      ),
    );
  }
}
