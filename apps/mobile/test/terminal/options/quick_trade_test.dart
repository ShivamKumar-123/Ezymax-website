// The options mode on the preview data: the account opens, the options service answers (underlyings, expiries, the
// chain), the bottom bar shows Markets · Chart · Chain · Trade · Positions, and Quick trade buys an option: Up → the
// strike → contracts → "What happens" → confirm, the order reaches the preview server, the trader sees "Done" and the
// position count in the bottom bar.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kalks/core/notifications/notifications.dart';
import 'package:kalks/features/terminal/chart/terminal_chart.dart';
import 'package:kalks/features/terminal/core/market.dart';
import 'package:kalks/features/terminal/core/sessions.dart';
import 'package:kalks/features/terminal/core/terminal_controller.dart';
import 'package:kalks/features/terminal/options/core/store.dart';
import 'package:kalks/features/terminal/options/options_preview.dart';
import 'package:kalks/features/terminal/options/options_terminal.dart';
import 'package:kalks/features/terminal/widgets/kit.dart';
import 'package:kalks/i18n/i18n.dart';
import 'package:kalks/ui/ui.dart';

import 'opt_harness.dart';

void main() {
  late ProviderContainer c;

  Future<void> boot(WidgetTester tester) async {
    await loadFonts();
    TerminalChart.forceNative = true;
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.runAsync(() async {
      c = await optionsContainer();
      c.listen(terminalProvider, (_, _) {});
      c.listen(optionsProvider, (_, _) {});
      await c.read(tradeSessionsProvider.notifier).start(preferred: '10042817');
      await c.read(symbolsProvider.future);
      await until(() => c.read(terminalProvider).synced);
      await until(() => c.read(optionsProvider).avail == OptAvail.ready && c.read(optionsProvider).chainOnScreen != null);
      // an expiry more than a day away: today's may already be close-only near its cut
      final s = c.read(optionsProvider);
      final later = s.expiries.where((e) => expiryOpen(e) && e.cutMs - DateTime.now().millisecondsSinceEpoch > 86400000).toList()
        ..sort((a, b) => a.cutMs.compareTo(b.cutMs));
      c.read(optionsProvider.notifier).selectExpiry(later.first.date);
      await until(() => c.read(optionsProvider).chainOnScreen?.expiry == later.first.date);
    });
  }

  Future<void> show(WidgetTester tester) async {
    final t = c.read(tProvider);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: c,
        child: MaterialApp(
          theme: KTheme.trader(Brightness.dark),
          // like the app: the texts above the navigator, so sheets have them too
          builder: (context, child) => I18nScope(t: t, child: child!),
          home: const Scaffold(body: OptionsTerminal()),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 50));
  }

  /// Lets the previews and the order answer (the preview server answers at once; timers are the test's).
  Future<void> settle(WidgetTester tester, {int rounds = 8}) async {
    for (var i = 0; i < rounds; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
      await tester.pump(const Duration(milliseconds: 400));
    }
  }

  Future<void> done(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    // the market stream's demand timer of the rows that left the screen
    await tester.pump(const Duration(seconds: 1));
    await tester.runAsync(() async => c.dispose());
    TerminalChart.forceNative = false;
  }

  testWidgets('bottom bar, Quick trade: Up → strike → contracts → what happens → buy', (tester) async {
    await boot(tester);
    final login = c.read(terminalProvider).login;
    final before = PreviewOptions.instance.bookOf(login).positions.length;
    await show(tester);

    // the web's tabs; Quick trade is the default panel, so Trade opens first
    for (final label in ['Markets', 'Chart', 'Chain', 'Trade', 'Positions']) {
      expect(find.text(label), findsWidgets);
    }
    expect(find.text('Quick trade'), findsOneWidget);
    expect(find.text('Up'), findsOneWidget);
    expect(find.text('Down'), findsOneWidget);

    await tester.tap(find.text('Up'));
    await settle(tester);

    // step 4: how high, three strikes from ATM up; step 5: contracts
    expect(find.textContaining('How high will'), findsOneWidget);
    final confirm = find.textContaining(RegExp(r'^Buy\W+1\W+×'));
    await tester.scrollUntilVisible(confirm, 300, scrollable: find.byType(Scrollable).first);
    await settle(tester);
    expect(find.text('What happens'), findsOneWidget);
    expect(find.textContaining('Pay '), findsWidgets);

    // two contracts
    final two = find.descendant(of: find.byType(TQuickStrip<int>), matching: find.text('2'));
    await tester.scrollUntilVisible(two, -200, scrollable: find.byType(Scrollable).first);
    await tester.tap(two);
    await settle(tester);
    final confirm2 = find.textContaining(RegExp(r'^Buy\W+2\W+×'));
    await tester.scrollUntilVisible(confirm2, 300, scrollable: find.byType(Scrollable).first);
    await settle(tester);
    await tester.tap(confirm2);
    await settle(tester);

    expect(find.text('Done: your option is open'), findsOneWidget);
    final book = PreviewOptions.instance.bookOf(login);
    expect(book.positions.length, before + 1);
    final p = book.positions.last;
    expect(p['side'], 'buy');
    expect(p['contracts'], 2);
    expect('${p['symbol']}', startsWith('EURUSD-'));
    expect('${p['symbol']}', endsWith('-C'));
    final notes = c.read(notificationsProvider.notifier) as RecordedNotes;
    expect(notes.toasts.map((x) => x.title), contains('Option order filled'));
    expect(notes.toasts.where((x) => x.kind == NotificationKind.error), isEmpty);

    // "See my positions": the new option is a card there
    await tester.tap(find.text('See my positions'));
    await settle(tester, rounds: 3);
    expect(find.text('Open · ${before + 1}'), findsOneWidget);
    expect(find.text('Close'), findsWidgets);
    await done(tester);
  });

  testWidgets('chain: tap a price, the selection bar opens the ticket with that side', (tester) async {
    await boot(tester);
    await show(tester);
    await tester.tap(find.text('Chain'));
    await settle(tester, rounds: 3);
    expect(find.text('CALLS'), findsWidgets);
    expect(find.text('STRIKE'), findsOneWidget);
    expect(find.text('ATM'), findsOneWidget);
    // the price pills of the Simple columns: tap the first call price on screen
    final prices = find.textContaining(r'$');
    expect(prices, findsWidgets);
    await tester.tap(prices.first);
    await settle(tester, rounds: 3);
    final s = c.read(optionsProvider);
    expect(s.sel, isNotNull);
    expect(s.ticket.legs, hasLength(1));
    // Buy in the selection bar: the ticket with Buy chosen
    await tester.tap(find.text('BUY'));
    await settle(tester, rounds: 3);
    expect(c.read(optionsProvider).ticket.armed, isTrue);
    expect(c.read(optionsProvider).ticket.legs.single.side, 'buy');
    expect(find.text('Order'), findsOneWidget);
    expect(find.text('More order options'), findsOneWidget);
    await done(tester);
  });

  testWidgets('every tab and view lays out on a phone: markets, chart, analytics, positions, closed, settled, builder', (tester) async {
    await boot(tester);
    await show(tester);
    final t = c.read(tProvider);

    await tester.tap(find.text('Markets'));
    await settle(tester, rounds: 2);
    expect(find.text('EURUSD'), findsWidgets);
    expect(find.text('XAUUSD'), findsWidgets);

    await tester.tap(find.text('Chart').last);
    await settle(tester, rounds: 3);
    expect(find.text(t('trader.opt.chart.premium')), findsOneWidget);
    expect(find.text('M15'), findsOneWidget);
    await tester.tap(find.text(t('trader.opt.an.tab')));
    await settle(tester, rounds: 4);
    expect(find.text(t('trader.opt.an.smile.title').toUpperCase()), findsOneWidget);
    expect(find.text(t('trader.opt.an.term.title').toUpperCase()), findsOneWidget);

    await tester.tap(find.text('Positions'));
    await settle(tester, rounds: 3);
    expect(find.text('Close'), findsWidgets);
    await tester.tap(find.text(t('trader.opt.hist.tab')));
    await settle(tester, rounds: 3);
    expect(find.textContaining('#'), findsWidgets);
    await tester.tap(find.text(t('trader.opt.m.settled')));
    await settle(tester, rounds: 3);
    expect(find.text(t('trader.opt.set.summary', {'count': 2})), findsOneWidget);

    await tester.tap(find.text('Chain'));
    await settle(tester, rounds: 2);
    await tester.tap(find.bySemanticsLabel(t('trader.opt.builder.open')));
    await settle(tester, rounds: 4);
    expect(find.text(t('trader.opt.builder.title')), findsOneWidget);
    expect(find.text(t('trader.opt.tpl.straddle.name')), findsWidgets);
    expect(find.text(t('trader.opt.payoff.atExpiry')), findsWidgets);
    await done(tester);
  });
}
