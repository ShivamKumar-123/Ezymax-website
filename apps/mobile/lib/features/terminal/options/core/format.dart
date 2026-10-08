// Number and date formatting of the options workspace (web: components/options/format.ts). Premiums are shown in USD
// per contract; strikes keep the ladder's own decimals; expiries are dated by their cut (10:00 New York), in UTC.
// Figures use en-US grouping and Latin digits in every language, like the rest of Ezymex Trader.
import 'package:intl/intl.dart';

import '../../../../core/format/format.dart';
import '../../../../i18n/i18n.dart';
import 'pricer.dart';

double _clean(double v, int d) {
  final r = double.parse(v.toStringAsFixed(d));
  return r == 0 ? 0 : r;
}

/// "1,234.56" (no sign).
String usd(double v, [int d = 2]) => v.isFinite ? Fmt.number(_clean(v, d), d) : '—';

/// "+4.29" / "−4.29".
String usdSigned(double v, [int d = 2]) {
  if (!v.isFinite) return '—';
  final r = _clean(v, d);
  return '${r > 0 ? '+' : (r < 0 ? '−' : '')}${usd(r.abs(), d)}';
}

/// "12.4%" of a ratio.
String pct(double? v, [int d = 1]) => v == null || !v.isFinite ? '—' : '${(v * 100).toStringAsFixed(d)}%';

/// "+12.4%" / "−3.0%" of a ratio.
String pctSigned(double? v, [int d = 1]) {
  if (v == null || !v.isFinite) return '—';
  final r = _clean(v * 100, d);
  return '${r > 0 ? '+' : (r < 0 ? '−' : '')}${r.abs().toStringAsFixed(d)}%';
}

/// "$1,234.56" ("−$4.00" below zero).
String money(double v, [int d = 2]) {
  if (!v.isFinite) return '—';
  final r = _clean(v, d);
  return '${r < 0 ? '−' : ''}\$${usd(r.abs(), d)}';
}

/// "+$12.30" / "−$4.00" / "$0.00".
String moneySigned(double v, [int d = 2]) {
  if (!v.isFinite) return '—';
  final r = _clean(v, d);
  return '${r > 0 ? '+' : (r < 0 ? '−' : '')}\$${usd(r.abs(), d)}';
}

/// A price of the underlying with its digits (strikes, breakevens, spot).
String px(double? v, int digits) => v == null || !v.isFinite ? '—' : v.toStringAsFixed(digits.clamp(0, 12));

String pips(double v) => v.isFinite ? Fmt.number(v, 1) : '—';

String greek(double? v, [int d = 3]) => v == null || !v.isFinite ? '—' : _clean(v, d).toStringAsFixed(d);

/// Change of an option's last price as a short label: in USD below a $0.50 base, capped at "> +999%".
String? lastChange(double? lastUsd, double? change) {
  if (lastUsd == null || lastUsd == 0 || change == null || !change.isFinite || change <= -1) return null;
  final base = lastUsd / (1 + change);
  if (base < 0.5) return usdSigned(lastUsd - base);
  final r = change * 100;
  return r > 999 ? '> +999%' : '${r >= 0 ? '+' : ''}${r.toStringAsFixed(1)}%';
}

/// Contracts / quantities: "1,250", "2.5".
String qty(double? n) {
  if (n == null || !n.isFinite) return '—';
  return n == n.roundToDouble() ? Fmt.number(n, 0) : Fmt.number(n, n * 10 == (n * 10).roundToDouble() ? 1 : 2);
}

DateFormat _fmt(String locale, String pattern) {
  try {
    return DateFormat(pattern, intlLocale(locale));
  } catch (_) {
    return DateFormat(pattern, 'en_US');
  }
}

/// "Fri, 09 Oct" for YYYY-MM-DD (`withWeekday` false: "09 Oct").
String expiryLabel(String date, String locale, {bool withWeekday = true}) {
  final d = DateTime.tryParse('${date}T12:00:00Z');
  if (d == null) return date;
  return latinDigits(_fmt(locale, withWeekday ? 'EEE, dd MMM' : 'dd MMM').format(d));
}

/// "2d 4h", "3h 12m", "4m 10s" until an instant.
String countdown(int toMs, [int? nowMs]) {
  var s = ((toMs - (nowMs ?? DateTime.now().millisecondsSinceEpoch)) / 1000).round();
  if (s < 0) s = 0;
  final d = s ~/ 86400;
  s -= d * 86400;
  final h = s ~/ 3600;
  s -= h * 3600;
  final m = s ~/ 60;
  s -= m * 60;
  if (d > 0) return '${d}d ${h}h';
  if (h > 0) return '${h}h ${m.toString().padLeft(2, '0')}m';
  return '${m}m ${s.toString().padLeft(2, '0')}s';
}

/// "3d 4h" a few days out, "5h 10m" on the day of the cut (expiry chips).
String untilText(int cutMs, int now) {
  final left = cutMs - now;
  if (left >= 86400000) {
    final d = left ~/ 86400000;
    final h = (left % 86400000) ~/ 3600000;
    return d >= 3 ? '${d}d' : '${d}d ${h}h';
  }
  return countdown(cutMs, now);
}

/// "Mon, 5 Oct · 14:00 UTC": the cut of an expiry, in UTC (the same instant for every trader).
String cutWhen(int? ms, String locale) {
  if (ms == null || ms <= 0) return '—';
  final d = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
  final day = latinDigits(_fmt(locale, 'EEE, d MMM').format(d));
  return '$day · ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')} UTC';
}

/// The cut of a YYYY-MM-DD expiry when the engine didn't send it: 10:00 New York.
int nyCut(String date) {
  try {
    return cutInstant(date);
  } catch (_) {
    return 0;
  }
}

/// A strike label with the ladder's decimals, from a number.
String strikeText(double strike, int digits) {
  final s = strike.toStringAsFixed(digits.clamp(0, 6));
  return s.contains('.') ? s.replaceFirst(RegExp(r'0+$'), '').replaceFirst(RegExp(r'\.$'), '') : s;
}

/// The strike as listed in the series code ("1.1250"), else from the number.
String strikeOf(String series, double strike, int digits) {
  final m = RegExp(r'^[A-Z0-9]{3,12}-\d{8}-([0-9]+(?:\.[0-9]+)?)-[CP]').firstMatch(series);
  return m != null ? m[1]! : strikeText(strike, digits);
}

/// A strike with the ladder's own decimals ("1.1250" on a 0.0025 ladder, "2650" on a 25 one).
String strikeLabelOf(String u, double strike) {
  final step = optionSpecs[u]?.strikeStep;
  if (step == null) return strikeText(strike, optionSpecs[u]?.digits ?? 5);
  return strike.toStringAsFixed(stepDecimals(step).clamp(0, 8));
}

int digitsOf(String u) => optionSpecs[u]?.digits ?? 5;

/// Values put into a translated sentence, each wrapped in a left-to-right isolate so prices keep their order in
/// Arabic, Persian and Urdu sentences. `count` stays a plain number (it picks the plural form).
Map<String, Object?> iso(Map<String, Object?> vars) => {
  for (final e in vars.entries) e.key: e.key == 'count' || e.value == null ? e.value : '\u2066${e.value}\u2069',
};

/// "Today", "Tomorrow" or "Fri, 09 Oct" for an expiry date.
String dayLabel(T t, String date, String locale, int now) {
  final today = DateTime.fromMillisecondsSinceEpoch(now, isUtc: true).toIso8601String().substring(0, 10);
  final tomorrow = DateTime.fromMillisecondsSinceEpoch(now + 86400000, isUtc: true).toIso8601String().substring(0, 10);
  if (date == today) return t('trader.opt.guide.today');
  if (date == tomorrow) return t('trader.opt.guide.tomorrow');
  return expiryLabel(date, locale);
}
