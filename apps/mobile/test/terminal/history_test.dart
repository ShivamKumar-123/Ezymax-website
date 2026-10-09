// History periods (web toolbox History): Today from server midnight, the period's range from trade/history merged with
// the live deals, the web's totals, and the period chips on the History tab.
import 'package:ezymex/features/terminal/cfd/history_tab.dart';
import 'package:ezymex/features/terminal/core/history.dart';
import 'package:ezymex/features/terminal/core/market.dart';
import 'package:ezymex/features/terminal/core/models.dart';
import 'package:ezymex/features/terminal/core/sessions.dart';
import 'package:ezymex/features/terminal/core/terminal_controller.dart';
import 'package:ezymex/i18n/i18n.dart';
import 'package:ezymex/ui/ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'harness.dart';

TClosed row(String deal, DateTime close, double profit) => TClosed(
  deal: deal,
  ticket: deal,
  symbol: 'EURUSD',
  side: 'buy',
  volume: 1,
  openPrice: 1,
  openTime: close.subtract(const Duration(hours: 1)),
  closePrice: 1,
  closeTime: close,
  swap: 0,
  commission: 0,
  profit: profit,
  reason: 'manual',
  source: 'manual',
);

void main() {
  group('periods', () {
    test('Today starts at server midnight (GMT+3), like the web', () {
      // 22:30 UTC is 01:30 the next day on the server: today began at 21:00 UTC
      expect(historySince('today', DateTime.utc(2026, 10, 8, 22, 30)), DateTime.utc(2026, 10, 8, 21));
      // 10:00 UTC is 13:00 on the server: today began yesterday at 21:00 UTC
      expect(historySince('today', DateTime.utc(2026, 10, 8, 10)), DateTime.utc(2026, 10, 7, 21));
    });

    test('the others go back whole days; All has no start; Last month is the default', () {
      final now = DateTime.utc(2026, 10, 8, 12);
      expect(historySince('3d', now), DateTime.utc(2026, 10, 5, 12));
      expect(historySince('week', now), DateTime.utc(2026, 10, 1, 12));
      expect(historySince('month', now), DateTime.utc(2026, 9, 8, 12));
      expect(historySince('3m', now), DateTime.utc(2026, 7, 10, 12));
      expect(historySince('all', now), isNull);
      expect(kHistoryPeriods.map((p) => p.$1), ['today', '3d', 'week', 'month', '3m', 'all']);
      final c = ProviderContainer();
      addTearDown(c.dispose);
      expect(c.read(historyPeriodProvider), 'month');
    });

    test('the loaded range and the live deals merge: in the period, newest first, once each', () {
      final now = DateTime.utc(2026, 10, 8, 12);
      final loaded = [row('1', now.subtract(const Duration(days: 2)), 5), row('2', now.subtract(const Duration(days: 10)), -3)];
      final live = [row('3', now.subtract(const Duration(hours: 1)), 7), row('1', now.subtract(const Duration(days: 2)), 5)];
      final week = mergeHistory(loaded, live, historySince('week', now));
      expect(week.map((r) => r.deal), ['3', '1']);
      expect(mergeHistory(loaded, live, null).map((r) => r.deal), ['3', '1', '2']);
    });

    test('totals: trades, win rate, gross profit / loss and profit factor (infinite without a loss)', () {
      final now = DateTime.utc(2026, 10, 8);
      final s = HistoryStats.of([row('a', now, 30), row('b', now, -10), row('c', now, 20), row('d', now, 0)]);
      expect(s.trades, 4);
      expect(s.winRate, 50);
      expect(s.grossProfit, 50);
      expect(s.grossLoss, -10);
      expect(s.net, 40);
      expect(s.pfText, '5.00');
      expect(HistoryStats.of([row('a', now, 1)]).pfText, '∞');
      expect(HistoryStats.of(const []).winRate, 0);
    });
  });

  group('on the preview trade server', () {
    late Harness h;

    Future<void> boot(WidgetTester tester) async {
      await loadFonts();
      tester.view.physicalSize = const Size(412, 915);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.runAsync(() async {
        h = await Harness.create(
          extra: [
            marketFeedProvider.overrideWith((ref) => FixedFeed({'EURUSD': q('EURUSD', 1.0845, 1.0846)})),
          ],
        );
        h.container.listen(terminalProvider, (_, _) {});
        await h.container.read(tradeSessionsProvider.notifier).start(preferred: '10042817');
        await h.container.read(symbolsProvider.future);
        await until(() => h.container.read(terminalProvider).synced);
      });
    }

    Future<void> done(WidgetTester tester) async {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.runAsync(() async => h.container.dispose());
    }

    testWidgets('trade/history is read from the start of the period', (tester) async {
      await boot(tester);
      late List<Map<String, dynamic>> week, all;
      await tester.runAsync(() async {
        week = await h.container.read(historyRangeProvider('week').future);
        all = await h.container.read(historyRangeProvider('all').future);
      });
      final since = historySince('week', DateTime.now())!;
      expect(week, isNotEmpty);
      expect(week.every((d) => !DateTime.parse('${d['time']}').isBefore(since)), isTrue);
      expect(all.length, greaterThan(week.length));
      await done(tester);
    });

    testWidgets('the period chips change the rows and the totals (Last month by default)', (tester) async {
      await boot(tester);
      final t = h.container.read(tProvider);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: h.container,
          child: MaterialApp(
            theme: KTheme.trader(Brightness.dark),
            home: I18nScope(
              t: t,
              child: const Scaffold(body: HistoryTab()),
            ),
          ),
        ),
      );
      Future<void> settle() async {
        for (var i = 0; i < 4; i++) {
          await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
          await tester.pump(const Duration(milliseconds: 50));
        }
      }

      String trades() {
        final totals = find.byKey(const ValueKey('history-totals'));
        final label = find.descendant(of: totals, matching: find.text('Trades'));
        final row = find.ancestor(of: label, matching: find.byType(Row)).first;
        return (tester.widget<Text>(find.descendant(of: row, matching: find.byType(Text)).last)).data!;
      }

      final strip = find.descendant(of: find.byType(PeriodChips), matching: find.byType(Scrollable));
      Future<void> pick(String p, {double step = 120}) async {
        final chip = find.byKey(ValueKey('history-period-$p'));
        await tester.scrollUntilVisible(chip, step, scrollable: strip);
        await tester.pump(const Duration(milliseconds: 300));
        await tester.tap(chip);
        await settle();
      }

      await settle();
      expect(find.text('Today'), findsOneWidget);
      expect(find.text('Last 3 days'), findsOneWidget);
      // the preview's closed trades: 30 h … 12 days ago in the month, one 45 days and one 160 days ago
      expect(trades(), '7');
      await pick('week');
      expect(h.container.read(historyPeriodProvider), 'week');
      expect(trades(), '5');
      // EURUSD +27.30, XAUUSD +285.40, NAS100 -49.10, GBPUSD -45.10, BTCUSD +56.40 (after the swap)
      expect(find.text('60.0%'), findsOneWidget);
      expect(find.text('3.92'), findsOneWidget);
      await pick('3m');
      expect(trades(), '8');
      await pick('all');
      expect(trades(), '9');
      await pick('today', step: -120);
      expect(trades(), '0');
      expect(find.text('No closed trades in this period'), findsOneWidget);
      await done(tester);
    });
  });
}
