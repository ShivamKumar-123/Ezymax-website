// The Dart port of createT (packages/i18n/src/core.ts): plurals, params, markup, RTL and fallbacks, plus the
// exported catalogs themselves (same keys as the web in every language).
import 'dart:convert';
import 'dart:io';

import 'package:ezymex/i18n/locales.dart';
import 'package:ezymex/i18n/t.dart';
import 'package:flutter_test/flutter_test.dart';

Messages _catalog(String code) => (jsonDecode(File('assets/i18n/$code.json').readAsStringSync()) as Map).cast<String, Object?>();

void main() {
  final en = <String, Object?>{
    'common.cancel': 'Cancel',
    'shell.greeting': 'Good morning, {name}',
    'x.accounts': {'one': '{count} account', 'other': '{count} accounts'},
    'x.withZero': {'zero': 'No accounts', 'one': '{count} account', 'other': '{count} accounts'},
    'x.tag': 'New to Ezymex? <link>Create an account</link>',
    'x.onlyEn': 'Only in English',
  };

  group('plurals', () {
    test('English one / other', () {
      final t = T('en', null, en);
      expect(t('x.accounts', {'count': 1}), '1 account');
      expect(t('x.accounts', {'count': 2}), '2 accounts');
      expect(t('x.accounts', {'count': 0}), '0 accounts');
    });

    test('zero is used only when count is exactly 0', () {
      final t = T('en', null, en);
      expect(t('x.withZero', {'count': 0}), 'No accounts');
      expect(t('x.withZero', {'count': 1}), '1 account');
      expect(t('x.withZero', {'count': 0.5}), '0.5 accounts');
      // no count at all reads as 0, like Number(undefined ?? 0) on the web
      expect(t('x.withZero'), 'No accounts');
    });

    test('CLDR categories per language', () {
      expect(pluralCategory(1, 'en'), 'one');
      expect(pluralCategory(1, 'ja'), 'other');
      expect(pluralCategory(0, 'fr'), 'one');
      expect(pluralCategory(1, 'ru'), 'one');
      expect(pluralCategory(3, 'ru'), 'few');
      expect(pluralCategory(5, 'ru'), 'many');
      expect(pluralCategory(21, 'ru'), 'one');
      expect(pluralCategory(0, 'ar'), 'zero');
      expect(pluralCategory(2, 'ar'), 'two');
      expect(pluralCategory(5, 'ar'), 'few');
      expect(pluralCategory(11, 'ar'), 'many');
      expect(pluralCategory(100, 'ar'), 'other');
    });

    test('a missing form falls back to other', () {
      final ar = {
        'x.n': {'one': 'حساب واحد', 'other': '{count} حسابات'},
      };
      final t = T('ar', ar, en);
      expect(t('x.n', {'count': 2}), '2 حسابات');
      expect(t('x.n', {'count': 1}), 'حساب واحد');
    });
  });

  group('params', () {
    test('fills {name} placeholders', () {
      final t = T('en', null, en);
      expect(t('shell.greeting', {'name': 'Arjun'}), 'Good morning, Arjun');
    });

    test('keeps a placeholder whose value is missing or null', () {
      final t = T('en', null, en);
      expect(t('shell.greeting'), 'Good morning, {name}');
      expect(t('shell.greeting', {'name': null}), 'Good morning, {name}');
      expect(interpolate('{a} and {b}', {'a': 1}), '1 and {b}');
    });
  });

  group('fallback', () {
    test('a key missing in the language falls back to English', () {
      final t = T('de', {'common.cancel': 'Abbrechen'}, en);
      expect(t('common.cancel'), 'Abbrechen');
      expect(t('x.onlyEn'), 'Only in English');
    });

    test('a key that exists nowhere becomes readable text, never the raw key', () {
      final t = T('en', null, en);
      expect(t('dashboard.home.totalBalance'), 'Total Balance');
      expect(humanise('wallet.withdraw_fee'), 'Withdraw fee');
      expect(t.has('dashboard.home.totalBalance'), isFalse);
      expect(t.has('common.cancel'), isTrue);
    });

    test('dyn uses the given fallback for unknown keys', () {
      final t = T('en', null, en);
      expect(t.dyn('accounts.mode.netting', fallback: 'netting'), 'netting');
      expect(t.dyn('x.missing', fallback: 'Hi {name}', vars: {'name': 'A'}), 'Hi A');
      expect(t.dyn('common.cancel', fallback: 'nope'), 'Cancel');
    });
  });

  group('markup', () {
    test('splits <tag>…</tag> into tappable segments', () {
      expect(parseRich(en['x.tag']! as String), const [RichSegment('New to Ezymex? '), RichSegment('Create an account', 'link')]);
      expect(parseRich('<b>a@b.c</b> got it'), const [RichSegment('a@b.c', 'b'), RichSegment(' got it')]);
      expect(parseRich('plain'), const [RichSegment('plain')]);
      expect(parseRich('<signin>Sign in</signin> or <reset>reset</reset>.'), const [
        RichSegment('Sign in', 'signin'),
        RichSegment(' or '),
        RichSegment('reset', 'reset'),
        RichSegment('.'),
      ]);
    });
  });

  group('locales and RTL', () {
    test('22 languages, RTL for ar / ur / fa', () {
      expect(kLocales.length, 22);
      expect(kLocales.where((l) => l.rtl).map((l) => l.code), ['ar', 'ur', 'fa']);
      expect(isRtl('ar') && isRtl('ur') && isRtl('fa'), isTrue);
      expect(isRtl('en') || isRtl('hi'), isFalse);
      expect(T('fa', null, en).rtl, isTrue);
    });

    test('matches device tags', () {
      expect(matchLocale('pt-BR'), 'pt');
      expect(matchLocale('zh_Hans_CN'), 'zh');
      expect(matchLocale('AR'), 'ar');
      expect(matchLocale('in-ID'), 'id');
      expect(matchLocale('iw'), isNull);
      expect(matchLocale('xx'), isNull);
      expect(intlLocale('pt'), 'pt_BR');
    });
  });

  group('exported catalogs (tool/export_i18n.mjs)', () {
    final english = _catalog('en');

    test('every language has every English key (web parity)', () {
      for (final l in kLocales) {
        final c = _catalog(l.code);
        final missing = english.keys.where((k) => !c.containsKey(k)).toList();
        expect(missing, isEmpty, reason: '${l.code} misses ${missing.take(5)}');
      }
    });

    test('web keys read like the web, app keys are translated', () {
      final t = T('en', null, english);
      expect(t('auth.login.signIn'), 'Sign in');
      expect(t('shell.more'), 'More');
      expect(t('dashboard.accounts.more', {'count': 3}), '3 more accounts');
      final ar = T('ar', _catalog('ar'), english);
      expect(ar('shell.more'), isNot('More'));
      expect(ar('app.unlock.button'), isNot(t('app.unlock.button')));
      expect(ar('app.version', {'version': '1.0.0+1'}), contains('1.0.0+1'));
    });
  });
}
