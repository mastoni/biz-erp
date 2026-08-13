import 'package:flutter/services.dart';
import 'printer_device.dart';

/// Exception dengan pesan error asli dari layer native Android.
class PrinterException implements Exception {
  final String message;
  PrinterException(this.message);

  @override
  String toString() => 'PrinterException: $message';
}

/// Adapter tipis ke Kotlin MethodChannel `com.biz_erp/bluetooth_printer`.
/// Tidak mengandung business logic; hanya translasi error.
class BluetoothPrinterAdapter {
  BluetoothPrinterAdapter({
    this._channel = const MethodChannel('com.biz_erp/bluetooth_printer'),
  });

  final MethodChannel _channel;

  Future<List<PrinterDevice>> pairedDevices() async {
    try {
      final list = await _channel.invokeMethod('getPairedDevices');
      return (list as List? ?? <dynamic>[])
          .map(
            (e) => PrinterDevice(
              name: (e['name'] as String?) ?? 'Unknown',
              address: (e['address'] as String?) ?? '',
            ),
          )
          .toList();
    } on PlatformException catch (e) {
      throw PrinterException(e.message ?? 'pairedDevices failed');
    }
  }

  Future<void> connect(String address) async {
    try {
      await _channel.invokeMethod('connect', {'address': address});
    } on PlatformException catch (e) {
      throw PrinterException(e.message ?? 'connect failed');
    }
  }

  Future<void> writeBytes(Uint8List bytes) async {
    try {
      await _channel.invokeMethod('writeBytes', {'bytes': bytes});
    } on PlatformException catch (e) {
      throw PrinterException(e.message ?? 'writeBytes failed');
    }
  }

  Future<void> disconnect() async {
    try {
      await _channel.invokeMethod('disconnect');
    } on PlatformException catch (e) {
      throw PrinterException(e.message ?? 'disconnect failed');
    }
  }

  Future<bool> isConnected() async {
    try {
      return (await _channel.invokeMethod('isConnected')) == true;
    } on PlatformException {
      return false;
    }
  }
}
