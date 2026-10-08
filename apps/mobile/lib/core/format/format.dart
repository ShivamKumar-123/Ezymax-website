// Number, money, percent and date formatting with the web's rules:
// - trading figures use en-US grouping and Latin digits in every language (packages/ui lib/format.ts, MT5 style);
// - locale-aware dates and numbers (packages/i18n/src/format.ts) keep the language's separators and month names but
//   Latin digits too (`-u-nu-latn` on the web), and dates are shown in server time (GMT+3, Europe/Istanbul).
import 'package:intl/intl.dart';

import '../../i18n/i18n.dart';

/// Zero code points of the Unicode decimal digit blocks Intl may produce (Arabic-Indic, Persian, Devanagari,
/// Bengali, Tamil, Thai, …). Each block runs zero..nine.
const List<int> _digitZeros = [
  0x0660,
  0x06F0,
  0x07C0,
  0x0966,
  0x09E6,
  0x0A66,
  0x0AE6,
  0x0B66,
  0x0BE6,
  0x0C66,
  0x0CE6,
  0x0D66,
  0x0DE6,
  0x0E50,
  0x0ED0,
  0x0F20,
  0x1040,
  0x17E0,
  0x1810,
  0xFF10,
];

/// Any decimal digit -> 0-9 (figures stay Latin in Arabic, Persian, Hindi, Bengali, Tamil, Thai, …).
String latinDigits(String s) {
  var changed = false;
  final out = StringBuffer();
  for (final r in s.runes) {
    var mapped = r;
    if (r > 0x7f) {
      for (final z in _digitZeros) {
        if (r >= z && r <= z + 9) {
          mapped = 0x30 + (r - z);
          changed = true;
          break;
        }
      }
    }
    out.writeCharCode(mapped);
  }
  return changed ? out.toString() : s;
}

/// Trading and money figures: en-US grouping, Latin digits, the same output as @ezymex/ui (formatMoney, Money).
abstract final class Fmt {
  static final Map<String, NumberFormat> _nf = {};

  static NumberFormat _fixed(int min, int max) => _nf.putIfAbsent('$min-$max', () {
    final f = NumberFormat.decimalPattern('en_US');
    f.minimumFractionDigits = min;
    f.maximumFractionDigits = max;
    return f;
  });

  /// 1234.5 -> "1,234.50".
  static String number(num v, [int decimals = 2]) => _fixed(decimals, decimals).format(v);

  /// ISO 4217 minor units (JPY, KRW, VND: none; BHD, KWD, OMR: three); everything else two.
  static int currencyDecimals(String code) => switch (code.toUpperCase()) {
    'JPY' || 'KRW' || 'VND' || 'CLP' || 'ISK' || 'UGX' || 'XAF' || 'XOF' || 'IDR' => 0,
    'BHD' || 'KWD' || 'OMR' || 'JOD' || 'TND' => 3,
    _ => 2,
  };

  static const Map<String, String> _symbols = {'USD': r'$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'INR': '₹'};

  /// Money with its currency, sign first:
  /// - USD "$1,234.50", EUR "€…", GBP "£…", JPY "¥1,235" (no minor units), INR "₹…";
  /// - USC (cent accounts) "USC 123,450.00": the web's account prefix (curOf);
  /// - anything else (USDT, BTC) "1,234.50 USDT".
  static String money(num v, {String currency = 'USD', int? decimals, bool signed = false}) {
    final p = moneyParts(v, currency: currency, decimals: decimals, signed: signed);
    return '${p.sign}${p.prefix}${p.integer}${p.fraction.isEmpty ? '' : '.${p.fraction}'}${p.suffix}';
  }

  /// The pieces of [money], for the large figures with dimmed decimals (`$54,208.11` with `.11` dimmed).
  static MoneyParts moneyParts(num v, {String currency = 'USD', int? decimals, bool signed = false}) {
    final code = currency.toUpperCase();
    final dp = decimals ?? currencyDecimals(code);
    final s = number(v.abs(), dp);
    final dot = s.indexOf('.');
    final sign = v < 0 && s.replaceAll(RegExp(r'[0.,]'), '').isNotEmpty ? '-' : (signed && v > 0 ? '+' : '');
    final symbol = _symbols[code];
    final prefix = symbol ?? (code == 'USC' ? 'USC ' : '');
    final suffix = symbol == null && code != 'USC' ? ' $code' : '';
    return MoneyParts(sign: sign, prefix: prefix, integer: dot < 0 ? s : s.substring(0, dot), fraction: dot < 0 ? '' : s.substring(dot + 1), suffix: suffix);
  }

  /// 1.234 -> "1.23%", signed: "+1.23%" (web formatPct / Formatter.percent).
  static String percent(num v, {int decimals = 2, bool signed = false}) => '${signed && v > 0 ? '+' : ''}${number(v, decimals)}%';

  /// 1234567 -> "1.23M".
  static String compact(num v) => NumberFormat.compact(locale: 'en_US').format(v);

  /// Cent accounts (USC) hold cents: their figures count 1/100 towards USD totals (web toUsd).
  static num toUsd(num v, {required bool cent}) => cent ? v / 100 : v;

  /// The account currency as the web shows it (curOf): "$" for USD, "USC " for cent accounts, else "<code> ".
  static String accountPrefix({required String currency, required bool cent}) => cent || currency == 'USC' ? 'USC ' : (currency == 'USD' ? r'$' : '$currency ');

  /// An account figure in its own currency ("$1,234.50", "USC 123,450.00", "EUR 1,234.50").
  static String accountMoney(num v, {required String currency, required bool cent}) {
    final cur = accountPrefix(currency: currency, cent: cent);
    return cur == r'$' ? money(v) : '${v < 0 ? '-' : ''}$cur${number(v.abs())}';
  }

  /// Wallet amounts arrive as strings ("1234.5"): at least `dp` decimals, up to 6 when the value has them (web fmt).
  static String amount(Object? v, [int dp = 2]) {
    final n = v is num ? v : num.tryParse('${v ?? 0}');
    if (n == null || !n.isFinite) return '—';
    final digits = '$v'.contains('.') ? '$v'.split('.').last.replaceAll(RegExp(r'0+$'), '').length : 0;
    return _fixed(dp, digits.clamp(dp, 6)).format(n);
  }

  /// 10001234 -> "1000 1234" (account cards).
  static String spacedLogin(String login) => login.replaceAllMapped(RegExp(r'(\d{4})(?=\d)'), (m) => '${m[1]} ');

  /// Margin level: "1,234%" or "—" when there is no margin in use.
  static String level(num? ml) => ml == null || !ml.isFinite ? '—' : '${number(ml.round(), 0)}%';

  /// "1:500".
  static String leverage(num v) => '1:${number(v, 0)}';
}

class MoneyParts {
  const MoneyParts({required this.sign, required this.prefix, required this.integer, required this.fraction, required this.suffix});
  final String sign;
  final String prefix;
  final String integer;
  final String fraction;
  final String suffix;
}

/// Server time (statements, swaps, daily P&L): New York close, GMT+3 all year (Europe/Istanbul has no DST).
const Duration kServerOffset = Duration(hours: 3);

DateTime toServerTime(DateTime t) => t.toUtc().add(kServerOffset);

/// Locale-aware formats (packages/i18n/src/format.ts createFormatter): the language's separators and month names,
/// Latin digits, dates in server time.
class LocaleFormat {
  LocaleFormat(this.locale) : _tag = intlLocale(locale);
  final String locale;
  final String _tag;
  static final Map<String, Object> _cache = {};

  NumberFormat _num(int decimals) => _cache.putIfAbsent('$_tag|n|$decimals', () {
    final f = NumberFormat.decimalPattern(_tag);
    f.minimumFractionDigits = decimals;
    f.maximumFractionDigits = decimals;
    return f;
  }) as NumberFormat;

  DateFormat _date(String key, DateFormat Function() make) => _cache.putIfAbsent('$_tag|d|$key', make) as DateFormat;

  String number(num v, [int decimals = 2]) => latinDigits(_num(decimals).format(v));

  String percent(num v, {int decimals = 2, bool signed = false}) => '${signed && v > 0 ? '+' : ''}${number(v, decimals)}%';

  /// "24 Sep 2026" in the reader's language.
  String date(DateTime d) => latinDigits(_date('date', () => DateFormat.yMMMd(_tag)).format(toServerTime(d)));

  /// "24 Sep".
  String dayMonth(DateTime d) => latinDigits(_date('dm', () => DateFormat.MMMd(_tag)).format(toServerTime(d)));

  /// "24 Sep, 21:40".
  String dateTime(DateTime d) => latinDigits(_date('dt', () => DateFormat.MMMd(_tag).add_Hm()).format(toServerTime(d)));

  /// "21:40".
  String time(DateTime d) => latinDigits(_date('t', () => DateFormat.Hm(_tag)).format(toServerTime(d)));
}

/// "Just now" / "5m ago" / "3h ago" / "2d ago" / "24 Sep": the bell's times (web `ago` in components/notifications).
String timeAgo(T t, LocaleFormat f, DateTime at, DateTime now) {
  final s = (now.difference(at).inMilliseconds / 1000).round().clamp(0, 1 << 31);
  if (s < 45) return t('dashboard.time.justNow');
  final m = (s / 60).round();
  if (m < 60) return t('dashboard.time.minutesAgo', {'count': m});
  final h = (m / 60).round();
  if (h < 24) return t('dashboard.time.hoursAgo', {'count': h});
  final d = (h / 24).round();
  if (d < 7) return t('dashboard.time.daysAgo', {'count': d});
  return f.dayMonth(at);
}
