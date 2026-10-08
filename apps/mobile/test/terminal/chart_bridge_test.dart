// The message codec between the app and the chart page (assets/chart/chart.html): commands in, gestures out.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:ezymex/features/terminal/chart/chart_bridge.dart';
import 'package:ezymex/features/terminal/chart/chart_surface.dart';
import 'package:ezymex/features/terminal/chart/indicators.dart';
import 'package:ezymex/features/terminal/chart/terminal_chart.dart';

void main() {
  const palette = ChartPalette(
    dark: true,
    bg: '#0a0a0d',
    grid: 'rgba(255,255,255,0.035)',
    line: 'rgba(255,255,255,0.07)',
    up: '#22c55e',
    down: '#f04438',
    gold: '#e9b949',
    warn: '#f59e0b',
    ember: '#ff5a1f',
    fg: '#f5f5f7',
    fg2: '#a1a1aa',
    fg3: '#8b8b96',
    label: '#26262e',
    panel: 'rgba(21,21,26,1.000)',
  );

  Map<String, dynamic> dec(String s) => jsonDecode(s) as Map<String, dynamic>;

  group('commands', () {
    test('init carries the precision, the time axis, the colours, the chart type and the indicators', () {
      const ema = IndInstance(uid: 'a1', type: 'ema', params: {'period': 50, 'source': 'close'});
      final m = dec(
        ChartCmd.init(
          digits: 5,
          intraday: true,
          palette: palette,
          symbol: 'EURUSD',
          tf: 'M15',
          step: 900,
          chartType: 'area',
          indicators: [ema.toJson()],
          texts: const {'more': '+{count} more'},
        ),
      );
      expect(m['symbol'], 'EURUSD');
      expect(m['tf'], 'M15');
      expect(m['step'], 900);
      expect(m['chartType'], 'area');
      expect(m['indicators'], [
        {
          'uid': 'a1',
          'type': 'ema',
          'params': {'period': 50, 'source': 'close'},
          'visible': true,
        },
      ]);
      expect(m['texts'], {'more': '+{count} more'});
      expect(m['type'], 'init');
      expect(m['digits'], 5);
      expect(m['intraday'], isTrue);
      expect((m['palette'] as Map)['up'], '#22c55e');
      // rising candles and buy positions are blue (web --t-buy)
      expect((m['palette'] as Map)['buy'], '#4a7bff');
      expect((m['palette'] as Map)['dark'], isTrue);
    });

    test('bars are compact arrays [t, o, h, l, c, v]', () {
      final m = dec(ChartCmd.bars([(t: 1000, o: 1.1, h: 1.2, l: 1.0, c: 1.15, v: 42)]));
      expect(m['type'], 'bars');
      expect(m['bars'], [
        [1000, 1.1, 1.2, 1.0, 1.15, 42.0],
      ]);
      expect(dec(ChartCmd.bar((t: 1060, o: 1, h: 2, l: 0.5, c: 1.5, v: 3)))['bar'], [1060, 1.0, 2.0, 0.5, 1.5, 3.0]);
      final older = dec(ChartCmd.older(const [], exhausted: true));
      expect(older['bars'], isEmpty);
      expect(older['exhausted'], isTrue);
    });

    test('quote and trade lines', () {
      expect(dec(ChartCmd.quote(1.0845, 1.0846)), {'type': 'quote', 'bid': 1.0845, 'ask': 1.0846});
      final m = dec(
        ChartCmd.lines(const [
          ChartLine(id: 'sl:7', kind: 'sl', price: 1.08, label: 'SL', side: 'buy', draggable: true, note: '-12.40', tone: 'down', closable: true),
        ]),
      );
      expect(m['lines'], [
        {
          'id': 'sl:7',
          'kind': 'sl',
          'price': 1.08,
          'label': 'SL',
          'side': 'buy',
          'drag': true,
          'note': '-12.40',
          'tone': 'down',
          'close': true,
          'addSl': false,
          'addTp': false,
          'stops': null,
        },
      ]);
    });

    test('a position line carries its S / T handles and the stop maths', () {
      const stops = ChartStops(open: 1.0832, k: 10000, c: -1.2, gap: 0.0001);
      final m = dec(
        ChartCmd.lines(const [
          ChartLine(id: 'pos:7', kind: 'pos', price: 1.0832, label: 'BUY 0.10', side: 'buy', note: '+4.20', tone: 'up', closable: true, addTp: true, stops: stops),
        ]),
      );
      final l = (m['lines'] as List).single as Map;
      expect(l['drag'], isFalse);
      expect(l['addSl'], isFalse);
      expect(l['addTp'], isTrue);
      expect(l['stops'], {'open': 1.0832, 'k': 10000.0, 'c': -1.2, 'inv': false, 'order': false, 'gap': 0.0001});
      // the native chart reads it back
      expect(ChartStops.fromJson(l['stops']), stops);
      expect(ChartStops.fromJson({'open': 1}), isNull);
      expect(ChartStops.fromJson('x'), isNull);
    });

    test('indicators and chart type', () {
      const rsi = IndInstance(
        uid: 'r',
        type: 'rsi',
        visible: false,
        style: {'rsi': IndStyle(color: 'info', width: 2)},
        levels: [80, 20],
      );
      final m = dec(ChartCmd.indicators([rsi.toJson()]));
      expect(m['type'], 'indicators');
      expect(m['indicators'], [
        {
          'uid': 'r',
          'type': 'rsi',
          'params': <String, Object>{},
          'visible': false,
          'style': {
            'rsi': {'color': 'info', 'width': 2},
          },
          'levels': [80.0, 20.0],
        },
      ]);
      expect(dec(ChartCmd.chartType('bars')), {'type': 'chartType', 'chartType': 'bars'});
      // an instance survives a round trip through the workspace JSON
      expect(IndInstance.fromJson(jsonDecode(jsonEncode(rsi.toJson()))), rsi);
    });

    test('a line knows its ticket and compares by value', () {
      const a = ChartLine(id: 'pnd:49434302', kind: 'pending', price: 2628.5, label: 'BUY LIMIT 0.30');
      expect(a.ref, '49434302');
      expect(a, const ChartLine(id: 'pnd:49434302', kind: 'pending', price: 2628.5, label: 'BUY LIMIT 0.30'));
      expect(a == const ChartLine(id: 'pnd:49434302', kind: 'pending', price: 2629, label: 'BUY LIMIT 0.30'), isFalse);
      expect(a == const ChartLine(id: 'pnd:49434302', kind: 'pending', price: 2628.5, label: 'BUY LIMIT 0.30', addSl: true), isFalse);
      // the ids of the stop lines a handle sets: a position's sl: / tp:, an order's osl: / otp:
      expect(a.stopId('sl'), 'osl:49434302');
      expect(const ChartLine(id: 'pos:9', kind: 'pos', price: 1, label: 'BUY').stopId('tp'), 'tp:9');
      final moved = a.copyWith(price: 2630, addTp: true);
      expect(moved.price, 2630);
      expect(moved.addTp, isTrue);
      expect(moved.label, a.label);
    });
  });

  group('stops', () {
    // 1.00 lot of EURUSD: 100,000 USD per 1.0 of price
    const buy = ChartStops(open: 1.0800, k: 100000, c: -3);
    const sell = ChartStops(open: 1.0800, k: -100000);

    test('the money at a stop: the P&L there, swap and commission included', () {
      expect(buy.moneyAt(1.0780), closeTo(-203, 1e-6));
      expect(buy.moneyAt(1.0850), closeTo(497, 1e-6));
      expect(sell.moneyAt(1.0780), closeTo(200, 1e-6));
      // USDJPY: the JPY result converted at the closing price
      const jpy = ChartStops(open: 150, k: 100000, inv: true);
      expect(jpy.moneyAt(151), closeTo(100000 / 151, 1e-6));
    });

    test('a position: SL below / TP above the bid for a buy, SL above / TP below the ask for a sell', () {
      ({String key, double limit})? p(ChartStops s, String which, String side, double price) => s.problem(which, side, price, bid: 1.0845, ask: 1.0847);
      expect(p(buy, 'sl', 'buy', 1.0840), isNull);
      expect(p(buy, 'sl', 'buy', 1.0845), (key: 'slBelow', limit: 1.0845));
      expect(p(buy, 'sl', 'buy', 1.0850)?.key, 'slBelow');
      expect(p(buy, 'tp', 'buy', 1.0850), isNull);
      expect(p(buy, 'tp', 'buy', 1.0844)?.key, 'tpAbove');
      expect(p(sell, 'sl', 'sell', 1.0850), isNull);
      expect(p(sell, 'sl', 'sell', 1.0846), (key: 'slAbove', limit: 1.0847));
      expect(p(sell, 'tp', 'sell', 1.0840), isNull);
      expect(p(sell, 'tp', 'sell', 1.0847)?.key, 'tpBelow');
      // a price of zero or below never goes
      expect(p(sell, 'tp', 'sell', 0)?.key, 'tpBelow');
      // no quote yet: the server decides
      expect(buy.problem('sl', 'buy', 2, bid: 0, ask: 0), isNull);
    });

    test("the stops level keeps a stop that far from the price; an order's stops are checked against its entry", () {
      const gap = ChartStops(open: 1.08, k: 100000, gap: 0.0005);
      expect(gap.problem('sl', 'buy', 1.0840, bid: 1.0845, ask: 1.0847), isNull);
      expect(gap.problem('sl', 'buy', 1.0841, bid: 1.0845, ask: 1.0847)?.limit, closeTo(1.0840, 1e-12));
      const order = ChartStops(open: 1.0800, k: 100000, order: true);
      // a buy limit at 1.0800 (the market above it): its SL below 1.0800, its TP above, whatever the bid
      expect(order.problem('sl', 'buy', 1.0790, bid: 1.0845, ask: 1.0847), isNull);
      expect(order.problem('sl', 'buy', 1.0810, bid: 1.0845, ask: 1.0847), (key: 'slBelow', limit: 1.08));
      expect(order.problem('tp', 'buy', 1.0820, bid: 1.0845, ask: 1.0847), isNull);
    });
  });

  group('events', () {
    test('ready, drag, tap, older, long press', () {
      expect(ChartEvent.decode('{"type":"ready"}'), isA<ChartReady>());
      final d = ChartEvent.decode('{"type":"drag","id":"tp:9","price":2690.5}') as ChartLineDragged;
      expect(d.id, 'tp:9');
      expect(d.price, 2690.5);
      expect((ChartEvent.decode('{"type":"tap","id":"pos:9"}') as ChartLineTapped).id, 'pos:9');
      expect((ChartEvent.decode('{"type":"close","id":"sl:9"}') as ChartLineClosed).id, 'sl:9');
      expect((ChartEvent.decode('{"type":"older","before":1700000000}') as ChartNeedsOlder).before, 1700000000);
      expect((ChartEvent.decode('{"type":"long","price":1.0832}') as ChartLongPress).price, 1.0832);
      expect((ChartEvent.decode('{"type":"dragstart","id":"sl:9"}') as ChartDragStarted).id, 'sl:9');
      expect((ChartEvent.decode('{"type":"ind","uid":"k2"}') as ChartIndicatorTapped).uid, 'k2');
      expect((ChartEvent.decode('{"type":"dragend","id":"sl:9"}') as ChartDragEnded).id, 'sl:9');
    });

    test('a stop dragged out of an S / T handle', () {
      final s = ChartEvent.decode('{"type":"stop","id":"pos:9","which":"sl","price":1.0812}') as ChartStopDragged;
      expect(s.id, 'pos:9');
      expect(s.which, 'sl');
      expect(s.price, 1.0812);
      final t = ChartEvent.decode('{"type":"stop","id":"pnd:4","which":"tp","price":2690}') as ChartStopDragged;
      expect((t.id, t.which, t.price), ('pnd:4', 'tp', 2690.0));
    });

    test('malformed or unknown messages are ignored', () {
      expect(ChartEvent.decode('not json'), isNull);
      expect(ChartEvent.decode('[1,2]'), isNull);
      expect(ChartEvent.decode('{"type":"drag","id":"x"}'), isNull);
      expect(ChartEvent.decode('{"type":"drag","id":3,"price":1}'), isNull);
      expect(ChartEvent.decode('{"type":"nope"}'), isNull);
      expect(ChartEvent.decode('{"type":"stop","id":"pos:9","which":"be","price":1}'), isNull);
      expect(ChartEvent.decode('{"type":"stop","id":"pos:9","which":"sl"}'), isNull);
      expect(ChartEvent.decode('{"type":"stop","which":"tp","price":1}'), isNull);
      expect(ChartEvent.decode('{"type":"dragend"}'), isNull);
    });
  });

  test('the controller queues commands until the page is ready, and replays init', () {
    final c = ChartSurfaceController();
    final got = <String>[];
    c.send(ChartCmd.init(digits: 2, intraday: false, palette: palette));
    c.send(ChartCmd.quote(1, 2));
    c.attach(got.addAll);
    expect(got.length, 2);
    expect(dec(got.first)['type'], 'init');
    c.detach();
    c.send(ChartCmd.quote(3, 4));
    final again = <String>[];
    c.attach(again.addAll);
    // a re-attached page (rebuilt WebView) gets the init again, then what was queued
    expect(again.map((s) => dec(s)['type']), ['init', 'quote']);
    c.dispose();
  });

  testWidgets('live updates are coalesced to one delivery per frame: the last quote, bar and lines win', (tester) async {
    final c = ChartSurfaceController();
    final calls = <List<String>>[];
    c.attach(calls.add);
    for (var i = 0; i < 10; i++) {
      c.send(ChartCmd.quote(1.0 + i, 2.0 + i));
      c.send(ChartCmd.bar((t: 600, o: 1, h: 2, l: 0.5, c: 1.0 + i, v: 3)));
      c.send(ChartCmd.lines([ChartLine(id: 'sl:1', kind: 'sl', price: 1.0 + i, label: 'SL')]));
    }
    c.send(ChartCmd.bar((t: 660, o: 1, h: 2, l: 0.5, c: 9, v: 3)));
    expect(calls, isEmpty);
    await tester.pump(const Duration(milliseconds: 70));
    expect(calls, hasLength(1));
    final batch = calls.single.map(dec).toList();
    expect(batch.map((m) => m['type']), ['quote', 'bar', 'lines', 'bar']);
    expect(batch[0]['bid'], 10.0);
    expect((batch[1]['bar'] as List)[4], 10.0);
    expect(((batch[2]['lines'] as List).single as Map)['price'], 10.0);
    expect((batch[3]['bar'] as List).first, 660);
    // history, indicators and the chart type go out at once
    c.send(ChartCmd.chartType('line'));
    await tester.pump();
    expect(calls, hasLength(2));
    expect(dec(calls.last.single)['type'], 'chartType');
    c.dispose();
  });

  testWidgets('while a chip is dragged, trade-line updates wait and the latest goes out when it is dropped', (tester) async {
    final c = ChartSurfaceController();
    final calls = <List<String>>[];
    c.attach(calls.add);
    c.holdLines = true;
    c.send(ChartCmd.lines([const ChartLine(id: 'sl:1', kind: 'sl', price: 1, label: 'SL')]));
    c.send(ChartCmd.quote(1, 2));
    // while dragging, live updates go out less often (the finger's moves come first)
    await tester.pump(const Duration(milliseconds: 70));
    expect(calls, isEmpty);
    await tester.pump(const Duration(milliseconds: 120));
    expect(calls.expand((b) => b).map((s) => dec(s)['type']), ['quote']);
    c.send(ChartCmd.lines([const ChartLine(id: 'sl:1', kind: 'sl', price: 2, label: 'SL')]));
    c.holdLines = false;
    await tester.pump();
    final lines = calls.expand((b) => b).map(dec).where((m) => m['type'] == 'lines').toList();
    expect(lines, hasLength(1));
    expect(((lines.single['lines'] as List).single as Map)['price'], 2.0);
    c.dispose();
  });

  test('chart time is broker server time (GMT+3 in US summer, GMT+2 in winter) and converts back', () {
    final summer = DateTime.utc(2026, 7, 1, 12).millisecondsSinceEpoch ~/ 1000;
    final winter = DateTime.utc(2026, 1, 15, 12).millisecondsSinceEpoch ~/ 1000;
    expect(toChartTime(summer) - summer, 3 * 3600);
    expect(toChartTime(winter) - winter, 2 * 3600);
    expect(fromChartTime(toChartTime(summer)), summer);
    expect(fromChartTime(toChartTime(winter)), winter);
  });
}
