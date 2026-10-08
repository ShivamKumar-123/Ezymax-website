// The S / T handles of a position chip (MT5, TradingView): a stop dragged out of the line, checked against the price
// before anything is sent, and drawn at the drop price until the server answers. Widget tests have no WebView, so the
// native chart draws it here; the chart page (assets/chart/chart.html) does the same with the same rules.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:ezymex/features/terminal/chart/chart_bridge.dart';
import 'package:ezymex/features/terminal/chart/chart_native.dart';
import 'package:ezymex/features/terminal/chart/chart_surface.dart';
import 'package:ezymex/features/terminal/chart/terminal_chart.dart';
import 'package:ezymex/features/terminal/core/market.dart';
import 'package:ezymex/i18n/i18n.dart';
import 'package:ezymex/ui/ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// EURUSD between 1.0800 and 1.0900, the bid at 1.0845.
class _Source extends ChartSource {
  @override
  String get key => 'EURUSD-test';
  @override
  int get digits => 4;

  @override
  Future<List<Candle>> history(String tf, {int? to}) async => [
    for (var i = 0; i < 60; i++) Candle(1700000000 + i * 60, 1.0840, i == 58 ? 1.0900 : 1.0850, i == 59 ? 1.0800 : 1.0835, 1.0845, 10),
  ];

  @override
  void Function()? quotes(void Function(double bid, double ask) onQuote) {
    onQuote(1.0845, 1.0847);
    return () {};
  }
}

const _stops = ChartStops(open: 1.0820, k: 10000, c: -0.5);

ChartLine _pos({bool addSl = true, bool addTp = true}) => ChartLine(
  id: 'pos:1',
  kind: 'pos',
  price: 1.0820,
  side: 'buy',
  label: 'BUY 0.10',
  closable: true,
  addSl: addSl,
  addTp: addTp,
  stops: _stops,
);

Finder _ghost() => find.byKey(const ValueKey('chart-ghost'));

String _ghostText(WidgetTester tester) => tester.widget<Text>(find.descendant(of: _ghost(), matching: find.byType(Text))).data!;

void main() {
  testWidgets('a stop dragged out of S goes below the bid; on the wrong side it is grey, says why and sends nothing', (tester) async {
    tester.view.physicalSize = const Size(400, 300);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final c = ChartSurfaceController();
    final events = <ChartEvent>[];
    c.onEvent = events.add;
    c.send(
      ChartCmd.init(
        digits: 4,
        intraday: true,
        palette: chartPalette(KTokens.traderDark()),
        texts: const {'slBelow': 'Stop loss must be below {price}', 'notSent': 'Nothing was sent.', 'dragTp': 'Drag to set a take profit'},
      ),
    );
    c.send(ChartCmd.bars([for (var i = 0; i < 60; i++) (t: 1000 + i * 60, o: 1.0840, h: i == 58 ? 1.0900 : 1.0850, l: i == 59 ? 1.0800 : 1.0835, c: 1.0845, v: 10)]));
    c.send(ChartCmd.quote(1.0845, 1.0847));
    c.send(ChartCmd.lines([_pos()]));
    await tester.pumpWidget(MaterialApp(theme: KTheme.trader(Brightness.dark), home: NativeChartSurface(controller: c)));
    await tester.pump();
    final s = find.byKey(const ValueKey('chart-stop-sl-pos:1'));
    expect(s, findsOneWidget);
    expect(find.byKey(const ValueKey('chart-stop-tp-pos:1')), findsOneWidget);

    // up, above the bid: the ghost says why while the finger is there, and releasing sends nothing
    final g = await tester.startGesture(tester.getCenter(s));
    await g.moveBy(const Offset(0, -20));
    await g.moveBy(const Offset(0, -130));
    await tester.pump();
    expect(_ghostText(tester), 'Stop loss must be below 1.0845');
    await g.up();
    await tester.pump();
    expect(events, isEmpty);
    expect(_ghostText(tester), 'Stop loss must be below 1.0845 · Nothing was sent.');
    await tester.pump(const Duration(seconds: 3));
    expect(_ghost(), findsNothing);

    // down, below the bid: the price and the money there, then the stop is set at the drop price
    final g2 = await tester.startGesture(tester.getCenter(s));
    await g2.moveBy(const Offset(0, 20));
    await g2.moveBy(const Offset(0, 20));
    await tester.pump();
    expect(_ghostText(tester), matches(RegExp(r'^SL 1\.08\d\d · -\d+\.\d\d$')));
    await g2.up();
    await tester.pump();
    final e = events.single as ChartStopDragged;
    expect(e.id, 'pos:1');
    expect(e.which, 'sl');
    expect(e.price, lessThan(1.0820));
    expect(_ghost(), findsNothing);

    // a tap on T shows what it does
    await tester.tap(find.byKey(const ValueKey('chart-stop-tp-pos:1')));
    await tester.pump();
    expect(_ghostText(tester), 'Drag to set a take profit');
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpWidget(const SizedBox.shrink());
    c.dispose();
  });

  testWidgets('a SL line dropped above the bid goes back: dragend only, no drag', (tester) async {
    tester.view.physicalSize = const Size(400, 300);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final c = ChartSurfaceController();
    final events = <ChartEvent>[];
    c.onEvent = events.add;
    c.send(ChartCmd.init(digits: 4, intraday: true, palette: chartPalette(KTokens.traderDark())));
    c.send(ChartCmd.bars([for (var i = 0; i < 60; i++) (t: 1000 + i * 60, o: 1.0840, h: i == 58 ? 1.0900 : 1.0850, l: i == 59 ? 1.0800 : 1.0835, c: 1.0845, v: 10)]));
    c.send(ChartCmd.quote(1.0845, 1.0847));
    c.send(ChartCmd.lines(const [ChartLine(id: 'sl:1', kind: 'sl', price: 1.0810, side: 'buy', label: 'SL', draggable: true, closable: true, stops: _stops)]));
    await tester.pumpWidget(MaterialApp(theme: KTheme.trader(Brightness.dark), home: NativeChartSurface(controller: c)));
    await tester.pump();
    final g = await tester.startGesture(tester.getCenter(find.text('SL')));
    await g.moveBy(const Offset(0, -20));
    await g.moveBy(const Offset(0, -150));
    await tester.pump();
    // grey with the reason (no texts given here: its key)
    expect(_ghostText(tester), 'slBelow');
    await g.up();
    await tester.pump();
    expect(events.map((e) => e.runtimeType), [ChartDragStarted, ChartDragEnded]);
    // a valid move is a drag as before
    events.clear();
    await tester.pump(const Duration(seconds: 3));
    await tester.drag(find.text('SL'), const Offset(0, 30));
    await tester.pump();
    expect(events.map((e) => e.runtimeType), [ChartDragStarted, ChartLineDragged]);
    expect((events.last as ChartLineDragged).price, lessThan(1.0810));
    await tester.pumpWidget(const SizedBox.shrink());
    c.dispose();
  });

  testWidgets('the new stop is drawn at the drop price until the server answers, without its handle on the chip', (tester) async {
    tester.view.physicalSize = const Size(400, 300);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    TerminalChart.forceNative = true;
    addTearDown(() => TerminalChart.forceNative = false);
    final en = (jsonDecode(File('assets/i18n/en.json').readAsStringSync()) as Map).cast<String, Object?>();
    final answer = Completer<bool>();
    final got = <(String, String, double)>[];
    Future<bool> stop(ChartLine l, String which, double price) {
      got.add((l.id, which, price));
      return answer.future;
    }

    Widget app(List<ChartLine> lines) => ProviderScope(
      child: MaterialApp(
        theme: KTheme.trader(Brightness.dark),
        home: I18nScope(
          t: T('en', en, en),
          child: TerminalChart(
            symbol: 'EURUSD',
            tf: 'M1',
            source: _Source(),
            lines: lines,
            onStopDragged: stop,
          ),
        ),
      ),
    );
    await tester.pumpWidget(app([_pos()]));
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 80));
    }
    final s = find.byKey(const ValueKey('chart-stop-sl-pos:1'));
    expect(s, findsOneWidget);
    // no SL line yet: the only "SL" is the handle on the position chip
    expect(find.text('SL'), findsOneWidget);
    final g = await tester.startGesture(tester.getCenter(s));
    await g.moveBy(const Offset(0, 20));
    await g.moveBy(const Offset(0, 20));
    await g.up();
    await tester.pump(const Duration(milliseconds: 80));
    await tester.pump(const Duration(milliseconds: 80));
    expect(got.single.$1, 'pos:1');
    expect(got.single.$2, 'sl');
    // the SL line at the drop price, with the money there; the chip has no SL handle meanwhile
    expect(find.text('SL'), findsOneWidget);
    expect(s, findsNothing);
    expect(find.byKey(const ValueKey('chart-stop-tp-pos:1')), findsOneWidget);
    // refused: back as it was
    answer.complete(false);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 80));
    await tester.pump(const Duration(milliseconds: 80));
    // the SL line is gone and the handle is back
    expect(find.text('SL'), findsOneWidget);
    expect(s, findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 13));
  });
}
