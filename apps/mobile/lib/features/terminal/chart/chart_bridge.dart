// The message codec between the app and the chart page (assets/chart/chart.html, lightweight-charts 5.2.1, the same
// engine as the web terminal). Dart -> page: JSON passed to `window.K.recv(...)`; page -> Dart: JSON posted on the
// `KalksChart` JavaScript channel. Both sides are tiny and versioned by `type`, so the page stays dumb: Dart owns the
// data (history, forming bars, quotes, trade lines) and the page draws it and reports gestures.
import 'dart:convert';

import 'package:flutter/foundation.dart';

/// One trade line on the chart (web TLine): an open position, its SL / TP, a pending order, a price alert.
@immutable
class ChartLine {
  const ChartLine({
    required this.id,
    required this.kind,
    required this.price,
    required this.label,
    this.side,
    this.draggable = false,
    this.note,
    this.tone,
    this.closable = false,
  });

  /// `pos:TICKET`, `sl:TICKET`, `tp:TICKET`, `pnd:TICKET` or `alr:ID`.
  final String id;

  /// pos | sl | tp | pending | alert, and for options: strike | breakeven | barrier
  final String kind;
  final double price;
  final String label;

  /// buy | sell (positions and orders)
  final String? side;
  final bool draggable;

  /// A figure shown on the chip after the label (web: the position's P&L, the money at a stop).
  final String? note;

  /// up | down: the note's colour on a position chip.
  final String? tone;

  /// The chip has × (close the position, remove the stop, cancel the order, delete the alert).
  final bool closable;

  /// The ticket / alert id after the prefix.
  String get ref => id.contains(':') ? id.substring(id.indexOf(':') + 1) : id;

  Map<String, Object?> toJson() => {
    'id': id,
    'kind': kind,
    'price': price,
    'label': label,
    'side': side,
    'drag': draggable,
    'note': note,
    'tone': tone,
    'close': closable,
  };

  @override
  bool operator ==(Object other) =>
      other is ChartLine &&
      other.id == id &&
      other.kind == kind &&
      other.price == price &&
      other.label == label &&
      other.side == side &&
      other.draggable == draggable &&
      other.note == note &&
      other.tone == tone &&
      other.closable == closable;

  @override
  int get hashCode => Object.hash(id, kind, price, label, side, draggable, note, tone, closable);
}

/// The chart's colours (web readPalette): CSS colour strings.
@immutable
class ChartPalette {
  const ChartPalette({
    required this.dark,
    required this.bg,
    required this.grid,
    required this.line,
    required this.up,
    required this.down,
    required this.gold,
    required this.warn,
    required this.ember,
    required this.fg,
    required this.fg2,
    required this.fg3,
    required this.label,
    required this.panel,
    this.info = '#38bdf8',
  });

  final bool dark;
  final String bg, grid, line, up, down, gold, warn, ember, fg, fg2, fg3, label, panel;

  /// The indicators' "info" colour token (web --k-info).
  final String info;

  Map<String, Object?> toJson() => {
    'dark': dark,
    'bg': bg,
    'grid': grid,
    'line': line,
    'up': up,
    'down': down,
    'gold': gold,
    'warn': warn,
    'ember': ember,
    'fg': fg,
    'fg2': fg2,
    'fg3': fg3,
    'label': label,
    'panel': panel,
    'info': info,
  };
}

/// A bar in chart time (server time seconds, like MT5).
typedef ChartBar = ({int t, double o, double h, double l, double c, double v});

List<num> _bar(ChartBar b) => [b.t, b.o, b.h, b.l, b.c, b.v];

/// Messages to the page.
abstract final class ChartCmd {
  /// A fresh chart: price precision, whether the time axis shows hours, colours, the legend's market and timeframe, the
  /// bar length in seconds, the chart type (candles | bars | line | area), the indicator instances (web
  /// IndicatorInstance JSON, drawn by the web's own indicator code in the page) and the legend's texts.
  static String init({
    required int digits,
    required bool intraday,
    required ChartPalette palette,
    String symbol = '',
    String tf = '',
    int step = 60,
    String chartType = 'candles',
    List<Map<String, Object?>> indicators = const [],
    Map<String, String> texts = const {},
  }) => jsonEncode({
    'type': 'init',
    'digits': digits,
    'intraday': intraday,
    'palette': palette.toJson(),
    'symbol': symbol,
    'tf': tf,
    'step': step,
    'chartType': chartType,
    'indicators': indicators,
    'texts': texts,
  });

  /// The whole history (oldest first): replaces what is drawn and scrolls to the latest bar.
  static String bars(List<ChartBar> bars) => jsonEncode({'type': 'bars', 'bars': bars.map(_bar).toList()});

  /// Older bars loaded on scroll-back (prepended; the view keeps its place).
  static String older(List<ChartBar> bars, {required bool exhausted}) => jsonEncode({'type': 'older', 'bars': bars.map(_bar).toList(), 'exhausted': exhausted});

  /// The forming bar (new or updated).
  static String bar(ChartBar b) => jsonEncode({'type': 'bar', 'bar': _bar(b)});

  /// The account's executable bid / ask lines.
  static String quote(double bid, double ask) => jsonEncode({'type': 'quote', 'bid': bid, 'ask': ask});

  /// Trade lines (positions, SL / TP, pending orders, alerts), replacing the previous set.
  static String lines(List<ChartLine> lines) => jsonEncode({'type': 'lines', 'lines': lines.map((l) => l.toJson()).toList()});

  /// New colours (theme switch) without rebuilding the chart.
  static String palette(ChartPalette p) => jsonEncode({'type': 'palette', 'palette': p.toJson()});

  /// The indicator instances (added, removed, restyled, shown / hidden): the page diffs them like the web layer.
  static String indicators(List<Map<String, Object?>> list) => jsonEncode({'type': 'indicators', 'indicators': list});

  /// Another chart type (candles | bars | line | area), keeping the data and the view.
  static String chartType(String type) => jsonEncode({'type': 'chartType', 'chartType': type});
}

/// Events from the page.
sealed class ChartEvent {
  const ChartEvent();

  /// Parses one message of the `KalksChart` channel; null for anything unknown or malformed.
  static ChartEvent? decode(String raw) {
    Object? m;
    try {
      m = jsonDecode(raw);
    } catch (_) {
      return null;
    }
    if (m is! Map) return null;
    double? n(Object? v) => v is num && v.isFinite ? v.toDouble() : null;
    switch (m['type']) {
      case 'ready':
        return const ChartReady();
      case 'dragstart':
        final id = m['id'];
        return id is String ? ChartDragStarted(id) : null;
      case 'drag':
        final id = m['id'], price = n(m['price']);
        return id is String && price != null ? ChartLineDragged(id, price) : null;
      case 'tap':
        final id = m['id'];
        return id is String ? ChartLineTapped(id) : null;
      case 'close':
        final id = m['id'];
        return id is String ? ChartLineClosed(id) : null;
      case 'older':
        final before = m['before'];
        return before is num ? ChartNeedsOlder(before.toInt()) : null;
      case 'long':
        final price = n(m['price']);
        return price == null ? null : ChartLongPress(price);
      case 'ind':
        final uid = m['uid'];
        return uid is String ? ChartIndicatorTapped(uid) : null;
    }
    return null;
  }
}

/// The page is loaded and listening.
class ChartReady extends ChartEvent {
  const ChartReady();
}

/// A trade line's chip started moving under the finger (the app holds its line updates until the drag ends).
class ChartDragStarted extends ChartEvent {
  const ChartDragStarted(this.id);
  final String id;
}

/// A trade line was dragged to `price` and released.
class ChartLineDragged extends ChartEvent {
  const ChartLineDragged(this.id, this.price);
  final String id;
  final double price;
}

/// A trade line's chip was tapped.
class ChartLineTapped extends ChartEvent {
  const ChartLineTapped(this.id);
  final String id;
}

/// The × of a trade line's chip was tapped.
class ChartLineClosed extends ChartEvent {
  const ChartLineClosed(this.id);
  final String id;
}

/// The left edge came into view: load bars older than `before` (chart time).
class ChartNeedsOlder extends ChartEvent {
  const ChartNeedsOlder(this.before);
  final int before;
}

/// A long press on the plot at `price` (alert / limit order here).
class ChartLongPress extends ChartEvent {
  const ChartLongPress(this.price);
  final double price;
}

/// An indicator's legend row was tapped (show / hide, settings, remove).
class ChartIndicatorTapped extends ChartEvent {
  const ChartIndicatorTapped(this.uid);
  final String uid;
}
