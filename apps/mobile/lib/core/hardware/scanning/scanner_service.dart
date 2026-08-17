import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:biz_erp_mobile/products/data/product_repository.dart';
import 'package:biz_erp_mobile/products/domain/barcode_lookup.dart';
import 'scan_buffer.dart';

enum ScanEventKind { added, notFound, inactive, duplicate }

class ScanEvent {
  final ScanEventKind kind;
  final String barcode;
  final String? productName;
  const ScanEvent(this.kind, this.barcode, this.productName);
}

/// Intersepsi global keyboard-wedge (USB/BT HID) + lookup + add-to-cart.
/// TIDAK menyentuh CheckoutService atau status transaksi.
class ScannerService extends ChangeNotifier {
  ScannerService({
    required this._productRepo,
    required this._businessId,
    required this._addToCart,
    this.duplicateDebounce = const Duration(milliseconds: 500),
  });

  final ProductRepository _productRepo;
  final String _businessId;
  final Future<void> Function(String productId) _addToCart;
  final Duration duplicateDebounce;

  final ScanBuffer _buffer = ScanBuffer();
  ScanEvent? _lastEvent;
  String? _lastCode;
  int _lastTs = 0;

  ScanEvent? get lastEvent => _lastEvent;

  /// Pasang listener keyboard global.
  void start() {
    HardwareKeyboard.instance.addHandler(_onKey);
  }

  void stop() {
    HardwareKeyboard.instance.removeHandler(_onKey);
  }

  bool _onKey(KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return false;
    }
    final now = DateTime.now().millisecondsSinceEpoch;
    final logical = event.logicalKey;

    if (logical == LogicalKeyboardKey.enter ||
        logical == LogicalKeyboardKey.numpadEnter) {
      final code = _buffer.feed(isEnter: true, timestampMs: now);
      if (code != null) {
        processBarcode(code);
        return true; // konsumsi Enter hanya jika scan valid
      }
      return false;
    }

    final ch = event.character;
    if (ch != null && ch.isNotEmpty && ch.codeUnitAt(0) >= 0x20) {
      _buffer.feed(character: ch, timestampMs: now);
    }
    return false; // karakter TIDAK dikonsumsi → ketikan manusia normal
  }

  /// Entry point publik (dipakai hardware handler, unit test, dan adb flow).
  Future<void> processBarcode(String code) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    if (code == _lastCode &&
        (now - _lastTs) < duplicateDebounce.inMilliseconds) {
      return; // double-read hardware
    }
    _lastCode = code;
    _lastTs = now;

    final lookup = await _productRepo.findByBarcode(_businessId, code);
    switch (lookup.status) {
      case BarcodeLookupStatus.found:
        await _addToCart(lookup.product!.id);
        _lastEvent = ScanEvent(ScanEventKind.added, code, lookup.product!.name);
        break;
      case BarcodeLookupStatus.notFound:
        _lastEvent = ScanEvent(ScanEventKind.notFound, code, null);
        break;
      case BarcodeLookupStatus.inactive:
        _lastEvent = ScanEvent(
          ScanEventKind.inactive,
          code,
          lookup.product!.name,
        );
        break;
      case BarcodeLookupStatus.duplicate:
        _lastEvent = ScanEvent(ScanEventKind.duplicate, code, null);
        break;
    }
    notifyListeners();
  }
}
