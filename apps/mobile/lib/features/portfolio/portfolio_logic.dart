// Pure helpers of the Portfolio pages (ports of apps/crm/components/trading/activity.tsx, portfolio.tsx,
// option-deal.ts, instrument.tsx and components/reports/live-analytics.tsx): date ranges, analytics periods,
// statement periods and query strings, option premiums and labels, server-time labels. No widgets, so they are
// unit-tested in test/c1_portfolio_test.dart.
import 'dart:math' as math;

import 'package:intl/intl.dart';

import '../../core/format/format.dart';
import '../../core/models/account.dart';
import '../../core/models/trading.dart';
import '../../i18n/locales.dart';
import '../../i18n/t.dart';

/* ------------------------------------------------------------------ accounts */

/// "Pro · Hedging" (web accountTitle; the mode in the reader's language).
String accountTitle(T t, EngineAccount a) => '${a.groupName} · ${t.dyn('accounts.mode.${a.mode}', fallback: modeLabel(a.mode))}';

/// The account a picker page opens with (web useSelectedAccount): `?account=` (or `?login=`), else the first live
/// account that isn't archived, else any account that isn't archived, else the first. Archived accounts stay
/// selectable for their statements but are never the default.
EngineAccount? pickAccount(List<EngineAccount> accounts, int? wanted) {
  if (accounts.isEmpty) return null;
  for (final a in accounts) {
    if (a.login == wanted) return a;
  }
  for (final a in accounts) {
    if (a.live && !a.archived) return a;
  }
  for (final a in accounts) {
    if (!a.archived) return a;
  }
  return accounts.first;
}

/// The login asked for by the route (`?account=` like the web, `?login=` like the app's other links).
int? wantedLogin(Map<String, String> query) => int.tryParse(query['account'] ?? query['login'] ?? '');

/// Equity allocation of the live accounts with equity, in USD (web LivePortfolio `alloc`).
List<({int login, double usd})> allocation(AccountTotals totals) => [
  for (final a in totals.live)
    if (a.equity > 0) (login: a.login, usd: a.usd(a.equity)),
];

/* ------------------------------------------------------------------ history / ledger ranges */

/// The range presets of the history and ledger panels (web RangePicker).
enum RangePreset { d7, d30, d90, all, custom }

/// A chosen range: a preset, or custom days `from` / `to` (YYYY-MM-DD, both inclusive in the UI).
class ActivityRange {
  const ActivityRange(this.preset, {this.from, this.to});
  final RangePreset preset;
  final String? from, to;

  /// A custom range without both days, or with `from` after `to` (the web disables the list and the CSV).
  bool get invalid => preset == RangePreset.custom && (from == null || from!.isEmpty || to == null || to!.isEmpty || from!.compareTo(to!) > 0);

  ActivityRange copyWith({String? from, String? to}) => ActivityRange(preset, from: from ?? this.from, to: to ?? this.to);

  @override
  bool operator ==(Object other) => other is ActivityRange && other.preset == preset && other.from == from && other.to == to;

  @override
  int get hashCode => Object.hash(preset, from, to);
}

/// Choosing a preset (web RangePicker onChange): Custom starts from the last 30 days (or the previous custom days).
ActivityRange selectPreset(RangePreset p, ActivityRange current, {DateTime? now}) {
  if (p != RangePreset.custom) return ActivityRange(p);
  final today = now ?? DateTime.now();
  return ActivityRange(p, from: current.from ?? isoDay(today.subtract(const Duration(days: 29))), to: current.to ?? isoDay(today));
}

/// The day after `day` (the engine's `to` is exclusive; the UI's is inclusive).
String nextDay(String day) {
  final p = day.split('-').map(int.parse).toList();
  return isoDay(DateTime(p[0], p[1], p[2] + 1));
}

/// `from` / `to` query values of a range (web rangeQuery): presets send only `from` (today counts as a day).
({String? from, String? to}) rangeQuery(ActivityRange r, {DateTime? now}) {
  switch (r.preset) {
    case RangePreset.all:
      return (from: null, to: null);
    case RangePreset.custom:
      return (from: (r.from ?? '').isEmpty ? null : r.from, to: (r.to ?? '').isEmpty ? null : nextDay(r.to!));
    case RangePreset.d7:
    case RangePreset.d30:
    case RangePreset.d90:
      final days = r.preset == RangePreset.d7 ? 7 : (r.preset == RangePreset.d30 ? 30 : 90);
      final d = now ?? DateTime.now();
      return (from: isoDay(DateTime(d.year, d.month, d.day - days + 1)), to: null);
  }
}

/// Pages of a paged list (web Pager).
int pageCount(int total, int limit) => math.max(1, (total / math.max(1, limit)).ceil());

/// The period's net result of a history page: commission is a charge (positive in the engine), so it comes off.
double historyNet(HistoryPage p) => p.profit + p.swap - p.commission.abs();

/// The history query (web HistoryPanel path): range, page, limit 25, instrument unless All.
Map<String, Object?> historyQuery(ActivityRange r, int page, String instrument, {int limit = 25, DateTime? now}) {
  final q = rangeQuery(r, now: now);
  return {'from': q.from, 'to': q.to, 'page': page, 'limit': limit, if (instrument != 'all') 'instrument': instrument};
}

/// The ledger query (web LedgerPanel path).
Map<String, Object?> ledgerQuery(ActivityRange r, int page, {int limit = 25, DateTime? now}) {
  final q = rangeQuery(r, now: now);
  return {'from': q.from, 'to': q.to, 'page': page, 'limit': limit};
}

/// The CSV export query (web downloadExport): `kind`, the range, and the instrument for the history.
Map<String, Object?> exportQuery(String kind, ActivityRange r, {String instrument = 'all', DateTime? now}) {
  final q = rangeQuery(r, now: now);
  return {'kind': kind, 'from': q.from, 'to': q.to, if (kind == 'history' && instrument != 'all') 'instrument': instrument};
}

/* ------------------------------------------------------------------ analytics periods */

/// The analytics periods (web PERIODS) and their days.
enum AnPeriod {
  d7('7D', 7),
  d30('30D', 30),
  d90('90D', 90),
  y1('1Y', 365),
  all('ALL', 3650);

  const AnPeriod(this.key, this.days);
  final String key;
  final int days;
}

/// `from` (inclusive) and `to` (exclusive, tomorrow) of a period (web periodRange), in local days.
({String from, String to}) periodRange(AnPeriod p, {DateTime? now}) {
  final d = now ?? DateTime.now();
  return (from: isoDay(DateTime(d.year, d.month, d.day - p.days + 1)), to: isoDay(DateTime(d.year, d.month, d.day + 1)));
}

/// "All time" / "Last 12 months" / "Last 30 days" (web usePeriodLabel).
String periodLabel(T t, AnPeriod p) => switch (p) {
  AnPeriod.all => t('portfolio.an.period.allTime'),
  AnPeriod.y1 => t('portfolio.an.period.last12Months'),
  _ => t('portfolio.an.period.lastDays', {'count': p.days}),
};

/// A holding time: "2d 4h", "3h 12m", "45m", "30s", "—" (web fmtHold).
String fmtHold(T t, num secs) {
  if (secs == 0) return '—';
  final m = (secs / 60).round();
  if (m >= 1440) return t('portfolio.an.hold.dh', {'d': m ~/ 1440, 'h': (m % 1440) ~/ 60});
  if (m >= 60) return t('portfolio.an.hold.hm', {'h': m ~/ 60, 'm': m % 60});
  return m != 0 ? t('portfolio.an.hold.m', {'m': m}) : t('portfolio.an.hold.s', {'s': secs.round()});
}

/* ------------------------------------------------------------------ statements */

/// Statement periods (web StPeriod).
enum StPeriod { day, month, year, custom }

/// Statement formats in the web's order (ST_FORMATS: pdf, xlsx, csv).
enum StFormat {
  pdf('PDF', 'pdf'),
  xlsx('Excel', 'xlsx'),
  csv('CSV', 'csv');

  const StFormat(this.label, this.ext);

  /// The tile's name (the web writes these in English in every language).
  final String label;
  final String ext;
}

/// `day` plus `n` days, as UTC calendar days (web addDays).
String addDaysIso(String day, int n) {
  final p = day.split('-').map(int.parse).toList();
  final d = DateTime.utc(p[0], p[1], p[2] + n);
  return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

/// "September 2026" in the reader's language.
String monthLabel(String locale, int year, int month) => latinDigits(DateFormat.yMMMM(intlLocale(locale)).format(DateTime.utc(year, month)));

/// [from, to) in server days for the chosen period, with its label; null when the input is incomplete (web stRange).
({String from, String to, String label})? stRange(
  T t,
  StPeriod p, {
  required String day,
  required String month,
  required String year,
  required String from,
  required String to,
}) {
  switch (p) {
    case StPeriod.day:
      if (day.isEmpty) return null;
      final parts = day.split('-').map(int.parse).toList();
      final label = latinDigits(DateFormat.yMMMMd(intlLocale(t.locale)).format(DateTime.utc(parts[0], parts[1], parts[2])));
      return (from: day, to: addDaysIso(day, 1), label: label);
    case StPeriod.month:
      if (!RegExp(r'^\d{4}-\d{2}$').hasMatch(month)) return null;
      final y = int.parse(month.substring(0, 4)), m = int.parse(month.substring(5));
      final next = m == 12 ? '${y + 1}-01-01' : '$y-${(m + 1).toString().padLeft(2, '0')}-01';
      return (from: '$month-01', to: next, label: monthLabel(t.locale, y, m));
    case StPeriod.year:
      return (from: '$year-01-01', to: '${int.parse(year) + 1}-01-01', label: t('portfolio.st.yearLabel', {'year': year}));
    case StPeriod.custom:
      if (from.isEmpty || to.isEmpty || from.compareTo(to) > 0) return null;
      return (from: from, to: addDaysIso(to, 1), label: t('portfolio.st.rangeLabel', {'from': from, 'to': to}));
  }
}

/// `GET reports/accounts/{login}/statement` (web stUrl).
String statementPath(int login) => 'reports/accounts/$login/statement';

/// The statement's query (web stUrl): sections left out are sent as `=0`; without options every section is in.
Map<String, Object?> statementQuery(String from, String to, StFormat f, {bool open = true, bool charges = true, bool deals = true}) => {
  'from': from,
  'to': to,
  'format': f.ext,
  if (!open) 'open': '0',
  if (!charges) 'charges': '0',
  if (!deals) 'deals': '0',
};

/// The years a statement can cover: this year back to the account's opening year (web `years`).
List<String> statementYears(DateTime createdAt, {DateTime? now}) {
  final y = (now ?? DateTime.now()).year;
  final first = math.min(createdAt.year, y);
  return [for (var i = y; i >= first; i--) '$i'];
}

/* ------------------------------------------------------------------ Kalks FX Options in trade lists */

/// An option's readable terms (web OptionTerms).
class OptionTerms {
  const OptionTerms({
    required this.series,
    required this.underlying,
    required this.right,
    required this.strike,
    required this.strikeLabel,
    required this.expiry,
    this.quoteCurrency,
  });
  final String series, underlying, right, strikeLabel, expiry;
  final double strike;
  final String? quoteCurrency;
}

/// The quote currency of an underlying when the data doesn't say (EURUSD -> USD).
String? quoteOf(String underlying, String? given) {
  if (given != null && given.isNotEmpty) return given;
  return RegExp(r'^[A-Z]{6}$').hasMatch(underlying) ? underlying.substring(3) : null;
}

double? _num(Object? v) => v is num && v.isFinite ? v.toDouble() : null;

String _trimNum(double v) {
  final r = double.parse(v.toStringAsFixed(8));
  return r == r.truncateToDouble() ? '${r.toInt()}' : '$r';
}

/// The option's terms from its `option` object, falling back to the series code in `symbol` (web optionTerms).
OptionTerms? optionTerms(String symbol, Map<String, dynamic>? o) {
  final p = parseSeries(o?['series'] as String?) ?? parseSeries(symbol);
  final underlying = ('${o?['underlying'] ?? ''}'.isNotEmpty ? '${o!['underlying']}' : (p?.underlying ?? '')).toUpperCase();
  final r = '${o?['right'] ?? ''}'.toLowerCase();
  final right = r == 'call' || r == 'c' ? 'call' : (r == 'put' || r == 'p' ? 'put' : p?.right);
  final strike = _num(o?['strike']) ?? p?.strike;
  final rawExpiry = '${o?['expiry'] ?? ''}';
  final expiry = rawExpiry.isNotEmpty ? rawExpiry.substring(0, math.min(10, rawExpiry.length)) : p?.expiry;
  if (underlying.isEmpty || right == null || strike == null || expiry == null) return null;
  final strikeLabel = p != null && (p.strike - strike).abs() < 1e-9 ? p.strikeLabel : _trimNum(strike);
  final series = '${o?['series'] ?? ''}'.isNotEmpty ? '${o!['series']}' : (p?.series ?? symbol);
  return OptionTerms(
    series: series,
    underlying: underlying,
    right: right,
    strike: strike,
    strikeLabel: strikeLabel,
    expiry: expiry,
    quoteCurrency: quoteOf(underlying, o?['quoteCurrency'] as String?),
  );
}

/// Premiums of an option deal in USD per contract (web dealPremiumsUsd): `own` at this deal's price, `open` what
/// the closed contracts were opened at (exits only). Null when the data can't say.
({double? own, double? open}) dealPremiumsUsd(EngineDeal d, int usdFactor) {
  final o = d.option;
  final n = d.volume.abs();
  final k = usdFactor > 0 ? usdFactor : 1;
  final cs = _num(o?['contractSize']), upq = _num(o?['usdPerQuote']);
  final perUnitUsd = cs != null && upq != null && cs > 0 && upq > 0 ? cs * upq : null;
  final cash = _num(o?['cash']);
  double? own;
  if (perUnitUsd != null && d.price.isFinite) {
    own = d.price.abs() * perUnitUsd;
  } else if (cash != null && n > 0) {
    own = cash.abs() / n / k;
  }
  double? open;
  if (d.entry != 'in') {
    if (cash != null && n > 0 && d.profit.isFinite) {
      open = (d.profit - cash).abs() / n / k;
    } else if (perUnitUsd != null && d.openPrice != null) {
      open = d.openPrice!.abs() * perUnitUsd;
    }
  }
  return (own: own, open: open);
}

/// Open premium and value now of an option position, in USD per contract (web positionPremiumsUsd).
({double? open, double? now}) positionPremiumsUsd(EnginePosition p, int usdFactor) {
  final n = p.volume.abs();
  final k = usdFactor > 0 ? usdFactor : 1;
  return (open: n > 0 && p.premium != null ? p.premium!.abs() / n / k : null, now: n > 0 && p.markValue != null ? p.markValue!.abs() / n / k : null);
}

/// Contracts without grouping, up to 2 decimals (web fmtContracts).
String fmtContracts(num v) {
  final s = v.abs().toStringAsFixed(2);
  return s.contains('.') ? s.replaceFirst(RegExp(r'\.?0+$'), '') : s;
}

/// "2 Oct" (with the year when it isn't this year), in the reader's language (web expiryLabel).
String expiryLabel(String day, String locale, {DateTime? now}) {
  final d = DateTime.tryParse('${day.substring(0, math.min(10, day.length))}T00:00:00Z');
  if (d == null) return day;
  final tag = intlLocale(locale);
  final sameYear = d.year == (now ?? DateTime.now()).toUtc().year;
  return latinDigits((sameYear ? DateFormat.MMMd(tag) : DateFormat.yMMMd(tag)).format(d));
}

/// "EURUSD 1.1000 Call · 2 Oct" (web optionLabel).
String optionLabel(T t, OptionTerms o) => t('accounts.opt.label', {
  'underlying': o.underlying,
  'strike': o.strikeLabel,
  'right': t(o.right == 'call' ? 'accounts.opt.call' : 'accounts.opt.put'),
  'date': expiryLabel(o.expiry, t.locale),
});

/// Readable name of an engine symbol: the option label for a series code, the symbol itself otherwise.
String symbolLabel(T t, String symbol, [Map<String, dynamic>? option]) {
  final o = option != null || parseSeries(symbol) != null ? optionTerms(symbol, option) : null;
  return o == null ? symbol : optionLabel(t, o);
}

/// A deal's close reason (web reasonLabel): options read "Closed" for a client close.
String reasonLabel(T t, String reason) => t.dyn('accounts.reason.$reason', fallback: reason.replaceAll('_', ' '));

/* ------------------------------------------------------------------ server time */

/// "24 Sep 2026 14:03" in the trading server's time (GMT+3 / GMT+2), the reader's month names (web serverTime).
String serverTimeLabel(DateTime? t, String locale, {bool withYear = true}) {
  if (t == null) return '—';
  final tag = intlLocale(locale);
  final f = withYear ? DateFormat.yMMMd(tag).add_Hm() : DateFormat.MMMd(tag).add_Hm();
  return latinDigits(f.format(toTradingServerTime(t)));
}
