// Contract maths of Ezymex Trader: the engine's formulas (symbol_margin, pnl), USD internally and USC on cent accounts,
// JPY-quoted pairs converted through USDJPY, market hours and server time.
import 'package:flutter_test/flutter_test.dart';
import 'package:ezymex/features/terminal/core/market_hours.dart';
import 'package:ezymex/features/terminal/core/models.dart';
import 'package:ezymex/features/terminal/core/trade_math.dart';
import 'package:ezymex/i18n/t.dart';

import 'fixtures.dart';

void main() {
  group('conversion to USD', () {
    test('USD-quoted markets need none', () {
      expect(usdPerQuote('USD', symbol: 'EURUSD', price: 1.08), 1);
    });

    test('a USD/xxx pair converts with its own price', () {
      expect(usdPerQuote('JPY', symbol: 'USDJPY', price: 150), closeTo(1 / 150, 1e-12));
    });

    test('a cross converts through USD/xxx or xxx/USD', () {
      expect(usdPerQuote('JPY', symbol: 'EURJPY', price: 162, bidOf: (s) => s == 'USDJPY' ? 150.0 : null), closeTo(1 / 150, 1e-12));
      expect(usdPerQuote('GBP', symbol: 'EURGBP', price: 0.85, bidOf: (s) => s == 'GBPUSD' ? 1.25 : null), 1.25);
    });
  });

  group('profit slope (the stop projection on the chart)', () {
    test('a line through the open price: profitAt at any close', () {
      final s = profitSlope(eurusd, side: 'buy', lots: 0.5);
      expect(s.inverse, isFalse);
      expect(s.perPrice, closeTo(50000, 1e-9));
      expect((1.0790 - 1.0845) * s.perPrice, closeTo(profitAt(eurusd, side: 'buy', lots: 0.5, open: 1.0845, close: 1.0790), 1e-9));
      expect(profitSlope(eurusd, side: 'sell', lots: 0.5).perPrice, closeTo(-50000, 1e-9));
    });

    test('a USD-base pair converts at the close', () {
      final j = profitSlope(usdjpy, side: 'sell', lots: 1);
      expect(j.inverse, isTrue);
      expect((149 - 150) * j.perPrice / 149, closeTo(profitAt(usdjpy, side: 'sell', lots: 1, open: 150, close: 149), 1e-9));
    });
  });

  group('pip value', () {
    test('EURUSD: 10 USD a pip for one lot', () {
      expect(pipValuePerLot(eurusd, 1.0845), closeTo(10, 1e-9));
    });

    test('USDJPY: 1,000 JPY a pip, in USD at the current price', () {
      expect(usdjpy.pipSize, 0.01);
      expect(pipValuePerLot(usdjpy, 149.38), closeTo(1000 / 149.38, 1e-9));
    });

    test('XAUUSD: a 0.10 pip on 100 oz = 10 USD', () {
      expect(xauusd.pipSize, 0.1);
      expect(pipValuePerLot(xauusd, 2654), closeTo(10, 1e-9));
    });
  });

  group('margin (engine symbol_margin)', () {
    test('notional / leverage at 100 % margin', () {
      expect(marginRequired(eurusd, 1, 1.0845, 100), closeTo(1084.5, 1e-6));
      expect(marginRequired(eurusd, 0.1, 1.0845, 500), closeTo(21.69, 1e-6));
    });

    test('a USD-base pair: the contract in USD', () {
      expect(marginRequired(usdjpy, 1, 150, 100), closeTo(1000, 1e-6));
    });

    test('the symbol caps the leverage and scales by its margin %', () {
      // 1 BTC at 60,000, account 1:500 capped at 1:100, margin 500 % -> 60,000 * 5 / 100
      expect(marginRequired(btcusd, 1, 60000, 500), closeTo(3000, 1e-6));
      expect(effectiveLeverage(btcusd, 500), 100);
      expect(effectiveLeverage(btcusd, 50), 50);
    });
  });

  group('profit', () {
    test('a buy gains when the bid rises; swap and commission count', () {
      final p = TPosition.fromJson({
        'ticket': 1,
        'symbol': 'EURUSD',
        'side': 'buy',
        'volume': 1,
        'openPrice': 1.08,
        'openTime': '2026-10-08T10:00:00Z',
        'swap': -2,
        'commission': 3,
        'source': 'manual',
      }, cent: false);
      expect(positionProfit(eurusd, p, 1.081, 1.0811), closeTo(100 - 2 - 3, 1e-6));
    });

    test('a sell closes at the ask; JPY profit in USD', () {
      expect(profitAt(usdjpy, side: 'sell', lots: 1, open: 150, close: 149), closeTo(100000 / 149, 1e-6));
    });
  });

  group('account money (USC on cent accounts)', () {
    test('USD shown as is, cent accounts x 100', () {
      expect(accMoney(false, 1234.5), '1,234.50');
      expect(accMoney(true, 12.5), '1,250.00');
      expect(accCcy(true), 'USC');
      expect(accCcy(false), 'USD');
    });

    test('signs: minus for losses, plus only when asked, none for zero', () {
      expect(accMoney(false, -3.456), '-3.46');
      expect(accMoney(false, 3.4, signed: true), '+3.40');
      expect(accMoney(false, 0.001, signed: true), '0.00');
      expect(accMoney(false, -0.001), '0.00');
    });

    test('cent account views are divided back to USD when parsed', () {
      final a = account(cent: true);
      expect(a.balance, 10000);
      expect(a.equity, 10250);
      expect(a.ccy, 'USC');
      expect(accMoney(a.cent, a.equity), '1,025,000.00');
    });
  });

  test('margin level states against the group levels', () {
    final a = account();
    expect(marginState(double.infinity, a), 'ok');
    expect(marginState(450, a), 'ok');
    expect(marginState(150, a), 'low');
    expect(marginState(90, a), 'call');
    expect(marginState(50, a), 'stopout');
  });

  test('volume steps, limits and the broker max lot', () {
    expect(normalizeVolume(eurusd, 0.123), 0.12);
    expect(normalizeVolume(eurusd, 0.001), 0.01);
    expect(normalizeVolume(eurusd, 500), 100);
    expect(normalizeVolume(eurusd, 5, maxLot: 2), 2);
    expect(normalizeVolume(spec('XXXYYY', lotStep: 0.1, lotMin: 0.1), 0.26), 0.3);
  });

  test('prices: digits, points, the spread, the input step', () {
    expect(fmtPrice(5, 1.08), '1.08000');
    expect(fmtPrice(3, 149.3816), '149.382');
    expect(spreadPoints(eurusd, 1.08451, 1.08459), 8);
    expect(priceStep(eurusd), closeTo(0.00001, 1e-12));
    expect(priceStep(xauusd), closeTo(0.01, 1e-12));
  });

  test('server time: GMT+3 like the web, the chart offset follows US daylight saving', () {
    expect(serverOffsetSeconds(DateTime.utc(2026, 7, 2)), 3 * 3600);
    expect(serverOffsetSeconds(DateTime.utc(2026, 1, 15)), 2 * 3600);
    expect(fmtServer(DateTime.utc(2026, 10, 8, 11, 5, 9)), '2026.10.08 14:05:09');
    expect(fmtServer(DateTime.utc(2026, 10, 8, 11, 5, 9), seconds: false), '2026.10.08 14:05');
  });

  test('market hours: FX closed at the weekend, crypto always open, US stocks in New York hours', () {
    final saturday = DateTime.utc(2026, 10, 10, 12);
    final wednesday = DateTime.utc(2026, 10, 7, 12);
    expect(isMarketOpen(eurusd, saturday), isFalse);
    expect(isMarketOpen(eurusd, wednesday), isTrue);
    expect(isMarketOpen(btcusd, saturday), isTrue);
    final aapl = SymbolSpec.fromJson({'symbol': 'AAPL', 'assetClass': 'stocks', 'digits': 2, 'session': 'us_equity'});
    expect(isMarketOpen(aapl, DateTime.utc(2026, 10, 7, 15)), isTrue); // 11:00 New York
    expect(isMarketOpen(aapl, DateTime.utc(2026, 10, 7, 21)), isFalse); // 17:00 New York
  });

  test('swap texts: % a year or points, with a real minus sign', () {
    final t = T('en', null, {'desk.sw.pctYear': '{n}% / year', 'order.unit.pts': '{n} pts'});
    expect(swapRateText(t, -20, 'percent_per_year'), '−20.00% / year');
    expect(swapRateText(t, 1.4, 'points'), '+1.40 pts');
  });
}
