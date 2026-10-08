// The order sheet's rules before anything is sent (volume limits and step, a pending price, stops on the right side,
// the comment, the account's restrictions, the market state), the body of `POST trade/orders`, SL / TP by pips or
// money (cent accounts type money in USC) and sizing by risk.
import 'package:flutter_test/flutter_test.dart';
import 'package:ezymex/features/terminal/core/order.dart';
import 'package:ezymex/features/terminal/core/trade_math.dart';

import 'fixtures.dart';

void main() {
  const bid = 1.08450, ask = 1.08460;
  OrderRequest o({
    String side = 'buy',
    String type = 'market',
    double volume = 0.1,
    double? price,
    double? stopLimit,
    double? sl,
    double? tp,
    String? comment,
    String expiry = 'GTC',
    String? expiryDate,
  }) => OrderRequest(
    symbol: 'EURUSD',
    side: side,
    type: type,
    volume: volume,
    price: price,
    stopLimit: stopLimit,
    sl: sl,
    tp: tp,
    comment: comment,
    expiry: expiry,
    expiryDate: expiryDate,
  );
  String? check(OrderRequest r, {bool readOnly = false, bool open = true, bool delayed = false, bool cent = false}) => validateOrder(
    r,
    eurusd,
    bid: bid,
    ask: ask,
    account: account(cent: cent),
    readOnly: readOnly,
    marketOpen: open,
    delayed: delayed,
  );

  group('validation', () {
    test('a plain market order passes', () {
      expect(check(o()), isNull);
    });

    test('volume: at least the minimum, at most the maximum, in steps', () {
      expect(check(o(volume: 0.001)), 'order.reject.invalid_volume');
      expect(check(o(volume: 101)), 'order.reject.invalid_volume');
      expect(check(o(volume: 0.015)), 'order.reject.invalid_volume');
      expect(check(o(volume: 0.02)), isNull);
    });

    test('a pending order needs its price; a dated expiry needs a date', () {
      expect(check(o(type: 'limit')), 'order.toast.enterPendingPrice');
      expect(check(o(type: 'limit', price: 1.08)), isNull);
      expect(check(o(type: 'stop', price: 1.09, expiry: 'Date')), 'order.reject.invalid_expiry');
      expect(check(o(type: 'stop', price: 1.09, expiry: 'Date', expiryDate: '2026-10-09')), isNull);
    });

    test('stops on the right side of the entry (buy: SL below, TP above; sell: the opposite)', () {
      expect(check(o(sl: 1.0850)), 'order.reject.invalid_sl'); // above the ask
      expect(check(o(sl: 1.0840, tp: 1.0840)), 'order.reject.invalid_tp');
      expect(check(o(sl: 1.0840, tp: 1.0860)), isNull);
      expect(check(o(side: 'sell', sl: 1.0840)), 'order.reject.invalid_sl'); // below the bid
      expect(check(o(side: 'sell', sl: 1.0860, tp: 1.0830)), isNull);
      // a pending order checks against its own price
      expect(check(o(type: 'limit', price: 1.0800, sl: 1.0820)), 'order.reject.invalid_sl');
      expect(check(o(type: 'limit', price: 1.0800, sl: 1.0780, tp: 1.0850)), isNull);
    });

    test('the account and the market: read-only, closed, delayed price', () {
      expect(check(o(), readOnly: true), 'order.reject.read_only');
      expect(check(o(), open: false), 'order.reject.market_closed');
      expect(check(o(), delayed: true), 'order.reject.stale_price');
      // a pending order can be placed on a delayed price
      expect(check(o(type: 'limit', price: 1.08), delayed: true), isNull);
    });

    test('the comment holds 31 characters', () {
      expect(check(o(comment: 'x' * 31)), isNull);
      expect(check(o(comment: 'x' * 32)), 'order.reject.validation');
    });
  });

  group('the request body', () {
    test('market: prices rounded to the digits, trailing in points, deviation with the price seen', () {
      final b = orderBody(
        OrderRequest(symbol: 'EURUSD', side: 'buy', type: 'market', volume: 0.123456, sl: 1.0840012, tp: 1.08700004, trailingPips: 20, comment: 'c' * 40),
        eurusd,
        clientOrderId: 'cid-12345678',
        deviationPoints: 5,
        bid: bid,
        ask: ask,
      );
      expect(b['type'], 'market');
      expect(b['volume'], 0.12);
      expect(b['sl'], 1.0840);
      expect(b['tp'], 1.087);
      expect(b['trailingPoints'], 200); // 20 pips = 200 points on a 5-digit pair
      expect((b['comment']! as String).length, 31);
      expect(b['deviationPoints'], 5);
      expect(b['requestedPrice'], ask);
      expect(b.containsKey('price'), isFalse);
    });

    test('pending: price, expiry, no deviation; stop-limit sends both prices', () {
      final b = orderBody(
        o(type: 'stop-limit', price: 1.0900, stopLimit: 1.0895, expiry: 'Date', expiryDate: '2026-10-09'),
        eurusd,
        clientOrderId: 'cid-12345678',
        deviationPoints: 5,
        bid: bid,
        ask: ask,
      );
      expect(b['type'], 'stop_limit');
      expect(b['price'], 1.09);
      expect(b['stopLimit'], 1.0895);
      expect(b['expiry'], '2026-10-09');
      expect(b.containsKey('deviationPoints'), isFalse);
      final g = orderBody(o(type: 'limit', price: 1.08), eurusd, clientOrderId: 'cid-12345678');
      expect(g['expiry'], 'GTC');
      expect(g.containsKey('sl'), isFalse);
    });

    test('JPY digits', () {
      final b = orderBody(
        const OrderRequest(symbol: 'USDJPY', side: 'sell', type: 'limit', volume: 1, price: 150.12349, tp: 149.0004),
        usdjpy,
        clientOrderId: 'cid-12345678',
      );
      expect(b['price'], 150.123);
      expect(b['tp'], 149.0);
    });
  });

  group('SL / TP by pips or money', () {
    // 0.10 lot EURUSD: 1 USD a pip
    final pv = pipValuePerLot(eurusd, bid) * 0.1;

    test('pips: a buy SL 20 pips under the ask, TP 40 pips over', () {
      expect(stopPrice(const StopInput(on: true, value: '20'), 'sl', 'buy', ask, eurusd, pipValue: pv, cent: false), 1.0826);
      expect(stopPrice(const StopInput(on: true, value: '40'), 'tp', 'buy', ask, eurusd, pipValue: pv, cent: false), 1.0886);
      expect(stopPrice(const StopInput(on: true, value: '20'), 'sl', 'sell', bid, eurusd, pipValue: pv, cent: false), 1.0865);
    });

    test('money: 25 USD at risk on 1 USD a pip = 25 pips; a cent account types USC', () {
      expect(
        stopDistancePips(
          const StopInput(on: true, mode: 'money', value: '25'),
          pipValue: pv,
          cent: false,
        ),
        closeTo(25, 1e-9),
      );
      expect(
        stopDistancePips(
          const StopInput(on: true, mode: 'money', value: '2500'),
          pipValue: pv,
          cent: true,
        ),
        closeTo(25, 1e-9),
      );
    });

    test('price mode passes the typed price; off gives nothing', () {
      expect(
        stopPrice(
          const StopInput(on: true, mode: 'price', value: '1.08'),
          'sl',
          'buy',
          ask,
          eurusd,
          pipValue: pv,
          cent: false,
        ),
        1.08,
      );
      expect(stopPrice(const StopInput(value: '20'), 'sl', 'buy', ask, eurusd, pipValue: pv, cent: false), isNull);
    });
  });

  test('size by risk: 1 % of 10,000 over 25 pips at 10 USD a pip -> 0.40 lot', () {
    expect(riskLots(riskUsd: 100, pips: 25, pipValuePerLot: 10), 0.4);
    expect(riskLots(riskUsd: 1, pips: 50, pipValuePerLot: 10), 0.01);
    // JPY pair: the pip value comes in USD at the current price
    expect(riskLots(riskUsd: 100, pips: 20, pipValuePerLot: pipValuePerLot(usdjpy, 150)), closeTo(0.75, 0.0101));
  });

  test('entry price: ask for a buy, bid for a sell, the order price when pending', () {
    expect(entryPrice(o(), bid: bid, ask: ask), ask);
    expect(
      entryPrice(
        o(side: 'sell'),
        bid: bid,
        ask: ask,
      ),
      bid,
    );
    expect(
      entryPrice(
        o(type: 'limit', price: 1.08),
        bid: bid,
        ask: ask,
      ),
      1.08,
    );
    expect(
      entryPrice(
        o(type: 'stop-limit', price: 1.09, stopLimit: 1.0895),
        bid: bid,
        ask: ask,
      ),
      1.0895,
    );
  });
}
