// The engine's shapes as the terminal reads them (web map.ts): accounts (cent accounts / 100), positions, pending
// orders (a triggered stop-limit is a limit), closed trades from deals (commission share of the entry), equity frames,
// option entries kept apart; and the rejection texts (symbol_demo_only, stale_price, market_closed…).
import 'package:flutter_test/flutter_test.dart';
import 'package:ezymex/core/api/api_error.dart';
import 'package:ezymex/features/terminal/core/models.dart';
import 'package:ezymex/features/terminal/core/trade_errors.dart';
import 'package:ezymex/i18n/t.dart';

import 'fixtures.dart';

void main() {
  test('accounts: USC amounts become USD, controls, demo refills, spread group', () {
    final a = TAccount.fromJson(accountJson(cent: true, type: 'demo', balance: 500000, equity: 512345, margin: 10000));
    expect(a.cent, isTrue);
    expect(a.balance, 5000);
    expect(a.equity, closeTo(5123.45, 1e-9));
    expect(a.margin, 100);
    expect(a.freeMargin, closeTo(5023.45, 1e-9));
    expect(a.server, 'Ezymex-Demo');
    expect(a.refillsLeft, 2);
    expect(a.spreadGroup, 'standard');
    expect(a.group, 'Cent');
    expect(a.currency, 'USD');
    expect(a.ccy, 'USC');
  });

  test('positions: empty stops are null, trailing in points, money per cent', () {
    final p = TPosition.fromJson({
      'ticket': 49434410,
      'symbol': 'XAUUSD',
      'side': 'buy',
      'volume': 1,
      'openPrice': 2646.72,
      'openTime': '2026-09-24T08:44:12Z',
      'sl': 0,
      'tp': 2690,
      'trailingPoints': 150,
      'swap': -640,
      'commission': 0,
      'profit': 1250,
      'source': 'fix',
    }, cent: true);
    expect(p.ticket, '49434410');
    expect(p.sl, isNull);
    expect(p.tp, 2690);
    expect(p.trailingPoints, 150);
    expect(p.swap, -6.4);
    expect(p.profit, 12.5);
    expect(p.source, 'api');
  });

  test('pending orders: a triggered stop-limit is a limit at its limit price; OCO pairs; dated expiry', () {
    final o = TOrder.fromJson({
      'ticket': 30,
      'symbol': 'BTCUSD',
      'side': 'buy',
      'type': 'stop_limit',
      'volume': 0.05,
      'price': 64200,
      'stopLimit': 64150,
      'triggered': true,
      'expiry': '2026-09-27',
      'expiryAt': '2026-09-27T21:00:00Z',
      'oco': 25,
      'placedAt': '2026-09-24T14:05:00Z',
      'source': 'manual',
    });
    expect(o.type, 'limit');
    expect(o.price, 64150);
    expect(o.stopLimit, isNull);
    expect(o.expiry, 'Date');
    expect(o.expiryDate, '2026-09-27');
    expect(o.oco, '25');
    expect(o.labelKey, 'order.pending.buy.limit');
    final w = TOrder.fromJson({
      'ticket': 31,
      'symbol': 'BTCUSD',
      'side': 'sell',
      'type': 'stop_limit',
      'volume': 1,
      'price': 60000,
      'stopLimit': 59950,
      'triggered': false,
      'expiry': 'GTC',
    });
    expect(w.type, 'stop-limit');
    expect(w.stopLimit, 59950);
    expect(w.label, 'sell stop limit');
  });

  test('closed trades: one row per exit deal, newest first, entry commission shared, profit net', () {
    final rows = mapHistory([
      {
        'id': 1,
        'positionTicket': 7,
        'symbol': 'EURUSD',
        'side': 'buy',
        'positionSide': 'buy',
        'entry': 'in',
        'volume': 2,
        'price': 1.08,
        'profit': 0,
        'swap': 0,
        'commission': 8,
        'reason': 'client',
        'time': '2026-10-01T10:00:00Z',
        'openPrice': 1.08,
        'openTime': '2026-10-01T10:00:00Z',
      },
      {
        'id': 2,
        'positionTicket': 7,
        'symbol': 'EURUSD',
        'side': 'sell',
        'positionSide': 'buy',
        'entry': 'out',
        'volume': 1,
        'price': 1.081,
        'profit': 100,
        'swap': -1,
        'commission': 4,
        'reason': 'tp',
        'time': '2026-10-02T10:00:00Z',
        'openPrice': 1.08,
        'openTime': '2026-10-01T10:00:00Z',
      },
      {
        'id': 3,
        'positionTicket': 7,
        'symbol': 'EURUSD',
        'side': 'sell',
        'positionSide': 'buy',
        'entry': 'out',
        'volume': 1,
        'price': 1.079,
        'profit': -100,
        'swap': 0,
        'commission': 4,
        'reason': 'stop_out',
        'time': '2026-10-03T10:00:00Z',
        'openPrice': 1.08,
        'openTime': '2026-10-01T10:00:00Z',
      },
      {
        'id': 4,
        'positionTicket': 9,
        'symbol': 'EURUSD',
        'side': 'sell',
        'positionSide': 'buy',
        'entry': 'out',
        'volume': 1,
        'price': 1.079,
        'profit': 5,
        'swap': 0,
        'commission': 0,
        'reason': 'client',
        'time': '2026-10-04T10:00:00Z',
        'reversed': true,
      },
    ], cent: false);
    expect(rows.map((r) => r.deal), ['3', '2']);
    final tp = rows.last;
    expect(tp.commission, 8); // 4 own + half of the entry's 8
    expect(tp.profit, 100 - 1 - 8);
    expect(tp.reason, 'tp');
    expect(rows.first.reason, 'stop out');
    final cent = mapHistory([
      {
        'id': 5,
        'positionTicket': 1,
        'symbol': 'EURUSD',
        'positionSide': 'sell',
        'entry': 'out',
        'volume': 1,
        'price': 1.07,
        'profit': 1000,
        'swap': -50,
        'commission': 0,
        'reason': 'client',
        'time': '2026-10-04T10:00:00Z',
      },
    ], cent: true);
    expect(cent.single.profit, 9.5);
    expect(cent.single.side, 'sell');
  });

  test('equity frames: live numbers and per-position profit, cent accounts / 100', () {
    final e = LiveEquity.fromFrame({
      'type': 'equity',
      'balance': 100000,
      'credit': 500,
      'bonus': 500,
      'profit': 2500,
      'swap': -100,
      'equity': 103400,
      'margin': 2000,
      'freeMargin': 101400,
      'marginLevel': 5170,
      'positions': [
        {
          'ticket': 9,
          'price': 1.08,
          'profit': 2500,
          'swap': -100,
          'mark': 0.0041,
          'greeks': {'delta': 0.5},
        },
      ],
    }, cent: true);
    expect(e.balance, 1000);
    expect(e.credit, 10);
    expect(e.equity, 1034);
    expect(e.marginLevel, 5170);
    expect(e.positions['9']!.profit, 25);
    expect(e.positions['9']!.mark, 0.0041);
    expect(e.positions['9']!.greeks!['delta'], 0.5);
    final m = Metrics.of(account(), e);
    expect(m.floating, 24);
    expect(m.free, 1014);
  });

  test('metrics without equity frames come from the account view; no margin = infinite level', () {
    final a = TAccount.fromJson(accountJson(margin: 0));
    final m = Metrics.of(a, null);
    expect(m.level, double.infinity);
    expect(m.equity, 10250);
    expect(m.floating, 250);
  });

  test('option entries are told apart (they carry `option` or a series code)', () {
    expect(isOptionEntry({'symbol': 'EURUSD'}), isFalse);
    expect(isOptionEntry({'symbol': 'EURUSD-20261009-1.1650-C'}), isTrue);
    expect(
      isOptionEntry({
        'symbol': 'EURUSD',
        'option': {'series': 'x'},
      }),
      isTrue,
    );
  });

  group('rejections in the reader\'s language', () {
    final t = T('en', null, {
      'desk.trade.demoOnly': "Live trading for this market isn't enabled yet",
      'order.reject.stale_price': 'No prices',
      'order.reject.market_closed': 'Market closed',
      'order.reject.unavailable': 'No connection with the trade server',
      'order.reject.invalid_sl': 'Invalid stops',
    });
    ApiException e(String code, [String message = '']) => ApiException(status: 422, code: code, message: message);

    test('a catalogue market on a live account says so plainly', () {
      expect(tradeRejection(e('symbol_demo_only', 'Live trading for X is not enabled yet.'), t).title, "Live trading for this market isn't enabled yet");
    });

    test('stale prices, a closed market, no connection', () {
      expect(tradeRejection(e('stale_price', 'Prices are stale'), t).title, 'No prices');
      expect(tradeRejection(e('market_closed'), t).title, 'Market closed');
      expect(tradeRejection(ApiException.network, t).title, 'No connection with the trade server');
      expect(tradeRejection(ApiException.network, t).detail, isEmpty);
    });

    test("the engine's own sentence is the detail", () {
      final r = tradeRejection(e('invalid_sl', 'Stop loss must be below 83235.95'), t);
      expect(r.title, 'Invalid stops');
      expect(r.detail, 'Stop loss must be below 83235.95');
    });

    test('an unknown code keeps the server wording', () {
      expect(tradeRejection(e('brand_new_code', 'Something new'), t).title, 'Something new');
    });
  });
}
