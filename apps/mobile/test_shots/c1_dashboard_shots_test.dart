// Dashboard screenshots (light / dark / Arabic, top to bottom). Run:
//   flutter test test_shots/c1_dashboard_shots_test.dart --update-goldens --dart-define=EZYMEX_PREVIEW=true
import 'package:flutter_test/flutter_test.dart';

import 'shots.dart';

void main() {
  for (final (name, theme, locale) in [('light', 'light', 'en'), ('dark', 'dark', 'en'), ('ar', 'light', 'ar')]) {
    for (final (i, y) in [(0, 0.0), (1, 1500.0), (2, 2400.0), (3, 3300.0), (4, 4200.0), (5, 5100.0), (6, 6000.0)]) {
      testWidgets('dashboard $name $i', (tester) async {
        await shotAt(tester, 'dashboard-$name-$i', '/', theme: theme, locale: locale, scroll: y);
      });
    }
  }
}
