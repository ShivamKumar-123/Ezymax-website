// Screenshots of the Wallet pages (light, dark, Arabic, plus scrolled views and the key states / sheets):
//   flutter test test_shots/c1_wallet_shots_test.dart --update-goldens
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kalks/preview/c1/preview_wallet.dart';
import 'package:kalks/ui/ui.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../test/helpers/test_app.dart';
import 'shots.dart';

const String _intent = 'dep_4c1d9e2f7a8b6c5d3e2f1a0b';

/// Scrolls `f` to the middle of the page (clear of the frosted header and the tab bar) and taps it.
Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.runAsync(() => Scrollable.ensureVisible(tester.element(f.first), alignment: 0.5));
  await tester.pump(const Duration(milliseconds: 300));
  await tester.tap(f.first);
  await settle(tester, frames: 6);
}

Future<void> _tapText(WidgetTester tester, String text) => _tap(tester, find.text(text));

/// A KButton by its icon (the same in every language).
Finder _button(IconData icon) => find.byWidgetPredicate((w) => w is KButton && (w.icon == icon || w.trailingIcon == icon));

/// Deposit: amount 250 on BNB Chain -> Continue (the pay panel).
Future<void> _startDeposit(WidgetTester tester) async {
  await tester.enterText(find.byType(TextField).first, '250');
  await tester.pump();
  await _tap(tester, _button(LucideIcons.wallet));
}

/// Withdraw: a TRON address and 120 USDT -> the quote.
Future<void> _fillWithdrawal(WidgetTester tester) async {
  await _tapText(tester, 'USDT · TRC20');
  await tester.enterText(find.byType(TextField).at(0), 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj');
  await tester.pump();
  await tester.enterText(find.byType(TextField).at(1), '120');
  await tester.pump(const Duration(milliseconds: 500));
  await settle(tester, frames: 6);
}

void main() {
  setUp(resetPreviewWallet);

  final themes = [('light', 'light', 'en'), ('dark', 'dark', 'en'), ('ar', 'light', 'ar')];
  for (final (name, theme, locale) in themes) {
    if (locale == 'ar' && !hasArabicFont) continue;
    testWidgets('wallet $name', (tester) async {
      await shotAt(tester, 'wallet-overview-$name', '/wallet', theme: theme, locale: locale);
      await shotAt(tester, 'wallet-overview-$name-2', '/wallet', theme: theme, locale: locale, scroll: 700);
      await shotAt(tester, 'wallet-overview-$name-3', '/wallet', theme: theme, locale: locale, scroll: 1500);
      await shotAt(tester, 'wallet-overview-$name-4', '/wallet', theme: theme, locale: locale, scroll: 2600);
    });
    testWidgets('deposit $name', (tester) async {
      await shotAt(tester, 'wallet-deposit-$name', '/wallet/deposit', theme: theme, locale: locale);
      await shotAt(tester, 'wallet-deposit-$name-2', '/wallet/deposit', theme: theme, locale: locale, scroll: 600);
      await shotAt(tester, 'wallet-deposit-$name-pay', '/wallet/deposit', theme: theme, locale: locale, before: _startDeposit);
      await shotAt(tester, 'wallet-deposit-$name-pay-2', '/wallet/deposit', theme: theme, locale: locale, before: _startDeposit, scroll: 600);
      await shotAt(tester, 'wallet-deposit-$name-pay-3', '/wallet/deposit', theme: theme, locale: locale, before: _startDeposit, scroll: 1150);
      await shotAt(tester, 'wallet-deposit-$name-tracker', '/wallet/deposit?intent=$_intent', theme: theme, locale: locale, scroll: 120);
    });
    testWidgets('withdraw $name', (tester) async {
      await shotAt(tester, 'wallet-withdraw-$name', '/wallet/withdraw', theme: theme, locale: locale);
      await shotAt(tester, 'wallet-withdraw-$name-quote', '/wallet/withdraw', theme: theme, locale: locale, before: _fillWithdrawal, scroll: 330);
      await shotAt(tester, 'wallet-withdraw-$name-2', '/wallet/withdraw', theme: theme, locale: locale, scroll: 1000);
      await shotAt(tester, 'wallet-withdraw-$name-3', '/wallet/withdraw', theme: theme, locale: locale, scroll: 1500);
      await shotAt(
        tester,
        'wallet-withdraw-$name-stepup',
        '/wallet/withdraw',
        theme: theme,
        locale: locale,
        before: (tester) async {
          await _fillWithdrawal(tester);
          await _tap(tester, _button(LucideIcons.arrowUpFromLine));
        },
      );
    });
    testWidgets('transfer $name', (tester) async {
      await shotAt(tester, 'wallet-transfer-$name', '/wallet/transfer?to=10042817', theme: theme, locale: locale);
      await shotAt(tester, 'wallet-transfer-$name-2', '/wallet/transfer?to=10042817', theme: theme, locale: locale, scroll: 700);
    });
    testWidgets('history $name', (tester) async {
      await shotAt(tester, 'wallet-history-$name', '/wallet/history', theme: theme, locale: locale);
      await shotAt(tester, 'wallet-history-$name-2', '/wallet/history', theme: theme, locale: locale, scroll: 1900);
    });
  }

  testWidgets('withdraw requested + transfer from', (tester) async {
    await shotAt(
      tester,
      'wallet-withdraw-light-requested',
      '/wallet/withdraw',
      before: (tester) async {
        await _fillWithdrawal(tester);
        await _tap(tester, _button(LucideIcons.arrowUpFromLine));
        await tester.enterText(find.byType(TextField).last, '123456');
        await settle(tester);
      },
    );
    await shotAt(tester, 'wallet-transfer-light-from', '/wallet/transfer?from=10051123');
    await shotAt(tester, 'wallet-history-light-deposits', '/wallet/history?type=deposit');
  });
}
