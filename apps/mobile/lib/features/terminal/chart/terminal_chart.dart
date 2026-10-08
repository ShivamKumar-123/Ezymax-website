// One chart window (web: components/chart/engine.ts + chart-view.tsx): candle history from market data (cached per
// symbol / timeframe so switching draws at once, then the tail is refreshed), the forming bar from the stream, the
// account's bid / ask lines, and the trade lines (positions, SL / TP, pending orders, alerts) with drag / tap
// callbacks and the S / T handles that set a stop loss / take profit. Charts are drawn in broker server time like MT5
// (GMT+3 in US summer time, GMT+2 otherwise).
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/realtime/market_stream.dart' show Bar;
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../core/market.dart';
import '../core/trade_math.dart';
import '../core/workspace.dart';
import 'chart_bridge.dart';
import 'chart_surface.dart';
import 'indicators.dart';

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
    this.onStopDragged,
    this.onLineTapped,
    this.onLineClosed,
    this.onLongPress,
    this.chartType = 'candles',
    this.indicators = const [],
    this.onIndicatorTapped,
  });

  /// The market (also the cache key when no source is given).
  final String symbol;

  /// M1 … MN
  final String tf;
  final ChartSource? source;
  final List<ChartLine> lines;

  /// A line dropped at `price`. Until a returned future completes the line stays at the drop price on the chart
  /// (then the chart shows the lines it is given again: the new price once the server confirmed it, else the old one).
  final FutureOr<void> Function(ChartLine line, double price)? onLineDragged;

  /// The S / T handle of a position or order line dropped at `price` (on the right side of the price, the chart
  /// checked it): set its stop loss (`which` = sl) / take profit (tp). Until a returned future completes the new stop
  /// line is drawn at the drop price, like a dropped line.
  final FutureOr<void> Function(ChartLine line, String which, double price)? onStopDragged;
  final void Function(ChartLine line)? onLineTapped;

  /// The × on a line's chip.
  final void Function(ChartLine line)? onLineClosed;
  final void Function(double price)? onLongPress;

  /// candles | bars | line | area
  final String chartType;

  /// Indicator instances drawn by the chart page (the web's own indicator code).
  final List<IndInstance> indicators;

  /// An indicator's legend row was tapped.
  final void Function(String uid)? onIndicatorTapped;

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

  /// A dropped line kept at its drop price until the app's action finished: a moved line, or the new SL / TP set with
  /// the S / T handle of the `owner` line (whose handle is hidden meanwhile).
  ({ChartLine line, String? owner})? _held;
  Timer? _holdTimer;

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
      return;
    }
    if (!listEquals(old.lines, widget.lines)) _sendLines();
    if (old.chartType != widget.chartType) _c.send(ChartCmd.chartType(widget.chartType));
    if (!listEquals(old.indicators, widget.indicators)) _c.send(ChartCmd.indicators(_indicatorsJson));
  }

  List<Map<String, Object?>> get _indicatorsJson => [for (final i in widget.indicators) i.toJson()];

  /// The lines to draw: the given ones, with a just-dropped line kept at its drop price (a new stop line added).
  void _sendLines() {
    var h = _held;
    // the confirmed line is at the drop price: nothing to hold any more
    if (h != null && widget.lines.any((l) => l.id == h!.line.id && (l.price - h.line.price).abs() < 1e-9)) {
      _held = h = null;
      _holdTimer?.cancel();
      _holdTimer = null;
    }
    if (h == null) {
      _c.send(ChartCmd.lines(widget.lines));
      return;
    }
    final held = h.line, owner = h.owner;
    final which = held.kind;
    final lines = [
      for (final l in widget.lines)
        if (l.id == held.id)
          l.copyWith(price: held.price, note: _stopNote(l, held.price))
        else if (l.id == owner)
          l.copyWith(addSl: which == 'sl' ? false : null, addTp: which == 'tp' ? false : null)
        else
          l,
      // a new stop: drawn while its position or order is there
      if (owner != null && !widget.lines.any((l) => l.id == held.id) && widget.lines.any((l) => l.id == owner)) held,
    ];
    _c.send(ChartCmd.lines(lines));
  }

  /// The money at a stop line moved to `price` (other lines keep their note).
  static String? _stopNote(ChartLine l, double price) {
    final s = l.stops;
    if (s == null || (l.kind != 'sl' && l.kind != 'tp')) return l.note;
    return accMoney(false, s.moneyAt(price), signed: true);
  }

  /// Shows `held` until `act`'s answer: a refusal puts the lines back at once, a success keeps it until the confirmed
  /// line arrives (or briefly, if it already did); a lost answer never pins it (12 s at most).
  void _hold(({ChartLine line, String? owner}) held, FutureOr<void> Function()? act) {
    _holdTimer?.cancel();
    _held = held;
    _sendLines();
    final r = act?.call();
    if (_held == null) return;
    final id = held.line.id;
    _holdTimer = Timer(const Duration(seconds: 12), _release);
    if (r is Future) {
      r.then((ok) {
        if (!mounted || _held?.line.id != id) return;
        _holdTimer?.cancel();
        _holdTimer = ok == false ? null : Timer(const Duration(milliseconds: 1500), _release);
        if (ok == false) _release();
      }, onError: (Object _) => _release()).ignore();
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) => _release());
    }
  }

  void _release() {
    _holdTimer?.cancel();
    _holdTimer = null;
    if (_held == null) return;
    _held = null;
    if (mounted) _sendLines();
  }

  @override
  void dispose() {
    for (final u in _unsubs) {
      u();
    }
    _unsubs.clear();
    _holdTimer?.cancel();
    _c.dispose();
    super.dispose();
  }

  static ChartBar _bar(Candle c) => (t: toChartTime(c.t), o: c.o, h: c.h, l: c.l, c: c.c, v: c.v);

  Future<void> _load() async {
    final gen = ++_gen;
    // a fresh chart (another market, a reloaded page) has no drag in progress
    _c.holdLines = false;
    for (final u in _unsubs) {
      u();
    }
    _unsubs.clear();
    final src = _source;
    final tf = widget.tf;
    final key = '${src.key}|$tf';
    final t = context.t;
    _c.send(
      ChartCmd.init(
        digits: src.digits,
        intraday: (kTfSeconds[tf] ?? 3600) < 86400,
        palette: _palette!,
        symbol: widget.symbol,
        tf: tf,
        step: kTfSeconds[tf] ?? 60,
        chartType: widget.chartType,
        indicators: _indicatorsJson,
        texts: {
          'more': t('chart.legend.more', {'count': '{count}'}),
          'less': t('chart.legend.showLess'),
          // the S / T handles of a position or order chip, and why a stop may not go where it is dragged
          'posTip': t('chart.line.posTip'),
          'dragSl': t('chart.line.dragSl'),
          'dragTp': t('chart.line.dragTp'),
          'slBelow': t('chart.line.bad.slBelow', {'price': '{price}'}),
          'slAbove': t('chart.line.bad.slAbove', {'price': '{price}'}),
          'tpAbove': t('chart.line.bad.tpAbove', {'price': '{price}'}),
          'tpBelow': t('chart.line.bad.tpBelow', {'price': '{price}'}),
          'notSent': t('chart.line.bad.notSent'),
        },
      ),
    );
    _sendLines();
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
      case ChartDragStarted():
        _c.holdLines = true;
      case ChartDragEnded():
        // dropped where it may not go: the page put it back, nothing was sent
        _c.holdLines = false;
      case ChartLineDragged(:final id, :final price):
        _c.holdLines = false;
        final l = widget.lines.where((x) => x.id == id).firstOrNull;
        if (l == null) {
          _sendLines();
          break;
        }
        final cb = widget.onLineDragged;
        _hold((line: l.copyWith(price: price), owner: null), cb == null ? null : () => cb(l, price));
      case ChartStopDragged(:final id, :final which, :final price):
        final l = widget.lines.where((x) => x.id == id).firstOrNull;
        final cb = widget.onStopDragged;
        if (l == null || cb == null) break;
        // the new stop line at the drop price until the server answers (its chip without × or drag meanwhile)
        final stop = ChartLine(
          id: l.stopId(which),
          kind: which,
          price: price,
          label: which.toUpperCase(),
          side: l.side,
          note: l.stops == null ? null : accMoney(false, l.stops!.moneyAt(price), signed: true),
          stops: l.stops,
        );
        _hold((line: stop, owner: id), () => cb(l, which, price));
      case ChartLineTapped(:final id):
        _c.holdLines = false;
        final l = widget.lines.where((x) => x.id == id).firstOrNull;
        if (l != null) widget.onLineTapped?.call(l);
      case ChartLineClosed(:final id):
        _c.holdLines = false;
        final l = widget.lines.where((x) => x.id == id).firstOrNull;
        if (l != null) widget.onLineClosed?.call(l);
      case ChartLongPress(:final price):
        widget.onLongPress?.call(price);
      case ChartIndicatorTapped(:final uid):
        widget.onIndicatorTapped?.call(uid);
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
