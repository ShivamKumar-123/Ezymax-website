// One chart window (web: components/chart/engine.ts + chart-view.tsx): candle history from market data (cached per
// symbol / timeframe so switching draws at once, then the tail is refreshed), the forming bar from the stream, the
// account's bid / ask lines, and the trade lines (positions, SL / TP, pending orders, alerts) with drag / tap
// callbacks. Charts are drawn in broker server time like MT5 (GMT+3 in US summer time, GMT+2 otherwise).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/realtime/market_stream.dart' show Bar;
import '../../../ui/ui.dart';
import '../core/market.dart';
import '../core/trade_math.dart';
import '../core/workspace.dart';
import 'chart_bridge.dart';
import 'chart_surface.dart';

/// UTC unix seconds -> chart time (server time).
int toChartTime(int utc) => utc + serverOffsetSeconds(DateTime.fromMillisecondsSinceEpoch(utc * 1000, isUtc: true));

/// Chart time -> UTC unix seconds (DST-aware inverse).
int fromChartTime(int chart) {
  final summer = chart - 3 * 3600;
  return toChartTime(summer) == chart ? summer : chart - 2 * 3600;
}

/// Where a chart's candles come from (market data by default; the options mode can give its own premium candles).
abstract class ChartSource {
  /// Cache key (symbol / series).
  String get key;
  int get digits;

  /// History oldest first, UTC seconds; `to` = inclusive end (older pages).
  Future<List<Candle>> history(String tf, {int? to});

  /// The forming bar; returns the unsubscribe (null: no live bars).
  void Function()? bars(String tf, void Function(Candle bar) onBar) => null;

  /// Bid / ask lines; returns the unsubscribe (null: none).
  void Function()? quotes(void Function(double bid, double ask) onQuote) => null;
}

/// A market of the market-data service.
class MarketChartSource extends ChartSource {
  MarketChartSource(this.feed, this.symbol, this.digits);
  final MarketFeed feed;
  final String symbol;
  @override
  final int digits;

  @override
  String get key => symbol;

  @override
  Future<List<Candle>> history(String tf, {int? to}) => feed.candles(symbol, tf, limit: to == null ? 1000 : 1500, to: to);

  @override
  void Function()? bars(String tf, void Function(Candle bar) onBar) => feed.subscribeBars(symbol, tf, (Bar b) => onBar(Candle(b.t, b.o, b.h, b.l, b.c, b.v)));

  @override
  void Function()? quotes(void Function(double bid, double ask) onQuote) => feed.subscribe([symbol], (q) => onQuote(q.bid, q.ask));
}

class TerminalChart extends ConsumerStatefulWidget {
  const TerminalChart({
    super.key,
    required this.symbol,
    required this.tf,
    this.source,
    this.lines = const [],
    this.onLineDragged,
    this.onLineTapped,
    this.onLineClosed,
    this.onLongPress,
    this.indicators = const [],
  });

  /// The market (also the cache key when no source is given).
  final String symbol;

  /// M1 … MN
  final String tf;
  final ChartSource? source;
  final List<ChartLine> lines;
  final void Function(ChartLine line, double price)? onLineDragged;
  final void Function(ChartLine line)? onLineTapped;

  /// The × on a line's chip.
  final void Function(ChartLine line)? onLineClosed;
  final void Function(double price)? onLongPress;

  /// Overlays drawn by the chart page: `ema50`, `sma20` (the web's default chart).
  final List<String> indicators;

  /// Widget tests and the web preview draw the native chart (no WebView there).
  static bool forceNative = false;

  @override
  ConsumerState<TerminalChart> createState() => _TerminalChartState();
}

class _TerminalChartState extends ConsumerState<TerminalChart> {
  static final Map<String, List<Candle>> _cache = {};
  final ChartSurfaceController _c = ChartSurfaceController();
  final List<void Function()> _unsubs = [];
  List<Candle> _data = [];
  int _gen = 0;
  bool _dark = true;
  ChartPalette? _palette;

  ChartSource get _source {
    final s = widget.source;
    if (s != null) return s;
    final spec = ref.read(symbolBookProvider)[widget.symbol];
    return MarketChartSource(ref.read(marketFeedProvider), widget.symbol, spec?.digits ?? 5);
  }

  @override
  void initState() {
    super.initState();
    _c.onEvent = _onEvent;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final k = context.k;
    final p = chartPalette(k);
    if (_palette == null) {
      _palette = p;
      _dark = k.dark;
      _load();
    } else if (_dark != k.dark || p.up != _palette!.up) {
      _palette = p;
      _dark = k.dark;
      _c.send(ChartCmd.palette(p));
    }
  }

  @override
  void didUpdateWidget(TerminalChart old) {
    super.didUpdateWidget(old);
    final sourceChanged = (old.source?.key ?? old.symbol) != (widget.source?.key ?? widget.symbol);
    if (sourceChanged || old.tf != widget.tf) {
      _load();
    } else if (!_sameLines(old.lines, widget.lines)) {
      _c.send(ChartCmd.lines(widget.lines));
    }
  }

  static bool _sameLines(List<ChartLine> a, List<ChartLine> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  @override
  void dispose() {
    for (final u in _unsubs) {
      u();
    }
    _unsubs.clear();
    super.dispose();
  }

  static ChartBar _bar(Candle c) => (t: toChartTime(c.t), o: c.o, h: c.h, l: c.l, c: c.c, v: c.v);

  Future<void> _load() async {
    final gen = ++_gen;
    for (final u in _unsubs) {
      u();
    }
    _unsubs.clear();
    final src = _source;
    final tf = widget.tf;
    final key = '${src.key}|$tf';
    _c.send(
      ChartCmd.init(
        digits: src.digits,
        intraday: (kTfSeconds[tf] ?? 3600) < 86400,
        palette: _palette!,
        symbol: widget.symbol,
        tf: tf,
        indicators: widget.indicators,
      ),
    );
    _c.send(ChartCmd.lines(widget.lines));
    final cached = _cache[key];
    if (cached != null && cached.isNotEmpty) {
      _data = [...cached];
      _c.send(ChartCmd.bars(_data.map(_bar).toList()));
    }
    final q = src.quotes((bid, ask) {
      if (gen == _gen) _c.send(ChartCmd.quote(bid, ask));
    });
    if (q != null) _unsubs.add(q);
    final fresh = await src.history(tf);
    if (!mounted || gen != _gen) return;
    if (fresh.isNotEmpty) {
      // keep a forming bar that arrived while the request was in flight
      final last = _data.isNotEmpty ? _data.last : null;
      _data = [...fresh];
      if (last != null && last.t > _data.last.t) _data.add(last);
      _cache[key] = [..._data];
      _c.send(ChartCmd.bars(_data.map(_bar).toList()));
    }
    final b = src.bars(tf, (bar) {
      if (gen != _gen || _data.isEmpty) return;
      if (bar.t < _data.last.t) return;
      if (bar.t > _data.last.t) {
        _data.add(bar);
      } else {
        _data[_data.length - 1] = bar;
      }
      _c.send(ChartCmd.bar(_bar(bar)));
    });
    if (b != null) _unsubs.add(b);
  }

  void _onEvent(ChartEvent e) {
    switch (e) {
      case ChartNeedsOlder(:final before):
        unawaited(_older(before));
      case ChartLineDragged(:final id, :final price):
        final l = widget.lines.where((x) => x.id == id).firstOrNull;
        if (l != null) widget.onLineDragged?.call(l, price);
      case ChartLineTapped(:final id):
        final l = widget.lines.where((x) => x.id == id).firstOrNull;
        if (l != null) widget.onLineTapped?.call(l);
      case ChartLineClosed(:final id):
        final l = widget.lines.where((x) => x.id == id).firstOrNull;
        if (l != null) widget.onLineClosed?.call(l);
      case ChartLongPress(:final price):
        widget.onLongPress?.call(price);
      case ChartReady():
        // a reloaded page: draw everything again
        unawaited(_load());
    }
  }

  Future<void> _older(int beforeChart) async {
    final gen = _gen;
    final src = _source;
    final older = await src.history(widget.tf, to: fromChartTime(beforeChart) - 1);
    if (!mounted || gen != _gen) return;
    final first = _data.isEmpty ? 0 : _data.first.t;
    final add = older.where((c) => c.t < first).toList();
    if (add.isNotEmpty) {
      _data = [...add, ..._data];
      _cache['${src.key}|${widget.tf}'] = [..._data];
    }
    _c.send(ChartCmd.older(add.map(_bar).toList(), exhausted: add.isEmpty));
  }

  @override
  Widget build(BuildContext context) => chartSurface(_c, native: TerminalChart.forceNative);
}
