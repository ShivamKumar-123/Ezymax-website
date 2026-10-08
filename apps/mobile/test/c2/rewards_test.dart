// Contests & Rewards (lib/features/rewards) on the sample-data API: the contests page in its phone order, joining a
// demo contest (credentials once, then the entry), loyalty (balance, tiers, estimate, redeem → voucher), cashback
// enrol, a bonus claim and a promo code.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kalks/features/rewards/cashback_screen.dart';
import 'package:kalks/features/rewards/contest_detail_screen.dart';
import 'package:kalks/features/rewards/contests_screen.dart';
import 'package:kalks/features/rewards/loyalty_screen.dart';
import 'package:kalks/features/rewards/promotions_screen.dart';
import 'package:kalks/preview/c2/rewards.dart';
import 'package:kalks/router/router.dart';

import '../helpers/test_app.dart';

/// The page's own vertical scroll view (the first Scrollable under the screen).
Finder _page(Type screen) => find.descendant(of: find.byType(screen), matching: find.byType(Scrollable)).first;

/// Scrolls `f` into view, then to the middle of the screen (clear of the frosted header and tab bar).
Future<void> _scrollTo(WidgetTester tester, Finder f, Finder page, {double delta = 300}) async {
  await tester.scrollUntilVisible(f, delta, scrollable: page);
  await tester.pump();
  unawaited(Scrollable.ensureVisible(tester.element(f.first), alignment: 0.5));
  await settle(tester, frames: 3);
}

void main() {
  setUp(resetPreviewRewards);

  testWidgets('contests: featured contest, rules & prizes, leaderboard, tiles and my results', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/rewards');
    await settle(tester);

    expect(find.byType(ContestsScreen), findsOneWidget);
    expect(find.text('Autumn Gold Rush 2026'), findsWidgets);
    expect(find.text('Joined · account #10042817'), findsOneWidget);
    expect(find.text('Ends in'), findsOneWidget);

    // the hero's Rules & prizes opens the contest (iOS push)
    await _scrollTo(tester, find.text('Rules & prizes'), _page(ContestsScreen));
    await tester.tap(find.text('Rules & prizes'));
    await settle(tester);
    expect(find.byType(ContestDetailScreen), findsOneWidget);
    expect(find.text('All contests'), findsOneWidget);
    final detail = _page(ContestDetailScreen);
    await _scrollTo(tester, find.byKey(const ValueKey('contest-my-entry')), detail);
    expect(find.text('Your entry'), findsOneWidget);
    await _scrollTo(tester, find.text('Paid as'.toUpperCase()), detail);
    await _scrollTo(tester, find.text('Ties go to the earlier entry.'), detail);
    expect(find.text('Rules'), findsOneWidget);

    c.read(routerProvider).go('/rewards');
    await settle(tester);
    final page = _page(ContestsScreen);
    await _scrollTo(tester, find.byKey(const ValueKey('leaderboard-row-me')), page);
    expect(find.text('Live leaderboard'), findsOneWidget);
    await _scrollTo(tester, find.text('Prize distribution'), page);
    await _scrollTo(tester, find.text('Your rewards'), page);
    expect(find.text('18,420 points'), findsOneWidget);
    await _scrollTo(tester, find.text('Open for entry'), page);
    await _scrollTo(tester, find.byKey(const ValueKey('contest-card-103')), page);
    await _scrollTo(tester, find.text('Past contests'), page);
    await _scrollTo(tester, find.text('Every contest you entered'), page);
    expect(find.text('Summer Live Cup'), findsWidgets);
    await unmount(tester);
  });

  testWidgets('joining a demo contest shows the contest account once, then the entry', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    unawaited(c.read(routerProvider).push('/rewards/contests/102'));
    await settle(tester);

    expect(find.text('October Demo Sprint'), findsWidgets);
    final page = _page(ContestDetailScreen);
    // not joined yet: Your entry asks to join (as on the web)
    await _scrollTo(tester, find.text('Join to start ranking'), page);
    expect(find.text("You haven't joined this contest"), findsOneWidget);
    await _scrollTo(tester, find.text('Join contest').first, page, delta: -300);
    await tester.tap(find.text('Join contest').first);
    await settle(tester);
    expect(find.text('Join October Demo Sprint'), findsOneWidget);
    expect(find.text('A dedicated demo account is opened for this contest.'), findsOneWidget);

    await tester.tap(find.text('Confirm entry'));
    await settle(tester);
    expect(find.text('Your contest account'), findsOneWidget);
    expect(find.text('20031188'), findsOneWidget);
    expect(find.text('Kx7!pR2m'), findsOneWidget);
    expect(find.text('Open in Kalks Trader'), findsOneWidget);
    await tester.tap(find.text('Done'));
    await settle(tester);
    expect(find.text('Your contest account'), findsNothing);

    // the contest reloads with the new entry
    expect(find.text('Joined · #20031188'), findsOneWidget);
    await _scrollTo(tester, find.byKey(const ValueKey('contest-my-entry')), page);
    expect(find.text('Join to start ranking'), findsNothing);
    await unmount(tester);
  });

  testWidgets('loyalty: balance, tiers, estimate and redeeming a fee discount shows the voucher', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/rewards/loyalty');
    await settle(tester);

    expect(find.byType(LoyaltyScreen), findsOneWidget);
    expect(find.byKey(const ValueKey('points-balance')), findsOneWidget);
    expect(find.text('18,420'), findsOneWidget);
    // the balance chip, and the selected tier of the tier track (the current one), as on the web
    expect(find.text('Gold · 1.5×'), findsWidgets);
    final page = _page(LoyaltyScreen);
    await _scrollTo(tester, find.text('Progress to Platinum'), page);
    await _scrollTo(tester, find.byKey(const ValueKey('points-estimate')), page);
    // 10 lots of forex (10 pts / lot) at Gold 1.5× = 150 pts
    expect(find.text('150 pts'), findsOneWidget);

    final redeem = find.byKey(const ValueKey('redeem-3'));
    await _scrollTo(tester, redeem, page);
    await tester.tap(redeem);
    await settle(tester);
    expect(find.text('Redeem 20% off a prop challenge'), findsOneWidget);
    expect(find.text('Voucher code'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('redeem-confirm')));
    await settle(tester);
    expect(find.text('Your voucher'), findsOneWidget);
    expect(find.text('KLX-NEW-5R8D'), findsOneWidget);
    await tester.tap(find.text('Done'));
    await settle(tester);

    await _scrollTo(tester, find.text('Points history'), page);
    // the earlier voucher, in Vouchers and in Redemptions
    await _scrollTo(tester, find.text('Vouchers'), page);
    expect(find.text('KLX-PROP-7Q4M'), findsWidgets);
    await _scrollTo(tester, find.text('Redemptions'), page);
    await unmount(tester);
  });

  testWidgets('cashback enrol, bonus claim and a promo code', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/rewards/cashback');
    await settle(tester);

    expect(find.byType(CashbackScreen), findsOneWidget);
    final cashback = _page(CashbackScreen);
    await _scrollTo(tester, find.text('Daily cashback'), cashback);
    final enrol = find.byKey(const ValueKey('cashback-enrol-3'));
    await _scrollTo(tester, enrol, cashback);
    await tester.tap(enrol);
    await settle(tester);
    expect(find.text('Enrolled in Crypto weekend'), findsWidgets);
    // the programme reloads as enrolled: no Enrol button any more
    expect(find.byKey(const ValueKey('cashback-enrol-3')), findsNothing);
    await _scrollTo(tester, find.text('Cashback history'), cashback);

    c.read(routerProvider).go('/rewards/promotions');
    await settle(tester);
    expect(find.byType(PromotionsScreen), findsOneWidget);
    final promo = _page(PromotionsScreen);
    final claim = find.byKey(const ValueKey('bonus-claim-11'));
    await _scrollTo(tester, claim, promo);
    await tester.tap(claim);
    await settle(tester);
    expect(find.text('Claim Welcome deposit bonus'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('bonus-claim-confirm')));
    await settle(tester);
    expect(find.text('Welcome deposit bonus claimed'), findsWidgets);
    expect(find.byKey(const ValueKey('bonus-claim-11')), findsNothing);

    final input = find.byKey(const ValueKey('promo-input'));
    await _scrollTo(tester, input, promo);
    await tester.enterText(find.descendant(of: input, matching: find.byType(TextField)), 'autumn 500');
    await settle(tester, frames: 3);
    // upper case, no spaces (the code also appears in the promo history below)
    expect(find.descendant(of: input, matching: find.text('AUTUMN500')), findsOneWidget);
    await _scrollTo(tester, find.byKey(const ValueKey('promo-submit')), promo);
    await tester.tap(find.byKey(const ValueKey('promo-submit')));
    await settle(tester);
    expect(find.text('500 points were added to your balance.'), findsOneWidget);
    await unmount(tester);
  });
}
