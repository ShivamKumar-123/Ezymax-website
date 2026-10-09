// Staking (lib/features/staking): parsing of the service shapes, the amount rules, the maturity date, the error texts
// and the navigation entry; widget tests on the sample-data API: the plans page and the subscribe sheet (Subscribe
// stays off until the amount is valid and both acceptances are ticked, then the outcome), My staking with a position's
// detail, and the history. Texts are looked up through the app's translator, so the tests hold before and after the
// staking catalog is exported to the app.
import 'dart:async';

import 'package:ezymex/core/api/api_providers.dart';
import 'package:ezymex/core/auth/auth_controller.dart';
import 'package:ezymex/core/auth/secure_store.dart';
import 'package:ezymex/core/config/app_config.dart';
import 'package:ezymex/core/format/format.dart';
import 'package:ezymex/core/models/user.dart';
import 'package:ezymex/features/staking/history_screen.dart';
import 'package:ezymex/features/staking/plans_screen.dart';
import 'package:ezymex/features/staking/portfolio_screen.dart';
import 'package:ezymex/features/staking/staking_api.dart';
import 'package:ezymex/features/staking/widgets/position_sheet.dart';
import 'package:ezymex/features/staking/widgets/subscribe_sheet.dart';
import 'package:ezymex/i18n/i18n.dart';
import 'package:ezymex/router/router.dart';
import 'package:ezymex/shell/nav.dart';
import 'package:ezymex/ui/ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'helpers/test_app.dart';

/// The page's own vertical scroll view (the first Scrollable under the screen).
Finder _page<W>() => find.descendant(of: find.byType(W), matching: find.byType(Scrollable)).first;

/// Scrolls `f` into view, then to the middle of the screen (clear of the frosted header and tab bar).
Future<void> _scrollTo(WidgetTester tester, Finder f, Finder page, {double delta = 300}) async {
  await tester.scrollUntilVisible(f, delta, scrollable: page);
  await tester.pump();
  unawaited(Scrollable.ensureVisible(tester.element(f.first), alignment: 0.5));
  await settle(tester, frames: 3);
}

StakingPlan _plan({String status = 'active', bool full = false, double min = 100, double? max = 5000, double? maxNow = 4000}) => StakingPlan.fromJson({
  'id': 7,
  'name': 'Test 3M',
  'currency': 'USDT',
  'status': status,
  'termMonths': 3,
  'minAmount': min,
  'maxAmount': max,
  'perUserMax': null,
  'capacityLeft': null,
  'full': full,
  'invested': 0,
  'maxNow': maxNow,
  'description': '',
  'riskText': 'Risky.',
  'version': 1,
  'recentRates': [
    {'period': '2026-09', 'ratePct': 1.2},
  ],
});

void main() {
  setUpAll(initializeDateFormatting);

  group('service shapes', () {
    test('plans: limits, nulls and whether a plan is open', () {
      final data = StakingPlans.fromJson({
        'plans': [
          {
            'id': 1,
            'name': 'Stable 3M',
            'currency': 'USDT',
            'status': 'active',
            'termMonths': 3,
            'minAmount': 100,
            'maxAmount': null,
            'perUserMax': 1000,
            'capacityLeft': null,
            'full': false,
            'invested': 250.5,
            'maxNow': 749.5,
            'description': 'd',
            'riskText': 'r',
            'version': 2,
            'recentRates': [
              {'period': '2026-08', 'ratePct': 0.9},
              {'period': '2026-09', 'ratePct': 1.25},
            ],
          },
        ],
        'currencies': ['USDT'],
        'currentPeriod': '2026-10',
        'nextPayoutAfter': '2026-10-31T21:00:00Z',
        'serverTime': '2026-10-09T10:00:00Z',
      });
      final p = data.plans.single;
      expect(p.id, 1);
      expect(p.maxAmount, isNull);
      expect(p.capacityLeft, isNull);
      expect(p.perUserMax, 1000);
      expect(p.invested, 250.5);
      expect(p.recentRates.map((r) => r.ratePct), [0.9, 1.25]);
      expect(p.open, isTrue);
      expect(stakingCap(p), 749.5);
      expect(data.currentPeriod, '2026-10');
      expect(data.nextPayoutAfter, DateTime.utc(2026, 10, 31, 21));
      expect(_plan(status: 'paused').open, isFalse);
      expect(_plan(full: true).open, isFalse);
      // the client's own room is below the plan's minimum
      expect(_plan(maxNow: 50).open, isFalse);
      // no limit at all
      expect(stakingCap(_plan(max: null, maxNow: null)), isNull);
    });

    test('portfolio, a position with its returns, history pages', () {
      final pf = StakingPortfolio.fromJson({
        'summary': {
          'currency': 'USDT',
          'invested': 3500,
          'pending': 200,
          'returnsPaid': 73.35,
          'returnsThisYear': 60,
          'activePositions': 2,
          'nextPayout': {'period': '2026-10', 'after': '2026-10-31T21:00:00Z'},
          'nextMaturity': {'positionId': 1042, 'planName': 'Stable 3M', 'date': '2026-12-01T21:00:00Z', 'principal': 1000},
        },
        'positions': [
          {
            'id': 1042,
            'planId': 1,
            'planName': 'Stable 3M',
            'currency': 'USDT',
            'termMonths': 3,
            'principal': 1000,
            'status': 'active',
            'startedAt': '2026-09-01T09:00:00Z',
            'maturesAt': '2026-12-01T21:00:00Z',
            'maturedAt': null,
            'returnsPaid': 8.2,
            'daysTotal': 91,
            'daysElapsed': 38,
            'failureReason': null,
            'lastReturn': {'period': '2026-09', 'ratePct': 0.85, 'amount': 8.2},
            'termsAcceptedAt': '2026-09-01T09:00:00Z',
            'riskAcknowledgedAt': '2026-09-01T09:00:00Z',
            'createdAt': '2026-09-01T09:00:00Z',
          },
        ],
        'monthly': [
          {'period': '2026-08', 'amount': 4},
          {'period': '2026-09', 'amount': 8.2},
        ],
      });
      expect(pf.summary.pending, 200);
      expect(pf.summary.nextPayoutPeriod, '2026-10');
      expect(pf.summary.nextMaturity!.positionId, 1042);
      expect(pf.summary.nextMaturity!.principal, 1000);
      final pos = pf.positions.single;
      expect(pos.lastReturn!.ratePct, 0.85);
      expect(pos.progress, closeTo(38 / 91, 1e-9));
      expect(pf.monthly.map((m) => m.period), ['2026-08', '2026-09']);

      final d = StakingPositionDetail.fromJson({
        'position': {'id': 9, 'status': 'payment_failed', 'principal': '300', 'failureReason': 'Too low.'},
        'terms': {'name': 'Growth 6M', 'termMonths': 6, 'currency': 'USDT', 'minAmount': 500, 'maxAmount': null, 'description': '', 'riskText': 'r'},
        'returns': [
          {'period': '2026-09', 'ratePct': 1.25, 'daysActive': 30, 'daysInMonth': 30, 'amount': 31.25, 'status': 'paid', 'paidAt': '2026-10-04T08:00:00Z'},
        ],
      });
      expect(d.position.principal, 300);
      expect(d.position.failureReason, 'Too low.');
      expect(d.terms.maxAmount, isNull);
      expect(d.returns.single.status, 'paid');

      final h = StakingHistoryPage.fromJson({
        'items': [
          {'kind': 'subscribe', 'positionId': 9, 'amount': 300, 'currency': 'USDT'},
          {'kind': 'reward', 'positionId': 9, 'amount': 3, 'currency': 'USDT', 'period': '2026-09', 'ratePct': 1, 'days': 30},
          {'kind': 'principal', 'positionId': 9, 'amount': 300, 'currency': 'USDT'},
          {'kind': 'payment_failed', 'positionId': 9, 'amount': 300, 'currency': 'USDT'},
        ],
        'total': 41,
        'page': 1,
        'limit': 20,
      });
      expect(h.pages, 3);
      expect(h.items.map((e) => e.sign), [-1, 1, 1, 0]);
      expect(h.items[1].days, 30);
      expect(stakingSigned(300, 'USDT', -1), '-300.00 USDT');
      expect(stakingSigned(3, 'USDT', 1), '+3.00 USDT');
      expect(stakingSigned(300, 'USDT', 0), '300.00 USDT');
    });
  });

  group('amounts and dates', () {
    test('typed amounts: at most 2 decimals, dot or comma', () {
      expect(parseStakingAmount('250'), 250);
      expect(parseStakingAmount(' 1,000.50 '), 1000.5);
      expect(parseStakingAmount('1000,5'), 1000.5);
      expect(parseStakingAmount('12.'), 12);
      expect(parseStakingAmount('1.234'), isNull);
      expect(parseStakingAmount('abc'), isNull);
      expect(parseStakingAmount(''), isNull);
      expect(stakingAmountString(1000), '1000');
      expect(stakingAmountString(1000.5), '1000.5');
      expect(stakingAmountString(99.99), '99.99');
    });

    test('limits, Max and the wallet', () {
      final p = _plan();
      expect(stakingAmountIssue(p, null), StakingAmountIssue.empty);
      expect(stakingAmountIssue(p, 0), StakingAmountIssue.empty);
      expect(stakingAmountIssue(p, 99.99), StakingAmountIssue.belowMin);
      expect(stakingAmountIssue(p, 100), isNull);
      expect(stakingAmountIssue(p, 4000), isNull);
      // the client's room (maxNow 4,000) wins over the plan's maximum (5,000)
      expect(stakingAmountIssue(p, 4000.01), StakingAmountIssue.aboveMax);
      expect(stakingAmountIssue(_plan(max: null, maxNow: null), 1e9), isNull);
      expect(stakingMaxFill(p, 3000.456), 3000.45);
      expect(stakingMaxFill(p, 9000), 4000);
      expect(stakingMaxFill(p, null), 4000);
      expect(stakingMaxFill(_plan(max: null, maxNow: null), null), isNull);
    });

    test('maturity: the same day N months later in server time, clamped to short months', () {
      DateTime day(DateTime d) => toServerTime(d);
      expect(day(stakingMaturity(DateTime.utc(2026, 10, 9, 10), 6)), DateTime.utc(2027, 4, 9));
      expect(day(stakingMaturity(DateTime.utc(2026, 1, 31, 10), 1)), DateTime.utc(2026, 2, 28));
      expect(day(stakingMaturity(DateTime.utc(2026, 11, 15, 10), 3)), DateTime.utc(2027, 2, 15));
      // 22:30 UTC is already the next day in server time (GMT+3)
      expect(day(stakingMaturity(DateTime.utc(2026, 10, 9, 22, 30), 6)), DateTime.utc(2027, 4, 10));
    });

    test('months, rates, terms and the idempotency key', () {
      final t = T('en', null, const {
        'staking.plan.term': {'one': '{count} month', 'other': '{count} months'},
      });
      // the app's English is en-GB, whose short September is "Sept" (as in the web's Intl.DateTimeFormat)
      expect(stakingMonth(t, '2026-09'), matches(RegExp(r'^Sept? 2026$')));
      expect(stakingMonth(t, '2027-01'), 'Jan 2027');
      expect(stakingMonth(t, null), '—');
      expect(stakingRate(t, 1.2), '1.20%');
      expect(stakingTerm(t, 1), '1 month');
      expect(stakingTerm(t, 6), '6 months');
      final a = newStakingKey(), b = newStakingKey();
      expect(RegExp(r'^[A-Za-z0-9_-]{1,80}$').hasMatch(a), isTrue);
      expect(a, isNot(b));
    });
  });

  test('error texts and their next step', () {
    final t = T('en', null, const {
      'staking.error.generic': 'G',
      'staking.error.network': 'N',
      'staking.error.kycRequired': 'K',
      'staking.error.insufficientFunds': 'F',
      'staking.error.paymentPending': 'P',
      'staking.error.riskRequired': 'R',
    });
    ApiException e(String code, [int status = 422]) => ApiException(status: status, code: code, message: 'server text');
    expect(stakingErrorText(e('kyc_required'), t), 'K');
    expect(stakingErrorText(e('insufficient_funds'), t), 'F');
    expect(stakingErrorText(e('risk_ack_required'), t), 'R');
    expect(stakingErrorText(e('something_else'), t), 'G');
    expect(stakingErrorText(const ApiException(status: 0, code: 'network', message: ''), t), 'N');
    expect(stakingErrorText(StateError('x'), t), 'G');
    expect(kStakingErrorLink['kyc_required']!.$1, '/profile/verification');
    expect(kStakingErrorLink['insufficient_funds']!.$1, '/wallet/deposit');
    expect(stakingErrorSoft(e('payment_pending', 503)), isTrue);
    expect(stakingOutcomeUnknown(e('payment_pending', 503)), isTrue);
    expect(stakingOutcomeUnknown(const ApiException(status: 0, code: 'network', message: '')), isTrue);
    expect(stakingOutcomeUnknown(e('below_minimum')), isFalse);
    expect(stakingPaymentRefused(e('payment_failed')), isTrue);
    expect(stakingPaymentRefused(e('insufficient_funds')), isTrue);
  });

  test('navigation: after Prop, off with its module switch', () {
    final keys = kNav.map((m) => m.key).toList();
    expect(keys.indexOf('staking'), keys.indexOf('prop') + 1);
    final m = kNav.firstWhere((m) => m.key == 'staking');
    expect(m.sub.map((s) => s.href), ['/staking', '/staking/portfolio', '/staking/history']);
    expect(pageModule('/staking/history'), 'staking');
    final off = AppConfig.fromJson(const {
      'modules': {'staking': false},
    });
    expect(navForFeatures(kNav, off).any((m) => m.key == 'staking'), isFalse);
    expect(pageOn(off, '/staking/portfolio'), isFalse);
    final session = Session(token: 'x' * 40, expiresAt: DateTime.now().add(const Duration(days: 7)));
    final me = SessionUser.fromJson(const {
      'user': {'id': 7, 'email': 'a@b.c', 'first_name': 'A', 'last_name': 'B', 'kyc_status': 'verified'},
    });
    String? go(AppConfig cfg) =>
        redirectFor(auth: AuthSignedIn(session, me), maintenance: false, updateRequired: false, uri: Uri.parse('/staking'), config: cfg);
    expect(go(off), '/unavailable');
    expect(
      go(
        AppConfig.fromJson(const {
          'modules': {'staking': true},
        }),
      ),
      isNull,
    );
  });

  testWidgets('plans page and the subscribe sheet: Subscribe only with a valid amount and both acceptances', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/staking');
    await settle(tester);

    final t = tester.element(find.byType(StakingPlansScreen)).t;
    expect(find.text(t('staking.how.title')), findsOneWidget);
    expect(find.text(t('staking.risk.title')), findsOneWidget);
    final page = _page<StakingPlansScreen>();
    final card = find.widgetWithText(StakingPlanCard, 'Stable 3M');
    await _scrollTo(tester, card, page);
    // the settled months of the plan, never a promise
    expect(find.descendant(of: card, matching: find.textContaining('0.85%')), findsOneWidget);

    final subscribe = find.descendant(of: card, matching: find.widgetWithText(KButton, t('staking.plan.subscribe')));
    await tester.tap(subscribe);
    await settle(tester);

    final sheet = find.byType(StakingSubscribeSheet);
    expect(sheet, findsOneWidget);
    expect(find.text(t('staking.subscribe.title', {'plan': 'Stable 3M'})), findsOneWidget);
    expect(find.text(t('staking.subscribe.walletBalance', {'balance': '3,000.40 USDT'})), findsOneWidget);
    KButton confirm() => tester.widget<KButton>(find.byKey(StakingSubscribeSheet.confirmKey));
    final field = find.descendant(of: sheet, matching: find.byType(TextField));
    final checks = find.descendant(of: sheet, matching: find.byType(KCheckRow));
    expect(checks, findsNWidgets(2));
    expect(confirm().onPressed, isNull);

    await tester.enterText(field, '250');
    await tester.pump();
    expect(confirm().onPressed, isNull);
    await tester.ensureVisible(checks.at(0));
    await tester.tap(checks.at(0));
    await tester.pump();
    // the terms alone are not enough: the risk acknowledgement too
    expect(confirm().onPressed, isNull);
    await tester.ensureVisible(checks.at(1));
    await tester.tap(checks.at(1));
    await tester.pump();
    expect(confirm().onPressed, isNotNull);
    expect(confirm().label, t('staking.subscribe.confirm', {'amount': '250.00 USDT'}));

    // below the minimum, then more than the wallet holds (Deposit offered)
    await tester.enterText(field, '50');
    await tester.pump();
    expect(confirm().onPressed, isNull);
    expect(find.text(t('staking.subscribe.belowMin', {'min': '100.00 USDT'})), findsOneWidget);
    await tester.enterText(field, '5000');
    await tester.pump();
    expect(confirm().onPressed, isNull);
    expect(find.text(t('staking.subscribe.short', {'balance': '3,000.40 USDT'})), findsOneWidget);
    expect(find.descendant(of: sheet, matching: find.widgetWithText(KButton, t('staking.subscribe.deposit'))), findsOneWidget);

    await tester.enterText(field, '250');
    await tester.pump();
    await tester.tap(find.byKey(StakingSubscribeSheet.confirmKey));
    await settle(tester);
    expect(find.text(t('staking.subscribe.doneTitle')), findsOneWidget);
    expect(find.widgetWithText(KButton, t('staking.subscribe.viewStaking')), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('a paused or full plan cannot be subscribed', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/staking');
    await settle(tester);
    final t = tester.element(find.byType(StakingPlansScreen)).t;
    final page = _page<StakingPlansScreen>();
    for (final name in ['Prime 12M', 'Starter 1M']) {
      final card = find.widgetWithText(StakingPlanCard, name);
      await _scrollTo(tester, card, page);
      final subscribe = find.descendant(of: card, matching: find.widgetWithText(KButton, t('staking.plan.subscribe')));
      expect(tester.widget<KButton>(subscribe).onPressed, isNull, reason: name);
    }
    expect(find.text(t('staking.plan.noPastReturns')), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('my staking: figures, positions and a position detail', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/staking/portfolio');
    await settle(tester);

    final t = tester.element(find.byType(StakingPortfolioScreen)).t;
    expect(find.text('3,500.00 USDT'), findsOneWidget);
    expect(find.text(t('staking.kpi.active', {'count': 2})), findsOneWidget);
    expect(find.text('73.35 USDT'), findsWidgets);

    final page = _page<StakingPortfolioScreen>();
    final tiles = find.byType(StakingPositionTile);
    await _scrollTo(tester, tiles.first, page);
    expect(tiles, findsNWidgets(4));
    // active first, newest first: Growth 6M #1051
    expect(find.descendant(of: tiles.first, matching: find.text('Growth 6M')), findsOneWidget);
    await tester.tap(tiles.first);
    await settle(tester);

    expect(find.byType(StakingPositionSheet), findsOneWidget);
    expect(find.text(t('staking.position.title', {'plan': 'Growth 6M', 'id': 1051})), findsWidgets);
    expect(find.text(t('staking.position.locked')), findsOneWidget);
    expect(find.text('31.25 USDT'), findsWidgets);
    await unmount(tester);
  });

  testWidgets('history lists the events with signed amounts', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/staking/history');
    await settle(tester);

    final t = tester.element(find.byType(StakingHistoryScreen)).t;
    expect(find.text(t('staking.history.title')), findsWidgets);
    final page = _page<StakingHistoryScreen>();
    final rows = find.byType(StakingEventRow);
    expect(rows, findsWidgets);
    await _scrollTo(tester, find.text('+31.25 USDT'), page);
    expect(find.text('+31.25 USDT'), findsOneWidget);
    await _scrollTo(tester, find.text('-2,500.00 USDT'), page);
    expect(find.text('-2,500.00 USDT'), findsOneWidget);
    // a failed payment moved nothing: no sign
    await _scrollTo(tester, find.text('4,000.00 USDT'), page);
    expect(find.text('4,000.00 USDT'), findsOneWidget);
    await unmount(tester);
  });
}
