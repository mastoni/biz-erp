import 'package:flutter/material.dart';
import 'package:biz_erp_mobile/core/sync/sync_status_notifier.dart';

class SyncStatusIndicator extends StatelessWidget {
  final SyncStatusNotifier notifier;
  const SyncStatusIndicator({super.key, required this.notifier});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: notifier,
      builder: (context, child) {
        final state = notifier.currentState;
        IconData icon;
        Color color;
        String text;
        bool showSyncButton = false;

        switch (state) {
          case SyncState.offline:
            icon = Icons.wifi_off;
            color = Colors.redAccent;
            text = 'Offline';
            break;
          case SyncState.syncing:
            icon = Icons.sync;
            color = Colors.orangeAccent;
            text = 'Syncing...';
            break;
          case SyncState.failed:
            icon = Icons.error_outline;
            color = Colors.redAccent;
            text = '${notifier.failedCount} gagal';
            showSyncButton = true;
            break;
          case SyncState.pending:
            icon = Icons.cloud_upload_outlined;
            color = Colors.amber[700]!;
            text = '${notifier.pendingCount} pending';
            showSyncButton = true;
            break;
          case SyncState.synced:
            icon = Icons.cloud_done;
            color = Colors.lightGreen;
            text = 'Synced';
            break;
        }

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8.0),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: 6),
              Text(text, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
              if (showSyncButton && notifier.isOnline) ...[
                const SizedBox(width: 4),
                IconButton(
                  icon: const Icon(Icons.sync, color: Colors.white, size: 20),
                  tooltip: 'Sync Now',
                  onPressed: notifier.syncNow,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
