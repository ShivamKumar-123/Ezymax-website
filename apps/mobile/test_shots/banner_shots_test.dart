// The iOS-style banner over the Dashboard: an engine fill and an error toast, light and dark. Run:
//   flutter test test_shots/banner_shots_test.dart --update-goldens --dart-define=EZYMEX_PREVIEW=true
import 'package:ezymex/app.dart';
import 'package:ezymex/core/notifications/notifications.dart';
import 'package:ezymex/router/router.dart';
import 'package:flutter_test/flutter_test.dart';

import '../test/helpers/test_app.dart';
import 'shots.dart';

Future<void> _shot(WidgetTester tester, String name, String theme, void Function(NotificationsController n) fire) async {
  final c = await pumpApp(tester, signedIn: true, theme: theme);
  c.read(routerProvider).go('/');
  await settle(tester);
  fire(c.read(notificationsProvider.notifier));
  // the drop (420 ms) and the icon's SVG
  await tester.pump(const Duration(milliseconds: 500));
  await settle(tester, frames: 2);
  await expectLater(find.byType(EzymexApp), matchesGoldenFile(Uri.file('$shotsDir/$name.png')));
  await unmount(tester);
}

void main() {
  for (final theme in ['light', 'dark']) {
    testWidgets('fill banner $theme', (tester) async {
      await _shot(
        tester,
        'banner-fill-$theme',
        theme,
        (n) => n.push(title: 'Order filled', body: 'BUY 0.50 XAUUSD at 2,654.80 · #10042817', severity: 'success'),
      );
    });
    testWidgets('error toast $theme', (tester) async {
      await _shot(
        tester,
        'banner-error-$theme',
        theme,
        (n) => n.toast(NotificationKind.error, 'Order rejected', description: 'Not enough money · Free margin 120.00 USD'),
      );
    });
  }
}
