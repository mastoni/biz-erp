import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';
import 'package:biz_erp_mobile/core/sync/sync_conflict_models.dart';

class ConflictDetailDialog extends StatelessWidget {
  final SyncStatusNotifier notifier;
  final SyncConflictInfo conflict;
  const ConflictDetailDialog({super.key, required this.notifier, required this.conflict});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Detail Konflik Produk'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Produk: ${conflict.productName ?? 'Unknown'}', style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          const Text('LOKAL:', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.blue)),
          Text('Versi Server Lokal: ${conflict.localServerVersion ?? '?'}'),
          const SizedBox(height: 12),
          const Text('SERVER:', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red)),
          Text('Versi Server Saat Ini: ${conflict.currentServerVersion ?? 'Tidak tersedia'}'),
          if (conflict.serverProduct != null) ...[
            const SizedBox(height: 8),
            Text('Nama Server: ${conflict.serverProduct!.name}'),
            Text('Harga Server: ${conflict.serverProduct!.priceMinor}'),
          ],
          const SizedBox(height: 16),
          const Text(
            'Produk di server telah berubah sejak data lokal terakhir disinkronkan. Data lokal Anda tetap dipertahankan.',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () async {
            await notifier.discardConflict(conflict.outboxId);
            if (context.mounted) Navigator.pop(context);
          },
          child: const Text('Mengerti / Sembunyikan Konflik'),
        ),
        if (conflict.serverProduct != null)
          TextButton(
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Terima versi server?'),
                  content: const Text('Data lokal produk ini akan digantikan dengan data terbaru dari server. Perubahan lokal yang belum tersinkron akan hilang.'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
                    TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Terima Versi Server')),
                  ],
                ),
              );
              if (confirmed == true && context.mounted) {
                try {
                  await notifier.acceptServerConflict(conflict.outboxId, conflict.serverProduct!);
                  if (context.mounted) Navigator.pop(context);
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal menerima versi server: $e')));
                  }
                }
              }
            },
            child: const Text('Terima Versi Server'),
          ),
      ],
    );
  }
}
