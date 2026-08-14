import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';
import 'conflict_detail_dialog.dart';

class ConflictListSheet extends StatelessWidget {
  final SyncStatusNotifier notifier;
  const ConflictListSheet({super.key, required this.notifier});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: notifier,
      builder: (context, child) {
        final conflicts = notifier.conflicts;
        return Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Konflik Sinkronisasi', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              const Text('Produk berikut gagal disinkronkan karena versi di server telah berubah.'),
              const SizedBox(height: 16),
              if (conflicts.isEmpty)
                const Center(child: Padding(padding: EdgeInsets.all(16.0), child: Text('Tidak ada konflik.')))
              else
                ListView.builder(
                  shrinkWrap: true,
                  itemCount: conflicts.length,
                  itemBuilder: (context, index) {
                    final c = conflicts[index];
                    return ListTile(
                      leading: const Icon(Icons.warning_amber_rounded, color: Colors.orange),
                      title: Text(c.productName ?? 'Unknown Product'),
                      subtitle: Text('Local v${c.localServerVersion ?? '?'} | Server v${c.currentServerVersion ?? '?'}'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        Navigator.pop(context);
                        showDialog(
                          context: context,
                          builder: (_) => ConflictDetailDialog(notifier: notifier, conflict: c),
                        );
                      },
                    );
                  },
                ),
            ],
          ),
        );
      },
    );
  }
}
