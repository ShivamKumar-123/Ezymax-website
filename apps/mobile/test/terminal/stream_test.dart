// The account on screen over the engine stream (web store.tsx engine mode): the terminal opens the client's own
// account (`trade/sessions`), loads `trade/state`, then every frame keeps it current. Option entries stay apart for
// the options mode; engine notifications become banners in the bell; resync / ended reconnect with a fresh ticket.
import 'package:ezymex/features/terminal/core/sessions.dart';
import 'package:ezymex/features/terminal/core/terminal_controller.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fixtures.dart';
import 'harness.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('opens the own account, loads its state and follows the stream', () async {
    final h = await Harness.create();
    final c = h.container;
    final sub = c.listen(terminalProvider, (_, _) {});
    await c.read(tradeSessionsProvider.notifier).start(preferred: '10042817');
    final session = c.read(activeTradeSessionProvider);
    expect(session, isNotNull);
    expect(session!.login, '10042817');
    expect(session.token, startsWith('kt1.s.'));
    expect(session.own, isTrue);

    // trade/state, then the stream (one-time ticket -> the socket)
    await until(() => c.read(terminalProvider).synced && h.engines.isNotEmpty);
    expect(h.engines.single.url.queryParameters['ticket'], 'preview-10042817');
    var st = c.read(terminalProvider);
    expect(st.account!.login, '10042817');
    expect(st.positions, isNotEmpty);
    expect(st.history, isNotEmpty);

    final ch = h.engines.single;
    // snapshot: the account and the open book; an option position is kept apart
    ch.push({
      'type': 'snapshot',
      'readOnly': false,
      'account': accountJson(),
      'positions': [
        {
          'ticket': 1,
          'login': 10042817,
          'symbol': 'EURUSD',
          'side': 'buy',
          'volume': 1,
          'openPrice': 1.08,
          'openTime': '2026-10-08T08:00:00Z',
          'swap': 0,
          'commission': 0,
          'source': 'manual',
        },
        {
          'ticket': 2,
          'login': 10042817,
          'symbol': 'EURUSD-20261009-1.0850-C',
          'side': 'buy',
          'volume': 3,
          'openPrice': 0.0042,
          'openTime': '2026-10-08T08:00:00Z',
          'swap': 0,
          'commission': 0,
          'source': 'manual',
          'option': {'series': 'EURUSD-20261009-1.0850-C'},
        },
      ],
      'orders': <Object>[],
    });
    await until(() => c.read(terminalProvider).positions.length == 1);
    st = c.read(terminalProvider);
    expect(st.positions.single.ticket, '1');
    expect(st.optPositions.single['ticket'], 2);
    expect(st.orders, isEmpty);

    // a new position, a pending order, then the position closes with its deal
    ch.push({
      'type': 'position',
      'op': 'upsert',
      'position': {
        'ticket': 3,
        'symbol': 'XAUUSD',
        'side': 'sell',
        'volume': 0.5,
        'openPrice': 2650,
        'openTime': '2026-10-08T09:00:00Z',
        'swap': 0,
        'commission': 0,
        'source': 'manual',
      },
    });
    ch.push({
      'type': 'order',
      'op': 'upsert',
      'order': {
        'ticket': 4,
        'symbol': 'XAUUSD',
        'side': 'buy',
        'type': 'limit',
        'volume': 0.3,
        'price': 2620,
        'expiry': 'GTC',
        'placedAt': '2026-10-08T09:00:00Z',
      },
    });
    await until(() => c.read(terminalProvider).positions.length == 2 && c.read(terminalProvider).orders.length == 1);
    ch.push({
      'type': 'deal',
      'deal': {
        'id': 99,
        'positionTicket': 3,
        'symbol': 'XAUUSD',
        'side': 'buy',
        'positionSide': 'sell',
        'entry': 'out',
        'volume': 0.5,
        'price': 2640,
        'profit': 500,
        'swap': 0,
        'commission': 0,
        'reason': 'tp',
        'time': '2026-10-08T10:00:00Z',
        'openPrice': 2650,
        'openTime': '2026-10-08T09:00:00Z',
      },
    });
    ch.push({'type': 'position', 'op': 'remove', 'ticket': 3});
    ch.push({'type': 'order', 'op': 'remove', 'ticket': 4, 'status': 'cancelled'});
    await until(() => c.read(terminalProvider).positions.length == 1 && c.read(terminalProvider).orders.isEmpty);
    st = c.read(terminalProvider);
    expect(st.history.first.deal, '99');
    expect(st.history.first.profit, 500);

    // equity frames: the live numbers
    ch.push({
      'type': 'equity',
      'balance': 10000,
      'credit': 0,
      'profit': 120,
      'swap': -5,
      'equity': 10115,
      'margin': 540,
      'freeMargin': 9575,
      'marginLevel': 1873,
      'positions': [
        {'ticket': 1, 'price': 1.0812, 'profit': 120, 'swap': -5},
      ],
    });
    await until(() => c.read(terminalProvider).live?.equity == 10115);
    st = c.read(terminalProvider);
    expect(st.metrics.floating, 115);
    expect(st.profitOf(st.positions.single), 120);

    // engine notifications: banners for server-side events, none for this terminal's own fills
    ch.push({'type': 'notification', 'kind': 'fill', 'message': '#1 filled'});
    ch.push({'type': 'notification', 'kind': 'sl', 'message': '#5 buy 1.00 EURUSD closed at 1.0790'});
    ch.push({'type': 'notification', 'kind': 'margin_call', 'message': 'Margin level 95%'});
    ch.push({'type': 'notification', 'kind': 'order_filled', 'message': '#7 buy limit filled'});
    await until(() => h.notes.pushed.length == 3);
    expect(h.notes.pushed.map((n) => n.title), ['Stop loss triggered', 'Margin call', 'Pending order filled']);
    expect(h.notes.pushed.first.body, '#5 buy 1.00 EURUSD closed at 1.0790');
    expect(h.notes.pushed[1].severity, 'warning');

    // resync: a fresh ticket and a new socket
    ch.push({'type': 'resync', 'skipped': 12});
    await until(() => h.engines.length == 2);

    sub.close();
    c.dispose();
  });

  test('a cent account: the stream money is USC, the terminal keeps USD', () async {
    final h = await Harness.create();
    final c = h.container;
    final sub = c.listen(terminalProvider, (_, _) {});
    await c.read(tradeSessionsProvider.notifier).start(preferred: '10051123');
    await until(() => c.read(terminalProvider).synced && h.engines.isNotEmpty);
    expect(c.read(terminalProvider).account!.cent, isTrue);
    h.engines.single.push({
      'type': 'equity',
      'balance': 254300,
      'credit': 0,
      'profit': -2000,
      'swap': -320,
      'equity': 251980,
      'margin': 12000,
      'freeMargin': 239980,
      'marginLevel': 2099,
      'positions': <Object>[],
    });
    await until(() => c.read(terminalProvider).live?.equity == 2519.8);
    expect(c.read(terminalProvider).metrics.floating, closeTo(-23.2, 1e-9));
    sub.close();
    c.dispose();
  });

  test('switching accounts opens the other one; a password login can be read-only', () async {
    final h = await Harness.create();
    final c = h.container;
    final sub = c.listen(terminalProvider, (_, _) {});
    final s = c.read(tradeSessionsProvider.notifier);
    await s.start(preferred: '10042817');
    expect(await s.activate('20017734'), isTrue);
    expect(c.read(activeTradeSessionProvider)!.login, '20017734');
    expect(c.read(tradeSessionsProvider).sessions.keys, containsAll(['10042817', '20017734']));
    final inv = await s.loginWithPassword(login: '10051123', password: 'investor-pass', server: 'Ezymex-Live');
    expect(inv.readOnly, isTrue);
    expect(inv.own, isFalse);
    expect(c.read(activeTradeSessionProvider)!.login, '10051123');
    await s.logout('10051123');
    expect(c.read(tradeSessionsProvider).sessions.containsKey('10051123'), isFalse);
    sub.close();
    c.dispose();
  });
}
