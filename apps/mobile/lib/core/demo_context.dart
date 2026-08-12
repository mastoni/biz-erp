/// DEVELOPMENT ONLY.
/// Replace with authenticated business/branch context from Auth/Login phase before production.
class DemoContext {
  static const String businessId = '11111111-1111-1111-1111-111111111111';
  static const String branchId = 'BRANCH-001';
  static const String cashierId = 'CASHIER-001';
  static const String deviceId = 'DEVICE-001';
  static const int taxRateBps = 1100; // 11% Tax

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
