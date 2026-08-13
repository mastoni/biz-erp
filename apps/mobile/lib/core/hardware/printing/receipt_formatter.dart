import 'dart:typed_data';
import 'receipt_data.dart';

/// Formatter struk thermal 58mm (32 kolom), pure & deterministic.
class ReceiptFormatter {
  const ReceiptFormatter();

  static const int width = 32;

  /// Baris teks struk (terpisah dari bytes agar mudah di-test).
  List<String> buildLines(ReceiptData d) {
    final lines = <String>[];
    lines.add(_sep('='));
    lines.add(_center(d.businessName.toUpperCase()));
    lines.add(_center(d.branchName.toUpperCase()));
    lines.add(_sep('='));
    lines.add('No : ${d.receiptNumber}');
    final dt = DateTime.fromMillisecondsSinceEpoch(d.createdAtEpochMs);
    lines.add(
      'Tgl: ${_pad(dt.day)}/${_pad(dt.month)}/${dt.year} ${_pad(dt.hour)}:${_pad(dt.minute)}',
    );
    lines.add('Kasir: ${d.cashierId}');
    lines.add(_sep('-'));

    for (final item in d.items) {
      lines.add(_truncate(item.displayName, width));
      final left = ' ${item.quantity} x ${_num(item.unitPriceMinor)}';
      final right = _num(item.quantity * item.unitPriceMinor);
      lines.add(_leftRight(left, right));
    }

    lines.add(_sep('-'));
    lines.add(_leftRight('Subtotal', _num(d.subtotalMinor)));
    if (d.discountMinor > 0) {
      lines.add(_leftRight('Diskon', '-${_num(d.discountMinor)}'));
    }
    if (d.taxMinor > 0) {
      lines.add(_leftRight('Pajak', _num(d.taxMinor)));
    }
    lines.add(_leftRight('TOTAL', _num(d.totalMinor)));
    lines.add(_leftRight('Tunai', _num(d.cashReceivedMinor)));
    lines.add(_leftRight('Kembalian', _num(d.changeMinor)));
    lines.add(_sep('='));
    lines.add(_center('Terima kasih atas'));
    lines.add(_center('kunjungan Anda!'));
    lines.add(_sep('='));
    return lines;
  }

  /// Generate ESC/POS bytes lengkap (init → konten → feed → cut).
  Uint8List format(ReceiptData d) {
    final bytes = <int>[];
    bytes.addAll([0x1B, 0x40]); // ESC @ : init printer

    final lines = buildLines(d);
    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      final bold = i == 1 || line.startsWith('TOTAL');
      if (bold) bytes.addAll([0x1B, 0x45, 0x01]);
      bytes.addAll(_encode(line));
      bytes.add(0x0A);
      if (bold) bytes.addAll([0x1B, 0x45, 0x00]);
    }

    bytes.addAll([0x1B, 0x64, 0x03]); // feed 3 baris
    bytes.addAll([0x1D, 0x56, 0x00]); // GS V 0 : cut paper
    return Uint8List.fromList(bytes);
  }

  // ===== helpers =====

  String _sep(String c) => c * width;

  String _center(String s) {
    final t = _truncate(s, width);
    final leftPad = (width - t.length) ~/ 2;
    final rightPad = width - t.length - leftPad;
    return (' ' * leftPad) + t + (' ' * rightPad);
  }

  String _leftRight(String l, String r) {
    final maxL = width - r.length;
    final lt = _truncate(l, maxL);
    final gap = width - lt.length - r.length;
    return lt + (' ' * gap) + r;
  }

  String _truncate(String s, int n) => s.length <= n ? s : s.substring(0, n);

  String _num(int v) {
    final s = v.toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
      buf.write(s[i]);
    }
    return buf.toString();
  }

  String _pad(int n) => n.toString().padLeft(2, '0');

  /// Encode ASCII-safe (>126 diganti '?') agar deterministik di code page printer.
  List<int> _encode(String s) =>
      s.codeUnits.map((c) => c > 0x7E ? 0x3F : c).toList();
}
