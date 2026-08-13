import 'package:flutter/foundation.dart';
import 'bluetooth_printer_adapter.dart';
import 'printer_device.dart';
import 'printer_preferences.dart';
import 'receipt_data.dart';
import 'receipt_formatter.dart';

enum PrinterStatus { disconnected, connecting, connected, printing, error }

class PrintingService extends ChangeNotifier {
  PrintingService({
    required this._adapter,
    required this._prefs,
    this._formatter = const ReceiptFormatter(),
  });

  final BluetoothPrinterAdapter _adapter;
  final PrinterPreferences _prefs;
  final ReceiptFormatter _formatter;

  PrinterStatus _status = PrinterStatus.disconnected;
  String? _errorMessage;
  List<PrinterDevice> _pairedDevices = <PrinterDevice>[];
  PrinterDevice? _connectedDevice;

  PrinterStatus get status => _status;
  String? get errorMessage => _errorMessage;
  List<PrinterDevice> get pairedDevices => List.unmodifiable(_pairedDevices);
  PrinterDevice? get connectedDevice => _connectedDevice;

  Future<void> loadPairedDevices() async {
    try {
      _pairedDevices = await _adapter.pairedDevices();
      _errorMessage = null;
    } on PrinterException catch (e) {
      _pairedDevices = <PrinterDevice>[];
      _errorMessage = e.message;
    }
    notifyListeners();
  }

  Future<bool> connect(PrinterDevice device) async {
    _status = PrinterStatus.connecting;
    _errorMessage = null;
    notifyListeners();
    try {
      await _adapter.connect(device.address);
      _connectedDevice = device;
      _status = PrinterStatus.connected;
      await _prefs.saveLastPrinter(device);
      notifyListeners();
      return true;
    } on PrinterException catch (e) {
      _connectedDevice = null;
      _status = PrinterStatus.error;
      _errorMessage = e.message;
      notifyListeners();
      return false;
    }
  }

  /// Mencetak struk. TIDAK menyentuh status transaksi apa pun.
  Future<bool> printReceipt(ReceiptData data) async {
    if (_status != PrinterStatus.connected) {
      _errorMessage = 'Printer belum terhubung';
      _status = PrinterStatus.error;
      notifyListeners();
      return false;
    }
    _status = PrinterStatus.printing;
    _errorMessage = null;
    notifyListeners();
    try {
      final bytes = _formatter.format(data);
      await _adapter.writeBytes(bytes);
      _status = PrinterStatus.connected;
      notifyListeners();
      return true;
    } on PrinterException catch (e) {
      _status = PrinterStatus.error;
      _errorMessage = e.message;
      notifyListeners();
      return false;
    }
  }

  Future<void> disconnect() async {
    try {
      await _adapter.disconnect();
    } on PrinterException {
      // abaikan
    }
    _connectedDevice = null;
    _status = PrinterStatus.disconnected;
    _errorMessage = null;
    notifyListeners();
  }

  /// Silent auto-reconnect saat startup. Gagal = tetap disconnected (bukan error).
  Future<void> autoReconnectLast() async {
    final saved = await _prefs.loadLastPrinter();
    if (saved == null) return;
    try {
      final paired = await _adapter.pairedDevices();
      final match = paired.where((p) => p.address == saved.address).toList();
      if (match.isEmpty) return;
      await _adapter.connect(saved.address);
      _connectedDevice = match.first;
      _status = PrinterStatus.connected;
    } catch (_) {
      _connectedDevice = null;
      _status = PrinterStatus.disconnected;
    }
    notifyListeners();
  }
}
