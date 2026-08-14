// apps/mobile/lib/core/sync/sync_config.dart

class SyncConfig {
  // Development URLs
  static const String androidEmulatorUrl = 'http://10.0.2.2:8080';
  static const String iosSimulatorUrl = 'http://localhost:8080';

  // Production URL (replace with actual production URL)
  static const String productionUrl = 'https://api.biz-erp.com';

  // Current environment
  static String get baseUrl {
    // In development, use emulator URL
    // In production, use production URL
    const isProduction = bool.fromEnvironment('dart.vm.product');
    return isProduction ? productionUrl : androidEmulatorUrl;
  }

  // Timeouts
  static const Duration healthTimeout = Duration(seconds: 5);
  static const Duration apiTimeout = Duration(seconds: 30);
}
