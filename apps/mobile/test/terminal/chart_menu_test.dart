// The chart menu (web chart toolbar: chart type, indicators, templates): the registry generated from the web code,
// the web's small helpers (params, labels, colours), per-symbol saving, and the sheets (type, on-chart rows, the
// indicators list with search and favourites, an indicator's settings).
import 'dart:convert';
import 'dart:io';

import 'package:ezymex/core/prefs.dart';
import 'package:ezymex/features/terminal/cfd/chart_menu.dart';
import 'package:ezymex/features/terminal/chart/indicators.dart';
import 'package:ezymex/features/terminal/chart/terminal_chart.dart';
import 'package:ezymex/features/terminal/core/market.dart';
import 'package:ezymex/features/terminal/core/workspace.dart';
import 'package:ezymex/features/terminal/terminal_screen.dart';
import 'package:ezymex/i18n/i18n.dart';
import 'package:ezymex/ui/ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'harness.dart';

final reg = IndRegistry.parse(File('assets/chart/indicators.json').readAsStringSync());

void main() {
  group('registry and helpers', () {
    test('the registry is the web one: 35 indicators in 5 categories, with params, outputs and levels', () {
      expect(reg.list, hasLength(35));
      expect(reg.categories, ['Trend', 'Oscillators', 'Volatility', 'Volume', 'Bill Williams']);
      expect(reg.colors, ['ember', 'gold', 'up', 'down', 'warn', 'info', 'fg2', 'fg3']);
      expect(reg.sources.map((s) => s.value), ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4']);
      expect(reg['rsi']!.separate, isTrue);
      expect(reg['rsi']!.levels, [70.0, 30.0]);
      expect(reg['ema']!.outputs.single.key, 'ma');
      expect(reg['macd']!.outputs.map((o) => o.kind), ['hist', 'line', 'line']);
      // the page bundle is generated from the same web code
      final bundle = File('assets/chart/indicators.bundle.js').readAsStringSync();
      expect(bundle, contains('window.EzymexInd'));
      expect(bundle, contains('createIndicatorLayer'));
    });

    test('params are repaired like the web (clamped, defaults for bad values) and labelled like the web', () {
      final sma = reg['sma']!;
      expect(normalizeParams(sma, {'period': 9999, 'source': 'nope', 'junk': 1}), {'period': 500, 'source': 'close'});
      expect(normalizeParams(sma, {'period': 'abc'}), {'period': 20, 'source': 'close'});
      expect(indicatorLabel(sma, normalizeParams(sma, const {})), 'SMA 20');
      expect(indicatorLabel(reg['bb']!, normalizeParams(reg['bb']!, const {})), 'BB 20, 2');
      expect(indicatorLabel(reg['rsi']!, normalizeParams(reg['rsi']!, {'source': 'hlc3'})), 'RSI 14 hlc3');
    });

    test('a second line of the same type gets the next free colour (web makeInstance)', () {
      final a = makeInstance(reg, 'sma', const []);
      expect(a.style, isEmpty);
      final b = makeInstance(reg, 'sma', [a]);
      expect(b.style['ma']?.color, 'gold');
      expect(b.uid, isNot(a.uid));
    });

    test('templates: the web built-ins, fresh instances, and the current one recognised', () {
      expect(kBuiltinTemplates.map((t) => t.id), ['b-default', 'b-trend', 'b-vol', 'b-mom', 'b-intraday', 'b-ichimoku', 'b-bw', 'b-line']);
      final mom = kBuiltinTemplates.firstWhere((t) => t.id == 'b-mom');
      final list = mom.instances(reg);
      expect(list.map((i) => i.type), ['macd', 'rsi']);
      expect(list.first.params, {'fast': 12, 'slow': 26, 'signal': 9, 'source': 'close'});
      expect(mom.matches(reg, 'candles', list), isTrue);
      expect(mom.matches(reg, 'line', list), isFalse);
      final trend = kBuiltinTemplates.firstWhere((t) => t.id == 'b-trend').instances(reg);
      expect(trend[1].style['ma']?.color, 'info');
      expect(kBuiltinTemplates.last.type, 'line');
    });
  });

  test('a symbol\'s chart is saved in the workspace: the web default until changed, per symbol', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await Prefs.open();
    final c1 = ProviderContainer(overrides: [prefsProvider.overrideWithValue(prefs)]);
    final ws = c1.read(workspaceProvider);
    expect(ws.chartOf('XAUUSD').type, 'candles');
    expect(ws.chartOf('XAUUSD').indicators.map((i) => (i.type, i.params['period'])), [('ema', 50), ('sma', 20)]);
    c1.read(workspaceProvider.notifier).updateChart('XAUUSD', (c) => c.copyWith(type: 'area', indicators: [makeInstance(reg, 'rsi', const [])]));
    c1.read(workspaceProvider.notifier).toggleIndicatorFavourite('atr');
    c1.dispose();
    final c2 = ProviderContainer(overrides: [prefsProvider.overrideWithValue(prefs)]);
    addTearDown(c2.dispose);
    final again = c2.read(workspaceProvider);
    expect(again.chartOf('XAUUSD').type, 'area');
    expect(again.chartOf('XAUUSD').indicators.single.type, 'rsi');
    expect(again.chartOf('EURUSD').indicators, hasLength(2));
    expect(again.indicatorFavourites, [...kDefaultIndicatorFavourites, 'atr']);
    expect(jsonDecode(jsonEncode(again.toJson())), again.toJson());
  });

  group('sheets', () {
    late Harness h;

    Future<void> show(WidgetTester tester, Widget child) async {
      await loadFonts();
      tester.view.physicalSize = const Size(412, 915);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.runAsync(() async {
        h = await Harness.create(extra: [indicatorRegistryProvider.overrideWith((ref) async => reg)]);
        await h.container.read(indicatorRegistryProvider.future);
      });
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: h.container,
          child: MaterialApp(
            theme: KTheme.trader(Brightness.dark),
            home: I18nScope(
              t: h.container.read(tProvider),
              child: Scaffold(body: child),
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 50));
    }

    ChartSettings chart() => h.container.read(workspaceProvider).chartOf('XAUUSD');

    Future<void> done(WidgetTester tester) async {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.runAsync(() async => h.container.dispose());
    }

    testWidgets('the menu: chart type, the indicators on the chart (hide, remove), templates', (tester) async {
      await show(tester, const ChartMenu(symbol: 'XAUUSD'));
      expect(find.text('CHART TYPE'), findsOneWidget);
      expect(find.text('EMA 50'), findsOneWidget);
      expect(find.text('SMA 20'), findsOneWidget);
      for (final l in ['Candlesticks', 'Bars', 'Line', 'Area']) {
        expect(find.text(l), findsOneWidget);
      }

      await tester.tap(find.byKey(const ValueKey('chart-type-line')));
      await tester.pump();
      expect(chart().type, 'line');

      final ema = chart().indicators.first;
      await tester.tap(find.byKey(ValueKey('ind-eye-${ema.uid}')));
      await tester.pump();
      expect(chart().indicators.first.visible, isFalse);

      final sma = chart().indicators.last;
      await tester.tap(find.byKey(ValueKey('ind-remove-${sma.uid}')));
      await tester.pump();
      expect(chart().indicators.map((i) => i.type), ['ema']);
      expect(find.text('SMA 20'), findsNothing);

      // a template sets the chart type and its indicators
      ChartEdits(h.container.read, 'XAUUSD').applyTemplate(kBuiltinTemplates.firstWhere((t) => t.id == 'b-mom'));
      await tester.pump();
      expect(chart().type, 'candles');
      expect(find.text('MACD 12, 26, 9'), findsOneWidget);
      expect(find.text('RSI 14'), findsOneWidget);
      expect(find.text('Momentum (MACD · RSI)'), findsOneWidget);
      await done(tester);
    });

    testWidgets('the indicators list: tap adds, search, favourites, on this chart', (tester) async {
      await show(tester, const IndicatorList(symbol: 'XAUUSD'));
      expect(find.text('Moving Average (Simple)'), findsOneWidget);
      expect(find.text('1 ON CHART'), findsNWidgets(2));
      await tester.enterText(find.byType(EditableText), 'relative');
      await tester.pump();
      expect(find.text('Relative Strength Index'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('ind-add-rsi')));
      await tester.pump();
      expect(chart().indicators.map((i) => i.type), ['ema', 'sma', 'rsi']);
      expect(find.text('1 ON CHART'), findsOneWidget);

      await tester.enterText(find.byType(EditableText), 'boll');
      await tester.pump();
      expect(find.text('Bollinger Bands'), findsOneWidget);
      expect(find.text('Relative Strength Index'), findsNothing);
      await tester.tap(find.byKey(const ValueKey('ind-fav-bb')));
      await tester.pump();
      // bb is a default favourite: the star takes it off
      expect(h.container.read(workspaceProvider).indicatorFavourites, isNot(contains('bb')));

      await tester.enterText(find.byType(EditableText), '');
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('ind-view-fav')));
      await tester.pump();
      expect(find.text('Relative Strength Index'), findsOneWidget);
      expect(find.text('Bollinger Bands'), findsNothing);

      await tester.scrollUntilVisible(find.byKey(const ValueKey('ind-view-on')), 120, scrollable: find.byType(Scrollable).at(1));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.byKey(const ValueKey('ind-view-on')));
      await tester.pump();
      expect(find.text('EMA 50'), findsOneWidget);
      expect(find.text('RSI 14'), findsOneWidget);
      await done(tester);
    });

    testWidgets('settings: inputs with the web ranges, levels, then OK saves', (tester) async {
      await show(tester, const SizedBox.shrink());
      final rsi = ChartEdits(h.container.read, 'XAUUSD').add('rsi')!;
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: h.container,
          child: MaterialApp(
            theme: KTheme.trader(Brightness.dark),
            home: I18nScope(
              t: h.container.read(tProvider),
              child: Scaffold(
                body: IndicatorSettings(symbol: 'XAUUSD', uid: rsi.uid),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Relative Strength Index'), findsOneWidget);
      expect(find.text('Inputs'), findsOneWidget);
      expect(find.text('Levels'), findsOneWidget);
      // period 14 -> 15
      await tester.tap(find.descendant(of: find.byKey(const ValueKey('ind-param-period')), matching: find.byIcon(LucideIcons.plus)));
      await tester.pump();
      expect(find.text('RSI 15'), findsOneWidget);
      // levels: 70 / 30 -> 70 only
      await tester.tap(find.text('Levels'));
      await tester.pump();
      expect(find.text('Level 1'), findsOneWidget);
      await tester.tap(find.byIcon(LucideIcons.x).last);
      await tester.pump();
      expect(find.text('Level 2'), findsNothing);
      await tester.tap(find.byKey(const ValueKey('ind-settings-ok')));
      await tester.pump();
      final saved = chart().indicators.firstWhere((i) => i.uid == rsi.uid);
      expect(saved.params['period'], 15);
      expect(saved.levels, [70.0]);
      await done(tester);
    });
  });

  testWidgets('the chart toolbar opens the menu next to the timeframes', (tester) async {
    await loadFonts();
    TerminalChart.forceNative = true;
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    late Harness h;
    await tester.runAsync(() async {
      h = await Harness.create(
        extra: [
          marketFeedProvider.overrideWith((ref) => FixedFeed({'XAUUSD': q('XAUUSD', 2654.30, 2654.48)})),
          indicatorRegistryProvider.overrideWith((ref) async => reg),
        ],
      );
    });
    final router = GoRouter(
      initialLocation: '/trader?login=10042817&symbol=XAUUSD',
      routes: [GoRoute(path: '/trader', builder: (c, s) => TerminalScreen.fromQuery(s.uri.queryParameters))],
    );
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: h.container,
        child: MaterialApp.router(
          routerConfig: router,
          theme: KTheme.client(Brightness.dark),
          builder: (context, child) => I18nScope(t: h.container.read(tProvider), child: child!),
        ),
      ),
    );
    for (var i = 0; i < 12; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 40)));
      await tester.pump(const Duration(milliseconds: 100));
    }
    // the count of indicators on the button, and the legend rows of the chart
    expect(find.descendant(of: find.byKey(const ValueKey('chart-menu')), matching: find.text('2')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('chart-menu')));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.text('CHART TYPE'), findsOneWidget);
    expect(find.text('ON THIS CHART'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('chart-type-area')));
    await tester.pump();
    expect(h.container.read(workspaceProvider).chartOf('XAUUSD').type, 'area');
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.runAsync(() async => h.container.dispose());
    await tester.pump(const Duration(seconds: 1));
  });
}
