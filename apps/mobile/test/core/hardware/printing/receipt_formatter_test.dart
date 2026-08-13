import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_data.dart';
import 'package:biz_erp_mobile/core/hardware/printing/receipt_formatter.dart';

ReceiptData sample({int total = 47952}) => ReceiptData(
  receiptNumber: 'BRANCH-001-20260813-0001',
  businessName: 'WARUNG DEMO',
  branchName: 'CABANG UTAMA',
  cashierId: 'CASHIER-001',
  createdAtEpochMs: DateTime(2026, 8, 13, 16, 20).millisecondsSinceEpoch,
  subtotalMinor: 48000,
  discountMinor: 4800,
  taxMinor: 4752,
  totalMinor: total,
  cashReceivedMinor: 50000,
  changeMinor: 2048,
  items: const [
    ReceiptItemData(
      productId: 'p1',
      displayName: 'Kopi Susu Gula Aren',
      quantity: 1,
      unitPriceMinor: 18000,
    ),
    ReceiptItemData(
      productId: 'p2',
      displayName: 'Roti Bakar Coklat Keju Super Panjang Sekali',
      quantity: 2,
      unitPriceMinor: 15000,
    ),
  ],
);

void main() {
  const formatter = ReceiptFormatter();

  test('PRINT-001 header centered & separator 32 kolom', () {
    final lines = formatter.buildLines(sample());
    expect(lines[0], '=' * 32);
    expect(lines[1].length, 32);
    expect(lines[1].trim(), 'WARUNG DEMO');
    expect(lines[1].startsWith(' '), isTrue);
  });

  test('PRINT-002 item 2 baris, qty x harga kiri, total kanan', () {
    final lines = formatter.buildLines(sample());
    final idx = lines.indexOf('Kopi Susu Gula Aren');
    expect(idx, greaterThan(0));
    final detail = lines[idx + 1];
    expect(detail.length, 32);
    expect(detail.trimLeft().startsWith('1 x 18.000'), isTrue);
    expect(detail.endsWith('18.000'), isTrue);
  });

  test('PRINT-003 nama panjang di-truncate ke 32', () {
    final lines = formatter.buildLines(sample());
    final truncated = lines.firstWhere((l) => l.startsWith('Roti Bakar'));
    expect(truncated.length, 32);
  });

  test('PRINT-004 TOTAL right-aligned', () {
    final lines = formatter.buildLines(sample());
    final total = lines.firstWhere((l) => l.startsWith('TOTAL'));
    expect(total.length, 32);
    expect(total.endsWith('47.952'), isTrue);
  });

  test('PRINT-005 format ribuan (subtotal/diskon/kembalian)', () {
    final lines = formatter.buildLines(sample());
    expect(lines.any((l) => l.endsWith('48.000')), isTrue);
    expect(lines.any((l) => l.endsWith('-4.800')), isTrue);
    expect(lines.any((l) => l.endsWith('2.048')), isTrue);
  });

  test('PRINT-006 bytes: init di awal, cut di akhir', () {
    final bytes = formatter.format(sample());
    expect(bytes.take(2).toList(), [0x1B, 0x40]);
    expect(bytes.skip(bytes.length - 3).toList(), [0x1D, 0x56, 0x00]);
  });

  test('PRINT-007 total diambil dari snapshot, tidak dihitung ulang', () {
    final lines = formatter.buildLines(sample(total: 99999));
    final total = lines.firstWhere((l) => l.startsWith('TOTAL'));
    expect(total.endsWith('99.999'), isTrue);
  });
}
