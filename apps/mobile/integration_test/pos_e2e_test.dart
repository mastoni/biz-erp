import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:biz_erp_mobile/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Full POS E2E Flow (Stability, Cash, Transfer)', (tester) async {
    // 1. App Initialization (Hanya dipanggil sekali untuk mencegah DB Lock)
    await app.main();
    await tester.pumpAndSettle(const Duration(seconds: 5));

    // E2E-003: Stability Check
    expect(find.text('BizERP POS'), findsOneWidget);
    expect(find.text('Keranjang Kosong'), findsOneWidget);

    // ==========================================
    // E2E-001: Full flow CASH payment
    // ==========================================
    final product1 = find.byKey(
      const Key('product_a1111111-1111-1111-1111-111111111111'),
    );
    expect(product1, findsOneWidget);
    await tester.tap(product1);
    await tester.pumpAndSettle();

    final bayarBtn1 = find.text('BAYAR SEKARANG');
    expect(
      bayarBtn1,
      findsOneWidget,
      reason: 'Cart should update and show checkout button',
    );
    await tester.ensureVisible(bayarBtn1);
    await tester.tap(bayarBtn1);
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '20000');
    await tester.pump();
    final confirmBtn1 = find.text('KONFIRMASI');
    await tester.ensureVisible(confirmBtn1);
    await tester.tap(confirmBtn1);
    await tester.pumpAndSettle();

    expect(find.text('Transaksi Sukses'), findsOneWidget);

    final selesaiBtn1 = find.text('SELESAI');
    await tester.ensureVisible(selesaiBtn1);
    await tester.tap(selesaiBtn1);
    await tester.pumpAndSettle();

    expect(find.text('Keranjang Kosong'), findsOneWidget);

    // ==========================================
    // E2E-002: Full flow TRANSFER payment
    // ==========================================
    final product2 = find.byKey(
      const Key('product_b2222222-2222-2222-2222-222222222222'),
    );
    expect(product2, findsOneWidget);
    await tester.tap(product2);
    await tester.pumpAndSettle();

    final bayarBtn2 = find.text('BAYAR SEKARANG');
    expect(bayarBtn2, findsOneWidget);
    await tester.ensureVisible(bayarBtn2);
    await tester.tap(bayarBtn2);
    await tester.pumpAndSettle();

    final transferRadio = find.text('Transfer / Non-Tunai');
    await tester.ensureVisible(transferRadio);
    await tester.tap(transferRadio);
    await tester.pumpAndSettle();

    await tester.pump();
    final confirmBtn2 = find.text('KONFIRMASI');
    await tester.ensureVisible(confirmBtn2);
    await tester.tap(confirmBtn2);
    await tester.pumpAndSettle();

    expect(find.text('Transaksi Sukses'), findsOneWidget);

    final selesaiBtn2 = find.text('SELESAI');
    await tester.ensureVisible(selesaiBtn2);
    await tester.tap(selesaiBtn2);
    await tester.pumpAndSettle();

    expect(find.text('Keranjang Kosong'), findsOneWidget);
  });
}
