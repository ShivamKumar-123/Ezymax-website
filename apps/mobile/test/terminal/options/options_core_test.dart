// The options mode's pure parts: series codes, the chain / position / closed-trade / settlement shapes (cent accounts
// scaled back to USD), the pricer and payoff maths, the client-side preview estimate, Quick trade's strikes, the book
// order request, RFQ ratios and the options stream frames.
import 'dart:math' as math;

import 'package:ezymex/features/terminal/core/models.dart' show LivePos;
import 'package:ezymex/features/terminal/options/core/data.dart';
import 'package:ezymex/features/terminal/options/core/math.dart';
import 'package:ezymex/features/terminal/options/core/models.dart';
import 'package:ezymex/features/terminal/options/core/pricer.dart';
import 'package:ezymex/features/terminal/options/core/store.dart';
import 'package:ezymex/features/terminal/options/ui/book_ticket.dart';
import 'package:ezymex/features/terminal/options/ui/simple.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> quote(
  String code, {
  double bid = 0.0010,
  double ask = 0.0012,
  double mark = 0.0011,
  double usd = 10000,
  String state = 'open',
  double iv = 0.07,
}) => {
  'code': code,
  'bid': bid,
  'ask': ask,
  'mark': mark,
  'bidUsd': bid * usd,
  'askUsd': ask * usd,
  'markUsd': mark * usd,
  'iv': iv,
  'delta': 0.5,
  'gamma': 0.1,
  'vega': 1.2,
  'theta': -0.8,
  'probItm': 0.45,
  'breakeven': 1.1,
  'state': state,
};

Map<String, dynamic> chainJson({bool book = false, int n = 9}) {
  final rows = <Map<String, dynamic>>[];
  for (var i = 0; i < n; i++) {
    final k = 1.08 + i * 0.0025;
    final label = k.toStringAsFixed(4);
    final dist = (i - n ~/ 2).abs();
    rows.add({
      'strike': k,
      'strikeLabel': label,
      'call': quote('EURUSD-20261016-$label-C', bid: 0.002 / (dist + 1), ask: 0.0024 / (dist + 1), mark: 0.0022 / (dist + 1)),
      'put': quote('EURUSD-20261016-$label-P', bid: 0.0018 / (dist + 1), ask: 0.0022 / (dist + 1), mark: 0.002 / (dist + 1)),
    });
  }
  return {
    'underlying': 'EURUSD',
    'expiry': '2026-10-16',
    'kinds': ['weekly'],
    'cutAt': '2026-10-16T14:00:00Z',
    'state': 'open',
    'contractSize': 10000,
    'contractUnit': 'EUR',
    'quoteCcy': 'USD',
    'digits': 5,
    'pipSize': 0.0001,
    'commission': {'perContract': 0.25, 'capPct': 10},
    'spot': {'bid': 1.08995, 'ask': 1.09005, 'mid': 1.09},
    'atmStrike': 1.09,
    if (book) 'book': {'active': true, 'premiumTick': 0.00001},
    'rows': rows,
  };
}

void main() {
  group('series codes', () {
    test('parse and build', () {
      final p = parseSeriesCode('EURUSD-20261009-1.1650-C')!;
      expect(p.underlying, 'EURUSD');
      expect(p.date, '2026-10-09');
      expect(p.strike, 1.165);
      expect(p.strikeLabel, '1.1650');
      expect(p.right, 'call');
      expect(seriesCode('EURUSD', '2026-10-09', 1.165, 'call', 0.0025), 'EURUSD-20261009-1.1650-C');
      expect(seriesCode('XAUUSD', '2026-10-09', 2650, 'put', 25), 'XAUUSD-20261009-2650-P');
      expect(parseSeriesCode('EURUSD'), isNull);
      expect(parseSeriesCode('EURUSD-20261009-1.1650-C-UO1.18'), isNull);
    });

    test('a barrier suffix: the first four parts name the option', () {
      final p = parseSeriesBase('EURUSD-20261009-1.1650-C-UO1.1800')!;
      expect(p.strikeLabel, '1.1650');
      expect(p.right, 'call');
    });

    test('the cut is 10:00 New York (14:00 UTC in summer, 15:00 in winter)', () {
      expect(DateTime.fromMillisecondsSinceEpoch(cutInstant('2026-10-09'), isUtc: true).hour, 14);
      expect(DateTime.fromMillisecondsSinceEpoch(cutInstant('2026-12-11'), isUtc: true).hour, 15);
    });
  });

  group('shapes', () {
    test('a house chain: rows, quotes, ATM, commission', () {
      final c = OptionChain.fromJson(chainJson());
      expect(c.rows, hasLength(9));
      expect(c.book, isNull);
      expect(c.rows[4].call!.askUsd, closeTo(24, 1e-9));
      expect(c.commissionPerContract, 0.25);
      expect(atmIndex(c), 4);
      expect(usdPerUnitOf(c), closeTo(10000, 1e-6));
    });

    test('book quotes: an empty side is 0 with no size, USD filled from the mark rate', () {
      final raw = chainJson(book: true);
      final row = (raw['rows'] as List).first as Map<String, dynamic>;
      row['call'] = {'code': 'EURUSD-20261016-1.0800-C', 'bid': null, 'ask': 0.0012, 'askQty': 5, 'mark': 0.0011, 'markUsd': 11.0, 'theo': 0.00105};
      final c = OptionChain.fromJson(raw);
      expect(c.book?.active, isTrue);
      final q = c.rows.first.call!;
      expect(q.book, isTrue);
      expect(q.bid, 0);
      expect(q.bidQty, isNull);
      expect(q.askQty, 5);
      expect(q.askUsd, closeTo(12, 1e-9));
      expect(q.theoUsd, closeTo(10.5, 1e-9));
      // on the book an empty side has no price: the mark stands in for estimates
      expect(fillOf(q, 'sell'), 0.0011);
    });

    test('positions on a cent account: money ÷ 100, premiums per unit untouched', () {
      final p = OptPosition.fromJson({
        'ticket': 61200003,
        'symbol': 'EURUSD-20261016-1.0900-C',
        'side': 'buy',
        'contracts': 2,
        'openPrice': 0.0011,
        'commission': 50,
        'profit': 1240,
        'option': {'series': 'EURUSD-20261016-1.0900-C', 'underlying': 'EURUSD', 'right': 'call', 'strike': 1.09, 'expiry': '2026-10-16'},
      }, cent: true);
      expect(p.commission, 0.5);
      expect(p.profit, 12.4);
      expect(p.openPrice, 0.0011);
      expect(p.option.right, 'call');
      expect(p.contracts, 2);
    });

    test('a position without `option` reads its series code', () {
      final p = OptPosition.fromJson({'ticket': 1, 'symbol': 'XAUUSD-20261016-2650-P', 'side': 'sell', 'volume': 1, 'openPrice': 14});
      expect(p.option.underlying, 'XAUUSD');
      expect(p.option.right, 'put');
      expect(p.option.strike, 2650);
      expect(p.option.expiry, '2026-10-16');
      expect(p.buy, isFalse);
    });

    test('settlements on a cent account', () {
      final s = Settlement.fromJson({
        'ticket': 9,
        'series': 'EURUSD-20261009-1.0850-P',
        'side': 'sell',
        'contracts': 2,
        'fixing': 1.0871,
        'payout': -1200,
        'profit': 3500,
        'at': '2026-10-09T14:00:00Z',
        'run': 2,
      }, cent: true);
      expect(s.payout, -12);
      expect(s.profit, 35);
      expect(s.run, 2);
    });

    test('closed trades: exit deals with their entry commission share, USD per unit derived from the deal', () {
      final deals = <Map<String, dynamic>>[
        {'id': 1, 'positionTicket': 7, 'entry': 'in', 'volume': 2, 'commission': 50, 'symbol': 'EURUSD-20261009-1.0850-C'},
        {
          'id': 2,
          'positionTicket': 7,
          'entry': 'out',
          'volume': 2,
          'price': 0.0020,
          'openPrice': 0.0014,
          'positionSide': 'buy',
          'profit': 1200,
          'commission': 50,
          'reason': 'client',
          'time': '2026-10-08T10:00:00Z',
          'symbol': 'EURUSD-20261009-1.0850-C',
          'option': {'series': 'EURUSD-20261009-1.0850-C', 'underlying': 'EURUSD', 'right': 'call', 'strike': 1.085, 'expiry': '2026-10-09'},
        },
      ];
      final rows = mapOptionClosed(deals, cent: true);
      expect(rows, hasLength(1));
      final r = rows.single;
      expect(r.gross, 12);
      expect(r.commission, 1);
      expect(r.profit, 11);
      expect(r.usdPerUnit, closeTo(10000, 1e-6));
      expect(r.reason, OptCloseReason.closed);
    });

    test('why a trade closed', () {
      expect(closeReasonOf({'reason': 'expiry'}).reason, OptCloseReason.expired);
      expect(closeReasonOf({'reason': 'knock_out'}).reason, OptCloseReason.knockedOut);
      expect(closeReasonOf({'reason': 'stop_out'}).reason, OptCloseReason.stopOut);
      expect(
        closeReasonOf({
          'reason': 'client',
          'option': {
            'fill': {'kind': 'bust'},
          },
        }).reason,
        OptCloseReason.bust,
      );
      expect(OptCloseReason.knockedOut.key, 'knocked_out');
    });
  });

  group('maths', () {
    test('put-call parity of the pricer', () {
      const s = 1.09, k = 1.1, t = 0.1, r = 0.036, b = 0.016, v = 0.07;
      final c = bsmPrice('call', s, k, t, r, b, v);
      final p = bsmPrice('put', s, k, t, r, b, v);
      final parity = s * math.exp((b - r) * t) - k * math.exp(-r * t);
      expect(c - p, closeTo(parity, 1e-12));
    });

    test('a long call: unlimited profit, the premium is the most to lose, breakeven = strike + premium', () {
      const legs = [PayLeg(right: 'call', strike: 1.09, side: 'buy', contracts: 2, premium: 0.002)];
      final st = payoffStats(legs, 10000);
      expect(st.maxProfit, isNull);
      expect(st.maxLoss, closeTo(40, 1e-9));
      expect(st.breakevens.single, closeTo(1.092, 1e-9));
      final zone = profitZone(legs, 10000, st.breakevens, 1.09);
      expect(zone.kind, 'above');
      expect(shapeOf(legs), 'long_call');
      expect(isSelling(legs), isFalse);
    });

    test('a short put sells', () {
      const legs = [PayLeg(right: 'put', strike: 1.09, side: 'sell', contracts: 1, premium: 0.002)];
      final st = payoffStats(legs, 10000);
      expect(st.maxProfit, closeTo(20, 1e-9));
      expect(isSelling(legs), isTrue);
      expect(profitZone(legs, 10000, st.breakevens, 1.09).kind, 'above');
    });

    test('a straddle profits outside its breakevens', () {
      const legs = [
        PayLeg(right: 'call', strike: 1.09, side: 'buy', contracts: 1, premium: 0.002),
        PayLeg(right: 'put', strike: 1.09, side: 'buy', contracts: 1, premium: 0.002),
      ];
      final st = payoffStats(legs, 10000);
      expect(st.breakevens, hasLength(2));
      expect(profitZone(legs, 10000, st.breakevens, 1.09).kind, 'outside');
      expect(detectTemplate([(right: 'call', side: 'buy', strike: 1.09, contracts: 1), (right: 'put', side: 'buy', strike: 1.09, contracts: 1)]), 'straddle');
    });

    test('the estimate of a long call: premium at the ask, commission capped at 10 %', () {
      final c = OptionChain.fromJson(chainJson());
      final q = c.rows[4].call!;
      final p = estimatePreview(
        underlying: 'EURUSD',
        legs: [EstimateLeg(series: q.code, right: 'call', strike: 1.09, side: 'buy', contracts: 1, quote: q)],
        type: 'market',
        chain: c,
        account: (cash: 10000, margin: 0, free: 10000),
      );
      expect(p.ok, isTrue);
      expect(p.estimate, isTrue);
      expect(p.netPremium, closeTo(24, 1e-9));
      expect(p.commission, closeTo(0.25, 1e-9));
      expect(p.maxProfit, isNull);
      expect(p.maxLoss, closeTo(24.25, 1e-9));
    });

    test('the estimate says no cash when the premium is more than the cash', () {
      final c = OptionChain.fromJson(chainJson());
      final q = c.rows[4].call!;
      final p = estimatePreview(
        underlying: 'EURUSD',
        legs: [EstimateLeg(series: q.code, right: 'call', strike: 1.09, side: 'buy', contracts: 1, quote: q)],
        type: 'market',
        chain: c,
        account: (cash: 10, margin: 0, free: 10),
      );
      expect(p.ok, isFalse);
      expect(p.reasons.map((r) => r.code), contains('insufficient_cash'));
    });

    test('Quick trade offers ATM, then one and two steps in the chosen direction', () {
      final c = OptionChain.fromJson(chainJson());
      final up = quickTargets(c, 'up', nowMs: DateTime.utc(2026, 10, 8).millisecondsSinceEpoch);
      expect(up.map((x) => x.row.strikeLabel), ['1.0900', '1.0925', '1.0950']);
      expect(up.every((x) => x.right == 'call'), isTrue);
      expect(up.first.priceUsd, closeTo(24, 1e-9));
      expect(up.first.pop, inInclusiveRange(0, 1));
      final down = quickTargets(c, 'down', nowMs: DateTime.utc(2026, 10, 8).millisecondsSinceEpoch);
      expect(down.map((x) => x.row.strikeLabel), ['1.0900', '1.0875', '1.0850']);
      expect(down.every((x) => x.right == 'put'), isTrue);
    });

    test('an open position: P&L at the mark, closing sells at the bid; the engine figures win', () {
      final p = OptPosition.fromJson({'ticket': 1, 'symbol': 'EURUSD-20261016-1.0900-C', 'side': 'buy', 'contracts': 2, 'openPrice': 0.0018});
      final q = OptionQuote.fromJson(quote('EURUSD-20261016-1.0900-C', bid: 0.002, ask: 0.0024, mark: 0.0022))!;
      final v = derivePosition(p, q, null, 1);
      expect(v.usdU, closeTo(10000, 1e-6));
      expect(v.profit, closeTo(8, 1e-9));
      expect(v.closeNow, closeTo(40, 1e-9));
      expect(v.basis, closeTo(36, 1e-9));
      expect(v.delta, closeTo(1, 1e-9));
      final live = derivePosition(p, q, const LivePos(price: 0, profit: 9.5, swap: 0, mark: 0.0023), 1);
      expect(live.profit, 9.5);
      expect(live.markUsd, closeTo(23, 1e-9));
    });

    test('RFQ ratios: 2 + 2 contracts are size 2 of a 1:1 strategy', () {
      final r = toRatios([(series: 'A', side: 'buy', contracts: 2), (series: 'B', side: 'sell', contracts: 2)]);
      expect(r.qty, 2);
      expect(r.legs.map((l) => l.ratio), [1, 1]);
      final r2 = toRatios([(series: 'A', side: 'buy', contracts: 1), (series: 'B', side: 'sell', contracts: 2)]);
      expect(r2.qty, 1);
      expect(r2.legs.map((l) => l.ratio), [1, 2]);
    });

    test('premium ticks', () {
      expect(toTick(0.001234, 0.00001), 0.00123);
      expect(toTick(0.001234, 0.00001, 1), 0.00124);
      expect(defaultPremiumTick(optionSpecs['EURUSD']!), 0.00001);
      expect(defaultPremiumTick(optionSpecs['XAUUSD']!), 0.01);
    });
  });

  group('book orders', () {
    const leg = TicketLeg(
      id: 'l1',
      series: 'EURUSD-20261016-1.0900-C',
      u: 'EURUSD',
      expiry: '2026-10-16',
      right: 'call',
      strike: 1.09,
      strikeLabel: '1.0900',
      side: 'buy',
      contracts: 3,
    );
    const units = (k: 10000.0, tick: 0.00001, tickUsd: 0.1);

    test('a limit order: USD per contract → per unit on the tick', () {
      final r = bookRequest(const Ticket(limit: '12.34', postOnly: true), leg, units);
      expect(r.missing, isNull);
      expect(r.req!['type'], 'limit');
      expect(r.req!['price'], 0.00123);
      expect(r.req!['qty'], 3);
      expect(r.req!['postOnly'], isTrue);
    });

    test('what is still missing', () {
      expect(bookRequest(const Ticket(), leg, units).missing, 'trader.opt.bt.needPrice');
      expect(bookRequest(const Ticket(limit: '12', bookTif: 'gtd'), leg, units).missing, 'trader.opt.bt.needGtd');
      expect(bookRequest(const Ticket(bookType: 'stop'), leg, units).missing, 'trader.opt.bt.needTrigger');
      final m = bookRequest(const Ticket(bookType: 'market'), leg, units);
      expect(m.req!['tif'], 'ioc');
      final s = bookRequest(const Ticket(bookType: 'stop', trigSource: 'underlying', trigOp: 'above', trigPrice: '1.095'), leg, units);
      expect(s.req!['type'], 'stop_market');
      expect((s.req!['trigger']! as Map)['price'], 1.095);
    });
  });

  group('expiries', () {
    final now = DateTime.utc(2026, 10, 8, 9).millisecondsSinceEpoch;
    OptionExpiry e(String date, List<String> kinds) =>
        OptionExpiry(date: date, kinds: kinds, cutAt: DateTime.fromMillisecondsSinceEpoch(cutInstant(date), isUtc: true).toIso8601String());
    final list = [
      e('2026-10-08', ['daily']),
      e('2026-10-09', ['daily', 'weekly']),
      e('2026-10-16', ['weekly']),
      e('2026-10-30', ['monthly']),
    ];

    test('the nearest of a kind; a past cut rolls to the next', () {
      expect(pickExpiry(list, kind: 'daily', now: now).date, '2026-10-08');
      expect(pickExpiry(list, kind: 'weekly', now: now).date, '2026-10-09');
      expect(pickExpiry(list, kind: 'monthly', now: now).date, '2026-10-30');
      final after = DateTime.utc(2026, 10, 8, 15).millisecondsSinceEpoch;
      expect(pickExpiry(list, keep: '2026-10-08', kind: 'daily', now: after).date, '2026-10-09');
    });

    test('a date picked from the list keeps its kind when it is a kind nearest', () {
      expect(kindOfExpiry(list, '2026-10-16', 'daily', now), isNull);
      expect(kindOfExpiry(list, '2026-10-09', 'weekly', now), 'weekly');
    });
  });

  group('stream frames', () {
    const s0 = OptState(u: 'EURUSD', expiry: '2026-10-16', prefs: OptPrefs());

    test('a chain frame for the chain on screen', () {
      final r = applyOptFrame(s0, {'type': 'chain', ...chainJson(book: true)});
      expect(r.chainChanged, isTrue);
      expect(r.state.chain!.rows, hasLength(9));
      expect(r.state.bookLive, isTrue);
      expect(r.state.index, hasLength(18));
      // another expiry's chain is not ours
      expect(identical(applyOptFrame(s0, {'type': 'chain', ...chainJson(), 'expiry': '2026-10-23'}).state, s0), isTrue);
    });

    test('changed rows replace theirs; an unknown strike asks for the full chain', () {
      final s = applyOptFrame(s0, {'type': 'chain', ...chainJson()}).state;
      final row = {
        'strike': 1.09,
        'strikeLabel': '1.0900',
        'call': quote('EURUSD-20261016-1.0900-C', bid: 0.003, ask: 0.0034, mark: 0.0032),
        'put': quote('EURUSD-20261016-1.0900-P'),
      };
      final r = applyOptFrame(s, {
        'type': 'rows',
        'u': 'EURUSD',
        'expiry': '2026-10-16',
        'rows': [row],
        'spot': {'bid': 1.0910, 'ask': 1.0911},
      });
      expect(r.reload, isFalse);
      expect(r.state.quoteOf('EURUSD-20261016-1.0900-C')!.askUsd, closeTo(34, 1e-9));
      expect(r.state.chain!.spot!.mid, closeTo(1.09105, 1e-9));
      final unknown = applyOptFrame(s, {
        'type': 'rows',
        'u': 'EURUSD',
        'expiry': '2026-10-16',
        'rows': [
          {...row, 'strike': 1.2, 'strikeLabel': '1.2000'},
        ],
      });
      expect(unknown.reload, isTrue);
    });

    test('series quotes, depth and the tape (deduplicated, newest first)', () {
      var s = applyOptFrame(s0, {
        'type': 'series',
        'quotes': [quote('EURUSD-20261023-1.0900-C')],
      }).state;
      expect(s.quoteOf('EURUSD-20261023-1.0900-C'), isNotNull);
      s = applyOptFrame(s, {
        'type': 'depth',
        'series': 'EURUSD-20261023-1.0900-C',
        'bids': [
          [0.001, 5, 2],
          [0.0009, 3],
        ],
        'asks': [
          {'price': 0.0012, 'qty': 4},
        ],
      }).state;
      expect(s.depth['EURUSD-20261023-1.0900-C']!.bids, hasLength(2));
      expect(s.depth['EURUSD-20261023-1.0900-C']!.asks.single.qty, 4);
      final t1 = {'id': 'a', 'series': 'EURUSD-20261023-1.0900-C', 'price': 0.0011, 'qty': 1, 'side': 'buy', 't': 1000};
      final t2 = {'id': 'b', 'series': 'EURUSD-20261023-1.0900-C', 'price': 0.0012, 'qty': 2, 'side': 'sell', 't': 2000};
      s = applyOptFrame(s, {
        'type': 'tape',
        'trades': [t1, t2],
      }).state;
      s = applyOptFrame(s, {
        'type': 'tape',
        'trades': [t2],
      }).state;
      expect(s.tape['EURUSD-20261023-1.0900-C']!.map((x) => x.id), ['b', 'a']);
    });
  });

  group('prefs', () {
    test('saved prefs come back; old flags map to the column sets', () {
      final p = OptPrefs.fromJson(const OptPrefs(u: 'XAUUSD', view: 'puts', colPreset: 'pro', cols: allChainCols, tf: 'H1', panel: 'ticket').toJson());
      expect(p.u, 'XAUUSD');
      expect(p.view, 'puts');
      expect(p.cols, allChainCols);
      expect(p.tf, 'H1');
      expect(p.panel, 'ticket');
      expect(OptPrefs.fromJson({'greeks': true}).colPreset, 'pro');
      expect(OptPrefs.fromJson({'extra': true}).cols, colPresets['standard']);
    });
  });
}
