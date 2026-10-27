// Screenshot harness for agents (not part of `flutter test`, which only runs test/): pumps the real app on the
// sample-data API, opens a page signed in, and writes a 412 x 915 PNG. Run with --update-goldens:
//   flutter test test_shots/<module>_shots_test.dart --update-goldens
// The PNGs land in the session scratchpad (c1/shots/<name>.png); view them to compare with the phone web.
import 'package:ezymex/app.dart';
import 'package:ezymex/router/router.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../test/helpers/test_app.dart';

/// Where the PNGs land. The default is one machine's scratchpad and is useless anywhere else, so it can be
/// overridden: `flutter test test_shots/... --update-goldens --dart-define=SHOTS_DIR=/path/to/dir`.
const String shotsDir = String.fromEnvironment(
  'SHOTS_DIR',
  defaultValue: '/private/tmp/claude-501/-Users-shivamsingh-Desktop-ezymex/8887654c-7bec-49a8-bfdd-05d6e4ed1bce/scratchpad/mobile/c1/shots',
);

/// Opens `location` as the signed-in sample client in `theme` / `locale`, runs `before` (taps, sheets), scrolls the
/// page by `scroll` pixels, and saves `<shotsDir>/<name>.png`.
Future<void> shotAt(
  WidgetTester tester,
  String name,
  String location, {
  String theme = 'light',
  String locale = 'en',
  double scroll = 0,
  Future<void> Function(WidgetTester tester)? before,
}) async {
  final c = await pumpApp(tester, signedIn: true, theme: theme, locale: locale);
  c.read(routerProvider).go(location);
  await settle(tester);
  if (before != null) {
    await before(tester);
    await settle(tester, frames: 6);
  }
  if (scroll > 0) {
    final page = find.byType(Scrollable).hitTestable().first;
    await tester.drag(page, Offset(0, -scroll));
    await settle(tester, frames: 6);
  }
  await expectLater(find.byType(EzymexApp), matchesGoldenFile(Uri.file('$shotsDir/$name.png')));
  await unmount(tester);
}
