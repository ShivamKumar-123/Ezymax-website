// The Dashboard's picture + sheet (light / dark / Arabic, at the top and scrolled 700 px) and the Accounts tab for the
// ink tab bar on a normal page. Run:
//   flutter test test_shots/dashboard_hero_shots_test.dart --update-goldens --dart-define=EZYMEX_PREVIEW=true
import 'package:flutter_test/flutter_test.dart';

import 'shots.dart';

void main() {
  for (final (name, theme, locale) in [('light', 'light', 'en'), ('dark', 'dark', 'en'), ('ar', 'light', 'ar')]) {
    for (final (i, y) in [(0, 0.0), (1, 700.0)]) {
      testWidgets('dashboard hero $name $i', (tester) async {
        await shotAt(tester, 'dashboard-hero-$name-$i', '/', theme: theme, locale: locale, scroll: y);
      });
    }
  }
  testWidgets('accounts tab bar', (tester) async {
    await shotAt(tester, 'dashboard-hero-accounts-light', '/accounts');
  });
}
