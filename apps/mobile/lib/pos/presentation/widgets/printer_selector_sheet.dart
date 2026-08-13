import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../../core/hardware/printing/printing_service.dart';

/// Membuka bottom sheet pemilih printer. Return true jika berhasil connect.
Future<bool> showPrinterSelectorSheet(
  BuildContext context, {
  required PrintingService printingService,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    builder: (_) => PrinterSelectorSheet(printingService: printingService),
  );
  return result ?? false;
}

class PrinterSelectorSheet extends StatefulWidget {
  final PrintingService printingService;
  const PrinterSelectorSheet({super.key, required this.printingService});

  @override
  State<PrinterSelectorSheet> createState() => _PrinterSelectorSheetState();
}

class _PrinterSelectorSheetState extends State<PrinterSelectorSheet> {
  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    // 1. Permission request - abaikan error apapun
    try {
      await [Permission.bluetoothConnect, Permission.bluetoothScan].request();
    } catch (_) {}

    // 2. Load devices - selalu jalankan, abaikan error apapun
    try {
      await widget.printingService.loadPairedDevices();
    } catch (_) {
      // Silent fail - test environment tanpa MethodChannel
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.printingService,
      builder: (context, _) {
        final service = widget.printingService;
        return Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Text(
                    'Pilih Printer',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.refresh, size: 20),
                    onPressed: () => service.loadPairedDevices(),
                  ),
                ],
              ),
              if (service.errorMessage != null)
                Text(
                  service.errorMessage!,
                  style: const TextStyle(color: Colors.red, fontSize: 12),
                ),
              const SizedBox(height: 8),
              if (service.pairedDevices.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text(
                      'Tidak ada printer ter-pairing.\nPair di Settings Bluetooth dulu.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey),
                    ),
                  ),
                )
              else
                ...service.pairedDevices.map((device) {
                  final connecting = service.status == PrinterStatus.connecting;
                  return ListTile(
                    dense: true,
                    leading: const Icon(Icons.print, size: 20),
                    title: Text(
                      device.name,
                      style: const TextStyle(fontSize: 14),
                    ),
                    subtitle: Text(
                      device.address,
                      style: const TextStyle(fontSize: 11),
                    ),
                    trailing: connecting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.link, size: 18),
                    onTap: connecting
                        ? null
                        : () async {
                            final ok = await service.connect(device);
                            if (ok && context.mounted) {
                              Navigator.pop(context, true);
                            }
                          },
                  );
                }),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
}
