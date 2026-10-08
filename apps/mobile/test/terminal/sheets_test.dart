// The order sheet (web order form) and the position sheet (web PositionDialog) on the preview trade server, with
// fixed quotes and the trade actions recorded instead of sent.
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ezymex/features/terminal/cfd/order_sheet.dart';
import 'package:ezymex/features/terminal/cfd/position_sheet.dart';
import 'package:ezymex/features/terminal/core/market.dart';
import 'package:ezymex/features/terminal/core/order.dart';
import 'package:ezymex/features/terminal/core/sessions.dart';
import 'package:ezymex/features/terminal/core/terminal_controller.dart';
import 'package:ezymex/features/terminal/core/trade_actions.dart';
import 'package:ezymex/i18n/i18n.dart';
import 'package:ezymex/ui/ui.dart';

import 'harness.dart';

/// Records what the sheets ask for.
class RecordingActions extends TradeActions {
  RecordingActions(super.ref);
  final List<OrderRequest> orders = [];
  final List<(String, double?)> closes = [];
  final List<Map<String, Object?>> modifies = [];

  @override
  Future<bool> placeOrder(OrderRequest o) async {
    orders.add(o);
    return true;
  }

  @override
  Future<bool> closePosition(String ticket, {double? volume}) async {
    closes.add((ticket, volume));
    return true;
  }

  @override
  Future<bool> modifyPosition(
    String ticket, {
    double? sl,
    double? tp,
    bool clearSl = false,
    bool clearTp = false,
    int? trailingPoints,
    bool setTrailing = false,
  }) async {
    modifies.add({'ticket': ticket, 'sl': sl, 'tp': tp, 'clearSl': clearSl, 'clearTp': clearTp, 'trailing': trailingPoints});
    return true;
  }
}

void main() {
  late Harness h;
  late RecordingActions actions;

  Future<void> boot(WidgetTester tester) async {
    await loadFonts();
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.runAsync(() async {
      h = await Harness.create(
        extra: [
          marketFeedProvider.overrideWith(
            (ref) => FixedFeed({'BTCUSD': q('BTCUSD', 63400, 63418), 'XAUUSD': q('XAUUSD', 2654.30, 2654.48), 'EURUSD': q('EURUSD', 1.0845, 1.0846)}),
          ),
          tradeActionsProvider.overrideWith((ref) => actions = RecordingActions(ref)),
        ],
      );
      h.container.listen(terminalProvider, (_, _) {});
      await h.container.read(tradeSessionsProvider.notifier).start(preferred: '10042817');
      await h.container.read(symbolsProvider.future);
      await until(() => h.container.read(terminalProvider).synced);
    });
    h.container.read(tradeActionsProvider);
  }

  Future<void> show(WidgetTester tester, Widget child) async {
    final t = h.container.read(tProvider);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: h.container,
        child: MaterialApp(
          theme: KTheme.trader(Brightness.dark),
          home: I18nScope(
            t: t,
            child: Scaffold(body: child),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 50));
  }

  Future<void> done(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.runAsync(() async => h.container.dispose());
  }

  testWidgets('order sheet: pick a side, the button names the trade, SL by pips, pending needs a price', (tester) async {
    await boot(tester);
    await show(tester, const OrderForm(symbol: 'BTCUSD'));
    expect(find.text('Choose Sell or Buy'), findsOneWidget);

    await tester.tap(find.text('Buy').first);
    await tester.pump();
    expect(find.text('Buy 0.50 lot BTCUSD at market'), findsOneWidget);

    // a volume preset
    await tester.tap(find.text('0.1'));
    await tester.pump();
    expect(find.text('Buy 0.10 lot BTCUSD at market'), findsOneWidget);

    // stop loss on: a starting distance in pips, shown as money at risk
    await tester.tap(find.byType(CupertinoSwitch).first);
    await tester.pump();
    expect(find.textContaining('Risk -'), findsOneWidget);

    await tester.tap(find.text('Buy 0.10 lot BTCUSD at market'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(actions.orders, hasLength(1));
    final o = actions.orders.single;
    expect(o.side, 'buy');
    expect(o.type, 'market');
    expect(o.volume, 0.1);
    expect(o.sl, isNotNull);
    expect(o.sl!, lessThan(63418));
    expect(o.tp, isNull);
    await done(tester);
  });

  testWidgets('order sheet: the stop loss price is the pips away from the entry', (tester) async {
    await boot(tester);
    await show(tester, const OrderForm(symbol: 'XAUUSD', side: 'buy'));
    await tester.tap(find.byType(CupertinoSwitch).first);
    await tester.pump();
    // ask 2654.48, 10 pips of 0.10 under it, 50.00 USD at risk on 0.50 lot (the web's default volume)
    expect(find.textContaining('2653.48'), findsOneWidget);
    expect(find.text('Risk -50.00'), findsOneWidget);
    await done(tester);
  });

  testWidgets('order sheet: a limit order asks for its price first', (tester) async {
    await boot(tester);
    await show(tester, const OrderForm(symbol: 'BTCUSD', side: 'sell', type: 'limit'));
    expect(find.text('Enter the order price'), findsOneWidget);
    expect(find.text('Order price'), findsOneWidget);
    expect(find.text('Expires'), findsOneWidget);
    await done(tester);
  });

  testWidgets('position sheet: close part of it, nudge the stop loss, breakeven, modify', (tester) async {
    await boot(tester);
    final p = h.container.read(terminalProvider).positions.firstWhere((x) => x.symbol == 'XAUUSD');
    await show(tester, PositionForm(ticket: p.ticket));
    expect(find.text('Floating profit'), findsOneWidget);

    await tester.tap(find.text('50%'));
    await tester.pump();
    final closeLabel = find.textContaining('Close #${p.ticket} buy 0.25 XAUUSD');
    expect(closeLabel, findsOneWidget);
    await tester.tap(closeLabel);
    await tester.pump(const Duration(milliseconds: 100));
    expect(actions.closes.single, (p.ticket, 0.25));

    // 10 pips under the bid (a buy's stop loss is below the price)
    await tester.tap(find.text('10p').first);
    await tester.pump();
    await tester.tap(find.text('Modify').last);
    await tester.pump(const Duration(milliseconds: 100));
    expect(actions.modifies.last['sl'], closeTo(2654.30 - 10 * 0.1, 1e-9));

    await tester.tap(find.textContaining('Move SL to breakeven'));
    await tester.pump();
    await tester.tap(find.text('Modify').last);
    await tester.pump(const Duration(milliseconds: 100));
    expect(actions.modifies.last['sl'], p.openPrice);
    await done(tester);
  });
}
