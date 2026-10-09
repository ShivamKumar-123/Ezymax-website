// Prop Challenges (lib/features/prop): the web's formatting rules, and widget tests on the sample-data API: the store
// and the buy flow (pay from the wallet, credentials once), My challenges (live phase, banners, rules, Trade, switching
// challenge), payouts (request the eligible payout) and certificates.
import 'dart:async';

import 'package:ezymex/features/prop/certificates_screen.dart';
import 'package:ezymex/features/prop/mine_screen.dart';
import 'package:ezymex/features/prop/payouts_screen.dart';
import 'package:ezymex/features/prop/prop_api.dart';
import 'package:ezymex/features/prop/store_screen.dart';
import 'package:ezymex/features/prop/widgets/mine_sections.dart';
import 'package:ezymex/router/router.dart';
import 'package:ezymex/ui/ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/test_app.dart';

/// The page's own vertical scroll view (the first Scrollable under the screen).
Finder _page<W>() => find.descendant(of: find.byType(W), matching: find.byType(Scrollable)).first;

/// Scrolls `f` into view, then to the middle of the screen (clear of the frosted header and tab bar).
Future<void> _scrollTo(WidgetTester tester, Finder f, Finder page, {double delta = 300}) async {
  await tester.scrollUntilVisible(f, delta, scrollable: page);
  await tester.pump();
  unawaited(Scrollable.ensureVisible(tester.element(f.first), alignment: 0.5));
  await settle(tester, frames: 3);
}

void main() {
  group('formatting (web api.ts)', () {
    test('sizes, money and percentages', () {
      expect(sizeLabel(10000), r'$10k');
      expect(sizeLabel(25000), r'$25k');
      expect(sizeLabel(2500), r'$2.5k');
      expect(sizeLabel(1000000), r'$1M');
      expect(sizeLabel(800), r'$800');
      expect(usd(1234.5), r'$1,234.50');
      expect(usd(-386.2), r'-$386.20');
      expect(usd(null), '—');
      expect(feeText(299), r'$299');
      expect(feeText(99.5), r'$99.50');
      expect(signedUsd(12.5), r'+$12.50');
      expect(signedUsd(-3), r'-$3.00');
      expect(pctText(8), '8%');
      expect(pctText(2.5), '2.5%');
    });

    test('daily reset: 17:00 New York', () {
      // summer (DST): 21:00 UTC; winter: 22:00 UTC
      expect(nextNyClose(DateTime.utc(2026, 7, 1, 12)), DateTime.utc(2026, 7, 1, 21));
      expect(nextNyClose(DateTime.utc(2026, 7, 1, 21, 30)), DateTime.utc(2026, 7, 2, 21));
      expect(nextNyClose(DateTime.utc(2026, 12, 1, 12)), DateTime.utc(2026, 12, 1, 22));
      expect(hms(const Duration(hours: 3, minutes: 4, seconds: 5)), '03:04:05');
    });

    test('rule view falls back to the plan terms before the first evaluation', () {
      final c = Challenge.fromJson({
        'id': 1,
        'status': 'active',
        'size': 10000,
        'plan': {'dailyLoss': 5, 'maxDD': 10},
        'phases': [
          {'id': 9, 'phaseIndex': 0, 'phase': 'Phase 1', 'status': 'active', 'initialBalance': 10000, 'targetPct': 8, 'minDays': 4, 'timeLimitDays': 0},
        ],
        'current': {'id': 9, 'phaseIndex': 0, 'phase': 'Phase 1', 'status': 'active', 'initialBalance': 10000, 'targetPct': 8, 'minDays': 4},
      });
      final v = RuleView.of(c, c.current!);
      expect(v.live, isFalse);
      expect(v.dailyLimit, 500);
      expect(v.dailyFloor, 9500);
      expect(v.ddFloor, 9000);
      expect(v.targetAmount, 800);
      expect(tradable(c, c.current!), isTrue);
    });
  });

  testWidgets('store shows the configurator and buys a challenge from the wallet', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/prop');
    await settle(tester);

    expect(find.text('Prop challenges'), findsWidgets);
    expect(find.text('Choose your challenge'), findsOneWidget);
    // two running challenges in the sample data
    expect(find.text('2'), findsWidgets);
    expect(find.text('Ezymex Classic 2-Step'), findsWidgets);
    expect(find.text('Two evaluation phases with lower targets and wider limits.'), findsOneWidget);

    final buy = find.text(r'Buy challenge · $299');
    await _scrollTo(tester, buy, _page<PropStoreScreen>());
    await tester.tap(buy);
    await settle(tester);

    expect(find.text('Buy Ezymex Classic 2-Step'), findsOneWidget);
    expect(find.text('Wallet balance: 3,000.40 USDT'), findsOneWidget);
    expect(find.text('Rules of this challenge'), findsOneWidget);
    // Pay stays off until the rules are accepted
    final pay = find.widgetWithText(KButton, r'Pay $299');
    expect(tester.widget<KButton>(pay).onPressed, isNull);
    final agree = find.textContaining('I have read the rules above');
    await tester.ensureVisible(agree);
    await tester.tap(agree);
    await tester.pump();
    expect(tester.widget<KButton>(pay).onPressed, isNotNull);
    await tester.tap(pay);
    await settle(tester);

    expect(find.text('Your challenge is ready'), findsOneWidget);
    expect(find.text('80520391'), findsOneWidget);
    expect(find.text('Trading password'), findsOneWidget);
    // passwords are hidden until revealed
    expect(find.text('Kx7#pQ2v!mR9'), findsNothing);
    await tester.tap(find.bySemanticsLabel('Show').first);
    await tester.pump();
    expect(find.text('Kx7#pQ2v!mR9'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('my challenges shows the live phase, its rules and Trade, and switches challenge', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/prop/mine');
    await settle(tester);

    expect(find.text('Live rule tracking for every evaluation and funded account.'), findsOneWidget);
    expect(find.text('Phase 2 · Active'), findsOneWidget);
    expect(find.text("54% of today's loss limit used"), findsOneWidget);
    expect(find.text('Phase 2 · live'), findsOneWidget);
    expect(find.text('Ezymex Classic 2-Step · \$50k'), findsOneWidget);

    final page = _page<PropMineScreen>();
    await _scrollTo(tester, find.text('Trading account'), page);
    expect(find.text('80520114'), findsOneWidget);
    // the account's Trade (the shell header has its own Trade button)
    final trade = find.descendant(of: find.byType(ChallengeOverview), matching: find.widgetWithText(KButton, 'Trade'));
    expect(trade, findsOneWidget);
    expect(tester.widget<KButton>(trade).onPressed, isNotNull);

    await _scrollTo(tester, find.text('Daily loss limit'), page);
    expect(find.text('In progress'), findsWidgets);
    await _scrollTo(tester, find.text('Rule events'), page, delta: 600);
    expect(find.text('Warning'), findsOneWidget);
    await _scrollTo(tester, find.text('Trade history'), page);
    expect(find.textContaining('14 closed trades'), findsOneWidget);

    // the funded challenge
    await _scrollTo(tester, find.text(r'$100k'), page, delta: -600);
    await tester.tap(find.text(r'$100k'));
    await settle(tester);
    expect(find.text(r'Payout available: $4,992.00'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('payouts: the eligible quote and a payout request', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/prop/payouts');
    await settle(tester);

    expect(find.text('Prop payouts'), findsWidgets);
    expect(find.text('Identity verified: payouts can be approved.'), findsOneWidget);
    expect(find.text('1 of 1 funded account eligible'), findsOneWidget);

    final page = _page<PropPayoutsScreen>();
    final request = find.widgetWithText(KButton, 'Request payout');
    await _scrollTo(tester, request, page);
    expect(find.text('Eligible now'), findsOneWidget);
    expect(find.text('Already refunded'), findsOneWidget);
    await tester.tap(request);
    await settle(tester);

    expect(find.text('Total to your wallet'), findsOneWidget);
    await tester.tap(find.widgetWithText(KButton, r'Request $4,992.00'));
    await settle(tester);
    expect(find.text('Total to your wallet'), findsNothing);
    expect(find.text('Payout requested'), findsWidgets);

    await _scrollTo(tester, find.text('Payout history'), page);
    expect(find.text('Paid'), findsOneWidget);
    expect(find.text('Rejected'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('certificates list the earned certificates with their numbers', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/prop/certificates');
    await settle(tester);

    expect(find.text('Certificates'), findsWidgets);
    expect(find.text('Payout certificate'), findsOneWidget);
    // the number is on the card and in the certificate picture (as on the web's server image)
    expect(find.descendant(of: find.byType(PropCertificatesScreen), matching: find.text('No. KC-2026-3010-0077')), findsNWidgets(2));
    expect(find.bySemanticsLabel('Copy share link'), findsWidgets);
    await unmount(tester);
  });
}
