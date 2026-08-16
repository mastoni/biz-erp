class CurrencyFormatter {
  /// Simple IDR formatter (no decimals, dot separator)
  static String formatIDR(int minor) {
    if (minor < 0) return '-Rp ${formatIDR(-minor).substring(3)}';
    final str = minor.toString();
    final buffer = StringBuffer();
    for (int i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) buffer.write('.');
      buffer.write(str[i]);
    }
    return 'Rp $buffer';
  }
}
