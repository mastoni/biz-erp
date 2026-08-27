import 'dart:async';
import 'package:flutter/material.dart';

import 'package:biz_erp_mobile/core/auth/auth_secure_storage.dart';
import 'package:biz_erp_mobile/core/auth/auth_api_client.dart';
import 'package:biz_erp_mobile/core/auth/auth_repository.dart';
import 'package:biz_erp_mobile/core/auth/auth_state_notifier.dart';
import 'package:biz_erp_mobile/core/auth/auth_models.dart';
import 'package:biz_erp_mobile/core/auth/presentation/login_screen.dart';
import 'package:biz_erp_mobile/core/tenant/tenant_context.dart';
import 'package:biz_erp_mobile/core/tenant/tenant_models.dart';
import 'package:biz_erp_mobile/core/tenant/presentation/tenant_selection_screen.dart';
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

  final tenantContext = TenantContext(authNotifier: authStateNotifier);
  await tenantContext.init();

  await initSentry(() {
    runApp(MyApp(
      authStateNotifier: authStateNotifier,
      tenantContext: tenantContext,
    ));
  });
}

class MyApp extends StatefulWidget {
  final AuthStateNotifier authStateNotifier;
  final TenantContext? tenantContext;

  const MyApp({
    super.key,
    required this.authStateNotifier,
    this.tenantContext,
  });

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late final TenantContext _tenantContext;
  TenantDependencyGraph? _graph;
  String? _currentBusinessId;
  bool _isLoadingTenant = false;

  @override
  void initState() {
    super.initState();
    _tenantContext = widget.tenantContext ?? TenantContext(authNotifier: widget.authStateNotifier);
    _tenantContext.addListener(_onTenantChanged);
    _onTenantChanged(); // check initial state
  }

  @override
  void dispose() {
    _tenantContext.removeListener(_onTenantChanged);
    if (widget.tenantContext == null) {
      _tenantContext.dispose();
    }
    _graph?.dispose();
    super.dispose();
  }

  Future<void> _onTenantChanged() async {
    final businessId = _tenantContext.businessId;

    if (businessId == null || !isValidBusinessId(businessId)) {
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

      try {
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
      } catch (e) {
        if (mounted) {
          setState(() {
            _isLoadingTenant = false;
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BizERP POS',
      theme: ThemeData(primarySwatch: Colors.blueGrey, useMaterial3: true),
      home: AnimatedBuilder(
        animation: Listenable.merge([widget.authStateNotifier, _tenantContext]),
        builder: (context, _) {
          if (widget.authStateNotifier.status == AuthStatus.unknown) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          if (widget.authStateNotifier.status == AuthStatus.unauthenticated ||
              widget.authStateNotifier.status == AuthStatus.sessionExpired) {
            return LoginScreen(authNotifier: widget.authStateNotifier);
          }

          if (_tenantContext.status == TenantStatus.loading ||
              _tenantContext.status == TenantStatus.switching ||
              _isLoadingTenant) {
            return const Scaffold(
              body: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(),
                    SizedBox(height: 16),
                    Text('Menyiapkan sesi tenant...'),
                  ],
                ),
              ),
            );
          }

          if (_tenantContext.status == TenantStatus.available) {
            return TenantSelectionScreen(
              tenants: _tenantContext.availableTenants,
              activeTenantId: _tenantContext.activeTenant?.id,
              onSelectTenant: (id) async {
                await _tenantContext.switchTenant(id);
              },
            );
          }

          if (_tenantContext.status == TenantStatus.empty) {
            return Scaffold(
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.business_outlined, size: 64, color: Colors.grey),
                      const SizedBox(height: 16),
                      const Text(
                        'Tidak Ada Bisnis',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Akun Anda belum terhubung ke unit usaha manapun.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey),
                      ),
                      const SizedBox(height: 24),
                      ElevatedButton(
                        onPressed: () => widget.authStateNotifier.logout(),
                        child: const Text('Keluar'),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          if (_graph == null) {
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
            supplierRepo: _graph!.supplierRepo,
          );
        },
      ),
    );
  }
}
