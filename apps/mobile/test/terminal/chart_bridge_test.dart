// The message codec between the app and the chart page (assets/chart/chart.html): commands in, gestures out.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:kalks/features/terminal/chart/chart_bridge.dart';
import 'package:kalks/features/terminal/chart/chart_surface.dart';
import 'package:kalks/features/terminal/chart/terminal_chart.dart';

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
    test('init carries the precision, the time axis and the colours', () {
      final m = dec(ChartCmd.init(digits: 5, intraday: true, palette: palette, symbol: 'EURUSD', tf: 'M15', indicators: const ['ema50', 'sma20']));
      expect(m['symbol'], 'EURUSD');
      expect(m['tf'], 'M15');
      expect(m['indicators'], ['ema50', 'sma20']);
      expect(m['type'], 'init');
      expect(m['digits'], 5);
      expect(m['intraday'], isTrue);
      expect((m['palette'] as Map)['up'], '#22c55e');
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
        {'id': 'sl:7', 'kind': 'sl', 'price': 1.08, 'label': 'SL', 'side': 'buy', 'drag': true, 'note': '-12.40', 'tone': 'down', 'close': true},
      ]);
    });

    test('a line knows its ticket and compares by value', () {
      const a = ChartLine(id: 'pnd:49434302', kind: 'pending', price: 2628.5, label: 'BUY LIMIT 0.30');
      expect(a.ref, '49434302');
      expect(a, const ChartLine(id: 'pnd:49434302', kind: 'pending', price: 2628.5, label: 'BUY LIMIT 0.30'));
      expect(a == const ChartLine(id: 'pnd:49434302', kind: 'pending', price: 2629, label: 'BUY LIMIT 0.30'), isFalse);
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
    });

    test('malformed or unknown messages are ignored', () {
      expect(ChartEvent.decode('not json'), isNull);
      expect(ChartEvent.decode('[1,2]'), isNull);
      expect(ChartEvent.decode('{"type":"drag","id":"x"}'), isNull);
      expect(ChartEvent.decode('{"type":"drag","id":3,"price":1}'), isNull);
      expect(ChartEvent.decode('{"type":"nope"}'), isNull);
    });
  });

  test('the controller queues commands until the page is ready, and replays init', () {
    final c = ChartSurfaceController();
    final got = <String>[];
    c.send(ChartCmd.init(digits: 2, intraday: false, palette: palette));
    c.send(ChartCmd.quote(1, 2));
    c.attach(got.add);
    expect(got.length, 2);
    expect(dec(got.first)['type'], 'init');
    c.detach();
    c.send(ChartCmd.quote(3, 4));
    final again = <String>[];
    c.attach(again.add);
    // a re-attached page (rebuilt WebView) gets the init again, then what was queued
    expect(again.map((s) => dec(s)['type']), ['init', 'quote']);
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
