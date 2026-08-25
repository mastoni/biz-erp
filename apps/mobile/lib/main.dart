import 'dart:async';
import 'package:flutter/material.dart';

import 'package:biz_erp_mobile/core/auth/auth_secure_storage.dart';
import 'package:biz_erp_mobile/core/auth/auth_api_client.dart';
import 'package:biz_erp_mobile/core/auth/auth_repository.dart';
import 'package:biz_erp_mobile/core/auth/auth_state_notifier.dart';
import 'package:biz_erp_mobile/core/auth/auth_models.dart';
import 'package:biz_erp_mobile/core/auth/presentation/login_screen.dart';
import 'package:biz_erp_mobile/core/composition/tenant_composition_root.dart';
import 'package:biz_erp_mobile/core/observability/sentry_integration.dart';
import 'package:biz_erp_mobile/core/sync/sync_config.dart';
import 'package:biz_erp_mobile/pos/presentation/pos_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Phase 4.0.9: Global Auth Initialization
  final authStorage = AuthSecureStorage();
  final authApiClient = AuthApiClient(baseUrl: SyncConfig.baseUrl);
  final authRepository = AuthRepository(storage: authStorage, apiClient: authApiClient);
  final authStateNotifier = AuthStateNotifier(repository: authRepository);
  await authStateNotifier.init();

  await initSentry(() {
    runApp(MyApp(
      authStateNotifier: authStateNotifier,
    ));
  });
}

class MyApp extends StatefulWidget {
  final AuthStateNotifier authStateNotifier;

  const MyApp({super.key, required this.authStateNotifier});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  TenantDependencyGraph? _graph;
  String? _currentBusinessId;
  bool _isLoadingTenant = false;

  @override
  void initState() {
    super.initState();
    widget.authStateNotifier.addListener(_onAuthStateChanged);
    _onAuthStateChanged(); // check initial state
  }

  @override
  void dispose() {
    widget.authStateNotifier.removeListener(_onAuthStateChanged);
    _graph?.dispose();
    super.dispose();
  }

  Future<void> _onAuthStateChanged() async {
    final businessId = widget.authStateNotifier.businessId;

    if (businessId == null) {
      if (_graph != null) {
        await _graph!.dispose();
        if (mounted) {
          setState(() {
            _graph = null;
            _currentBusinessId = null;
          });
        }
      }
      return;
    }

    if (businessId != _currentBusinessId) {
      if (mounted) {
        setState(() {
          _isLoadingTenant = true;
        });
      }

      if (_graph != null) {
        await _graph!.dispose();
      }

      final newGraph = await TenantCompositionRoot.compose(
        businessId: businessId,
        authStateNotifier: widget.authStateNotifier,
      );

      if (mounted) {
        setState(() {
          _graph = newGraph;
          _currentBusinessId = businessId;
          _isLoadingTenant = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BizERP POS',
      theme: ThemeData(primarySwatch: Colors.blueGrey, useMaterial3: true),
      home: AnimatedBuilder(
        animation: widget.authStateNotifier,
        builder: (context, _) {
          if (widget.authStateNotifier.status == AuthStatus.unknown) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          if (widget.authStateNotifier.status == AuthStatus.unauthenticated) {
            return LoginScreen(authNotifier: widget.authStateNotifier);
          }
          if (_isLoadingTenant || _graph == null) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }

          return PosScreen(
            controller: _graph!.controller,
            scannerService: _graph!.scannerService,
            syncStatusNotifier: _graph!.syncStatusNotifier,
            productRepo: _graph!.productRepo,
            outboxRepo: _graph!.outboxRepo,
            authStateNotifier: widget.authStateNotifier,
            customerRepo: _graph!.customerRepo,
          );
        },
      ),
    );
  }
}
