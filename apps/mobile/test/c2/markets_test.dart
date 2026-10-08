// Dashboard › Markets / News / Calendar and the Options page on the sample-data API: the web's sections in order and
// the main flows (instrument sheet + favourites, story sheet + reading list, event detail + reminder, accepting the
// options terms, and without an Options account the call to open one).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ezymex/core/models/account.dart';
import 'package:ezymex/data/client_data.dart';
import 'package:ezymex/features/accounts/open_account_screen.dart';
import 'package:ezymex/features/calendar/calendar_screen.dart';
import 'package:ezymex/features/markets/markets_feed.dart';
import 'package:ezymex/features/markets/markets_screen.dart';
import 'package:ezymex/features/news/news_screen.dart';
import 'package:ezymex/features/options_intro/options_screen.dart';
import 'package:ezymex/features/terminal/preview/preview_server.dart';
import 'package:ezymex/preview/c2/options.dart';
import 'package:ezymex/preview/preview_data.dart';
import 'package:ezymex/router/router.dart';

import '../helpers/test_app.dart';

Finder _page<W>() => find.descendant(of: find.byType(W), matching: find.byType(Scrollable)).first;

/// Scrolls `f` into view, then to the middle of the screen (clear of the frosted header and tab bar).
Future<void> _scrollTo(WidgetTester tester, Finder f, Finder page) async {
  await tester.scrollUntilVisible(f, 250, scrollable: page);
  await tester.pump();
  unawaited(Scrollable.ensureVisible(tester.element(f.first), alignment: 0.5));
  await settle(tester, frames: 3);
}

void main() {
  testWidgets('markets: heatmap, list, instrument sheet and favourites', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/markets');
    await settle(tester);
    expect(find.byType(MarketsScreen), findsOneWidget);
    expect(find.text('Markets'), findsWidgets);
    expect(find.text('Open terminal'), findsOneWidget);
    expect(find.text('Market heatmap'), findsOneWidget);

    final page = _page<MarketsScreen>();
    await _scrollTo(tester, find.text('Euro vs US Dollar'), page);
    // the default favourites, then EURUSD removed from them
    expect(c.read(marketFavouritesProvider), contains('EURUSD'));
    await tester.tap(find.text('Euro vs US Dollar'));
    await settle(tester);
    expect(find.text('Instrument details'), findsOneWidget);
    expect(find.text('Contract specification'), findsOneWidget);
    expect(find.text('Trade EURUSD'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Favourite').last);
    await settle(tester, frames: 4);
    expect(c.read(marketFavouritesProvider), isNot(contains('EURUSD')));
    expect(find.text('EURUSD removed from favourites'), findsWidgets);
    await unmount(tester);
  });

  testWidgets('news: featured story, brief, world map and the story sheet', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/news');
    await settle(tester);
    expect(find.byType(NewsScreen), findsOneWidget);
    expect(find.text('Market news'), findsOneWidget);
    expect(find.text('Fed holds rates steady, signals patience as inflation cools'), findsOneWidget);
    final page = _page<NewsScreen>();
    for (final s in ["Today's market brief", 'News around the world', 'Most mentioned', 'Market sessions']) {
      await _scrollTo(tester, find.text(s), page);
      expect(find.text(s), findsWidgets, reason: s);
    }
    await _scrollTo(tester, find.text('Gold climbs to a two-week high as the dollar eases'), page);
    await tester.tap(find.text('Gold climbs to a two-week high as the dollar eases'));
    await settle(tester);
    expect(find.text('Copy link'), findsOneWidget);
    expect(find.text('Trade XAUUSD'), findsOneWidget);
    await tester.tap(find.text('Save'));
    await settle(tester, frames: 4);
    expect(c.read(savedNewsProvider), contains(9102));
    await unmount(tester);
  });

  testWidgets('calendar: cards, the week, event detail and a reminder', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/calendar');
    await settle(tester);
    expect(find.byType(CalendarScreen), findsOneWidget);
    for (final s in ['Economic calendar', 'Next high-impact', 'This week', 'High-impact alerts']) {
      expect(find.text(s), findsWidgets, reason: s);
    }
    final page = _page<CalendarScreen>();
    // Friday's payrolls are in the future for most of the week: open it and set a reminder
    await _scrollTo(tester, find.text('Impact'), page);
    final days = find.descendant(of: find.byType(CalendarScreen), matching: find.byType(Scrollable)).at(1);
    await tester.scrollUntilVisible(find.text('Friday'), 120, scrollable: days);
    await settle(tester, frames: 3);
    await tester.tap(find.text('Friday'));
    await settle(tester, frames: 4);
    await _scrollTo(tester, find.text('Non-Farm Employment Change'), page);
    await tester.tap(find.text('Non-Farm Employment Change'));
    await settle(tester);
    await _scrollTo(tester, find.text('Release history'), page);
    expect(find.text('This release'), findsOneWidget);
    final remind = find.text('Remind me 15 min before');
    if (remind.evaluate().isNotEmpty) {
      await _scrollTo(tester, remind, page);
      await tester.tap(remind);
      await settle(tester);
      expect(find.text('Remove reminder'), findsOneWidget);
    }
    await unmount(tester);
  });

  testWidgets('options: intro, terms, then "I understand" + Start trading options accepts and opens the terminal', (tester) async {
    resetPreviewOptions();
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/options');
    await settle(tester);
    expect(find.byType(OptionsScreen), findsOneWidget);
    expect(find.text('Ezymex FX Options'), findsOneWidget);
    expect(find.text('Get started'), findsOneWidget);
    final page = _page<OptionsScreen>();
    await _scrollTo(tester, find.text('Options in three simple ideas'), page);
    await _scrollTo(tester, find.text('Read full terms'), page);
    await tester.tap(find.text('Read full terms'));
    await settle(tester);
    expect(find.text('Options terms'), findsWidgets);
    await tester.tap(find.text('Close').last);
    await settle(tester);

    await _scrollTo(tester, find.text('I understand how options work'), page);
    await tester.tap(find.text('I understand how options work'));
    await settle(tester, frames: 3);
    await _scrollTo(tester, find.text('Start trading options'), page);
    // Ezymex Trader's sample trade server ticks on a periodic timer with no stop: start it under real async, so it
    // isn't a fake timer left pending when this test ends
    await tester.runAsync(() async => PreviewServer.instance.answer('GET', 'trade/symbols', const {}, const {}, null));
    await tester.tap(find.text('Start trading options'));
    await settle(tester);
    // Ezymex Trader (agent D's screen) opens next; its chart is a WebView, which widget tests can't host: its errors
    // are not this page's
    final original = FlutterError.onError;
    final foreign = <FlutterErrorDetails>[];
    FlutterError.onError = (d) => '${d.stack}'.contains('features/options_intro') ? original?.call(d) : foreign.add(d);
    // several accounts: choose one
    if (find.text('Choose an account').evaluate().isNotEmpty) {
      await tester.tap(find.textContaining('#').first);
      await settle(tester);
    }
    expect(find.text("You're all set for options"), findsWidgets);
    final at = c.read(routerProvider).routerDelegate.currentConfiguration;
    expect(at.last.matchedLocation, '/trader');
    expect(at.uri.queryParameters['mode'] ?? at.last.matchedLocation, isNotEmpty);
    // back to the Client Area, then let the terminal's own timers (streams, reconnects) run out
    c.read(routerProvider).pop();
    await settle(tester, frames: 4);
    await unmount(tester);
    await tester.pump(const Duration(minutes: 5));
    FlutterError.onError = original;
  });

  test('options trade on Options accounts only', () {
    final all = [for (final a in previewAccounts['accounts'] as List) EngineAccount.fromJson((a as Map).cast<String, dynamic>())];
    expect([for (final a in optionsAccounts(all)) a.login], [20031150]);
    expect(optionsAccounts(all.where((a) => !a.isOptions).toList()), isEmpty);
  });

  testWidgets('options without an Options account: the call to open one, preset to Options', (tester) async {
    resetPreviewOptions();
    final cfdOnly = [
      for (final a in previewAccounts['accounts'] as List)
        if ((a as Map)['product'] != 'options') EngineAccount.fromJson(a.cast<String, dynamic>()),
    ];
    final c = await pumpApp(tester, signedIn: true, overrides: [accountsProvider.overrideWith((ref) async => cfdOnly)]);
    c.read(routerProvider).go('/options');
    await settle(tester);
    expect(find.byType(OptionsScreen), findsOneWidget);
    final page = _page<OptionsScreen>();
    // the intro and its terms wait for an Options account
    await _scrollTo(tester, find.text('Options trade on an Options account'), page);
    expect(find.text('I understand how options work'), findsNothing);
    await _scrollTo(tester, find.text('Open an Options account'), page);
    await tester.tap(find.text('Open an Options account').last);
    await settle(tester);
    final at = c.read(routerProvider).routerDelegate.currentConfiguration;
    expect(at.uri.path, '/accounts/new');
    expect(at.uri.queryParameters['product'], 'options');
    expect(find.byType(OpenAccountScreen), findsOneWidget);
    // the wizard starts at Live / Demo with the Options product chosen
    expect(find.text('Choose an account'), findsWidgets);
    await unmount(tester);
  });
}
