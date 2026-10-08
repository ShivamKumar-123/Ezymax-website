// The message codec between the app and the chart page (assets/chart/chart.html, lightweight-charts 5.2.1, the same
// engine as the web terminal). Dart -> page: JSON passed to `window.K.recv(...)`; page -> Dart: JSON posted on the
// `EzymexChart` JavaScript channel. Both sides are tiny and versioned by `type`, so the page stays dumb: Dart owns the
// data (history, forming bars, quotes, trade lines) and the page draws it and reports gestures.
import 'dart:convert';

import 'package:flutter/foundation.dart';

/// One trade line on the chart (web TLine): an open position, a pending order, their SL / TP, a price alert.
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
    this.addSl = false,
    this.addTp = false,
    this.stops,
  });

  /// `pos:TICKET`, `sl:TICKET`, `tp:TICKET`, `pnd:TICKET`, `osl:TICKET` / `otp:TICKET` (a pending order's SL / TP) or
  /// `alr:ID`.
  final String id;

  /// pos | sl | tp | pending | alert, and for options: strike | breakeven | barrier
  final String kind;
  final double price;
  final String label;

  /// buy | sell (positions and orders, and their SL / TP)
  final String? side;
  final bool draggable;

  /// A figure shown on the chip after the label (web: the position's P&L, the money at a stop).
  final String? note;

  /// up | down: the note's colour on a position chip.
  final String? tone;

  /// The chip has × (close the position, remove the stop, cancel the order, delete the alert).
  final bool closable;

  /// The chip has the S / T handle (a position or order without a stop loss / take profit): dragged off the line, it
  /// sets one at the drop price ([ChartStopDragged]).
  final bool addSl, addTp;

  /// How a stop of this trade is checked and valued while it is dragged (the S / T handles of a position or order
  /// line, and its SL / TP lines); null: no stops.
  final ChartStops? stops;

  /// The ticket / alert id after the prefix.
  String get ref => id.contains(':') ? id.substring(id.indexOf(':') + 1) : id;

  /// The id of the stop line `which` (sl | tp) of this position or pending order.
  String stopId(String which) => kind == 'pending' ? 'o$which:$ref' : '$which:$ref';

  ChartLine copyWith({double? price, String? note, bool? draggable, bool? closable, bool? addSl, bool? addTp}) => ChartLine(
    id: id,
    kind: kind,
    price: price ?? this.price,
    label: label,
    side: side,
    draggable: draggable ?? this.draggable,
    note: note ?? this.note,
    tone: tone,
    closable: closable ?? this.closable,
    addSl: addSl ?? this.addSl,
    addTp: addTp ?? this.addTp,
    stops: stops,
  );

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
    'addSl': addSl,
    'addTp': addTp,
    'stops': stops?.toJson(),
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
      other.closable == closable &&
      other.addSl == addSl &&
      other.addTp == addTp &&
      other.stops == stops;

  @override
  int get hashCode => Object.hash(id, kind, price, label, side, draggable, note, tone, closable, addSl, addTp, stops);
}

/// What the chart needs to check a stop of a trade and show the money at it while it is dragged, with no round trip
/// to the app (the contract maths of trade_math.dart as a line through the entry, web profitAt):
///   money(price) = (price − open) × k ÷ (inv ? price : 1) + c      (account currency: USD, USC on cent accounts)
/// A stop must stay beyond the reference by at least `gap` (engine check_sltp): below it for the SL of a buy and the
/// TP of a sell, above it for the TP of a buy and the SL of a sell. The reference is the live bid (buy) / ask (sell)
/// for a position, the entry for a pending order (`order`). The chart page has the same check (chart.html).
@immutable
class ChartStops {
  const ChartStops({required this.open, required this.k, this.c = 0, this.inv = false, this.order = false, this.gap = 0});

  /// The JSON sent to the page (the native chart reads it back); null when malformed.
  static ChartStops? fromJson(Object? j) {
    if (j is! Map) return null;
    final open = j['open'], k = j['k'], c = j['c'], gap = j['gap'];
    if (open is! num || k is! num) return null;
    return ChartStops(
      open: open.toDouble(),
      k: k.toDouble(),
      c: c is num ? c.toDouble() : 0,
      inv: j['inv'] == true,
      order: j['order'] == true,
      gap: gap is num ? gap.toDouble() : 0,
    );
  }

  /// The position's open price / the order's entry price.
  final double open;

  /// Account money per 1.0 of price above `open`, signed by side: lots × contract size × quote → USD (× 100 on a cent
  /// account), negative for a sell.
  final double k;

  /// The fixed part: a position's swap − commission (account money).
  final double c;

  /// A USD-base symbol (USDJPY …): its quote currency converts at 1 / price.
  final bool inv;

  /// A pending order: its stops are checked against `open`, not the live bid / ask.
  final bool order;

  /// The least distance of a stop from the reference (the symbol's stops level × point).
  final double gap;

  /// The money (account currency) if the trade closes at `price`.
  double moneyAt(double price) => (price - open) * k / (inv && price > 0 ? price : 1) + c;

  /// Null when a stop `which` (sl | tp) of a `side` trade may go to `price`, else why not: `key` names the text
  /// (chart.line.bad.slBelow | slAbove | tpAbove | tpBelow) and `limit` is the price it must be below / above. Without
  /// a quote yet the server decides.
  ({String key, double limit})? problem(String which, String side, double price, {required double bid, required double ask}) {
    final buy = side == 'buy';
    final r = order ? open : (buy ? bid : ask);
    if (!(r > 0)) return null;
    final below = (which == 'sl') == buy;
    final limit = below ? r - gap : r + gap;
    final eps = 1e-9 * (r > 1 ? r : 1);
    final bad = price <= 0 || (below ? price > limit + eps || price >= r - eps : price < limit - eps || price <= r + eps);
    return bad ? (key: '$which${below ? 'Below' : 'Above'}', limit: limit) : null;
  }

  Map<String, Object?> toJson() => {'open': open, 'k': k, 'c': c, 'inv': inv, 'order': order, 'gap': gap};

  @override
  bool operator ==(Object other) =>
      other is ChartStops && other.open == open && other.k == k && other.c == c && other.inv == inv && other.order == order && other.gap == gap;

  @override
  int get hashCode => Object.hash(open, k, c, inv, order, gap);
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
    this.buy = '#4a7bff',
  });

  final bool dark;
  final String bg, grid, line, up, down, gold, warn, ember, fg, fg2, fg3, label, panel;

  /// The indicators' "info" colour token (web --k-info).
  final String info;

  /// Buy position lines and chips, rising candles and volume (web --t-buy, blue). Sell / falling stay `down`; TP
  /// lines and P&L stay `up` / `down`.
  final String buy;

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
    'buy': buy,
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

  /// Parses one message of the `EzymexChart` channel; null for anything unknown or malformed.
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
      case 'dragend':
        final id = m['id'];
        return id is String ? ChartDragEnded(id) : null;
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
      case 'stop':
        final id = m['id'], which = m['which'], price = n(m['price']);
        return id is String && which is String && (which == 'sl' || which == 'tp') && price != null ? ChartStopDragged(id, which, price) : null;
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

/// A dragged trade line was released where it may not go (a stop on the wrong side of the price): nothing to commit,
/// the held line updates go through again.
class ChartDragEnded extends ChartEvent {
  const ChartDragEnded(this.id);
  final String id;
}

/// A trade line was dragged to `price` and released.
class ChartLineDragged extends ChartEvent {
  const ChartLineDragged(this.id, this.price);
  final String id;
  final double price;
}

/// The S / T handle of a position or order line (`id`) was dragged to `price` and released: set its stop loss
/// (`which` = sl) / take profit (tp) there. The chart checked the side of the price before.
class ChartStopDragged extends ChartEvent {
  const ChartStopDragged(this.id, this.which, this.price);
  final String id, which;
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
