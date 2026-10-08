// Kalks FX Options pricing maths (port of packages/mock/src/options.ts: the generalized Black-Scholes-Merton pricer with
// cost of carry, the smile from ATM + 25-delta RR / BF, the business-time vol clock, series codes, New York cuts and the
// scenario margin). The terminal uses it for the strategy builder's "today" curve, the client-side preview estimate and
// the analytics; the preview server prices its sample chains with it. Pure: no Flutter.
import 'dart:math' as math;

/// call | put
typedef OptionRight = String;

/// gk | bs | black76
class OptionSpec {
  const OptionSpec({
    required this.symbol,
    required this.name,
    required this.assetClass,
    required this.model,
    required this.baseCcy,
    required this.quoteCcy,
    required this.contractSize,
    required this.contractUnit,
    required this.digits,
    required this.pipSize,
    required this.strikeStep,
    required this.priceScan,
    required this.volScan,
    required this.enabled,
    required this.atm,
    required this.skew,
  });

  final String symbol, name, assetClass, model, baseCcy, quoteCcy, contractUnit;
  final double contractSize;
  final int digits;
  final double pipSize, strikeStep, priceScan, volScan;
  final bool enabled;

  /// ATM vols ON, 1W, 2W, 1M, 2M, 3M
  final List<double> atm;

  /// RR25, BF25, RR10, BF10
  final List<double> skew;
}

const _fx = 'forex';

/// Every underlying of Kalks FX Options (services/options/src/seed.rs); NZDUSD is seeded off ("soon").
const List<OptionSpec> optionUnderlyings = [
  OptionSpec(
    symbol: 'EURUSD',
    name: 'Euro / US Dollar',
    assetClass: _fx,
    model: 'gk',
    baseCcy: 'EUR',
    quoteCcy: 'USD',
    contractSize: 10000,
    contractUnit: 'EUR',
    digits: 5,
    pipSize: 0.0001,
    strikeStep: 0.0025,
    priceScan: 0.03,
    volScan: 0.03,
    enabled: true,
    atm: [0.062, 0.066, 0.068, 0.07, 0.072, 0.073],
    skew: [0.002, 0.0015, 0.004, 0.005],
  ),
  OptionSpec(
    symbol: 'GBPUSD',
    name: 'British Pound / US Dollar',
    assetClass: _fx,
    model: 'gk',
    baseCcy: 'GBP',
    quoteCcy: 'USD',
    contractSize: 10000,
    contractUnit: 'GBP',
    digits: 5,
    pipSize: 0.0001,
    strikeStep: 0.0025,
    priceScan: 0.03,
    volScan: 0.03,
    enabled: true,
    atm: [0.068, 0.072, 0.074, 0.076, 0.078, 0.079],
    skew: [-0.003, 0.0018, -0.006, 0.006],
  ),
  OptionSpec(
    symbol: 'USDJPY',
    name: 'US Dollar / Japanese Yen',
    assetClass: _fx,
    model: 'gk',
    baseCcy: 'USD',
    quoteCcy: 'JPY',
    contractSize: 10000,
    contractUnit: 'USD',
    digits: 3,
    pipSize: 0.01,
    strikeStep: 0.5,
    priceScan: 0.04,
    volScan: 0.035,
    enabled: true,
    atm: [0.095, 0.098, 0.1, 0.102, 0.104, 0.105],
    skew: [-0.01, 0.003, -0.02, 0.011],
  ),
  OptionSpec(
    symbol: 'AUDUSD',
    name: 'Australian Dollar / US Dollar',
    assetClass: _fx,
    model: 'gk',
    baseCcy: 'AUD',
    quoteCcy: 'USD',
    contractSize: 10000,
    contractUnit: 'AUD',
    digits: 5,
    pipSize: 0.0001,
    strikeStep: 0.0025,
    priceScan: 0.035,
    volScan: 0.035,
    enabled: true,
    atm: [0.082, 0.086, 0.088, 0.09, 0.092, 0.093],
    skew: [-0.008, 0.0025, -0.015, 0.009],
  ),
  OptionSpec(
    symbol: 'USDCAD',
    name: 'US Dollar / Canadian Dollar',
    assetClass: _fx,
    model: 'gk',
    baseCcy: 'USD',
    quoteCcy: 'CAD',
    contractSize: 10000,
    contractUnit: 'USD',
    digits: 5,
    pipSize: 0.0001,
    strikeStep: 0.0025,
    priceScan: 0.025,
    volScan: 0.03,
    enabled: true,
    atm: [0.05, 0.053, 0.055, 0.056, 0.058, 0.059],
    skew: [0.004, 0.0015, 0.008, 0.005],
  ),
  OptionSpec(
    symbol: 'USDCHF',
    name: 'US Dollar / Swiss Franc',
    assetClass: _fx,
    model: 'gk',
    baseCcy: 'USD',
    quoteCcy: 'CHF',
    contractSize: 10000,
    contractUnit: 'USD',
    digits: 5,
    pipSize: 0.0001,
    strikeStep: 0.0025,
    priceScan: 0.035,
    volScan: 0.035,
    enabled: true,
    atm: [0.068, 0.071, 0.073, 0.075, 0.077, 0.078],
    skew: [-0.004, 0.002, -0.008, 0.007],
  ),
  OptionSpec(
    symbol: 'NZDUSD',
    name: 'New Zealand Dollar / US Dollar',
    assetClass: _fx,
    model: 'gk',
    baseCcy: 'NZD',
    quoteCcy: 'USD',
    contractSize: 10000,
    contractUnit: 'NZD',
    digits: 5,
    pipSize: 0.0001,
    strikeStep: 0.0025,
    priceScan: 0.035,
    volScan: 0.035,
    enabled: false,
    atm: [0.088, 0.091, 0.093, 0.095, 0.097, 0.098],
    skew: [-0.008, 0.0025, -0.015, 0.009],
  ),
  OptionSpec(
    symbol: 'EURJPY',
    name: 'Euro / Japanese Yen',
    assetClass: _fx,
    model: 'gk',
    baseCcy: 'EUR',
    quoteCcy: 'JPY',
    contractSize: 10000,
    contractUnit: 'EUR',
    digits: 3,
    pipSize: 0.01,
    strikeStep: 0.5,
    priceScan: 0.04,
    volScan: 0.035,
    enabled: true,
    atm: [0.088, 0.092, 0.094, 0.096, 0.098, 0.099],
    skew: [-0.012, 0.003, -0.024, 0.012],
  ),
  OptionSpec(
    symbol: 'GBPJPY',
    name: 'British Pound / Japanese Yen',
    assetClass: _fx,
    model: 'gk',
    baseCcy: 'GBP',
    quoteCcy: 'JPY',
    contractSize: 10000,
    contractUnit: 'GBP',
    digits: 3,
    pipSize: 0.01,
    strikeStep: 0.5,
    priceScan: 0.045,
    volScan: 0.04,
    enabled: true,
    atm: [0.098, 0.102, 0.104, 0.106, 0.108, 0.109],
    skew: [-0.014, 0.0035, -0.027, 0.013],
  ),
  OptionSpec(
    symbol: 'XAUUSD',
    name: 'Gold / US Dollar',
    assetClass: 'metals',
    model: 'bs',
    baseCcy: 'XAU',
    quoteCcy: 'USD',
    contractSize: 1,
    contractUnit: 'oz',
    digits: 2,
    pipSize: 0.01,
    strikeStep: 25,
    priceScan: 0.05,
    volScan: 0.05,
    enabled: true,
    atm: [0.17, 0.18, 0.185, 0.19, 0.195, 0.2],
    skew: [0.015, 0.004, 0.03, 0.015],
  ),
  OptionSpec(
    symbol: 'XAGUSD',
    name: 'Silver / US Dollar',
    assetClass: 'metals',
    model: 'bs',
    baseCcy: 'XAG',
    quoteCcy: 'USD',
    contractSize: 50,
    contractUnit: 'oz',
    digits: 3,
    pipSize: 0.001,
    strikeStep: 0.5,
    priceScan: 0.08,
    volScan: 0.06,
    enabled: true,
    atm: [0.28, 0.3, 0.31, 0.32, 0.325, 0.33],
    skew: [0.02, 0.008, 0.04, 0.025],
  ),
  OptionSpec(
    symbol: 'USOIL',
    name: 'WTI Crude Oil',
    assetClass: 'energies',
    model: 'black76',
    baseCcy: 'OIL',
    quoteCcy: 'USD',
    contractSize: 10,
    contractUnit: 'bbl',
    digits: 2,
    pipSize: 0.01,
    strikeStep: 0.5,
    priceScan: 0.1,
    volScan: 0.08,
    enabled: true,
    atm: [0.3, 0.32, 0.33, 0.34, 0.345, 0.35],
    skew: [-0.01, 0.008, -0.02, 0.025],
  ),
  OptionSpec(
    symbol: 'UKOIL',
    name: 'Brent Crude Oil',
    assetClass: 'energies',
    model: 'black76',
    baseCcy: 'OIL',
    quoteCcy: 'USD',
    contractSize: 10,
    contractUnit: 'bbl',
    digits: 2,
    pipSize: 0.01,
    strikeStep: 0.5,
    priceScan: 0.1,
    volScan: 0.08,
    enabled: true,
    atm: [0.28, 0.3, 0.31, 0.32, 0.325, 0.33],
    skew: [-0.01, 0.008, -0.02, 0.025],
  ),
];

final Map<String, OptionSpec> optionSpecs = {for (final u in optionUnderlyings) u.symbol: u};

/// Annual decimals per currency: policy rates, metal lease rates (seed values).
const Map<String, double> optionRates = {
  'USD': 0.03625,
  'EUR': 0.02,
  'GBP': 0.0375,
  'JPY': 0.0075,
  'CHF': 0,
  'CAD': 0.0225,
  'AUD': 0.036,
  'NZD': 0.0225,
  'XAU': 0.005,
  'XAG': 0.01,
};

/// Group defaults (`*` row of group_settings).
abstract final class OptionDefaults {
  static const double volSpread = 0.004, minSpreadUsd = 0.5, commissionPerContract = 0.25, commissionCapPct = 10;
  static const int minContracts = 1, maxContracts = 100, contractStep = 1, noOpenMinutes = 15, closeOnlyMinutes = 1, twapMinutes = 30;
}

/// §2 defaults of the order book fields and the client fee schedule (maker rebate, taker fee).
abstract final class BookDefaults {
  static const double marketBandPct = 10, limitBandPct = 50, makerFeePerContract = -0.05, takerFeePerContract = 0.25, feeCapPct = 10;
  static const int bandMinTicks = 5, rfqQuoteTtlSecs = 5;
}

const List<int> _tenorDays = [1, 7, 14, 30, 61, 91];
const List<double> _skewScale = [0.8, 0.9, 0.95, 1, 1, 1];
const double _yearMs = 365 * 86400000.0;
const double _dayMs = 86400000.0;

/* ---------------- normal distribution ---------------- */

double normPdf(double x) => 0.3989422804014327 * math.exp(-0.5 * x * x);

double normCdf(double x) {
  final z = x.abs();
  double c;
  if (z > 37) {
    c = 0;
  } else {
    final e = math.exp(-0.5 * z * z);
    if (z < 7.07106781186547) {
      var n = 0.0352624965998911 * z + 0.700383064443688;
      n = n * z + 6.37396220353165;
      n = n * z + 33.912866078383;
      n = n * z + 112.079291497871;
      n = n * z + 221.213596169931;
      n = n * z + 220.206867912376;
      var d = 0.0883883476483184 * z + 1.75566716318264;
      d = d * z + 16.064177579207;
      d = d * z + 86.7807322029461;
      d = d * z + 296.564248779674;
      d = d * z + 637.333633378831;
      d = d * z + 793.826512519948;
      d = d * z + 440.413735824752;
      c = (e * n) / d;
    } else {
      var b = z + 0.65;
      b = z + 4 / b;
      b = z + 3 / b;
      b = z + 2 / b;
      b = z + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

/// Inverse of the standard normal CDF (Acklam's rational approximation).
double normInv(double p) {
  if (!(p > 0 && p < 1)) return p <= 0 ? double.negativeInfinity : double.infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    final q = math.sqrt(-2 * math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) {
    final q = math.sqrt(-2 * math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  final q = p - 0.5;
  final r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/* ---------------- generalized BSM ---------------- */

int _sign(OptionRight k) => k == 'call' ? 1 : -1;

/// Price of a European option: `s` spot (forward for b = 0), `k` strike, `t` years, `r` rate, `b` carry, `sigma` vol.
double bsmPrice(OptionRight kind, double s, double k, double t, double r, double b, double sigma) {
  if (!(s > 0 && k > 0 && t >= 0 && sigma >= 0)) return double.nan;
  final w = _sign(kind);
  final carry = math.exp((b - r) * t);
  final df = math.exp(-r * t);
  if (t == 0 || sigma == 0) return math.max(0, w * (s * carry - k * df));
  final v = sigma * math.sqrt(t);
  final d1 = (math.log(s / k) + (b + 0.5 * sigma * sigma) * t) / v;
  final d2 = d1 - v;
  return w * (s * carry * normCdf(w * d1) - k * df * normCdf(w * d2));
}

class Greeks {
  const Greeks({required this.price, required this.delta, required this.gamma, required this.vega, required this.theta});
  final double price, delta, gamma, vega, theta;
}

Greeks bsmGreeks(OptionRight kind, double s, double k, double t, double r, double b, double sigma) {
  final w = _sign(kind);
  final carry = math.exp((b - r) * t);
  final df = math.exp(-r * t);
  if (!(s > 0 && k > 0) || t <= 0 || sigma <= 0) {
    final intrinsic = w * (s * carry - k * df);
    return Greeks(price: math.max(0, intrinsic), delta: intrinsic > 0 ? w * carry : 0, gamma: 0, vega: 0, theta: 0);
  }
  final sq = math.sqrt(t);
  final v = sigma * sq;
  final d1 = (math.log(s / k) + (b + 0.5 * sigma * sigma) * t) / v;
  final d2 = d1 - v;
  final nd1 = normCdf(w * d1);
  final nd2 = normCdf(w * d2);
  final pdf1 = normPdf(d1);
  final fwdPv = s * carry;
  final strikePv = k * df;
  return Greeks(
    price: w * (fwdPv * nd1 - strikePv * nd2),
    delta: w * carry * nd1,
    gamma: (carry * pdf1) / (s * v),
    vega: fwdPv * pdf1 * sq,
    theta: (-fwdPv * pdf1 * sigma) / (2 * sq) - w * (b - r) * fwdPv * nd1 - w * r * strikePv * nd2,
  );
}

/// Carry of an underlying: GK `b = r_quote − r_base`, BS the same with the metal lease rate, Black-76 `b = 0`.
({double r, double b}) carryOf(OptionSpec spec) {
  final r = optionRates[spec.quoteCcy] ?? optionRates['USD']!;
  if (spec.model == 'black76') return (r: r, b: 0);
  return (r: r, b: r - (optionRates[spec.baseCcy] ?? 0));
}

/* ---------------- smile ---------------- */

class SmileQuotes {
  const SmileQuotes(this.atm, this.rr25, this.bf25);
  final double atm, rr25, bf25;
}

/// ATM / RR25 / BF25 at `days`: ATM interpolated in total variance, the skew linearly; flat beyond the pillars.
SmileQuotes quotesAt(OptionSpec spec, double days) {
  final d = math.max(days, 1 / 24);
  final pts = [
    for (var i = 0; i < _tenorDays.length; i++)
      (td: _tenorDays[i].toDouble(), atm: spec.atm[i], rr: spec.skew[0] * _skewScale[i], bf: spec.skew[1] * _skewScale[i]),
  ];
  if (d <= pts.first.td) return SmileQuotes(pts.first.atm, pts.first.rr, pts.first.bf);
  final last = pts.last;
  if (d >= last.td) return SmileQuotes(last.atm, last.rr, last.bf);
  var i = 1;
  while (pts[i].td < d) {
    i++;
  }
  final a = pts[i - 1];
  final b = pts[i];
  final k = (d - a.td) / (b.td - a.td);
  final va = a.atm * a.atm * a.td;
  final vb = b.atm * b.atm * b.td;
  return SmileQuotes(math.sqrt((va + (vb - va) * k) / d), a.rr + (b.rr - a.rr) * k, a.bf + (b.bf - a.bf) * k);
}

/// Vol at a call delta (Malz): σ(Δ) = ATM − 2·RR·(Δ − ½) + 16·BF·(Δ − ½)².
double smileAtDelta(SmileQuotes q, double callDelta) {
  final x = callDelta.clamp(0.01, 0.99) - 0.5;
  return math.max(0.01, q.atm - 2 * q.rr25 * x + 16 * q.bf25 * x * x);
}

/* ---------------- clocks and context ---------------- */

const double _weekendWeight = 0.15;
const double _avgWeight = (5 + 2 * _weekendWeight) / 7;

/// Business-time years to the cut: weekend hours (UTC Saturday and Sunday) count 15 %, normalised so a full week equals
/// a calendar week.
double volYears(double nowMs, double cutMs) {
  if (cutMs <= nowMs) return 0;
  var hours = 0.0;
  var t = nowMs;
  while (t < cutMs) {
    final end = math.min(cutMs, ((t / _dayMs).floor() + 1) * _dayMs);
    final day = DateTime.fromMillisecondsSinceEpoch(t.floor(), isUtc: true).weekday;
    hours += ((end - t) / 3600000) * (day == DateTime.saturday || day == DateTime.sunday ? _weekendWeight : 1);
    t = end;
  }
  return (hours / 24 / _avgWeight) / 365;
}

class PricingContext {
  const PricingContext({
    required this.spec,
    required this.spot,
    required this.tCal,
    required this.tVol,
    required this.tCal1d,
    required this.tVol1d,
    required this.r,
    required this.b,
    required this.quotes,
    required this.usdPerQuote,
    required this.usdPerUnit,
  });
  final OptionSpec spec;
  final double spot, tCal, tVol, tCal1d, tVol1d, r, b;
  final SmileQuotes quotes;
  final double usdPerQuote;

  /// usdPerQuote × contractSize: premium per unit → USD per contract
  final double usdPerUnit;

  PricingContext withUsdPerUnit(double v) => PricingContext(
    spec: spec,
    spot: spot,
    tCal: tCal,
    tVol: tVol,
    tCal1d: tCal1d,
    tVol1d: tVol1d,
    r: r,
    b: b,
    quotes: quotes,
    usdPerQuote: usdPerQuote,
    usdPerUnit: v,
  );
}

PricingContext pricingContext(OptionSpec spec, double spot, double cutAtMs, double nowMs, double usdPerQuote) {
  final c = carryOf(spec);
  final later = nowMs + _dayMs;
  return PricingContext(
    spec: spec,
    spot: spot,
    tCal: math.max(0, (cutAtMs - nowMs) / _yearMs),
    tVol: volYears(nowMs, cutAtMs),
    tCal1d: math.max(0, (cutAtMs - later) / _yearMs),
    tVol1d: volYears(later, cutAtMs),
    r: c.r,
    b: c.b,
    quotes: quotesAt(spec, (cutAtMs - nowMs) / _dayMs),
    usdPerQuote: usdPerQuote,
    usdPerUnit: usdPerQuote * spec.contractSize,
  );
}

/// The effective vol on the calendar clock for a business-time vol.
double effectiveVol(double sigma, double tVol, double tCal) => tCal <= 0 || tVol <= 0 ? 0 : sigma * math.sqrt(tVol / tCal);

/// Smile vol at a strike: a fixed point on the call delta.
double volAtStrike(PricingContext ctx, double k) {
  var sigma = ctx.quotes.atm;
  if (ctx.tVol <= 0) return sigma;
  for (var i = 0; i < 3; i++) {
    final v = sigma * math.sqrt(ctx.tVol);
    final d1 = (math.log(ctx.spot / k) + (ctx.b + 0.5 * sigma * sigma) * ctx.tVol) / v;
    sigma = smileAtDelta(ctx.quotes, math.exp((ctx.b - ctx.r) * ctx.tVol) * normCdf(d1));
  }
  return sigma;
}

/// ATM strike: the forward.
double forwardOf(PricingContext ctx) => ctx.spot * math.exp(ctx.b * ctx.tCal);

/// Model value per unit of a leg at spot `s`, `tCal` years before the cut, with vol `sigma` (business-time adjusted).
double legValue(OptionRight kind, double s, double k, double tCal, double tVol, double r, double b, double sigma) {
  if (tCal <= 0 || tVol <= 0) return math.max(0, _sign(kind) * (s - k));
  return bsmPrice(kind, s, k, tCal, r, b, effectiveVol(sigma, tVol, tCal));
}

/// Strike at a forward call delta N(d1) for a vol: K = F·exp(−N⁻¹(Δ)·σ√t + ½σ²t).
double strikeAtCallDelta(double forward, double callDelta, double vol, double years) {
  if (!(forward > 0) || !(callDelta > 0 && callDelta < 1) || !(vol > 0) || !(years > 0)) return double.nan;
  final v = vol * math.sqrt(years);
  return forward * math.exp(-normInv(callDelta) * v + 0.5 * v * v);
}

/* ---------------- series codes, strikes, cuts ---------------- */

/// Decimals of a strike step (0.0025 → 4, 0.5 → 1, 25 → 0).
int stepDecimals(double step) {
  for (var d = 0; d <= 8; d++) {
    final p = math.pow(10, d);
    if (((step * p).round() - step * p).abs() < 1e-9) return d;
  }
  return 8;
}

String strikeLabelFor(double strike, double step) => strike.toStringAsFixed(stepDecimals(step));

/// `EURUSD-20261009-1.1650-C`
String seriesCode(String symbol, String date, double strike, OptionRight right, double step) =>
    '$symbol-${date.replaceAll('-', '')}-${strikeLabelFor(strike, step)}-${right == 'call' ? 'C' : 'P'}';

class SeriesParts {
  const SeriesParts({required this.underlying, required this.date, required this.strike, required this.strikeLabel, required this.right});
  final String underlying;

  /// YYYY-MM-DD
  final String date;
  final double strike;
  final String strikeLabel;
  final OptionRight right;
}

final RegExp _seriesRe = RegExp(r'^([A-Z0-9]{3,12})-(\d{4})(\d{2})(\d{2})-([0-9]+(?:\.[0-9]+)?)-([CP])$');

/// `EURUSD-20261009-1.1650-C` → parts (null for anything else).
SeriesParts? parseSeriesCode(String? code) {
  if (code == null) return null;
  final m = _seriesRe.firstMatch(code);
  if (m == null) return null;
  return SeriesParts(underlying: m[1]!, date: '${m[2]}-${m[3]}-${m[4]}', strike: double.parse(m[5]!), strikeLabel: m[5]!, right: m[6] == 'C' ? 'call' : 'put');
}

/// A barrier series carries a suffix after C / P: the first four parts name the option.
SeriesParts? parseSeriesBase(String code) => parseSeriesCode(code.split('-').take(4).join('-'));

/// New York UTC offset in minutes at a UTC instant (US DST).
int newYorkOffset(int ms) {
  final y = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true).year;
  int nthSunday(int month, int n) {
    final d = DateTime.utc(y, month);
    final first = (7 - d.weekday % 7) % 7;
    return DateTime.utc(y, month, 1 + first + (n - 1) * 7).millisecondsSinceEpoch;
  }

  final start = nthSunday(3, 2) + 7 * 3600000;
  final end = nthSunday(11, 1) + 6 * 3600000;
  return ms >= start && ms < end ? -240 : -300;
}

/// 10:00 New York on `date` (YYYY-MM-DD) as a UTC instant (ms).
int cutInstant(String date, {int hh = 10, int mm = 0}) {
  final p = date.split('-').map(int.parse).toList();
  final guess = DateTime.utc(p[0], p[1], p[2], hh, mm).millisecondsSinceEpoch;
  return guess - newYorkOffset(guess + 5 * 3600000) * 60000;
}

/// Dealing state of an expiry: close_only in the last minutes before the cut, closed after it.
String tradeState(int cutMs, int nowMs) {
  final left = cutMs - nowMs;
  if (left <= OptionDefaults.closeOnlyMinutes * 60000) return 'closed';
  if (left <= OptionDefaults.noOpenMinutes * 60000) return 'close_only';
  return 'open';
}

/// Premium tick (quote currency per unit): FX pip / 10, XAU 0.01, metals and oil 0.001.
double defaultPremiumTick(OptionSpec spec) {
  if (spec.symbol == 'XAUUSD') return 0.01;
  if (spec.assetClass == 'energies' || spec.assetClass == 'metals') return 0.001;
  return double.parse((spec.pipSize / 10).toStringAsPrecision(6));
}

/* ---------------- scenario margin ---------------- */

class MarginLeg {
  const MarginLeg({required this.right, required this.strike, required this.qty, required this.iv});
  final OptionRight right;
  final double strike;

  /// + long, − short (contracts)
  final double qty;
  final double iv;
}

/// Worst loss of a set of legs on one underlying over a 16-scenario grid, one business day ahead (USD). Long-only books
/// have no margin.
double scenarioMargin(PricingContext ctx, List<MarginLeg> legs) {
  if (!legs.any((l) => l.qty < 0)) return 0;
  final spec = ctx.spec;
  final t1 = math.max(0.0, ctx.tCal - 1 / 365);
  final v1 = math.max(0.0, ctx.tVol - 1 / 365);
  double value(double s, double dv, double tc, double tv) =>
      legs.fold(0, (sum, l) => sum + l.qty * legValue(l.right, s, l.strike, tc, tv, ctx.r, ctx.b, math.max(0.005, l.iv + dv)));
  final base = value(ctx.spot, 0, ctx.tCal, ctx.tVol);
  var worst = 0.0;
  for (final m in [0.0, 1 / 3, -1 / 3, 2 / 3, -2 / 3, 1.0, -1.0]) {
    for (final dv in [spec.volScan, -spec.volScan]) {
      worst = math.max(worst, base - value(ctx.spot * (1 + m * spec.priceScan), dv, t1, v1));
    }
  }
  for (final m in [3.0, -3.0]) {
    worst = math.max(worst, 0.35 * (base - value(ctx.spot * (1 + m * spec.priceScan), 0, t1, v1)));
  }
  return worst * ctx.usdPerUnit;
}

/* ---------------- one series in the service's shape (previews) ---------------- */

double roundTo(double x, int d) {
  if (!x.isFinite) return 0;
  final p = math.pow(10, d);
  return (x * p).round() / p;
}

double _sigRound(double x, int digits) {
  if (x == 0 || !x.isFinite) return 0;
  final mag = (math.log(x.abs()) / math.ln10).floor();
  return roundTo(x, (digits - 1 - mag).clamp(0, 12));
}

/// A quote of one series as the options service prices it (services/options/src/pricing.rs), as wire JSON.
Map<String, dynamic> quoteSeriesJson(PricingContext ctx, OptionRight kind, double k, String code, String state) {
  final spec = ctx.spec;
  final sig = volAtStrike(ctx, k);
  final alive = ctx.tVol > 0 && ctx.tCal > 0;
  final intrinsic = math.max(0.0, _sign(kind) * (ctx.spot - k));
  final mark = alive ? bsmPrice(kind, ctx.spot, k, ctx.tCal, ctx.r, ctx.b, effectiveVol(sig, ctx.tVol, ctx.tCal)) : intrinsic;
  final usd = ctx.usdPerUnit;
  final minUnit = usd > 0 ? OptionDefaults.minSpreadUsd / usd : 0.0;
  var bid = mark, ask = mark, ivBid = sig, ivAsk = sig;
  if (alive) {
    final kf = math.sqrt(ctx.tVol / ctx.tCal);
    ivBid = math.max(math.max(0.001, 0.25 * sig), sig - OptionDefaults.volSpread);
    ivAsk = sig + OptionDefaults.volSpread;
    bid = bsmPrice(kind, ctx.spot, k, ctx.tCal, ctx.r, ctx.b, ivBid * kf);
    ask = bsmPrice(kind, ctx.spot, k, ctx.tCal, ctx.r, ctx.b, ivAsk * kf);
    if (ask - bid < minUnit) {
      bid = mark - 0.5 * minUnit;
      ask = mark + 0.5 * minUnit;
    }
  }
  if (bid < 0) {
    bid = 0;
    ask = math.max(ask, minUnit);
  }
  double delta, gamma = 0, vega = 0, probItm;
  if (alive) {
    final kf = math.sqrt(ctx.tVol / ctx.tCal);
    final se = sig * kf;
    final g = bsmGreeks(kind, ctx.spot, k, ctx.tCal, ctx.r, ctx.b, se);
    final d2 = (math.log(ctx.spot / k) + (ctx.b - 0.5 * se * se) * ctx.tCal) / (se * math.sqrt(ctx.tCal));
    delta = g.delta;
    gamma = g.gamma * ctx.spot * 0.01;
    vega = g.vega * kf * 0.01 * usd;
    probItm = normCdf(_sign(kind) * d2);
  } else {
    delta = intrinsic > 0 ? _sign(kind).toDouble() : 0;
    probItm = intrinsic > 0 ? 1 : 0;
  }
  final tomorrow = legValue(kind, ctx.spot, k, ctx.tCal1d, ctx.tVol1d, ctx.r, ctx.b, sig);
  final pd = spec.digits + 2;
  return {
    'code': code,
    'bid': roundTo(bid, pd),
    'ask': roundTo(ask, pd),
    'mark': roundTo(mark, pd),
    'bidUsd': roundTo(bid * usd, 2),
    'askUsd': roundTo(ask * usd, 2),
    'markUsd': roundTo(mark * usd, 2),
    'markPips': roundTo(mark / spec.pipSize, 1),
    'iv': roundTo(sig, 5),
    'ivBid': roundTo(ivBid, 5),
    'ivAsk': roundTo(ivAsk, 5),
    'delta': roundTo(delta, 4),
    'gamma': _sigRound(gamma, 4),
    'vega': roundTo(vega, 2),
    'theta': roundTo((tomorrow - mark) * usd, 2),
    'probItm': roundTo(probItm, 4),
    'breakeven': roundTo(kind == 'call' ? k + ask : k - ask, spec.digits),
    'state': state,
  };
}

/// Model premium per unit of the underlying at `spot`, `atMs` (the smile and vol clock of that moment).
double premiumAt(OptionSpec spec, OptionRight right, double strike, double spot, double atMs, double cutMs) {
  if (atMs >= cutMs) return math.max(0, _sign(right) * (spot - strike));
  final c = carryOf(spec);
  final tCal = (cutMs - atMs) / _yearMs;
  final tVol = volYears(atMs, cutMs);
  final ctx = PricingContext(
    spec: spec,
    spot: spot,
    tCal: tCal,
    tVol: tVol,
    tCal1d: 0,
    tVol1d: 0,
    r: c.r,
    b: c.b,
    quotes: quotesAt(spec, (cutMs - atMs) / _dayMs),
    usdPerQuote: 1,
    usdPerUnit: spec.contractSize,
  );
  return legValue(right, spot, strike, tCal, tVol, c.r, c.b, volAtStrike(ctx, strike));
}

/// Mark (§6): the model mid clamped inside the best bid / ask.
double clampMark(double model, double? bid, double? ask) {
  if (bid != null && ask != null && ask >= bid) return math.min(ask, math.max(bid, model));
  if (bid != null) return math.max(model, bid);
  if (ask != null) return math.min(model, ask);
  return model;
}
