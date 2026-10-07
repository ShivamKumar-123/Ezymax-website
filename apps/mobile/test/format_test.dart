import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:kalks/core/format/format.dart';
import 'package:kalks/ui/color_mix.dart';

void main() {
  setUpAll(() async => initializeDateFormatting());

  group('money', () {
    test('USD with sign first and two decimals', () {
      expect(Fmt.money(1234.5), r'$1,234.50');
      expect(Fmt.money(-1234.5), r'-$1,234.50');
      expect(Fmt.money(1234.5, signed: true), r'+$1,234.50');
      expect(Fmt.money(0), r'$0.00');
      // a negative that rounds to zero shows no sign
      expect(Fmt.money(-0.001), r'$0.00');
    });

    test('USC cent accounts use the web prefix and count 1/100 towards USD', () {
      expect(Fmt.money(123450, currency: 'USC'), 'USC 123,450.00');
      expect(Fmt.toUsd(123450, cent: true), 1234.5);
      expect(Fmt.toUsd(99, cent: false), 99);
      expect(Fmt.accountMoney(254300, currency: 'USC', cent: true), 'USC 254,300.00');
      expect(Fmt.accountMoney(12480.55, currency: 'USD', cent: false), r'$12,480.55');
      expect(Fmt.accountMoney(-12, currency: 'EUR', cent: false), '-EUR 12.00');
    });

    test('JPY has no minor units; other codes follow ISO 4217', () {
      expect(Fmt.money(1234.5, currency: 'JPY'), '¥1,235');
      expect(Fmt.currencyDecimals('JPY'), 0);
      expect(Fmt.currencyDecimals('KWD'), 3);
      expect(Fmt.money(1234.5, currency: 'JPY', decimals: 2), '¥1,234.50');
      expect(Fmt.money(99.9, currency: 'EUR'), '€99.90');
      expect(Fmt.money(1500, currency: 'USDT'), '1,500.00 USDT');
    });

    test('parts for dimmed decimals', () {
      final p = Fmt.moneyParts(54208.11);
      expect([p.sign, p.prefix, p.integer, p.fraction, p.suffix], ['', r'$', '54,208', '11', '']);
      final j = Fmt.moneyParts(-7, currency: 'JPY');
      expect([j.sign, j.integer, j.fraction], ['-', '7', '']);
    });

    test('wallet amounts keep their decimals (up to 6)', () {
      expect(Fmt.amount('1234.5'), '1,234.50');
      expect(Fmt.amount('0.123456'), '0.123456');
      expect(Fmt.amount('0.12345678'), '0.123457');
      expect(Fmt.amount(null), '0.00');
      expect(Fmt.amount('abc'), '—');
    });
  });

  group('numbers', () {
    test('percent, leverage, margin level, logins', () {
      expect(Fmt.percent(1.234), '1.23%');
      expect(Fmt.percent(1.234, signed: true), '+1.23%');
      expect(Fmt.percent(-0.5, signed: true), '-0.50%');
      expect(Fmt.leverage(500), '1:500');
      expect(Fmt.level(1234.4), '1,234%');
      expect(Fmt.level(null), '—');
      expect(Fmt.spacedLogin('10042817'), '1004 2817');
      expect(Fmt.compact(1234567), '1.23M');
    });

    test('digits stay Latin in every language', () {
      expect(latinDigits('١٢٣٫٤٥'), '123٫45');
      expect(latinDigits('۱۲۳'), '123');
      expect(latinDigits('१२३'), '123');
      expect(latinDigits('১২৩'), '123');
      expect(latinDigits('abc 123'), 'abc 123');
      expect(LocaleFormat('ar').number(1234.5), matches(RegExp(r'^[0-9.,٫٬  ‏؜ ]+$')));
      expect(LocaleFormat('fa').number(1234.5), isNot(contains('۱')));
      expect(LocaleFormat('hi').number(12), '12.00');
    });

    test('dates are in server time (GMT+3)', () {
      final utc = DateTime.utc(2026, 9, 24, 22, 30);
      expect(LocaleFormat('en').time(utc), '01:30');
      expect(LocaleFormat('en').date(utc), contains('25'));
      expect(LocaleFormat('ar').time(utc), '01:30');
    });
  });

  group('brand colour mixing (CSS color-mix in oklab)', () {
    test('endpoints and transparency', () {
      const ember = Color(0xFFFF5A1F);
      Color hex(Color c) => Color.from(alpha: 1, red: (c.r * 255).round() / 255, green: (c.g * 255).round() / 255, blue: (c.b * 255).round() / 255);
      expect(hex(mixOklab(ember, const Color(0xFFFFFFFF), 1)), hex(ember));
      expect(hex(mixOklab(ember, const Color(0xFFFFFFFF), 0)), const Color(0xFFFFFFFF));
      final soft = mixOklab(ember, const Color(0x00000000), 0.12);
      expect(soft.a, closeTo(0.12, 0.001));
      expect(hex(soft), hex(ember));
      expect(parseHex('#ff5a1f'), ember);
      expect(parseHex('nope'), isNull);
    });
  });
}
