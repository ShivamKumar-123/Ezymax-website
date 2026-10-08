// Live quotes and candles for the Client Area's market pages (Markets, the instrument sheet, News, Calendar), the way
// the web gets them (packages/mock/src/prices.ts PriceFeed in live mode):
//   GET  <marketData.http>/v1/quotes?group=standard     snapshot with the day's open / high / low (change = vs open)
//   WS   <marketData.ws>?group=standard                 the stream (MarketStream: passive for all, active for rows
//                                                       on screen)
//   GET  <marketData.http>/v1/candles?symbol&tf&limit    H1 bars for the 7-day line, D1 bars for the daily close chart
// The market-data service is public (no session). Previews and tests use the reference prices, no network.
import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/config/app_config.dart';
import '../../core/realtime/market_stream.dart';
import '../../env.dart';
import '../../preview/preview_adapter.dart';
import 'instruments.dart';

class MarketQuote {
  const MarketQuote({required this.bid, required this.ask, required this.change, this.dir = 0, this.delayed = false, this.high, this.low});
  final double bid, ask;

  /// Today's % change vs the server-day open.
  final double change;

  /// +1 up-tick, -1 down-tick, 0 unchanged.
  final int dir;
  final bool delayed;
  final double? high, low;
  double get mid => (bid + ask) / 2;
}

class MarketsFeedState {
  const MarketsFeedState({this.quotes = const {}, this.live = false});
  final Map<String, MarketQuote> quotes;

  /// The first prices arrived (the web's FeedGuard waits for this).
  final bool live;
  MarketQuote? operator [](String s) => quotes[s];
}

/// Sample prices instead of the market-data service: preview builds and tests (the sample-data transport).
bool useSampleMarkets(Ref ref) => Env.preview || ref.read(httpAdapterProvider) is PreviewAdapter;

final _http = Dio(BaseOptions(connectTimeout: const Duration(seconds: 10), receiveTimeout: const Duration(seconds: 15)));

double _d(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

/// Preview quotes: the reference prices and changes, a stable sample.
MarketsFeedState previewMarketsFeed() => MarketsFeedState(
  live: true,
  quotes: {
    for (final i in kInstruments)
      i.symbol: MarketQuote(
        bid: i.price - i.spread / 2,
        ask: i.price + i.spread / 2,
        change: i.change,
        high: i.price * (1 + 0.004),
        low: i.price * (1 - 0.0045),
        dir: i.change >= 0 ? 1 : -1,
      ),
  },
);

/// The quotes of the 28 instruments while a market page is open (autoDispose closes the socket).
class MarketsFeed extends Notifier<MarketsFeedState> {
  MarketStream? _stream;
  void Function()? _unsub;
  final Map<String, double> _open = {};
  final Map<String, ({double high, double low})> _day = {};
  Timer? _flush;
  final Map<String, MarketQuote> _pending = {};

  @override
  MarketsFeedState build() {
    if (useSampleMarkets(ref)) return previewMarketsFeed();
    final cfg = ref.watch(configProvider);
    ref.onDispose(() {
      _unsub?.call();
      _stream?.stop();
      _flush?.cancel();
    });
    unawaited(_snapshot(cfg.marketDataHttp));
    final stream = _stream = MarketStream(wsUrl: cfg.marketDataWs, allSymbols: [for (final i in kInstruments) i.symbol]);
    stream.start();
    _unsub = stream.subscribe(kInstrumentMap.keys, _onQuote);
    return const MarketsFeedState();
  }

  Future<void> _snapshot(String base) async {
    try {
      final r = await _http.get<Map<String, dynamic>>('$base/v1/quotes', queryParameters: {'group': 'standard'});
      final data = r.data ?? const {};
      final next = Map<String, MarketQuote>.of(state.quotes);
      for (final e in data.entries) {
        if (!kInstrumentMap.containsKey(e.key) || e.value is! Map) continue;
        final q = (e.value as Map).cast<String, dynamic>();
        final bid = _d(q['bid']), ask = _d(q['ask']);
        if (bid <= 0 || ask <= 0) continue;
        final mid = _d(q['last']) > 0 ? _d(q['last']) : (bid + ask) / 2;
        final o = _d(q['o']);
        _open[e.key] = o > 0 ? o : (_open[e.key] ?? mid);
        _day[e.key] = (high: _d(q['h']) > 0 ? _d(q['h']) : mid, low: _d(q['l']) > 0 ? _d(q['l']) : mid);
        // a stream quote that arrived first wins (the REST answer can be older than the socket)
        if (next.containsKey(e.key)) continue;
        next[e.key] = _quote(e.key, bid, ask, mid, 0, q['d'] == true || q['d'] == 1);
      }
      state = MarketsFeedState(quotes: next, live: next.isNotEmpty || state.live);
    } catch (_) {
      // the stream still fills the quotes
    }
  }

  MarketQuote _quote(String s, double bid, double ask, double mid, int dir, bool delayed) {
    final open = _open[s] ??= mid;
    final day = _day[s];
    final high = day == null ? mid : math.max(day.high, mid);
    final low = day == null ? mid : math.min(day.low, mid);
    _day[s] = (high: high, low: low);
    return MarketQuote(bid: bid, ask: ask, change: open > 0 ? (mid - open) / open * 100 : 0, dir: dir, delayed: delayed, high: high, low: low);
  }

  void _onQuote(Quote q) {
    _pending[q.symbol] = _quote(q.symbol, q.bid, q.ask, q.last > 0 ? q.last : (q.bid + q.ask) / 2, q.dir, q.delayed);
    // repaint at most 4 times a second
    _flush ??= Timer(const Duration(milliseconds: 250), () {
      _flush = null;
      state = MarketsFeedState(quotes: {...state.quotes, ..._pending}, live: true);
      _pending.clear();
    });
  }
}

final marketsFeedProvider = NotifierProvider.autoDispose<MarketsFeed, MarketsFeedState>(MarketsFeed.new);

/* ------------------------------------------------------------------ candles */

typedef Candle = ({int time, double open, double high, double low, double close});

/// A deterministic sample series for previews (seeded by the symbol), ending at the reference price.
List<Candle> sampleCandles(String symbol, int count, {required Duration step}) {
  final i = kInstrumentMap[symbol];
  final base = i?.price ?? 100;
  var seed = symbol.codeUnits.fold<int>(count, (a, c) => (a * 31 + c) & 0x7fffffff);
  double rnd() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  final drift = (i?.change ?? 0) / 100 / count * 6;
  final out = <Candle>[];
  var v = base / (1 + drift * count);
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  for (var n = 0; n < count; n++) {
    final o = v;
    v *= 1 + drift + (rnd() - 0.5) * 0.012;
    out.add((
      time: now - (count - n) * step.inSeconds,
      open: o,
      high: math.max(o, v) * (1 + rnd() * 0.002),
      low: math.min(o, v) * (1 - rnd() * 0.002),
      close: v,
    ));
  }
  return out;
}

Future<List<Candle>?> fetchCandles(Ref ref, String symbol, String tf, int limit) async {
  if (useSampleMarkets(ref)) return sampleCandles(symbol, limit, step: tf == 'D1' ? const Duration(days: 1) : const Duration(hours: 1));
  final base = ref.read(configProvider).marketDataHttp;
  try {
    final r = await _http.get<Map<String, dynamic>>('$base/v1/candles', queryParameters: {'symbol': symbol, 'tf': tf, 'limit': '$limit'});
    final bars = (r.data?['bars'] as List?) ?? const [];
    return [
      for (final b in bars.whereType<Map<String, dynamic>>())
        (time: (b['t'] as num?)?.toInt() ?? 0, open: _d(b['o']), high: _d(b['h']), low: _d(b['l']), close: _d(b['c'])),
    ];
  } catch (_) {
    return null;
  }
}

/// Closes of the last 7 calendar days (H1 bars), null when unavailable.
final weekClosesProvider = FutureProvider.autoDispose.family<List<double>?, String>((ref, symbol) async {
  final bars = await fetchCandles(ref, symbol, 'H1', 180);
  if (bars == null) return null;
  final from = DateTime.now().millisecondsSinceEpoch ~/ 1000 - 7 * 86400;
  final week = [
    for (final b in bars)
      if (b.time >= from) b.close,
  ];
  return week.length > 1 ? week : null;
});

/// Daily bars of the last 180 days (the instrument sheet's chart).
final dailyCandlesProvider = FutureProvider.autoDispose.family<List<Candle>?, String>((ref, symbol) => fetchCandles(ref, symbol, 'D1', 180));

/* ------------------------------------------------------------------ favourites */

/// Favourite symbols (the web keeps them in page state, starting from the defaults).
class MarketFavourites extends Notifier<List<String>> {
  @override
  List<String> build() => List.of(kDefaultFavourites);

  /// Adds or removes `s`; returns true when it is now a favourite.
  bool toggle(String s) {
    final on = state.contains(s);
    state = on
        ? [
            for (final x in state)
              if (x != s) x,
          ]
        : [...state, s];
    return !on;
  }
}

final marketFavouritesProvider = NotifierProvider<MarketFavourites, List<String>>(MarketFavourites.new);
