import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'sync_api_client.dart';

/// Connectivity = trigger; health check = proof of reachability.
class NetworkMonitor {
  NetworkMonitor({required SyncApiClient api}) : _api = api;
  final SyncApiClient _api;

  Stream<bool> get onConnectivityChanged => Connectivity().onConnectivityChanged
      .map((r) => !r.contains(ConnectivityResult.none));

  Future<bool> apiReachable() async {
    try {
      return await _api.health().timeout(const Duration(seconds: 5));
    } catch (_) {
      return false;
    }
  }
}
