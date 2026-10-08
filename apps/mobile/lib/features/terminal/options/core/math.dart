// Payoff maths, strategy templates, the client-side preview estimate and the analytics helpers of the options
// workspace (web: apps/terminal/lib/options/math.ts), plus the plain-language reading of a set of legs (plain.ts).
// Pure functions: the strategy builder, the guided Quick trade and the ticket all draw from here.
import 'dart:math' as math;

import 'models.dart';
import 'pricer.dart';

/// A leg with its fill premium per unit (quote currency).
class PayLeg {
  const PayLeg({required this.right, required this.strike, required this.side, required this.contracts, required this.premium, this.iv});
  final OptionRight right;
  final double strike;
  final String side;
  final double contracts;
  final double premium;
  final double? iv;
}

int _sgn(String side) => side == 'buy' ? 1 : -1;
double _intrinsic(OptionRight r, double s, double k) => math.max(0, r == 'call' ? s - k : k - s);

/// P&L at expiry in USD when the underlying fixes at `s`.
double payoffAt(List<PayLeg> legs, double s, double usdPerUnit) {
  var v = 0.0;
  for (final l in legs) {
    v += _sgn(l.side) * l.contracts * usdPerUnit * (_intrinsic(l.right, s, l.strike) - l.premium);
  }
  return v;
}

/// P&L now (model value with each leg's vol), `atMs` before the cut.
double payoffNow(List<PayLeg> legs, double s, double usdPerUnit, String u, double cutAtMs, {double? atMs}) {
  final at = atMs ?? DateTime.now().millisecondsSinceEpoch.toDouble();
  final spec = optionSpecs[u];
  final c = spec == null ? (r: 0.036, b: 0.0) : carryOf(spec);
  final tCal = math.max(0.0, (cutAtMs - at) / (365 * 86400000));
  final tVol = volYears(at, cutAtMs);
  var v = 0.0;
  for (final l in legs) {
    v += _sgn(l.side) * l.contracts * usdPerUnit * (legValue(l.right, s, l.strike, tCal, tVol, c.r, c.b, l.iv ?? spec?.atm[1] ?? 0.1) - l.premium);
  }
  return v;
}

class PayoffStats {
  const PayoffStats({required this.maxProfit, required this.maxLoss, required this.breakevens});

  /// null = unlimited
  final double? maxProfit;

  /// positive number (the most you can lose); null = unlimited
  final double? maxLoss;
  final List<double> breakevens;
}

/// Max profit / loss and breakevens of the piecewise-linear expiry payoff.
PayoffStats payoffStats(List<PayLeg> legs, double usdPerUnit) {
  if (legs.isEmpty) return const PayoffStats(maxProfit: 0, maxLoss: 0, breakevens: []);
  final ks = {for (final l in legs) l.strike}.toList()..sort();
  final xs = [0.0, ...ks];
  final ys = [for (final x in xs) payoffAt(legs, x, usdPerUnit)];
  var slope = 0.0;
  for (final l in legs) {
    if (l.right == 'call') slope += _sgn(l.side) * l.contracts * usdPerUnit;
  }
  const eps = 1e-9;
  final maxY = ys.reduce(math.max);
  final minY = ys.reduce(math.min);
  final double? maxProfit = slope > eps ? null : maxY;
  final double? maxLoss = slope < -eps ? null : math.max(0, -minY);
  final bes = <double>[];
  for (var i = 1; i < xs.length; i++) {
    final x0 = xs[i - 1], x1 = xs[i], y0 = ys[i - 1], y1 = ys[i];
    if ((y0 < 0 && y1 > 0) || (y0 > 0 && y1 < 0)) {
      bes.add(x0 + ((0 - y0) * (x1 - x0)) / (y1 - y0));
    } else if (y1.abs() < eps && i < xs.length - 1) {
      bes.add(x1);
    }
  }
  final yl = ys.last;
  if (slope.abs() > eps && (-yl).sign == slope.sign && yl != 0) bes.add(xs.last - yl / slope);
  final uniq = <double>{for (final b in bes) double.parse(b.toStringAsFixed(10))}.where((b) => b > 0).toList();
  return PayoffStats(maxProfit: maxProfit == null ? null : math.max(0, maxProfit), maxLoss: maxLoss, breakevens: uniq);
}

/// Probability that the expiry P&L is positive, under a lognormal at the given vol around the forward.
double probProfit(List<PayLeg> legs, double usdPerUnit, double forward, double vol, double years) {
  if (legs.isEmpty || !(forward > 0) || !(vol > 0) || !(years > 0)) return 0;
  final sd = vol * math.sqrt(years);
  final mu = math.log(forward) - 0.5 * sd * sd;
  const n = 600;
  var p = 0.0;
  var prev = 0.0;
  for (var i = 0; i <= n; i++) {
    final z = -6 + (12 * i) / n;
    final cdf = normCdf(z);
    if (i > 0) {
      final zm = z - 6 / n;
      final s = math.exp(mu + sd * zm);
      if (payoffAt(legs, s, usdPerUnit) > 0) p += cdf - prev;
    }
    prev = cdf;
  }
  return p.clamp(0, 1);
}

/// USD per contract per unit of premium, read off the chain (contract size × USD per quote currency).
double usdPerUnitOf(OptionChain? chain) {
  if (chain == null) return 0;
  for (final r in chain.rows) {
    for (final q in [r.call, r.put]) {
      if (q != null && q.ask > 0 && q.askUsd > 0) return q.askUsd / q.ask;
    }
  }
  for (final r in chain.rows) {
    for (final q in [r.call, r.put]) {
      if (q != null && q.mark > 0 && q.markUsd > 0) return q.markUsd / q.mark;
    }
  }
  return chain.quoteCcy == 'USD' ? chain.contractSize : 0;
}

/// Fill premium per unit of a leg: the ask when buying, the bid when selling (or the limit). On the order book an
/// empty side (0) has no price: the mark stands in for estimates.
double fillOf(OptionQuote q, String side, [double? limit]) {
  if (limit != null && limit > 0) return limit;
  final p = side == 'buy' ? q.ask : q.bid;
  return q.book && !(p > 0) ? q.mark : p;
}

/// Signed sum of quote Greeks over legs (delta / gamma in contracts, vega / theta in USD).
Map<String, double> sumGreeks(List<({String side, double contracts, OptionQuote? q})> legs) {
  var d = 0.0, g = 0.0, v = 0.0, t = 0.0;
  for (final l in legs) {
    final q = l.q;
    if (q == null) continue;
    final k = _sgn(l.side) * l.contracts;
    d += k * q.delta;
    g += k * q.gamma;
    v += k * q.vega;
    t += k * q.theta;
  }
  return {'delta': d, 'gamma': g, 'vega': v, 'theta': t};
}

/* ---------------- strategy templates ---------------- */

const List<String> strategyTemplates = ['long_call', 'long_put', 'straddle', 'strangle', 'bull_call', 'bear_put', 'iron_condor', 'butterfly'];

typedef TemplateLeg = ({OptionRight right, String side, int at, int ratio});

const Map<String, List<TemplateLeg>> _templates = {
  'long_call': [(right: 'call', side: 'buy', at: 0, ratio: 1)],
  'long_put': [(right: 'put', side: 'buy', at: 0, ratio: 1)],
  'straddle': [(right: 'call', side: 'buy', at: 0, ratio: 1), (right: 'put', side: 'buy', at: 0, ratio: 1)],
  'strangle': [(right: 'put', side: 'buy', at: -1, ratio: 1), (right: 'call', side: 'buy', at: 1, ratio: 1)],
  'bull_call': [(right: 'call', side: 'buy', at: 0, ratio: 1), (right: 'call', side: 'sell', at: 1, ratio: 1)],
  'bear_put': [(right: 'put', side: 'buy', at: 0, ratio: 1), (right: 'put', side: 'sell', at: -1, ratio: 1)],
  'iron_condor': [
    (right: 'put', side: 'buy', at: -2, ratio: 1),
    (right: 'put', side: 'sell', at: -1, ratio: 1),
    (right: 'call', side: 'sell', at: 1, ratio: 1),
    (right: 'call', side: 'buy', at: 2, ratio: 1),
  ],
  'butterfly': [(right: 'call', side: 'buy', at: -1, ratio: 1), (right: 'call', side: 'sell', at: 0, ratio: 2), (right: 'call', side: 'buy', at: 1, ratio: 1)],
};

/// Index of the row closest to the ATM strike (the forward), else to spot.
int atmIndex(OptionChain chain) {
  final ref = chain.atmStrike ?? chain.spot?.mid;
  if (chain.rows.isEmpty || ref == null) return chain.rows.length ~/ 2;
  var best = 0;
  for (var i = 1; i < chain.rows.length; i++) {
    if ((chain.rows[i].strike - ref).abs() < (chain.rows[best].strike - ref).abs()) best = i;
  }
  return best;
}

/// A template's legs on the chain: strikes `width` ladder steps apart around ATM.
List<({OptionChainRow row, OptionRight right, String side, int contracts})> templateLegs(String id, OptionChain chain, int width, int contracts) {
  final i0 = atmIndex(chain);
  final out = <({OptionChainRow row, OptionRight right, String side, int contracts})>[];
  for (final l in _templates[id] ?? const <TemplateLeg>[]) {
    if (chain.rows.isEmpty) break;
    final i = (i0 + l.at * (width < 1 ? 1 : width)).clamp(0, chain.rows.length - 1);
    out.add((row: chain.rows[i], right: l.right, side: l.side, contracts: l.ratio * contracts));
  }
  return out;
}

/// Best-effort name of a set of legs (positions grouped by combo, the builder's custom legs).
String? detectTemplate(List<({OptionRight right, String side, double strike, double contracts})> legs) {
  final sorted = [...legs]..sort((a, b) => a.strike != b.strike ? a.strike.compareTo(b.strike) : a.right.compareTo(b.right));
  final k = sorted.map((l) => '${l.side[0]}${l.right[0]}').join(',');
  final strikes = {for (final l in legs) l.strike}.length;
  if (legs.length == 1) return k == 'bc' ? 'long_call' : (k == 'bp' ? 'long_put' : null);
  if (legs.length == 2) {
    if (strikes == 1 && legs.every((l) => l.side == 'buy') && legs.any((l) => l.right == 'call') && legs.any((l) => l.right == 'put')) return 'straddle';
    if (k == 'bp,bc') return 'strangle';
    if (k == 'bc,sc') return 'bull_call';
    if (k == 'sp,bp') return 'bear_put';
  }
  if (legs.length == 4 && k == 'bp,sp,sc,bc') return 'iron_condor';
  if (legs.length == 3 && k == 'bc,sc,bc') return 'butterfly';
  return null;
}

/* ---------------- client-side preview estimate ---------------- */

class EstimateLeg {
  const EstimateLeg({required this.series, required this.right, required this.strike, required this.side, required this.contracts, required this.quote});
  final String series;
  final OptionRight right;
  final double strike;
  final String side;
  final double contracts;
  final OptionQuote? quote;
}

/// What the engine's preview would say, computed on the phone (while the engine doesn't take option orders yet).
OptPreview estimatePreview({
  required String underlying,
  required List<EstimateLeg> legs,
  required String type,
  double? limitPremium,
  required OptionChain? chain,
  required ({double cash, double margin, double free}) account,
  List<MarginLeg> existing = const [],
  bool marketOpen = true,
}) {
  final usd = chain != null ? usdPerUnitOf(chain) : (legs.map((l) => usdPerUnitOfQuote(l.quote)).firstWhere((x) => x > 0, orElse: () => 0));
  final perContract = chain?.commissionPerContract ?? OptionDefaults.commissionPerContract;
  final capPct = chain?.commissionCapPct ?? OptionDefaults.commissionCapPct;
  final reasons = <String>[];
  final single = legs.length == 1;
  final pay = <PayLeg>[];
  var net = 0.0, commission = 0.0;
  final out = <PreviewLeg>[];
  for (final l in legs) {
    final price = l.quote == null ? 0.0 : fillOf(l.quote!, l.side, single && type == 'limit' ? limitPremium : null);
    final premium = price * usd * l.contracts;
    net += _sgn(l.side) * premium;
    commission += math.min(perContract * l.contracts, (capPct / 100) * premium);
    pay.add(PayLeg(right: l.right, strike: l.strike, side: l.side, contracts: l.contracts, premium: price, iv: l.quote?.iv));
    if (l.quote == null) {
      reasons.add('no_price');
    } else if (l.quote!.state == 'halted') {
      reasons.add('series_halted');
    } else if (l.quote!.state == 'close_only') {
      reasons.add('cutoff');
    } else if (l.quote!.state == 'closed') {
      reasons.add('closed');
    }
    out.add(PreviewLeg(series: l.series, side: l.side, contracts: l.contracts, price: price, premium: double.parse(premium.toStringAsFixed(2))));
  }
  final stats = payoffStats(pay, usd);
  final spec = optionSpecs[underlying];
  var addMargin = 0.0;
  if (spec != null && chain?.spot != null && usd > 0) {
    final ctx = pricingContext(spec, chain!.spot!.mid, chain.cutMs.toDouble(), DateTime.now().millisecondsSinceEpoch.toDouble(), usd / spec.contractSize);
    final before = scenarioMargin(ctx, existing);
    final after = scenarioMargin(ctx, [
      ...existing,
      for (final p in pay) MarginLeg(right: p.right, strike: p.strike, qty: _sgn(p.side) * p.contracts, iv: p.iv ?? ctx.quotes.atm),
    ]);
    addMargin = math.max(0, after - before);
  }
  final cashAfter = account.cash - net - commission;
  final freeAfter = account.free - math.max(0, net) - commission - addMargin + math.max(0, -net);
  if (!marketOpen) reasons.add('market_closed');
  if (net + commission > account.cash && net > 0) {
    reasons.add('insufficient_cash');
  } else if (freeAfter < 0) {
    reasons.add('insufficient_margin');
  }
  final g = sumGreeks([for (final l in legs) (side: l.side, contracts: l.contracts, q: l.quote)]);
  double r2(double v) => double.parse(v.toStringAsFixed(2));
  return OptPreview(
    ok: reasons.isEmpty,
    reasons: [for (final r in reasons.toSet()) (code: r, message: null)],
    legs: out,
    netPremium: r2(net),
    commission: r2(commission),
    marginBefore: r2(account.margin),
    marginAfter: r2(account.margin + addMargin),
    freeMarginAfter: r2(freeAfter),
    cashAfter: r2(cashAfter),
    maxProfit: stats.maxProfit == null ? null : r2(stats.maxProfit! - commission),
    maxLoss: stats.maxLoss == null ? null : r2(stats.maxLoss! + commission),
    breakevens: stats.breakevens,
    greeks: g,
    estimate: true,
  );
}

/* ---------------- analytics ---------------- */

typedef SmilePillar = ({double callDelta, double vol, double strike});

/// 25-delta risk reversal (call vol − put vol) and butterfly (wings over ATM) read off the smile's pillars.
({double? rr25, double? bf25}) skewOf(List<SmilePillar> pillars, double? atmVol) {
  double? at(double d) {
    for (final p in pillars) {
      if ((p.callDelta - d).abs() < 0.02) return p.vol;
    }
    return null;
  }

  final c25 = at(0.25);
  final p25 = at(0.75);
  final atm = at(0.5) ?? atmVol;
  return (rr25: c25 != null && p25 != null ? c25 - p25 : null, bf25: c25 != null && p25 != null && atm != null ? (c25 + p25) / 2 - atm : null);
}

/// Puts over calls (open interest or volume); null without calls.
double? putCallRatio(double puts, double calls) => calls > 0 ? puts / calls : null;

/// Max pain: the listed strike where the holders of the expiry's open interest would collect the least at expiry.
double? maxPain(List<({double strike, double callOi, double putOi})> rows) {
  if (!rows.any((r) => r.callOi > 0 || r.putOi > 0)) return null;
  double? best;
  var bestPay = double.infinity;
  for (final f in rows) {
    var pay = 0.0;
    for (final r in rows) {
      pay += r.callOi * math.max(0, f.strike - r.strike) + r.putOi * math.max(0, r.strike - f.strike);
    }
    if (pay < bestPay - 1e-12) {
      bestPay = pay;
      best = f.strike;
    }
  }
  return best;
}

/// An option leg of the what-if book: an open position or a ticket leg.
class WhatIfLeg {
  const WhatIfLeg({
    required this.right,
    required this.strike,
    required this.side,
    required this.contracts,
    required this.premium,
    required this.iv,
    required this.cutAtMs,
    required this.usdPerUnit,
  });
  final OptionRight right;
  final double strike;
  final String side;
  final double contracts, premium, iv, cutAtMs, usdPerUnit;
}

class WhatIfBook {
  const WhatIfBook({required this.spot, required this.r, required this.b, required this.inverseUsd, required this.options});
  final double spot, r, b;
  final bool inverseUsd;
  final List<WhatIfLeg> options;
}

/// Each option leg's calendar and vol-clock years to its cut at an instant.
List<({double tCal, double tVol})> whatIfClock(WhatIfBook book, double atMs) => [
  for (final l in book.options) (tCal: math.max(0, (l.cutAtMs - atMs) / (365 * 86400000)), tVol: volYears(atMs, l.cutAtMs)),
];

/// P&L of the book in USD if the underlying trades at `s` at the clock's instant, every leg's IV moved by `ivShift`.
double whatIfPnl(WhatIfBook book, double s, List<({double tCal, double tVol})> clock, [double ivShift = 0]) {
  if (!(s > 0)) return double.nan;
  final fx = book.inverseUsd && book.spot > 0 ? book.spot / s : 1.0;
  var v = 0.0;
  for (var i = 0; i < book.options.length; i++) {
    final l = book.options[i];
    final c = i < clock.length ? clock[i] : (tCal: 0.0, tVol: 0.0);
    final sigma = math.max(0.005, l.iv + ivShift);
    v += _sgn(l.side) * l.contracts * l.usdPerUnit * fx * (legValue(l.right, s, l.strike, c.tCal, c.tVol, book.r, book.b, sigma) - l.premium);
  }
  return v;
}

/// A "nice" ± range in percent of spot that covers `need` (fraction).
double niceRangePct(double need) {
  const steps = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 7.5, 10.0, 15.0, 20.0, 25.0, 30.0, 40.0, 50.0];
  final want = math.max(0, need) * 100;
  return steps.firstWhere((x) => x >= want, orElse: () => 50);
}

/* ------------------------------------------------------------------ */
/* Plain language (web plain.ts)                                       */
/* ------------------------------------------------------------------ */

/// long_call | long_put | short_call | short_put | multi
String shapeOf(List<PayLeg> legs) {
  if (legs.length != 1) return 'multi';
  final l = legs.first;
  return '${l.side == 'buy' ? 'long' : 'short'}_${l.right}';
}

/// Where the expiry P&L is above zero, in words a beginner reads.
class ProfitZone {
  const ProfitZone(this.kind, {this.at = 0, this.lo = 0, this.hi = 0, this.list = const []});

  /// above | below | between | outside | always | never | list
  final String kind;
  final double at, lo, hi;
  final List<double> list;
}

ProfitZone profitZone(List<PayLeg> legs, double usdPerUnit, List<double> breakevens, double ref) {
  final bes = breakevens.where((b) => b > 0 && b.isFinite).toList()..sort();
  final k = usdPerUnit > 0 ? usdPerUnit : 1.0;
  bool pos(double s) => payoffAt(legs, s, k) > 1e-9;
  if (bes.isEmpty) return pos(ref > 0 ? ref : 1) ? const ProfitZone('always') : const ProfitZone('never');
  double out(double b, int dir) => b * (1 + dir * 0.005);
  final segs = <bool>[pos(out(bes.first, -1))];
  for (var i = 1; i < bes.length; i++) {
    segs.add(pos((bes[i - 1] + bes[i]) / 2));
  }
  segs.add(pos(out(bes.last, 1)));
  if (bes.length == 1) {
    if (segs[1] && !segs[0]) return ProfitZone('above', at: bes[0]);
    if (segs[0] && !segs[1]) return ProfitZone('below', at: bes[0]);
  }
  if (bes.length == 2) {
    if (segs[1] && !segs[0] && !segs[2]) return ProfitZone('between', lo: bes[0], hi: bes[1]);
    if (!segs[1] && segs[0] && segs[2]) return ProfitZone('outside', lo: bes[0], hi: bes[1]);
  }
  return ProfitZone('list', list: bes);
}

/// Cash the legs pay at expiry if the underlying fixes at `s` (USD; + paid to the holder, − paid by them).
double expiryCash(List<({OptionRight right, double strike, String side, double contracts})> legs, double s, double usdPerUnit) {
  var v = 0.0;
  for (final l in legs) {
    v += _sgn(l.side) * l.contracts * usdPerUnit * math.max(0, l.right == 'call' ? s - l.strike : l.strike - s);
  }
  return v;
}

class PlainNumbers {
  const PlainNumbers({
    required this.net,
    required this.commission,
    required this.maxLoss,
    required this.maxProfit,
    required this.breakevens,
    required this.zone,
    required this.selling,
  });

  /// net premium in USD: + paid (debit), − received (credit)
  final double net, commission;
  final double? maxLoss, maxProfit;
  final List<double> breakevens;
  final ProfitZone zone;

  /// a short leg is open without a matching long leg
  final bool selling;
}

/// The plain numbers of a set of legs: engine figures (a preview) win when given.
PlainNumbers plainNumbers(List<PayLeg> legs, double usdPerUnit, double ref, {OptPreview? engine, double commissionEstimate = 0}) {
  final st = payoffStats(legs, usdPerUnit);
  final net = engine != null ? engine.netPremium : legs.fold<double>(0, (s, l) => s + _sgn(l.side) * l.premium * usdPerUnit * l.contracts);
  final commission = engine != null ? engine.commission : commissionEstimate;
  final maxLoss = engine != null ? engine.maxLoss : (st.maxLoss == null ? null : st.maxLoss! + commission);
  final maxProfit = engine != null ? engine.maxProfit : (st.maxProfit == null ? null : st.maxProfit! - commission);
  final breakevens = engine != null && engine.breakevens.isNotEmpty ? engine.breakevens : st.breakevens;
  return PlainNumbers(
    net: net,
    commission: commission,
    maxLoss: maxLoss,
    maxProfit: maxProfit,
    breakevens: breakevens,
    zone: profitZone(legs, usdPerUnit, breakevens, ref),
    selling: isSelling(legs),
  );
}

/// True when some sold contracts aren't covered by bought contracts of the same right.
bool isSelling(List<PayLeg> legs) {
  for (final r in const ['call', 'put']) {
    final sold = legs.where((l) => l.right == r && l.side == 'sell').fold<double>(0, (s, l) => s + l.contracts);
    final bought = legs.where((l) => l.right == r && l.side == 'buy').fold<double>(0, (s, l) => s + l.contracts);
    if (sold > bought) return true;
  }
  return false;
}

/// Breakeven of one option position: strike ± the premium per unit it was opened at.
double breakevenOf(OptionRight right, double strike, double premium) => right == 'call' ? strike + premium : strike - premium;

/// Commission estimate before the engine answers: per contract, capped at a % of the premium (the chain's terms; on
/// the order book the taker fee). USD.
double commissionOf(OptionChain? chain, List<PayLeg> legs, double usdU, {required bool book}) {
  if (chain == null) return 0;
  var c = 0.0;
  for (final l in legs) {
    final prem = l.premium * usdU * l.contracts;
    if (book) {
      final fee = (chain.book?.takerFeePerContract ?? 0).abs();
      final cap = chain.book?.feeCapPct;
      c += cap != null ? math.min(fee * l.contracts, (cap / 100) * prem) : fee * l.contracts;
    } else {
      c += math.min(chain.commissionPerContract * l.contracts, (chain.commissionCapPct / 100) * prem);
    }
  }
  return c;
}
