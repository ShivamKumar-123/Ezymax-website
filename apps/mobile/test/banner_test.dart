// The iOS-style banner (KBannerHost / KBannerController): the app name, title, body, time and tone dot; a swipe up
// dismisses, a short drag snaps back, a pull down opens the body; a tap opens and closes; a newer banner replaces the
// current one with no gap (after it has been readable); auto-hide; the terminal's own theme; one haptic tick per second.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ezymex/ui/ui.dart';

const _body = 'BUY 0.50 XAUUSD at 2,654.80';

Future<KBannerController> _pumpHost(WidgetTester tester, {Brightness brightness = Brightness.light}) async {
  final c = KBannerController();
  addTearDown(c.dispose);
  await tester.pumpWidget(
    MaterialApp(
      theme: KTheme.client(brightness),
      builder: (context, child) => KBannerHost(controller: c, child: child ?? const SizedBox.shrink()),
      home: const Scaffold(body: SizedBox.expand()),
    ),
  );
  return c;
}

/// Lets the drop (420 ms) or the lift (220 ms) finish.
Future<void> _animate(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
}

/// Ends the test with no banner and no timer pending.
Future<void> _done(WidgetTester tester, KBannerController c) async {
  c.clear();
  await _animate(tester);
}

void main() {
  testWidgets('shows the app name in caps, the title, the body and the time', (tester) async {
    final c = await _pumpHost(tester);
    c.show(const KBannerData(title: 'Order filled', body: _body, time: 'Just now'));
    await _animate(tester);
    expect(find.text('EZYMEX'), findsOneWidget);
    expect(find.text('Order filled'), findsOneWidget);
    expect(find.text(_body), findsOneWidget);
    expect(find.text('Just now'), findsOneWidget);
    // the Ezymex launcher icon, no coloured icon tile
    expect(find.byType(KLogoMark), findsOneWidget);
    expect(find.byType(KIconTile), findsNothing);
    // the live region reads the whole notification
    final s = tester.getSemantics(find.bySemanticsLabel(RegExp('Ezymex. Order filled')));
    expect(s.flagsCollection.isLiveRegion, isTrue);
    await _done(tester, c);
  });

  testWidgets('a white-label broker gets its name and its initial as the icon', (tester) async {
    final c = await _pumpHost(tester);
    c.appName = 'Axis Markets';
    c.brandLetter = 'A';
    c.show(const KBannerData(title: 'Deposit received'));
    await _animate(tester);
    expect(find.text('AXIS MARKETS'), findsOneWidget);
    expect(find.text('A'), findsOneWidget);
    expect(find.byType(KLogoMark), findsNothing);
    await _done(tester, c);
  });

  testWidgets('the tone shows as a dot before the time: coral for an error, none for neutral', (tester) async {
    final c = await _pumpHost(tester);
    c.show(const KBannerData(title: 'Order rejected', tone: KTone.coral, time: 'Just now'));
    await _animate(tester);
    final dot = find.byKey(kBannerToneDot);
    expect(dot, findsOneWidget);
    final k = KTheme.client(Brightness.light).extension<KTokens>()!;
    expect(((tester.widget(dot) as Container).decoration! as BoxDecoration).color, k.tile(KTone.coral).$2);
    // the dot sits just before the time
    expect(tester.getTopRight(dot).dx, lessThan(tester.getTopLeft(find.text('Just now')).dx));

    c.show(const KBannerData(title: 'Copied', tone: KTone.neutral, time: 'Just now'));
    await tester.pump(const Duration(milliseconds: 700));
    await _animate(tester);
    expect(find.text('Copied'), findsOneWidget);
    expect(find.byKey(kBannerToneDot), findsNothing);
    await _done(tester, c);
  });

  testWidgets('swipe up dismisses; a short drag snaps back', (tester) async {
    final c = await _pumpHost(tester);
    c.show(const KBannerData(title: 'Order filled', body: _body));
    await _animate(tester);
    // past the touch slop, slow and short: not a dismissal
    await tester.timedDrag(find.text('Order filled'), const Offset(0, -24), const Duration(milliseconds: 400));
    await _animate(tester);
    expect(c.current, isNotNull);
    expect(find.text('Order filled'), findsOneWidget);

    await tester.drag(find.text('Order filled'), const Offset(0, -80));
    await tester.pump();
    expect(c.current, isNull);
    await _animate(tester);
    expect(find.text('Order filled'), findsNothing);
    await _done(tester, c);
  });

  testWidgets('a pull down opens the body to four lines', (tester) async {
    final c = await _pumpHost(tester);
    c.show(const KBannerData(title: 'Margin call', body: _body));
    await _animate(tester);
    Text body() => tester.widget(find.text(_body));
    expect(body().maxLines, 2);
    await tester.drag(find.text('Margin call'), const Offset(0, 40));
    await _animate(tester);
    expect(body().maxLines, 4);
    expect(c.current, isNotNull);
    await _done(tester, c);
  });

  testWidgets('a tap opens the notification and closes the banner', (tester) async {
    final c = await _pumpHost(tester);
    var opened = 0;
    c.show(KBannerData(title: 'Support replied', body: 'We have reset your password.', onTap: () => opened++));
    await _animate(tester);
    await tester.tap(find.text('Support replied'));
    await tester.pump();
    expect(opened, 1);
    expect(c.current, isNull);
    await _animate(tester);
    expect(find.text('Support replied'), findsNothing);
    await _done(tester, c);
  });

  testWidgets('a second banner replaces the first at once, after the first was readable', (tester) async {
    final c = await _pumpHost(tester);
    c.show(const KBannerData(title: 'First'));
    await _animate(tester);
    // within the minimum visible time the newer one waits
    c.show(const KBannerData(title: 'Second'));
    expect(c.current!.title, 'First');
    await tester.pump(KBannerController.minVisible);
    expect(c.current!.title, 'Second');
    await _animate(tester);
    expect(find.text('Second'), findsOneWidget);
    expect(find.text('First'), findsNothing);
    // after that a newer one takes over immediately (the old one lifts as it drops)
    await tester.pump(const Duration(seconds: 1));
    c.show(const KBannerData(title: 'Third'));
    expect(c.current!.title, 'Third');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Third'), findsOneWidget);
    expect(find.text('Second'), findsOneWidget);
    await _animate(tester);
    expect(find.text('Second'), findsNothing);
    await _done(tester, c);
  });

  testWidgets('a tap or a swipe on the current banner keeps the queued one, which drops next', (tester) async {
    final c = await _pumpHost(tester);
    c.show(const KBannerData(title: 'First'));
    c.show(const KBannerData(title: 'Second'));
    await _animate(tester);
    await tester.tap(find.text('First'));
    await tester.pump();
    expect(c.current, isNull);
    // the lift (240 ms), then the queued one drops
    await _animate(tester);
    expect(c.current!.title, 'Second');
    // Second is still fresh: Third waits behind it
    c.show(const KBannerData(title: 'Third'));
    expect(c.current!.title, 'Second');
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Second'), findsOneWidget);
    await tester.drag(find.text('Second'), const Offset(0, -80));
    await tester.pump();
    expect(c.current, isNull);
    await _animate(tester);
    await _animate(tester);
    expect(c.current!.title, 'Third');
    expect(find.text('Third'), findsOneWidget);
    await _done(tester, c);
  });

  testWidgets('hides by itself after its duration, then the next one drops', (tester) async {
    final c = await _pumpHost(tester);
    c.show(const KBannerData(title: 'Saved', duration: Duration(seconds: 1)));
    await _animate(tester);
    await tester.pump(const Duration(milliseconds: 700));
    expect(c.current, isNull);
    await _animate(tester);
    expect(find.text('Saved'), findsNothing);
    await _done(tester, c);
  });

  testWidgets('a finger on the banner keeps it', (tester) async {
    final c = await _pumpHost(tester);
    c.show(const KBannerData(title: 'Hold me', duration: Duration(seconds: 1)));
    await _animate(tester);
    final g = await tester.startGesture(tester.getCenter(find.text('Hold me')));
    await tester.pump(const Duration(seconds: 2));
    expect(c.current, isNotNull);
    await g.up();
    await tester.pump(const Duration(milliseconds: 1100));
    expect(c.current, isNull);
    await _done(tester, c);
  });

  testWidgets('the terminal theme applies to the banner over a light app', (tester) async {
    final c = await _pumpHost(tester);
    c.theme = KTheme.trader(Brightness.dark);
    c.show(const KBannerData(title: 'Stop out'));
    await _animate(tester);
    expect(Theme.of(tester.element(find.text('Stop out'))).brightness, Brightness.dark);
    expect(Theme.of(tester.element(find.byType(Scaffold))).brightness, Brightness.light);
    await _done(tester, c);
  });

  testWidgets('one haptic tick per second, not one per toast', (tester) async {
    final calls = <String>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (m) async {
      if (m.method == 'HapticFeedback.vibrate') calls.add('${m.arguments}');
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    final c = await _pumpHost(tester);
    c.show(const KBannerData(title: 'One'));
    c.show(const KBannerData(title: 'Two'));
    await tester.pump(KBannerController.minVisible);
    expect(calls, hasLength(1));
    await tester.pump(const Duration(seconds: 1));
    c.show(const KBannerData(title: 'Three'));
    await tester.pump();
    expect(calls, hasLength(2));
    await _animate(tester);
    await _done(tester, c);
  });
}
