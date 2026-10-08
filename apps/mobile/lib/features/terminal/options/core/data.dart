// Derived numbers and loaded lists of the options mode:
// - an open position's live numbers (web positions-tab.tsx derive): USD per contract, mark, P&L (the engine's
//   streamed figure wins), what closing pays, Greeks;
// - closed trades: the engine state's option deals plus 90 days of `trade/history` (web book.ts loadOptionHistory);
// - settlements (`trade/options/settlements`), the smile of an expiry and the ATM vol of every open expiry (web
//   analytics-data.tsx).
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_error.dart';
import '../../core/market.dart';
import '../../core/models.dart' show LivePos, isOptionEntry;
import '../../core/sessions.dart';
import '../../core/terminal_controller.dart';
import 'math.dart';
import 'models.dart';
import 'pricer.dart';
import 'store.dart';

/* ------------------------------------------------------------------ */
/* Currency                                                            */
/* ------------------------------------------------------------------ */

/// USD per unit of an underlying's quote currency, from the market feed (0 when unknown; web book.ts usdPerQuote).
double usdPerQuoteOf(String underlying, TQuote? Function(String symbol) quote) {
  final ccy = RegExp(r'^(XAU|XAG)USD$|^(US|UK)OIL$').hasMatch(underlying) || underlying.endsWith('USD')
      ? 'USD'
      : (optionSpecs[underlying]?.quoteCcy ?? (underlying.length >= 3 ? underlying.substring(underlying.length - 3) : 'USD'));
  if (ccy == 'USD') return 1;
  double mid(String s) {
    final q = quote(s);
    return q != null && q.bid > 0 ? (q.bid + q.ask) / 2 : 0;
  }

  final usdX = mid('USD$ccy');
  if (usdX > 0) return 1 / usdX;
  final xUsd = mid('${ccy}USD');
  return xUsd > 0 ? xUsd : 0;
}

/* ------------------------------------------------------------------ */
/* Open positions                                                      */
/* ------------------------------------------------------------------ */

@immutable
class PosLive {
  const PosLive({
    required this.q,
    required this.usdU,
    required this.openUsd,
    required this.markUsd,
    required this.profit,
    required this.basis,
    required this.closeNow,
    required this.delta,
    required this.gamma,
    required this.theta,
    required this.vega,
  });
  final OptionQuote? q;

  /// USD per contract for one unit of premium
  final double usdU;

  /// premium per contract at the open / at the mark, USD
  final double openUsd;
  final double? markUsd;

  /// P&L in USD at the mark, commission excluded (the engine's figure when it streams one)
  final double profit;

  /// premium paid (long) or received (short) for the whole position, USD
  final double basis;

  /// what closing all of it now pays (+) or costs (−), USD; null without a price
  final double? closeNow;
  final double delta, gamma, theta, vega;
}

/// USD per contract for one unit of premium of a position: its quote, else contract size × USD per quote currency.
double usdUnitOfPosition(OptionInfo o, OptionQuote? q, double usdPerQuote) {
  final k = usdPerUnitOfQuote(q);
  if (k > 0) return k;
  final size = o.contractSize > 0 ? o.contractSize : (optionSpecs[o.underlying]?.contractSize ?? 0);
  return size * (usdPerQuote > 0 ? usdPerQuote : 1);
}

/// The live numbers of one position (web derive).
PosLive derivePosition(OptPosition p, OptionQuote? q, LivePos? live, double usdPerQuote) {
  final usdU = usdUnitOfPosition(p.option, q, usdPerQuote);
  final k = p.buy ? 1.0 : -1.0;
  final markUnit = live?.mark ?? q?.mark ?? p.mark;
  final computed = markUnit != null ? k * (markUnit - p.openPrice) * usdU * p.contracts : null;
  final profit = live?.profit ?? p.profit ?? computed ?? 0;
  final exitUnit = q == null ? null : (q.book ? q.mark : (p.buy ? q.bid : q.ask));
  final double? closeNow = exitUnit != null && exitUnit > 0 ? k * exitUnit * usdU * p.contracts : (exitUnit == 0 && p.buy ? 0 : null);
  final lg = live?.greeks;
  double delta, gamma, theta, vega;
  if (lg != null) {
    delta = lg['delta'] ?? 0;
    gamma = lg['gamma'] ?? 0;
    theta = lg['theta'] ?? 0;
    vega = lg['vega'] ?? 0;
  } else if (q != null) {
    delta = k * p.contracts * q.delta;
    gamma = k * p.contracts * q.gamma;
    theta = k * p.contracts * q.theta;
    vega = k * p.contracts * q.vega;
  } else {
    delta = p.greeks?['delta'] ?? 0;
    gamma = p.greeks?['gamma'] ?? 0;
    theta = p.greeks?['theta'] ?? 0;
    vega = p.greeks?['vega'] ?? 0;
  }
  return PosLive(
    q: q,
    usdU: usdU,
    openUsd: p.openPrice * usdU,
    markUsd: markUnit == null ? null : markUnit * usdU,
    profit: profit,
    basis: p.openPrice * usdU * p.contracts,
    closeNow: closeNow,
    delta: delta,
    gamma: gamma,
    theta: theta,
    vega: vega,
  );
}

/// Positions by strategy: combos (one card each) and singles.
({Map<String, List<OptPosition>> combos, List<OptPosition> singles}) groupPositions(List<OptPosition> list) {
  final combos = <String, List<OptPosition>>{};
  final singles = <OptPosition>[];
  for (final p in list) {
    if (p.comboId != null) {
      (combos[p.comboId!] ??= []).add(p);
    } else {
      singles.add(p);
    }
  }
  return (combos: combos, singles: singles);
}

/// Greatest common divisor (strategy sizes, RFQ ratios).
int gcd(int a, int b) => b == 0 ? a.abs() : gcd(b, a % b);

/// Legs → whole ratios and a strategy size (2 × 1 + 2 × 1 = size 2 of a 1:1 strategy; web rfq.tsx toRatios).
({int qty, List<RfqLeg> legs}) toRatios(List<({String series, String side, int contracts})> legs) {
  final whole = [for (final l in legs) math.max(1, l.contracts)];
  var g = whole.isEmpty ? 1 : whole.first;
  for (final w in whole) {
    g = gcd(g, w);
  }
  if (g <= 0) g = 1;
  return (qty: g, legs: [for (var i = 0; i < legs.length; i++) RfqLeg(series: legs[i].series, side: legs[i].side, ratio: whole[i] ~/ g)]);
}

/* ------------------------------------------------------------------ */
/* Closed trades                                                       */
/* ------------------------------------------------------------------ */

/// 90 days of the engine's history (option deals only), loaded when the Closed list opens.
final optHistoryProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
  final api = ref.watch(optionsApiProvider);
  if (api == null) return const [];
  try {
    return (await api.history(days: 90)).where(isOptionEntry).toList();
  } on ApiException {
    return const [];
  }
});

/// Closed option trades, newest first: the engine state's deals merged with the loaded history.
final optClosedProvider = Provider.autoDispose<List<OptClosed>>((ref) {
  final book = ref.watch(optBookProvider);
  final history = ref.watch(optHistoryProvider).value ?? const <Json>[];
  final feed = ref.watch(marketFeedProvider);
  final ids = <String>{};
  final deals = <Json>[];
  for (final d in [...book.deals, ...history]) {
    if (ids.add('${d['id']}')) deals.add(d);
  }
  return mapOptionClosed(deals, cent: book.cent, usdPerQuote: (u) => usdPerQuoteOf(u, feed.quote));
});

/* ------------------------------------------------------------------ */
/* Settlements                                                         */
/* ------------------------------------------------------------------ */

final optSettlementsProvider = FutureProvider.autoDispose<List<Settlement>>((ref) async {
  final api = ref.watch(optionsApiProvider);
  if (api == null) return const [];
  final cent = ref.watch(terminalProvider.select((s) => s.account?.cent ?? false));
  final list = await api.settlements(cent: cent);
  list.sort((a, b) => msOf(b.at).compareTo(msOf(a.at)));
  return list;
});

/* ------------------------------------------------------------------ */
/* Analytics: smile and term structure                                 */
/* ------------------------------------------------------------------ */

@immutable
class SmileData {
  const SmileData({required this.u, required this.expiry, required this.atmVol, required this.points, required this.pillars, required this.term});
  final String u, expiry;
  final double? atmVol;

  /// the model smile at the listed strikes
  final List<({double strike, double vol})> points;
  final List<SmilePillar> pillars;

  /// the surface's ATM pillars
  final List<({String tenor, double days, double atm})> term;

  static SmileData parse(String u, String expiry, Json x) {
    final points = [
      for (final p in jsonList(x['points']))
        if ((numOf(p['strike']) ?? 0) > 0 && (numOf(p['vol']) ?? 0) > 0) (strike: numOf(p['strike'])!, vol: numOf(p['vol'])!),
    ]..sort((a, b) => a.strike.compareTo(b.strike));
    final pillars = <SmilePillar>[
      for (final p in jsonList(x['pillars']))
        if ((numOf(p['callDelta']) ?? 0) > 0 && (numOf(p['callDelta']) ?? 1) < 1 && (numOf(p['vol']) ?? 0) > 0)
          (callDelta: numOf(p['callDelta'])!, vol: numOf(p['vol'])!, strike: numOf(p['strike']) ?? double.nan),
    ];
    final term = [
      for (final p in jsonList(x['termStructure']))
        if ((numOf(p['days']) ?? 0) > 0 && (numOf(p['atm']) ?? 0) > 0) (tenor: '${p['tenor'] ?? ''}', days: numOf(p['days'])!, atm: numOf(p['atm'])!),
    ]..sort((a, b) => a.days.compareTo(b.days));
    return SmileData(u: u, expiry: strOf(x['expiry']) ?? expiry, atmVol: numOf(x['atmVol']), points: points, pillars: pillars, term: term);
  }
}

/// The model IV of a quote: the book's theo IV, else the house quote's IV.
double? modelIv(OptionQuote? q) {
  final v = q == null ? null : (q.book ? (q.theoIv ?? q.iv) : q.iv);
  return v != null && v > 0 ? v : null;
}

/// The chain's own smile (the out-of-the-money side's model IV): while the smile route doesn't answer.
SmileData? chainSmile(OptionChain chain) {
  final ref = chain.atmStrike ?? chain.spot?.mid;
  final points = <({double strike, double vol})>[];
  for (final r in chain.rows) {
    final otm = ref != null && r.strike < ref ? r.put : r.call;
    final v = modelIv(otm) ?? modelIv(r.call) ?? modelIv(r.put);
    if (v != null) points.add((strike: r.strike, vol: v));
  }
  if (points.isEmpty) return null;
  final atmRow = chain.rows.isEmpty ? null : chain.rows[atmIndex(chain)];
  return SmileData(
    u: chain.underlying,
    expiry: chain.expiry,
    atmVol: modelIv(atmRow?.call) ?? modelIv(atmRow?.put),
    points: points,
    pillars: const [],
    term: const [],
  );
}

final Map<String, ({int at, SmileData? data})> _smileCache = {};
final Map<String, Future<SmileData?>> _smileFlight = {};

/// One expiry's smile from the options service (cached 20 s, or `ttl`; in-flight requests shared).
Future<SmileData?> fetchSmile(TradeApi? api, String u, String expiry, {Duration ttl = const Duration(seconds: 20)}) {
  if (api == null) return Future.value();
  final key = '${api.login}|$u|$expiry';
  final c = _smileCache[key];
  final now = DateTime.now().millisecondsSinceEpoch;
  if (c != null && now - c.at < ttl.inMilliseconds) return Future.value(c.data);
  final flying = _smileFlight[key];
  if (flying != null) return flying;
  final f = () async {
    SmileData? data;
    try {
      data = SmileData.parse(u, expiry, await api.get<Map<String, dynamic>>('trade/options/smile', query: {'u': u, 'expiry': expiry}));
    } on ApiException {
      data = null;
    }
    _smileCache[key] = (at: DateTime.now().millisecondsSinceEpoch, data: data);
    unawaited(_smileFlight.remove(key));
    return data;
  }();
  _smileFlight[key] = f;
  return f;
}

/// The smile of the expiry on screen (refreshed every 20 s while watched).
final optSmileProvider = FutureProvider.autoDispose.family<SmileData?, (String, String)>((ref, key) async {
  final api = ref.watch(tradeApiProvider);
  final t = Timer(const Duration(seconds: 20), ref.invalidateSelf);
  ref.onDispose(t.cancel);
  return fetchSmile(api, key.$1, key.$2);
});

/// One point of the term structure: the ATM vol of an open expiry.
typedef TermPoint = ({String date, String cutAt, double days, double atm});

/// ATM IV of every open expiry of the underlying (their smiles, 3 at a time; refreshed every 60 s).
final optTermProvider = FutureProvider.autoDispose.family<List<TermPoint>, (String, String)>((ref, key) async {
  final api = ref.watch(tradeApiProvider);
  final t = Timer(const Duration(seconds: 60), ref.invalidateSelf);
  ref.onDispose(t.cancel);
  final u = key.$1;
  final list = ref.read(optionsProvider).expiries.where(expiryOpen).toList()..sort((a, b) => a.cutMs.compareTo(b.cutMs));
  final now = DateTime.now().millisecondsSinceEpoch;
  final out = List<TermPoint?>.filled(list.length, null);
  var i = 0;
  Future<void> worker() async {
    while (i < list.length) {
      final k = i++;
      final e = list[k];
      final s = await fetchSmile(api, u, e.date, ttl: const Duration(seconds: 60));
      final v = s?.atmVol;
      if (v != null && v > 0) out[k] = (date: e.date, cutAt: e.cutAt, days: math.max(1 / 24, (e.cutMs - now) / 86400000), atm: v);
    }
  }

  await Future.wait([worker(), worker(), worker()]);
  return [for (final p in out) ?p];
});

/// Open interest and today's volume per strike (null fields = the book doesn't report them; web oiOf).
@immutable
class OiData {
  const OiData({required this.available, required this.rows, required this.callOi, required this.callVol, required this.putOi, required this.putVol});
  final bool available;
  final List<({double strike, String label, double callOi, double putOi, double callVol, double putVol})> rows;
  final double callOi, callVol, putOi, putVol;

  static OiData of(OptionChain? chain) {
    var available = false;
    var cOi = 0.0, cVol = 0.0, pOi = 0.0, pVol = 0.0;
    final rows = <({double strike, String label, double callOi, double putOi, double callVol, double putVol})>[];
    for (final r in chain?.rows ?? const <OptionChainRow>[]) {
      final c = r.call, p = r.put;
      if (c?.oi != null || p?.oi != null || c?.volume != null || p?.volume != null) available = true;
      final row = (
        strike: r.strike,
        label: r.strikeLabel,
        callOi: math.max(0.0, c?.oi ?? 0),
        putOi: math.max(0.0, p?.oi ?? 0),
        callVol: math.max(0.0, c?.volume ?? 0),
        putVol: math.max(0.0, p?.volume ?? 0),
      );
      cOi += row.callOi;
      cVol += row.callVol;
      pOi += row.putOi;
      pVol += row.putVol;
      rows.add(row);
    }
    return OiData(available: available && (chain?.book?.active ?? false), rows: rows, callOi: cOi, callVol: cVol, putOi: pOi, putVol: pVol);
  }
}
