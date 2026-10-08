// Contract maths of Kalks Trader, the same formulas as the engine (services/trading/src/engine/mod.rs symbol_margin,
// pnl) and the web terminal (apps/terminal/lib/trading.ts): USD internally, USC shown on cent accounts.
import '../../../core/format/format.dart';
import '../../../i18n/t.dart';
import 'models.dart';

/// The bid of another symbol, for currency conversions (USDJPY to value JPY amounts). Null when unknown.
typedef BidOf = double? Function(String symbol);

/// USD per one unit of `ccy` (the quote currency of `symbol`, priced at `price`): 1 for USD; 1 / USDJPY for JPY
/// (using `price` itself when the symbol is USDJPY); EUR via EURUSD … (engine env.to_usd, web quoteToUsd).
double usdPerQuote(String ccy, {required String symbol, required double price, BidOf? bidOf}) {
  final c = ccy.toUpperCase();
  if (c == 'USD' || c == 'USC' || c.isEmpty) return 1;
  if (symbol.toUpperCase() == 'USD$c' && price > 0) return 1 / price;
  final usdX = bidOf?.call('USD$c');
  if (usdX != null && usdX > 0) return 1 / usdX;
  final xUsd = bidOf?.call('${c}USD');
  if (xUsd != null && xUsd > 0) return xUsd;
  // unknown cross: treat the price as the conversion when the symbol is X/USD-like, else 1
  return 1;
}

/// USD value of one pip for 1.00 lot.
double pipValuePerLot(SymbolSpec s, double price, {BidOf? bidOf}) =>
    s.pipSize * s.contractSize * usdPerQuote(s.profitCurrency, symbol: s.symbol, price: price, bidOf: bidOf);

/// The leverage a symbol trades at: the account's, capped by the symbol's maximum.
int effectiveLeverage(SymbolSpec s, int accountLeverage) {
  final l = accountLeverage < s.maxLeverage ? accountLeverage : s.maxLeverage;
  return l < 1 ? 1 : l;
}

/// USD margin for `lots` at `price` (engine symbol_margin, net position; hedged margin is the engine's business).
double marginRequired(SymbolSpec s, double lots, double price, int leverage, {BidOf? bidOf}) {
  final perLotQuote = s.contractSize * price;
  final perLotUsd = perLotQuote * usdPerQuote(s.profitCurrency, symbol: s.symbol, price: price, bidOf: bidOf);
  return perLotUsd * s.marginPct / 100 / effectiveLeverage(s, leverage) * lots;
}

/// Gross P&L (USD, no swap / commission) of `lots` opened at `open` if closed at `close`.
double profitAt(SymbolSpec s, {required String side, required double lots, required double open, required double close, BidOf? bidOf}) {
  final diff = side == 'buy' ? close - open : open - close;
  return diff * lots * s.contractSize * usdPerQuote(s.profitCurrency, symbol: s.symbol, price: close, bidOf: bidOf);
}

/// Floating P&L (USD) of a position at the current bid / ask, swap and commission included (web profitUsd).
double positionProfit(SymbolSpec s, TPosition p, double bid, double ask, {BidOf? bidOf}) {
  final close = p.buy ? bid : ask;
  return profitAt(s, side: p.side, lots: p.volume, open: p.openPrice, close: close, bidOf: bidOf) + p.swap - p.commission;
}

/// Price with the symbol's digits, no grouping (web fmtPrice).
String fmtPrice(int digits, double v) => v.toStringAsFixed(digits < 0 ? 0 : digits);

/// Lots with two decimals (web fmtVol).
String fmtVol(double v) => v.toStringAsFixed(2);

/// Rounds a price to the symbol's digits.
double roundPrice(int digits, double v) => double.parse(v.toStringAsFixed(digits));

/// Account money: USD internally, shown in USC on cent accounts (web accMoney): "1,234.50", "-12.00", "+3.40".
String accMoney(bool cent, double usd, {bool signed = false, int decimals = 2}) {
  final v = cent ? usd * 100 : usd;
  final s = Fmt.number(v.abs(), decimals);
  final zero = double.parse(v.abs().toStringAsFixed(decimals)) == 0;
  final sign = v < 0 && !zero ? '-' : (signed && v > 0 && !zero ? '+' : '');
  return '$sign$s';
}

/// "USC" on cent accounts, else "USD" (web accCcy).
String accCcy(bool cent) => cent ? 'USC' : 'USD';

/// Margin level state against the account's levels: stopout <= stop out, call <= margin call, low < 2 x call.
String marginState(double level, TAccount a) {
  if (!level.isFinite) return 'ok';
  if (level <= a.stopOutLevel) return 'stopout';
  if (level <= a.marginCallLevel) return 'call';
  if (level < a.marginCallLevel * 2) return 'low';
  return 'ok';
}

/// The volume rounded to the symbol's step and clamped to its limits (and the broker's max lot).
double normalizeVolume(SymbolSpec s, double v, {double? maxLot}) {
  final step = s.lotStep > 0 ? s.lotStep : 0.01;
  final stepped = (v / step).roundToDouble() * step;
  var max = s.lotMax;
  if (maxLot != null && maxLot > 0 && maxLot < max) max = maxLot;
  final clamped = stepped.clamp(s.lotMin, max);
  return double.parse(clamped.toStringAsFixed(_decimalsOf(step)));
}

int _decimalsOf(double step) {
  var d = 0;
  var x = step;
  while (d < 8 && (x - x.roundToDouble()).abs() > 1e-9) {
    x *= 10;
    d++;
  }
  return d < 2 ? 2 : d;
}

/// Spread in points.
int spreadPoints(SymbolSpec s, double bid, double ask) => ((ask - bid) / s.point).round();

/// The price step of price inputs (a tenth of a pip, at least one point; web priceStep).
double priceStep(SymbolSpec s) => s.pipSize / 10 >= s.point ? s.pipSize / 10 : s.point;

/// A swap rate as shown to traders: "−20.00% / year" or "−7.20 pts" (a real minus sign).
String swapRateText(T t, double v, String unit) {
  final n = '${v < 0 ? '−' : (v > 0 ? '+' : '')}${v.abs().toStringAsFixed(2)}';
  return unit == 'percent_per_year' ? t('desk.sw.pctYear', {'n': n}) : t('order.unit.pts', {'n': n});
}

/// "Long −20.00% / year · Short −20.00% / year (charged nightly)" (order summary).
String swapSummary(T t, SymbolSpec s) {
  final day = s.tripleSwapDay;
  final when = day == null ? t('desk.sw.nightly') : t('desk.sw.triple', {'day': t.dyn('order.info.tripleSwapDay.$day', fallback: day)});
  return t('desk.sw.summary', {'long': swapRateText(t, s.swapLong, s.swapUnit), 'short': swapRateText(t, s.swapShort, s.swapUnit), 'when': when});
}

/// Unit of the contract size for the order summary ("EUR", "oz", "bbl", "shares", "units").
String unitLabel(T t, SymbolSpec s) => switch (s.assetClass) {
  'forex' => s.baseCurrency,
  'metals' => t('order.unit.oz'),
  'energies' => t('order.unit.bbl'),
  'stocks' => t('order.unit.shares'),
  _ => t('order.unit.units'),
};

/// Broker server time (GMT+3 while US daylight saving is active, GMT+2 otherwise): the offset in seconds at `utc`.
int serverOffsetSeconds(DateTime utc) {
  final y = utc.toUtc().year;
  DateTime nthSunday(int month, int n) {
    final first = DateTime.utc(y, month);
    final firstSunday = 1 + (7 - first.weekday % 7) % 7;
    return DateTime.utc(y, month, firstSunday + (n - 1) * 7);
  }

  final start = nthSunday(3, 2).add(const Duration(hours: 7));
  final end = nthSunday(11, 1).add(const Duration(hours: 6));
  final t = utc.toUtc();
  return !t.isBefore(start) && t.isBefore(end) ? 3 * 3600 : 2 * 3600;
}

/// "2026.10.08 14:05:09" in server time, GMT+3 (web fmtServer / serverTime).
String fmtServer(DateTime d, {bool seconds = true}) {
  final s = d.toUtc().add(const Duration(hours: 3));
  String p(int n) => n.toString().padLeft(2, '0');
  final time = '${p(s.hour)}:${p(s.minute)}${seconds ? ':${p(s.second)}' : ''}';
  return '${s.year}.${p(s.month)}.${p(s.day)} $time';
}
