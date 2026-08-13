import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/hardware/scanning/scan_buffer.dart';

void main() {
  ScanBuffer buffer() => ScanBuffer();

  int feedChars(ScanBuffer b, String s, {int start = 0, int step = 5}) {
    var ts = start;
    for (final c in s.split('')) {
      b.feed(character: c, timestampMs: ts);
      ts += step;
    }
    return ts;
  }

  test('SCAN-001 karakter cepat + Enter emit barcode', () {
    final b = buffer();
    final ts = feedChars(b, '8991002123456');
    expect(b.feed(isEnter: true, timestampMs: ts), '8991002123456');
  });

  test('SCAN-002 ketikan lambat + Enter BUKAN scan', () {
    final b = buffer();
    final ts = feedChars(b, '8991002123456', step: 250);
    expect(b.feed(isEnter: true, timestampMs: ts), isNull);
  });

  test('SCAN-003 jeda > timeout mereset buffer', () {
    final b = buffer();
    var ts = feedChars(b, '123');
    ts += 500; // jeda manusia
    ts = feedChars(b, '8991002', start: ts);
    expect(b.feed(isEnter: true, timestampMs: ts), '8991002');
  });

  test('SCAN-004 Enter dengan buffer pendek diabaikan', () {
    final b = buffer();
    final ts = feedChars(b, '123');
    expect(b.feed(isEnter: true, timestampMs: ts), isNull);
  });

  test('SCAN-005 threshold configurable', () {
    final b = ScanBuffer(
      interCharacterTimeout: const Duration(milliseconds: 300),
    );
    final ts = feedChars(b, '8991002123456', step: 200);
    expect(b.feed(isEnter: true, timestampMs: ts), '8991002123456');
  });
}
