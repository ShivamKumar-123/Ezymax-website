// The signed-out welcome page (light / dark / Arabic) and the sign-in sheet open over it. Run:
//   flutter test test_shots/welcome_shots_test.dart --update-goldens --dart-define=EZYMEX_PREVIEW=true
import 'package:flutter_test/flutter_test.dart';
import 'package:ezymex/app.dart';

import '../test/helpers/test_app.dart';
import 'shots.dart';

/// Opens the app signed out (it lands on the welcome page), runs `before`, and saves `<shotsDir>/<name>.png`.
Future<void> welcomeShot(
  WidgetTester tester,
  String name, {
  String theme = 'light',
  String locale = 'en',
  Future<void> Function(WidgetTester tester)? before,
}) async {
  await pumpApp(tester, theme: theme, locale: locale);
  if (before != null) {
    await before(tester);
    await settle(tester, frames: 6);
  }
  await expectLater(find.byType(EzymexApp), matchesGoldenFile(Uri.file('$shotsDir/$name.png')));
  await unmount(tester);
}

void main() {
  for (final (name, theme, locale) in [('light', 'light', 'en'), ('dark', 'dark', 'en'), ('ar', 'light', 'ar')]) {
    testWidgets('welcome $name', (tester) async {
      await welcomeShot(tester, 'welcome-$name', theme: theme, locale: locale);
    });
  }
  testWidgets('welcome sign-in sheet', (tester) async {
    await welcomeShot(tester, 'welcome-signin-sheet', before: (tester) => tester.tap(find.text('Log in')));
  });
}
