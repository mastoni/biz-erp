import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/hardware/scanning/scanner_service.dart';
import 'pos_controller.dart';
import 'widgets/product_grid.dart';
import 'widgets/cart_panel.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';
import 'widgets/sync_status_indicator.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/core/sync/sync_outbox_repository.dart';
import 'package:biz_erp_mobile/products/presentation/product_list_screen.dart';
import 'widgets/conflict_list_sheet.dart';

class PosScreen extends StatefulWidget {
  final PosController controller;
  final ScannerService? scannerService; // optional agar test lama tetap jalan
  final SyncStatusNotifier? syncStatusNotifier;
  final ProductRepository? productRepo;
  final SyncOutboxRepository? outboxRepo;

  const PosScreen({super.key, required this.controller, this.scannerService, this.syncStatusNotifier, this.productRepo, this.outboxRepo});

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
      drawer: _buildDrawer(),
      appBar: AppBar(
        title: const Text('BizERP POS'),
        backgroundColor: Colors.blueGrey[800],
        foregroundColor: Colors.white,
      actions: [
          if (widget.syncStatusNotifier != null) SyncStatusIndicator(
                  notifier: widget.syncStatusNotifier!,
                  onTap: () {
                    showModalBottomSheet(
                      context: context,
                      builder: (_) => ConflictListSheet(notifier: widget.syncStatusNotifier!),
                    );
                  },
                ),
        ],
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

  Widget _buildDrawer() {
    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          DrawerHeader(
            decoration: BoxDecoration(color: Colors.blueGrey[800]),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text('BizERP POS', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                SizedBox(height: 4),
                Text('Menu', style: TextStyle(color: Colors.white70, fontSize: 14)),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.inventory_2),
            title: const Text('Daftar Produk'),
            subtitle: const Text('Kelola produk & harga'),
            onTap: () {
              Navigator.pop(context);
              if (widget.productRepo == null || widget.outboxRepo == null) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Manajemen produk belum diaktifkan')),
                );
                return;
              }
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ProductListScreen(
                    productRepo: widget.productRepo!,
                    outboxRepo: widget.outboxRepo!,
                    syncStatusNotifier: widget.syncStatusNotifier!,
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
