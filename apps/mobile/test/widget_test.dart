// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/main.dart';
import 'package:biz_erp_mobile/core/auth/auth_state_notifier.dart';
import 'package:biz_erp_mobile/core/auth/auth_models.dart';
import 'package:biz_erp_mobile/core/auth/auth_repository.dart';

class _FakeAuthRepository implements AuthRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeAuthStateNotifier extends AuthStateNotifier {
  _FakeAuthStateNotifier() : super(repository: _FakeAuthRepository());

  @override
  AuthStatus status = AuthStatus.authenticated;

  @override
  AuthSession? get session => null;

  @override
  Future<void> init() async {}
}

void main() {
  testWidgets('MyApp mounts without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(MyApp(authStateNotifier: _FakeAuthStateNotifier()));
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}