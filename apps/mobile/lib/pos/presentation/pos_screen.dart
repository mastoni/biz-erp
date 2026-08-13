import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/hardware/scanning/scanner_service.dart';
import 'pos_controller.dart';
import 'widgets/product_grid.dart';
import 'widgets/cart_panel.dart';

class PosScreen extends StatefulWidget {
  final PosController controller;
  final ScannerService? scannerService; // optional agar test lama tetap jalan

  const PosScreen({super.key, required this.controller, this.scannerService});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  @override
  void initState() {
    super.initState();
    widget.scannerService?.addListener(_onScanEvent);
  }

  @override
  void dispose() {
    widget.scannerService?.removeListener(_onScanEvent);
    super.dispose();
  }

  void _onScanEvent() {
    final ev = widget.scannerService?.lastEvent;
    if (ev == null || !mounted) return;

    String text;
    Color color;
    switch (ev.kind) {
      case ScanEventKind.added:
        text = '+ ${ev.productName}';
        color = Colors.green[700]!;
        break;
      case ScanEventKind.notFound:
        text = 'Produk tidak ditemukan: ${ev.barcode}';
        color = Colors.red[700]!;
        break;
      case ScanEventKind.inactive:
        text = 'Produk non-aktif: ${ev.productName}';
        color = Colors.orange[700]!;
        break;
      case ScanEventKind.duplicate:
        text = 'Barcode duplikat (data integrity error): ${ev.barcode}';
        color = Colors.red[700]!;
        break;
    }

    // Clear snackbar queue sebelum show yang baru
    ScaffoldMessenger.of(context).clearSnackBars();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text),
        backgroundColor: color,
        duration: const Duration(seconds: 2),
      ),
    );
  }

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
          if (constraints.maxWidth > 600) {
            return Row(
              children: [
                Expanded(
                  flex: 6,
                  child: ProductGrid(controller: widget.controller),
                ),
                Expanded(
                  flex: 4,
                  child: CartPanel(controller: widget.controller),
                ),
              ],
            );
          }
          return Column(
            children: [
              Expanded(
                flex: 3,
                child: ProductGrid(controller: widget.controller),
              ),
              Expanded(
                flex: 2,
                child: CartPanel(controller: widget.controller),
              ),
            ],
          );
        },
      ),
    );
  }
}
