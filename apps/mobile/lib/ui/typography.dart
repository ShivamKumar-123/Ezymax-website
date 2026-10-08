// Type scale. The Client Area sets everything in Plus Jakarta Sans (the web's --font-display on body), Ezymex Trader
// in Geist; prices, logins and codes in Geist Mono. Scripts the Latin fonts lack (Arabic, Devanagari, Thai, CJK, …)
// fall back to Geist and then the phone's system fonts (Noto on Android). Figures are tabular (web .k-num).
import 'package:flutter/material.dart';

import 'tokens.dart';

abstract final class KFonts {
  static const String display = 'PlusJakartaSans';
  static const String sans = 'Geist';
  static const String mono = 'GeistMono';
  static const List<String> fallback = ['Geist', 'Roboto', 'Noto Sans'];
}

const List<FontFeature> kTabular = [FontFeature.tabularFigures()];

/// The scale (sizes in logical pixels, from the web's phone layout).
@immutable
class KText {
  const KText(this.family, this.color);
  final String family;
  final Color color;

  TextStyle _s(double size, FontWeight w, {double? height, double spacing = 0, Color? color}) => TextStyle(
    fontFamily: family,
    fontFamilyFallback: KFonts.fallback,
    fontSize: size,
    fontWeight: w,
    height: height,
    letterSpacing: spacing,
    color: color ?? this.color,
    leadingDistribution: TextLeadingDistribution.even,
  );

  /// Page titles (web PageHeader h1 26 px, medium, -0.02em).
  TextStyle get largeTitle => _s(28, FontWeight.w600, height: 1.15, spacing: -0.5);

  /// Section titles ("Your accounts", 20 px semibold).
  TextStyle get title1 => _s(20, FontWeight.w600, height: 1.2, spacing: -0.3);

  /// Card and block titles (17 px semibold), and the header's module title (17 px bold).
  TextStyle get title2 => _s(17, FontWeight.w600, height: 1.25, spacing: -0.17);

  /// Row titles, buttons (15 px semibold).
  TextStyle get headline => _s(15, FontWeight.w600, height: 1.3);

  /// Body text (14.5 px).
  TextStyle get body => _s(14.5, FontWeight.w400, height: 1.4);

  /// Secondary text (13.5 px).
  TextStyle get callout => _s(13.5, FontWeight.w400, height: 1.4);

  /// Labels (web .k-label: 13 px medium).
  TextStyle get label => _s(13, FontWeight.w500, height: 1.35);

  /// Small print (12.5 px).
  TextStyle get footnote => _s(12.5, FontWeight.w400, height: 1.35);

  /// Captions, chips (11.5 px).
  TextStyle get caption => _s(11.5, FontWeight.w500, height: 1.3);

  /// Tab-bar labels (10.5 px semibold).
  TextStyle get micro => _s(10.5, FontWeight.w600, height: 1.2);

  /// Big money (the dashboard's total balance: 36 px bold, -0.03em).
  TextStyle get moneyXL => _s(36, FontWeight.w700, height: 1.0, spacing: -1.0).copyWith(fontFeatures: kTabular);

  /// KPI values (30 px semibold, -0.02em).
  TextStyle get moneyL => _s(28, FontWeight.w600, height: 1.0, spacing: -0.5).copyWith(fontFeatures: kTabular);

  /// Figures in rows (15 px semibold, tabular).
  TextStyle get figure => _s(15, FontWeight.w600, height: 1.25).copyWith(fontFeatures: kTabular);

  /// Prices, logins, codes.
  TextStyle mono(double size, {FontWeight weight = FontWeight.w500, Color? color}) => TextStyle(
    fontFamily: KFonts.mono,
    fontFamilyFallback: KFonts.fallback,
    fontSize: size,
    fontWeight: weight,
    color: color ?? this.color,
    fontFeatures: kTabular,
  );
}

extension KTextContext on BuildContext {
  /// The type scale in the surrounding theme's font and colour (Client Area: Plus Jakarta Sans; Trader: Geist).
  KText get text {
    final k = this.k;
    return KText(k.trader ? KFonts.sans : KFonts.display, k.fg);
  }
}
