// API & Algo on the sample-data API: creating an API key (the secret shown once, then gone) and revoking it after the
// confirm, creating a webhook (the URL shown once) and sending a test alert, pausing and killing a running strategy
// and the account kill switch, and running a backtest to its report.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ezymex/features/developer/backtests_screen.dart';
import 'package:ezymex/features/developer/deployments_screen.dart';
import 'package:ezymex/features/developer/keys_screen.dart';
import 'package:ezymex/features/developer/webhooks_screen.dart';
import 'package:ezymex/preview/c2/developer.dart';
import 'package:ezymex/router/router.dart';
import 'package:ezymex/ui/ui.dart';

import '../helpers/test_app.dart';

Finder _page<W>() => find.descendant(of: find.byType(W), matching: find.byType(Scrollable)).first;

/// Scrolls `f` into view, then to the middle of the screen (clear of the frosted header and tab bar).
Future<void> _scrollTo(WidgetTester tester, Finder f, Finder page) async {
  await tester.scrollUntilVisible(f, 250, scrollable: page);
  await tester.pump();
  unawaited(Scrollable.ensureVisible(tester.element(f.first), alignment: 0.5));
  await settle(tester, frames: 3);
}

const _secret = 'ks_Hc8vR2nZ0tYq4mWb6eKx1jPu5sDf7gAo';

void main() {
  setUp(resetPreviewDeveloper);

  testWidgets('API keys: create a key, the secret once, then revoke it after the confirm', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/developer');
    await settle(tester);
    expect(find.byType(DeveloperKeysScreen), findsOneWidget);
    expect(find.text('API & Algo'), findsWidgets);
    expect(find.text('Portfolio dashboard'), findsOneWidget);

    await tester.tap(find.text('Create API key'));
    await settle(tester);
    expect(find.text('Create key'), findsOneWidget);
    // the demo account and both scopes are picked
    expect(find.descendant(of: find.byType(KSheetContent), matching: find.text('Demo #80412337')), findsOneWidget);
    await tester.tap(find.text('Create key'));
    await settle(tester);

    // the secret, shown once with the copy buttons and the warning
    expect(find.text('“Trading bot” created'), findsOneWidget);
    expect(find.text('Copy the secret now: it is shown once and never stored in readable form.'), findsOneWidget);
    expect(find.text(_secret), findsOneWidget);
    expect(find.text('kk_7Qm2xW9pLs09'), findsWidgets);
    final page = _page<DeveloperKeysScreen>();
    await _scrollTo(tester, find.text('I stored it'), page);
    await tester.tap(find.text('I stored it'));
    await settle(tester, frames: 4);
    expect(find.text(_secret), findsNothing);

    // the new key is first: revoke it
    await _scrollTo(tester, find.text('kk_7Qm2xW9pLs09'), page);
    await tester.tap(find.widgetWithText(KButton, 'Revoke').first);
    await settle(tester);
    expect(find.text('Revoke “Trading bot”? Requests with it fail at once.'), findsOneWidget);
    await tester.tap(find.text('Revoke').last);
    await settle(tester);
    expect(find.text('Key revoked'), findsWidgets);
    // two keys stay active
    expect(find.widgetWithText(KButton, 'Revoke'), findsNWidgets(2));
    await unmount(tester);
  });

  testWidgets('webhooks: create a webhook, the URL once, then send a test alert', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/developer/webhooks');
    await settle(tester);
    expect(find.byType(DeveloperWebhooksScreen), findsOneWidget);
    expect(find.text('Your webhooks'), findsOneWidget);

    await tester.tap(find.text('New webhook'));
    await settle(tester);
    expect(find.text('Create webhook'), findsOneWidget);
    // one account routed by default (the demo account, 0.01 lot)
    expect(find.text('#80412337'), findsWidgets);
    await tester.tap(find.text('Create webhook'));
    await settle(tester);
    expect(find.text('Your webhook URL, shown once'), findsOneWidget);
    expect(find.text('https://api.ezymex.com/algo/hooks/wh_5f2c9a71d0e44b8ab3c6e2f19d7a0b6c'), findsOneWidget);

    final page = _page<DeveloperWebhooksScreen>();
    await _scrollTo(tester, find.text('Send test'), page);
    await tester.tap(find.text('Send test'));
    await settle(tester);
    expect(find.text('Alert accepted'), findsWidgets);
    await unmount(tester);
  });

  testWidgets('deployments: pause a running strategy, kill it after the confirm, then the kill switch', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/developer/deployments');
    await settle(tester);
    expect(find.byType(DeveloperDeploymentsScreen), findsOneWidget);
    expect(find.text('Running strategies'), findsWidgets);
    expect(find.text('Kill switch'), findsOneWidget);

    final page = _page<DeveloperDeploymentsScreen>();
    await _scrollTo(tester, find.widgetWithText(KButton, 'Pause'), page);
    await tester.tap(find.widgetWithText(KButton, 'Pause'));
    await settle(tester);
    expect(find.text('Paused'), findsWidgets);
    expect(find.widgetWithText(KButton, 'Resume'), findsOneWidget);

    await _scrollTo(tester, find.widgetWithText(KButton, 'Kill'), page);
    await tester.tap(find.widgetWithText(KButton, 'Kill'));
    await settle(tester);
    expect(find.text('Kill “EMA trend H1”?'), findsOneWidget);
    await tester.tap(find.text('Kill and close'));
    await settle(tester);
    expect(find.text('Strategy killed'), findsWidgets);
    expect(find.widgetWithText(KButton, 'Resume'), findsNothing);

    await _scrollTo(tester, find.text('Stop all automation'), page);
    await tester.tap(find.text('Stop all automation'));
    await settle(tester);
    expect(find.text('Stop all automated trading?'), findsOneWidget);
    await tester.tap(find.text('Kill all'));
    await settle(tester);
    expect(find.text('Kill switch on'), findsWidgets);
    await _scrollTo(tester, find.text('Release kill switch'), page);
    expect(find.text('Release kill switch'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('backtests: run a backtest and read its report', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/developer/backtests');
    await settle(tester);
    expect(find.byType(DeveloperBacktestsScreen), findsOneWidget);
    expect(find.text('Backtests'), findsWidgets);

    final page = _page<DeveloperBacktestsScreen>();
    await _scrollTo(tester, find.text('Run backtest'), page);
    await tester.tap(find.text('Run backtest'));
    await settle(tester);
    expect(find.text('Backtest queued'), findsWidgets);
    await _scrollTo(tester, find.text('Equity curve'), page);
    expect(find.text('Net profit'), findsWidgets);
    expect(find.text(r'$1,284.50'), findsWidgets);
    await unmount(tester);
  });
}
