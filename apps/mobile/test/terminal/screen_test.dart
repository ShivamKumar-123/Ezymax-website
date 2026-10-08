// The terminal screen as the router opens it: `/trader?login=&symbol=&side=` (Markets and the Client Area's Trade
// buttons) opens the account, the market's chart and the order sheet with that side. The account's product decides
// CFD or Options (no switch in the header): `mode=options` on a CFD account, or a CFD market on an Options account,
// moves to the client's account of that product.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:ezymex/core/models/account.dart';
import 'package:ezymex/features/terminal/chart/terminal_chart.dart';
import 'package:ezymex/features/terminal/core/market.dart';
import 'package:ezymex/features/terminal/core/sessions.dart';
import 'package:ezymex/features/terminal/core/workspace.dart';
import 'package:ezymex/features/terminal/terminal_screen.dart';
import 'package:ezymex/i18n/i18n.dart';
import 'package:ezymex/ui/ui.dart';

import 'harness.dart';

void main() {
  late Harness h;

  Future<void> open(WidgetTester tester, String location) async {
    await loadFonts();
    TerminalChart.forceNative = true;
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.runAsync(() async {
      h = await Harness.create(
        extra: [
          marketFeedProvider.overrideWith((ref) => FixedFeed({'BTCUSD': q('BTCUSD', 63400, 63418), 'XAUUSD': q('XAUUSD', 2654.30, 2654.48)})),
        ],
      );
    });
    final router = GoRouter(
      initialLocation: location,
      routes: [
        GoRoute(path: '/', builder: (c, s) => const SizedBox.shrink()),
        GoRoute(path: '/trader', builder: (c, s) => TerminalScreen.fromQuery(s.uri.queryParameters)),
      ],
    );
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: h.container,
        child: MaterialApp.router(
          routerConfig: router,
          theme: KTheme.client(Brightness.light),
          builder: (context, child) => I18nScope(t: h.container.read(tProvider), child: child!),
        ),
      ),
    );
    // the account opens over the preview trade server (real async), then frames settle
    for (var i = 0; i < 12; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 40)));
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  Future<void> close(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.runAsync(() async => h.container.dispose());
    await tester.pump(const Duration(seconds: 1));
  }

  testWidgets('symbol and side open the chart of that market and the order sheet', (tester) async {
    await open(tester, '/trader?login=10042817&symbol=btcusd&side=buy');
    expect(h.container.read(workspaceProvider).symbol, 'BTCUSD');
    expect(find.text('10042817'), findsWidgets);
    expect(find.text('Buy 0.50 lot BTCUSD at market'), findsOneWidget);
    await close(tester);
  });

  testWidgets('an Options account opens in Options mode; the header has no CFD | Options switch', (tester) async {
    await open(tester, '/trader?login=20031150');
    expect(h.container.read(tradeSessionsProvider).active, '20031150');
    expect(h.container.read(tradeModeProvider), 'options');
    expect(find.byWidgetPredicate((w) => w is KSegmented<String> && w.values.contains('cfd')), findsNothing);
    // the account pill: Demo and Options
    expect(find.text('OPTIONS'), findsWidgets);
    await close(tester);
  });

  testWidgets('mode=options on a CFD account moves to the Options account, with a note', (tester) async {
    await open(tester, '/trader?login=10042817&mode=options');
    expect(h.container.read(tradeSessionsProvider).active, '20031150');
    expect(h.container.read(tradeModeProvider), 'options');
    expect(h.notes.toasts.map((x) => x.title), contains('Switched to your Options account 20031150'));
    await close(tester);
  });

  testWidgets('a CFD market on an Options account moves to a CFD account (the same demo kind first)', (tester) async {
    await open(tester, '/trader?login=20031150&symbol=xauusd');
    expect(h.container.read(tradeSessionsProvider).active, '20017734');
    expect(h.container.read(tradeModeProvider), 'cfd');
    expect(h.container.read(workspaceProvider).symbol, 'XAUUSD');
    expect(h.notes.toasts.map((x) => x.title), contains('Switched to your CFD account 20017734'));
    await close(tester);
  });

  group('product links (web lib/options/mode.ts)', () {
    EngineAccount acc(int login, String type, String product, {String status = 'active'}) =>
        EngineAccount.fromJson({'login': login, 'type': type, 'group': product == 'options' ? 'options' : 'standard', 'product': product, 'status': status});

    test('what a link asks for: mode, else a CFD market', () {
      expect(linkProduct(mode: 'options'), 'options');
      expect(linkProduct(mode: 'CFD'), 'cfd');
      expect(linkProduct(mode: 'options', symbol: 'EURUSD'), 'options');
      expect(linkProduct(symbol: 'EURUSD'), 'cfd');
      expect(linkProduct(side: 'buy'), 'cfd');
      expect(linkProduct(), isNull);
      expect(linkProduct(mode: 'futures', symbol: ''), isNull);
    });

    test('the account a link moves to: that product, the same live / demo kind first, never a blocked one', () {
      final all = [acc(1, 'live', 'cfd'), acc(2, 'demo', 'options'), acc(3, 'live', 'options'), acc(4, 'demo', 'cfd', status: 'disabled')];
      expect(accountForProduct(all, 'options', live: true)!.login, 3);
      expect(accountForProduct(all, 'options', live: false)!.login, 2);
      // the only demo CFD account is disabled: the live one
      expect(accountForProduct(all, 'cfd', live: false)!.login, 1);
      expect(accountForProduct([acc(1, 'live', 'cfd')], 'options', live: true), isNull);
    });
  });
}
