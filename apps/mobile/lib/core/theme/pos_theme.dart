import 'package:flutter/material.dart';

/// Centralized SKMNet ERP Design System & Tokens for Mobile POS.
class PosColors {
  const PosColors._();

  // Canonical Pine Brand Palette
  static const Color pineDeep = Color(0xFF0C2018);
  static const Color pineDark = Color(0xFF10402C);
  static const Color pine = Color(0xFF17593E);
  static const Color pineLight = Color(0xFF1F7350);
  static const Color pineSoft = Color(0xFFE2ECE7);

  // Accent & Secondary
  static const Color honey = Color(0xFFD3921F);
  static const Color honeySoft = Color(0xFFF8ECD2);
  static const Color clay = Color(0xFFBC4B2F);
  static const Color claySoft = Color(0xFFF7E3DB);
  static const Color ocean = Color(0xFF35657F);
  static const Color oceanSoft = Color(0xFFDFE9F0);

  // Surfaces & Backgrounds
  static const Color paper = Color(0xFFF0EFE7);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceSoft = Color(0xFFFBFAF5);
  static const Color surfaceMuted = Color(0xFFE2ECE7);
  static const Color border = Color(0xFFE2E0D5);
  static const Color borderStrong = Color(0xFFCFCDBE);
  static const Color line = border;
  static const Color lineDark = borderStrong;

  // Text & Typography
  static const Color ink = Color(0xFF1A1D1A);
  static const Color inkSoft = Color(0xFF1A2620);
  static const Color fog = Color(0xFF7A827B);

  // Backward-Compatible Semantic Aliases
  static const Color primaryDark = pineDeep;
  static const Color primary = pine;
  static const Color primaryLight = pineLight;
  static const Color accent = pine;
  static const Color accentLight = honey;
  static const Color accentHover = pineDark;
  static const Color background = paper;

  static const Color textPrimary = ink;
  static const Color textSecondary = fog;
  static const Color textMuted = fog;
  static const Color textOnPrimary = Color(0xFFF0EFE7);
  static const Color textOnAccent = Color(0xFFFFFFFF);

  // Stock Badge Tokens
  static const Color stockNormalBg = pineSoft;
  static const Color stockNormalText = pine;
  static const Color stockLowBg = honeySoft;
  static const Color stockLowText = Color(0xFF8A5F10);
  static const Color stockOutBg = claySoft;
  static const Color stockOutText = clay;

  // Sync State Tokens
  static const Color syncSyncedBg = pineSoft;
  static const Color syncSyncedText = pine;
  static const Color syncSyncingBg = oceanSoft;
  static const Color syncSyncingText = ocean;
  static const Color syncPendingBg = honeySoft;
  static const Color syncPendingText = Color(0xFF8A5F10);
  static const Color syncOfflineBg = claySoft;
  static const Color syncOfflineText = clay;

  // Semantic Status
  static const Color success = pine;
  static const Color warning = honey;
  static const Color error = clay;
  static const Color info = ocean;
}

/// Spacing Scale Tokens (4-point standard).
class PosSpacing {
  const PosSpacing._();

  static const double xxs = 2.0;
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 12.0;
  static const double lg = 16.0;
  static const double xl = 20.0;
  static const double xxl = 24.0;
  static const double xxxl = 32.0;

  static const double minTouchTarget = 48.0;
}

/// Corner Radius Tokens.
class PosRadius {
  const PosRadius._();

  static const double sm = 4.0;
  static const double md = 8.0;
  static const double lg = 12.0;
  static const double xl = 16.0;
  static const double full = 9999.0;

  static final BorderRadius smBorderRadius = BorderRadius.circular(sm);
  static final BorderRadius mdBorderRadius = BorderRadius.circular(md);
  static final BorderRadius lgBorderRadius = BorderRadius.circular(lg);
  static final BorderRadius xlBorderRadius = BorderRadius.circular(xl);
  static final BorderRadius fullBorderRadius = BorderRadius.circular(full);
}

/// Elevation / Shadow Tokens.
class PosElevation {
  const PosElevation._();

  static const double flat = 0.0;
  static const double low = 1.0;
  static const double card = 2.0;
  static const double floating = 4.0;
  static const double dialog = 8.0;

  static const List<BoxShadow> cardShadow = [
    BoxShadow(
      color: Color(0x0D1A1D1A),
      offset: Offset(0, 1),
      blurRadius: 3,
    ),
  ];

  static const List<BoxShadow> floatingShadow = [
    BoxShadow(
      color: Color(0x1A0C2018),
      offset: Offset(0, 4),
      blurRadius: 12,
      spreadRadius: -2,
    ),
  ];
}

/// Typography Tokens for POS interface.
class PosTypography {
  const PosTypography._();

  static const TextStyle headingLarge = TextStyle(
    fontSize: 20.0,
    fontWeight: FontWeight.w700,
    color: PosColors.ink,
    letterSpacing: -0.4,
  );

  static const TextStyle headingMedium = TextStyle(
    fontSize: 18.0,
    fontWeight: FontWeight.w600,
    color: PosColors.ink,
    letterSpacing: -0.2,
  );

  static const TextStyle title = TextStyle(
    fontSize: 16.0,
    fontWeight: FontWeight.w600,
    color: PosColors.ink,
  );

  static const TextStyle body = TextStyle(
    fontSize: 14.0,
    fontWeight: FontWeight.w400,
    color: PosColors.ink,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontSize: 14.0,
    fontWeight: FontWeight.w500,
    color: PosColors.ink,
  );

  static const TextStyle caption = TextStyle(
    fontSize: 12.0,
    fontWeight: FontWeight.w400,
    color: PosColors.fog,
  );

  static const TextStyle priceLarge = TextStyle(
    fontSize: 20.0,
    fontWeight: FontWeight.w800,
    color: PosColors.pine,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const TextStyle priceMedium = TextStyle(
    fontSize: 16.0,
    fontWeight: FontWeight.w700,
    color: PosColors.pine,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const TextStyle priceSmall = TextStyle(
    fontSize: 14.0,
    fontWeight: FontWeight.w700,
    color: PosColors.pine,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const TextStyle badge = TextStyle(
    fontSize: 11.0,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.2,
  );
}

/// Main Theme Data Provider for Mobile POS.
class PosTheme {
  const PosTheme._();

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      primaryColor: PosColors.pine,
      scaffoldBackgroundColor: PosColors.paper,
      colorScheme: const ColorScheme(
        brightness: Brightness.light,
        primary: PosColors.pine,
        onPrimary: PosColors.textOnPrimary,
        secondary: PosColors.honey,
        onSecondary: PosColors.pineDeep,
        error: PosColors.clay,
        onError: Colors.white,
        surface: PosColors.surface,
        onSurface: PosColors.ink,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: PosColors.pineDeep,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 18.0,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
      cardTheme: CardThemeData(
        color: PosColors.surface,
        elevation: PosElevation.low,
        shape: RoundedRectangleBorder(
          borderRadius: PosRadius.lgBorderRadius,
          side: const BorderSide(color: PosColors.border),
        ),
        margin: EdgeInsets.zero,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: PosColors.pine,
          foregroundColor: PosColors.textOnPrimary,
          elevation: 0,
          minimumSize: const Size(PosSpacing.minTouchTarget, PosSpacing.minTouchTarget),
          shape: RoundedRectangleBorder(
            borderRadius: PosRadius.mdBorderRadius,
          ),
          textStyle: const TextStyle(
            fontSize: 16.0,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: PosColors.ink,
          backgroundColor: PosColors.surface,
          minimumSize: const Size(PosSpacing.minTouchTarget, PosSpacing.minTouchTarget),
          side: const BorderSide(color: PosColors.border),
          shape: RoundedRectangleBorder(
            borderRadius: PosRadius.mdBorderRadius,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: PosColors.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: PosSpacing.lg,
          vertical: PosSpacing.md,
        ),
        border: OutlineInputBorder(
          borderRadius: PosRadius.mdBorderRadius,
          borderSide: const BorderSide(color: PosColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: PosRadius.mdBorderRadius,
          borderSide: const BorderSide(color: PosColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: PosRadius.mdBorderRadius,
          borderSide: const BorderSide(color: PosColors.pine, width: 1.5),
        ),
        hintStyle: const TextStyle(
          color: PosColors.fog,
          fontSize: 14.0,
        ),
      ),
    );
  }
}
