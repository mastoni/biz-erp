import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:biz_erp_mobile/core/theme/pos_theme.dart';
import 'package:biz_erp_mobile/core/theme/pos_widgets.dart';

void main() {
  group('Design System Tokens', () {
    test('Pine & Honey brand color tokens match approved hex values', () {
      expect(PosColors.pineDeep, const Color(0xFF0C2018));
      expect(PosColors.pineDark, const Color(0xFF10402C));
      expect(PosColors.pine, const Color(0xFF17593E));
      expect(PosColors.pineLight, const Color(0xFF1F7350));
      expect(PosColors.pineSoft, const Color(0xFFE2ECE7));
      expect(PosColors.honey, const Color(0xFFD3921F));
      expect(PosColors.clay, const Color(0xFFBC4B2F));
      expect(PosColors.ocean, const Color(0xFF35657F));
      expect(PosColors.paper, const Color(0xFFF0EFE7));
      expect(PosColors.surface, const Color(0xFFFFFFFF));
      expect(PosColors.ink, const Color(0xFF1A1D1A));
      expect(PosColors.fog, const Color(0xFF7A827B));
      expect(PosColors.line, const Color(0xFFE2E0D5));
    });

    test('Spacing and Radius tokens follow 4-point scale', () {
      expect(PosSpacing.xs, 4.0);
      expect(PosSpacing.sm, 8.0);
      expect(PosSpacing.md, 12.0);
      expect(PosSpacing.lg, 16.0);
      expect(PosSpacing.xxl, 24.0);
      expect(PosSpacing.xxxl, 32.0);

      expect(PosRadius.sm, 4.0);
      expect(PosRadius.md, 8.0);
      expect(PosRadius.lg, 12.0);
      expect(PosRadius.xl, 16.0);
    });

    test('PosTheme lightTheme applies pine primary and paper background', () {
      final theme = PosTheme.lightTheme;
      expect(theme.primaryColor, PosColors.pine);
      expect(theme.scaffoldBackgroundColor, PosColors.paper);
      expect(theme.colorScheme.primary, PosColors.pine);
      expect(theme.colorScheme.secondary, PosColors.honey);
    });
  });

  group('Design System Reusable Widgets', () {
    testWidgets('PosBadge renders label and tone', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: PosBadge(
              label: 'Aktif',
              tone: PosBadgeTone.pine,
              hasDot: true,
            ),
          ),
        ),
      );

      expect(find.text('Aktif'), findsOneWidget);
    });

    testWidgets('PosButton handles tap', (tester) async {
      bool tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PosButton(
              label: 'Bayar Sekarang',
              variant: PosButtonVariant.primary,
              onPressed: () => tapped = true,
            ),
          ),
        ),
      );

      await tester.tap(find.text('Bayar Sekarang'));
      expect(tapped, isTrue);
    });

    testWidgets('PosCard renders child and padding', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: PosCard(
              child: Text('Card Content'),
            ),
          ),
        ),
      );

      expect(find.text('Card Content'), findsOneWidget);
    });

    testWidgets('PosEmptyState renders icon and title', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: PosEmptyState(
              title: 'Tidak Ada Transaksi',
              description: 'Belum ada transaksi hari ini',
            ),
          ),
        ),
      );

      expect(find.text('Tidak Ada Transaksi'), findsOneWidget);
      expect(find.text('Belum ada transaksi hari ini'), findsOneWidget);
    });

    testWidgets('PosKpiCard renders metric and title', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: PosKpiCard(
              title: 'Total Omzet',
              value: 'Rp 8.450.000',
              subtitle: '24 transaksi',
            ),
          ),
        ),
      );

      expect(find.text('TOTAL OMZET'), findsOneWidget);
      expect(find.text('Rp 8.450.000'), findsOneWidget);
      expect(find.text('24 transaksi'), findsOneWidget);
    });
  });
}
