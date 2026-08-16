// apps/mobile/lib/core/sync/sync_config.dart

class SyncConfig {
  // Development URLs
  static const String androidEmulatorUrl = 'http://10.0.2.2:8080';
  static const String iosSimulatorUrl = 'http://localhost:8080';

  // Production URL (replace with actual production URL)
  static const String productionUrl = 'https://api.biz-erp.com';

  // Current environment URL provided via --dart-define
  static String get baseUrl {
    const definedUrl = String.fromEnvironment('API_URL');
    if (definedUrl.isNotEmpty) {
      return definedUrl;
    }
    // Fallback for local development if not specified
    const isProduction = bool.fromEnvironment('dart.vm.product');
    if (isProduction) {
      throw Exception('API_URL must be provided via --dart-define in release builds.');
    }
    return androidEmulatorUrl;
  }

  // Timeouts
  static const Duration healthTimeout = Duration(seconds: 5);
  static const Duration apiTimeout = Duration(seconds: 30);
}
