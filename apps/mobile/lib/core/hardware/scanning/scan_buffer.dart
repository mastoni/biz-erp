/// Buffer heuristik keyboard-wedge: scanner mengetik sangat cepat,
/// manusia tidak. Pure logic, timestamp di-inject agar testable.
class ScanBuffer {
  ScanBuffer({
    this.interCharacterTimeout = const Duration(milliseconds: 80),
    this.minimumBarcodeLength = 6,
  });

  final Duration interCharacterTimeout;
  final int minimumBarcodeLength;

  final StringBuffer _buffer = StringBuffer();
  int _lastCharTs = 0;

  /// Return barcode jika Enter menghasilkan scan valid; selain itu null.
  String? feed({
    String? character,
    bool isEnter = false,
    required int timestampMs,
  }) {
    if (isEnter) {
      final code = _buffer.toString();
      _reset();
      if (code.length >= minimumBarcodeLength) {
        return code;
      }
      return null;
    }

    if (character == null || character.isEmpty) {
      return null;
    }

    if (_buffer.isNotEmpty &&
        (timestampMs - _lastCharTs) > interCharacterTimeout.inMilliseconds) {
      // Jeda terlalu lama → ketikan manusia, mulai ulang buffer.
      _buffer.clear();
    }
    _buffer.write(character);
    _lastCharTs = timestampMs;
    return null;
  }

  void _reset() {
    _buffer.clear();
    _lastCharTs = 0;
  }
}
