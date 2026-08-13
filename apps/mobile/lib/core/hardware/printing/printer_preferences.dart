import 'dart:convert';
import 'dart:io';
import 'printer_device.dart';

/// Abstraksi penyimpanan printer terakhir (auto-reconnect).
abstract class PrinterPreferences {
  Future<PrinterDevice?> loadLastPrinter();
  Future<void> saveLastPrinter(PrinterDevice device);
  Future<void> clearLastPrinter();
}

/// Implementasi file-based: `{baseDir}/last_printer.json`.
class FilePrinterPreferences implements PrinterPreferences {
  FilePrinterPreferences({required Directory baseDir})
    : _file = File('${baseDir.path}/last_printer.json');

  final File _file;

  @override
  Future<PrinterDevice?> loadLastPrinter() async {
    try {
      if (!await _file.exists()) return null;
      final raw = await _file.readAsString();
      final map = jsonDecode(raw) as Map<String, dynamic>;
      final address = map['address'] as String?;
      if (address == null || address.isEmpty) return null;
      return PrinterDevice(
        name: (map['name'] as String?) ?? 'Printer',
        address: address,
      );
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> saveLastPrinter(PrinterDevice device) async {
    try {
      if (!await _file.parent.exists()) {
        await _file.parent.create(recursive: true);
      }
      await _file.writeAsString(
        jsonEncode({'address': device.address, 'name': device.name}),
      );
    } catch (_) {
      // Persistensi printer bukan kritis; abaikan kegagalan I/O.
    }
  }

  @override
  Future<void> clearLastPrinter() async {
    try {
      if (await _file.exists()) await _file.delete();
    } catch (_) {}
  }
}
