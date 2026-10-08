// Sample answers for the Portfolio pages (development previews and widget tests only; never in a shipped build).
// Shapes are the real API's (the web's /api/<family>/... routes, docs/MOBILE-API.md, services/reports README);
// values are made up and dated relative to today, so the 7D / 30D / 90D ranges always have something to show.
//   GET  trading/accounts/{login}                     {account, positions, orders}
//   GET  trading/accounts/{login}/history             paged deals (range, instrument filter, totals)
//   GET  trading/accounts/{login}/ledger              paged balance movements
//   GET  trading/accounts/{login}/export              CSV (history | ledger)
//   GET  reports/analytics                            the full analytics answer (curve.points keeps day /
//                                                     balance / equity / flow for the dashboard)
//   GET  reports/accounts/{login}/months              calendar months
//   GET  reports/accounts/{login}/statement           a small file (or the JSON statement)
//   POST growth/shares                                a share card
// Return null for paths this file doesn't answer.
import 'dart:math' as math;

import '../preview_data.dart';

String _day(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

Map<String, dynamic>? _account(int login) {
  for (final a in (previewAccounts['accounts'] as List).cast<Map<String, dynamic>>()) {
    if (a['login'] == login) return a;
  }
  return null;
}

/// The option series of the sample option trades: an EURUSD 1.1000 call expiring in 9 days.
String previewOptionSeries() {
  final e = DateTime.now().add(const Duration(days: 9));
  return 'EURUSD-${e.year}${e.month.toString().padLeft(2, '0')}${e.day.toString().padLeft(2, '0')}-1.1000-C';
}

Map<String, dynamic> _optionTerms() {
  final s = previewOptionSeries();
  final p = s.split('-');
  return {
    'series': s,
    'underlying': 'EURUSD',
    'right': 'call',
    'strike': 1.1,
    'expiry': '${p[1].substring(0, 4)}-${p[1].substring(4, 6)}-${p[1].substring(6)}',
    'style': 'european',
    'contractSize': 10000,
    'quoteCurrency': 'USD',
  };
}

/* ------------------------------------------------------------------ account detail */

List<Map<String, dynamic>> _positions(int login) {
  final now = DateTime.now().toUtc();
  Map<String, dynamic> pos(int ticket, String symbol, String side, double volume, double open, double current, double profit, {Map<String, dynamic>? option}) =>
      {
        'ticket': ticket,
        'login': login,
        'symbol': symbol,
        'side': side,
        'volume': volume,
        'openPrice': open,
        'openTime': now.subtract(Duration(hours: ticket % 40 + 2)).toIso8601String(),
        'sl': null,
        'tp': null,
        'swap': 0,
        'commission': option == null ? 3.5 : 1.2,
        'currentPrice': current,
        'profit': profit,
        'source': 'manual',
        'platform': 'Android',
        'comment': '',
        if (option != null) ...{'option': option, 'premium': -60.0, 'markValue': 82.0, 'mark': current},
      };
  switch (login) {
    case 10042817:
      return [
        pos(5120031, 'EURUSD', 'buy', 0.5, 1.08412, 1.0853, 59),
        pos(5120044, 'XAUUSD', 'sell', 0.1, 2650.4, 2641.1, 93),
        pos(5120052, previewOptionSeries(), 'buy', 2, 0.003, 0.0041, 22, option: _optionTerms()),
      ];
    case 10051123:
      return [pos(5120061, 'BTCUSD', 'buy', 0.01, 61240.5, 60980.2, -260.3)];
    case 20017734:
      return [pos(7330011, 'US30', 'buy', 0.2, 42010.5, 42160.0, 299.0), pos(7330012, 'GBPUSD', 'sell', 0.3, 1.2745, 1.2731, 42.0)];
  }
  return const [];
}

/* ------------------------------------------------------------------ deals */

const List<String> _symbols = ['EURUSD', 'XAUUSD', 'US30', 'GBPUSD', 'BTCUSD', 'USDJPY', 'NAS100'];
const List<double> _prices = [1.0841, 2645.3, 42050, 1.2741, 61200, 149.21, 20110];
const List<double> _pnl = [124.5, -48.2, 310, -12.75, 88.4, -150.3, 42.1, 205.6, -66.9, 19.8, -230, 95.25, 61, -18.4, 140.7, -35.5];

/// The sample deals of an account, newest first (entries and exits; one option round trip on 10042817).
List<Map<String, dynamic>> previewDeals(int login) {
  final acc = _account(login);
  if (acc == null) return const [];
  final cent = acc['cent'] == true;
  final k = cent ? 100.0 : 1.0;
  final n = login == 10042817 ? 16 : (login == 20017734 ? 8 : 6);
  final now = DateTime.now().toUtc();
  final deals = <Map<String, dynamic>>[];
  var id = login % 1000 * 100000;
  for (var i = 0; i < n; i++) {
    final close = now.subtract(Duration(days: i * 5 + 1, hours: i * 3 % 11));
    final open = close.subtract(Duration(hours: 2 + i % 5, minutes: 7 * i % 60));
    final symbol = _symbols[(i + login) % _symbols.length];
    final base = _prices[(i + login) % _prices.length];
    final side = i.isEven ? 'buy' : 'sell';
    final volume = [0.5, 0.1, 1.0, 0.25, 0.3][i % 5];
    final profit = _pnl[i % _pnl.length] * k;
    final exitPrice = base * (1 + (profit >= 0 ? 1 : -1) * (side == 'buy' ? 1 : -1) * 0.0012);
    final ticket = 5100000 + login % 1000 * 100 + i;
    final commission = (3.5 * volume * 2 * k * 100).round() / 100;
    final reason = i == 1 ? 'sl' : (i == 2 ? 'tp' : (i == 10 ? 'stop_out' : 'client'));
    final common = {'login': login, 'positionTicket': ticket, 'symbol': symbol, 'positionSide': side, 'volume': volume, 'source': 'manual', 'comment': ''};
    deals.add({
      ...common,
      'id': ++id,
      'orderTicket': ticket + 900000,
      'side': side == 'buy' ? 'sell' : 'buy',
      'entry': 'out',
      'price': double.parse(exitPrice.toStringAsFixed(base > 100 ? 2 : 5)),
      'profit': profit,
      'swap': i % 3 == 0 ? -1.85 * k : 0,
      'commission': 0,
      'reason': reason,
      'time': close.toIso8601String(),
      'openPrice': base,
      'openTime': open.toIso8601String(),
      'reversed': false,
      'instrument': 'cfd',
    });
    deals.add({
      ...common,
      'id': ++id,
      'orderTicket': ticket + 800000,
      'side': side,
      'entry': 'in',
      'price': base,
      'profit': 0,
      'swap': 0,
      'commission': commission,
      'reason': 'client',
      'time': open.toIso8601String(),
      'openPrice': null,
      'openTime': null,
      'reversed': false,
      'instrument': 'cfd',
    });
  }
  if (login == 10042817) {
    // a Ezymex FX Options round trip: bought 2 contracts at $30 each, sold at $42 each (+$24)
    final terms = _optionTerms();
    final close = now.subtract(const Duration(days: 3, hours: 4));
    final open = close.subtract(const Duration(hours: 20));
    final common = {
      'login': login,
      'positionTicket': 5120099,
      'symbol': terms['series'],
      'positionSide': 'buy',
      'volume': 2,
      'source': 'manual',
      'comment': '',
      'instrument': 'option',
      'reversed': false,
    };
    deals.add({
      ...common,
      'id': ++id,
      'orderTicket': 6120099,
      'side': 'sell',
      'entry': 'out',
      'price': 0.0042,
      'profit': 24,
      'swap': 0,
      'commission': 0,
      'reason': 'client',
      'time': close.toIso8601String(),
      'openPrice': 0.003,
      'openTime': open.toIso8601String(),
      'option': {...terms, 'cash': 84, 'usdPerQuote': 1, 'commissionCharged': 1.2},
    });
    deals.add({
      ...common,
      'id': ++id,
      'orderTicket': 6120098,
      'side': 'buy',
      'entry': 'in',
      'price': 0.003,
      'profit': 0,
      'swap': 0,
      'commission': 1.2,
      'reason': 'client',
      'time': open.toIso8601String(),
      'openPrice': null,
      'openTime': null,
      'option': {...terms, 'cash': -60, 'usdPerQuote': 1, 'commissionCharged': 1.2},
    });
  }
  deals.sort((a, b) => '${b['time']}'.compareTo('${a['time']}'));
  return deals;
}

bool _inRange(String? iso, Map<String, String> query) {
  final t = DateTime.tryParse(iso ?? '');
  if (t == null) return false;
  final from = DateTime.tryParse(query['from'] ?? '');
  final to = DateTime.tryParse(query['to'] ?? '');
  if (from != null && t.isBefore(from)) return false;
  if (to != null && !t.isBefore(to)) return false;
  return true;
}

bool _isOption(Map<String, dynamic> d) => d['instrument'] == 'option' || d['option'] != null;

Map<String, dynamic> _page(List<Map<String, dynamic>> all, Map<String, String> query, String key) {
  final page = math.max(1, int.tryParse(query['page'] ?? '') ?? 1);
  final limit = (int.tryParse(query['limit'] ?? '') ?? 50).clamp(1, 500);
  return {key: all.skip((page - 1) * limit).take(limit).toList(), 'page': page, 'limit': limit, 'total': all.length};
}

Map<String, dynamic> _history(int login, Map<String, String> query) {
  final inst = query['instrument'];
  final deals = [
    for (final d in previewDeals(login))
      if (_inRange(d['time'] as String?, query) && (inst == null || (inst == 'option') == _isOption(d))) d,
  ];
  double sum(String k) => deals.fold(0.0, (s, d) => s + ((d[k] as num?)?.toDouble() ?? 0));
  return {
    ..._page(deals, query, 'deals'),
    'orders': <Object>[],
    'totals': {'profit': sum('profit'), 'swap': sum('swap'), 'commission': sum('commission')},
    'truncated': false,
  };
}

/* ------------------------------------------------------------------ ledger */

/// The sample balance movements of an account, newest first.
List<Map<String, dynamic>> previewLedger(int login) {
  final acc = _account(login);
  if (acc == null) return const [];
  final currency = '${acc['currency']}';
  final demo = acc['type'] == 'demo';
  final items = <Map<String, dynamic>>[];
  var txn = 880000 + login % 1000 * 100;
  Map<String, dynamic> item(String kind, double amount, String at, {String sub = 'balance', String? note, String? reference}) => {
    'txn': ++txn,
    'kind': kind,
    'subLedger': sub,
    'amount': amount,
    'currency': currency,
    'at': at,
    'reference': reference,
    'reasonCode': null,
    'note': note,
  };
  final now = DateTime.now().toUtc();
  items.add(
    item(
      demo ? 'demo_initial' : 'transfer_in',
      demo ? 10000 : (acc['cent'] == true ? 250000 : 12000),
      now.subtract(const Duration(days: 120)).toIso8601String(),
      note: demo ? null : 'From wallet',
    ),
  );
  if (!demo) {
    items.add(item('transfer_in', acc['cent'] == true ? 20000 : 1000, now.subtract(const Duration(days: 1, hours: 2)).toIso8601String(), note: 'From wallet'));
  }
  if (login == 10042817) {
    items.add(item('bonus', 50, now.subtract(const Duration(days: 40)).toIso8601String(), sub: 'bonus', reference: 'WELCOME50'));
    items.add(item('transfer_out', -500, now.subtract(const Duration(days: 12)).toIso8601String(), note: 'To wallet'));
  }
  for (final d in previewDeals(login)) {
    if (d['entry'] == 'in') {
      final c = (d['commission'] as num).toDouble();
      if (c != 0) items.add(item('commission', -c, '${d['time']}', reference: 'deal #${d['id']}'));
      if (_isOption(d)) items.add(item('option_premium', -60, '${d['time']}', reference: 'deal #${d['id']}'));
    } else if (_isOption(d)) {
      items.add(item('option_premium', 84, '${d['time']}', reference: 'deal #${d['id']}'));
    } else {
      items.add(item('trade_pnl', (d['profit'] as num).toDouble(), '${d['time']}', reference: 'deal #${d['id']}'));
      final sw = (d['swap'] as num).toDouble();
      if (sw != 0) items.add(item('swap', sw, '${d['time']}', reference: 'position #${d['positionTicket']}'));
    }
  }
  items.sort((a, b) => '${b['at']}'.compareTo('${a['at']}'));
  return items;
}

/* ------------------------------------------------------------------ analytics */

/// The analytics answer for `login` (`all` or one login) over [from, to): the dashboard reads `curve.points`.
Map<String, dynamic> previewPortfolioAnalytics(Map<String, String> query) {
  final login = query['login'] ?? 'all';
  final all = (previewAccounts['accounts'] as List).cast<Map<String, dynamic>>();
  final known = login == 'all' || all.any((a) => '${a['login']}' == login);
  final today = DateTime.now();
  final to = DateTime.tryParse(query['to'] ?? '') ?? today.add(const Duration(days: 1));
  var from = DateTime.tryParse(query['from'] ?? '') ?? today.subtract(const Duration(days: 89));
  final opened = DateTime(today.year, today.month, today.day).subtract(const Duration(days: 220));
  if (from.isBefore(opened)) from = opened;
  final points = <Map<String, dynamic>>[];
  if (known) {
    var eq = 15200.0, peak = 0.0, maxDd = 0.0;
    var i = 0;
    for (var d = from; d.isBefore(to) && !d.isAfter(today); d = DateTime(d.year, d.month, d.day + 1), i++) {
      final flow = i == 0 ? 0.0 : (i % 23 == 0 ? 1000.0 : 0.0);
      eq += flow + math.sin(i / 3.2) * 140 + 22;
      final bal = eq - 120 - math.cos(i / 2.0) * 60;
      peak = math.max(peak, eq);
      final dd = (eq - peak) / peak * 100;
      maxDd = math.min(maxDd, dd);
      points.add({'day': _day(d), 'balance': bal, 'equity': eq, 'flow': flow, 'index': 100 + i * 0.12, 'drawdown': dd});
    }
  }
  final trades = known ? 42 : 0;
  Map<String, dynamic> stats({int trades = 42, int wins = 25, double net = 1580.2, double pf = 2.03}) => {
    'trades': trades,
    'wins': wins,
    'losses': trades - wins,
    'winRate': trades == 0 ? 0 : wins / trades * 100,
    'grossProfit': trades == 0 ? 0 : 3120.4 * wins / 25,
    'grossLoss': trades == 0 ? 0 : 1540.2 * (trades - wins) / 17,
    'net': net,
    'avgWin': trades == 0 ? 0 : 124.8,
    'avgLoss': trades == 0 ? 0 : 90.6,
    'profitFactor': trades == 0 ? null : pf,
    'expectancy': trades == 0 ? 0 : net / trades,
    'rewardRisk': trades == 0 ? null : 1.38,
    'avgHoldSecs': trades == 0 ? 0 : 53460,
    'avgHoldWinSecs': trades == 0 ? 0 : 41200,
    'avgHoldLossSecs': trades == 0 ? 0 : 71000,
    'lots': trades * 0.44,
    'commission': trades * 3.07,
    'swap': -42.5,
    'profit': net + 128.8,
    'maxConsecWins': 6,
    'maxConsecLosses': 3,
    'best': trades == 0
        ? null
        : {
            'deal': 4281001,
            'ticket': 5120007,
            'login': 10042817,
            'symbol': 'XAUUSD',
            'side': 'buy',
            'volume': 0.5,
            'net': 412.6,
            'closeTime': today.toIso8601String(),
          },
    'worst': trades == 0
        ? null
        : {
            'deal': 4281044,
            'ticket': 5120010,
            'login': 10042817,
            'symbol': 'NAS100',
            'side': 'sell',
            'volume': 1.0,
            'net': -230.0,
            'closeTime': today.toIso8601String(),
          },
  };
  final heat = [
    for (var d = 0; d < 7; d++) [for (var h = 0; h < 24; h++) d < 5 && h >= 7 && h <= 21 ? ((math.sin(d * 24.0 + h) * 140).roundToDouble()) : 0.0],
  ];
  final heatTrades = [
    for (var d = 0; d < 7; d++) [for (var h = 0; h < 24; h++) d < 5 && h >= 7 && h <= 21 ? 1 + (d + h) % 3 : 0],
  ];
  return {
    'scope': login == 'all' ? 'live' : 'account',
    'from': _day(from),
    'to': _day(to),
    'accounts': [
      if (known)
        for (final a in all)
          {
            'login': a['login'],
            'type': a['type'],
            'group': a['group'],
            'groupName': a['groupName'],
            'currency': a['currency'],
            'cent': a['cent'],
            'equity': a['equity'],
            'balance': a['balance'],
          },
    ],
    'curve': {
      'points': points,
      'maxDrawdown': points.fold<double>(0, (m, p) => math.min(m, (p['drawdown'] as num).toDouble())),
      'currentDrawdown': points.isEmpty ? 0 : (points.last['drawdown'] as num).toDouble(),
      'returnPct': points.length < 2 ? 0 : 10.42,
      'sharpe': 1.82,
      'sortino': 2.41,
      'volatility': 12.3,
    },
    'stats': stats(trades: trades),
    'long': stats(trades: known ? 24 : 0, wins: 16, net: 1240.6, pf: 2.6),
    'short': stats(trades: known ? 18 : 0, wins: 9, net: 339.6, pf: 1.32),
    'bySymbol': [
      if (known) ...[
        {'key': 'XAUUSD', 'trades': 12, 'wins': 8, 'winRate': 66.7, 'net': 920.4, 'lots': 3.2},
        {'key': 'EURUSD', 'trades': 10, 'wins': 6, 'winRate': 60, 'net': 640.1, 'lots': 5},
        {'key': 'US30', 'trades': 6, 'wins': 4, 'winRate': 66.7, 'net': 210, 'lots': 1.2},
        {'key': previewOptionSeries(), 'trades': 1, 'wins': 1, 'winRate': 100, 'net': 24, 'lots': 0},
        {'key': 'GBPUSD', 'trades': 7, 'wins': 3, 'winRate': 42.9, 'net': -120.6, 'lots': 2.1},
        {'key': 'NAS100', 'trades': 6, 'wins': 3, 'winRate': 50, 'net': -93.7, 'lots': 6.9},
      ],
    ],
    'byWeekday': [
      if (known) ...[
        {'key': '0', 'trades': 9, 'wins': 6, 'winRate': 66.7, 'net': 410.2, 'lots': 3.8},
        {'key': '1', 'trades': 8, 'wins': 4, 'winRate': 50, 'net': -85.5, 'lots': 3.1},
        {'key': '2', 'trades': 10, 'wins': 7, 'winRate': 70, 'net': 690.4, 'lots': 4.4},
        {'key': '3', 'trades': 7, 'wins': 3, 'winRate': 42.9, 'net': -140.1, 'lots': 3.2},
        {'key': '4', 'trades': 8, 'wins': 5, 'winRate': 62.5, 'net': 705.2, 'lots': 3.9},
      ],
    ],
    'bySession': [
      if (known) ...[
        {'session': 'Asia', 'hours': '02:00–10:00', 'trades': 8, 'net': -60.2, 'winRate': 50},
        {'session': 'London', 'hours': '10:00–15:00', 'trades': 16, 'net': 980.5, 'winRate': 68.8},
        {'session': 'New York', 'hours': '15:00–23:00', 'trades': 18, 'net': 659.9, 'winRate': 55.6},
      ],
    ],
    'hourHeatmap': known ? heat : <Object>[],
    'hourTrades': known ? heatTrades : <Object>[],
    'moneyFlow': {
      'deposits': known ? 15000 : 0,
      'withdrawals': known ? -2500 : 0,
      'tradingPnl': known ? 1751.5 : 0,
      'commission': known ? -128.8 : 0,
      'performanceFees': 0,
      'bonus': known ? 50 : 0,
      'adjustments': 0,
      'earnings': known ? 120 : 0,
      'optionPremiums': known ? -60 : 0,
      'optionSettlements': known ? 84 : 0,
      'equityNow': points.isEmpty ? 0 : points.last['equity'],
    },
    'charges': {
      'commission': known ? 128.8 : 0,
      'swapPaid': known ? 61.2 : 0,
      'swapEarned': known ? 18.7 : 0,
      'performanceFees': 0,
      'walletFees': known ? 4 : 0,
      'spreadEstimate': known ? 212.5 : 0,
    },
    'behaviour': {
      'overtradingDays': 1,
      'revengeTrades': 2,
      'avgRiskPct': 1.4,
      'maxRiskPct': 3.2,
      'stopOuts': 1,
      'closedBySl': 5,
      'closedByTp': 7,
      'insights': [
        if (known) ...[
          {
            'id': 'session',
            'tone': 'up',
            'title': 'London is your best session',
            'stat': '+\$980',
            'text': '16 trades closed in the London session made 62% of your net profit.',
            'tip': 'Consider focusing your trading on the London hours.',
          },
          {
            'id': 'revenge',
            'tone': 'warn',
            'title': 'Revenge trades',
            'stat': '2',
            'text': 'Two trades were opened within 5 minutes of a loss, with a larger volume.',
            'tip': 'Take a short break after a losing trade before opening the next one.',
          },
          {
            'id': 'risk',
            'tone': 'info',
            'title': 'Risk per trade',
            'stat': '1.4%',
            'text': 'On average you risked 1.4% of equity per trade (3.2% at most).',
            'tip': 'Keeping risk under 2% per trade protects you from long losing streaks.',
          },
        ],
      ],
    },
  };
}

/* ------------------------------------------------------------------ statements */

List<Map<String, dynamic>> _months(int login) {
  final acc = _account(login);
  if (acc == null) return const [];
  final k = acc['cent'] == true ? 100.0 : 1.0;
  final now = DateTime.now();
  final out = <Map<String, dynamic>>[];
  for (var i = 0; i < 7; i++) {
    final m = DateTime(now.year, now.month - i);
    final next = DateTime(m.year, m.month + 1);
    out.add({
      'month': _day(m).substring(0, 7),
      'from': _day(m),
      'to': _day(next),
      'net': ([412.6, -128.4, 905.2, 64.1, -22.5, 318.9, 0.0][i] * k),
      'deposits': ([1000.0, 0.0, 2500.0, 0.0, 0.0, 12000.0, 0.0][i] * k),
      'withdrawals': ([0.0, 500.0, 0.0, 0.0, 250.0, 0.0, 0.0][i] * k),
      'trades': [9, 6, 14, 3, 2, 8, 0][i],
    });
  }
  return out;
}

/// The bytes of a sample statement / CSV (the preview adapter sends them as a JSON string).
String previewFile(String kind, String format) => switch (format) {
  'pdf' => '%PDF-1.4 Ezymex sample $kind',
  'xlsx' => 'PK sample $kind workbook',
  _ => 'time,deal,symbol,side,volume,price,profit\n2026-10-01T10:00:00Z,4281001,EURUSD,buy,0.50,1.08412,124.50\n',
};

/* ------------------------------------------------------------------ router */

(int, Object)? previewPortfolio(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  Map<String, dynamic> error(String code, String message) => {
    'error': {'code': code, 'message': message},
  };
  final seg = path.split('/');
  if (method == 'GET' && seg.length >= 3 && seg[0] == 'trading' && seg[1] == 'accounts') {
    final login = int.tryParse(seg[2]);
    if (login == null) return null;
    final acc = _account(login);
    if (acc == null) return (404, error('not_found', 'Account not found.'));
    if (seg.length == 3) return (200, {'account': acc, 'positions': _positions(login), 'orders': <Object>[]});
    switch (seg[3]) {
      case 'history':
        return (200, _history(login, query));
      case 'ledger':
        final items = [
          for (final x in previewLedger(login))
            if (_inRange(x['at'] as String?, query)) x,
        ];
        return (200, _page(items, query, 'items'));
      case 'export':
        return (200, previewFile(query['kind'] ?? 'history', 'csv'));
    }
    return null;
  }
  if (method == 'GET' && path == 'reports/analytics') return (200, previewPortfolioAnalytics(query));
  if (method == 'GET' && seg.length == 4 && seg[0] == 'reports' && seg[1] == 'accounts') {
    final login = int.tryParse(seg[2]) ?? 0;
    if (_account(login) == null) return (404, error('not_found', 'Account not found.'));
    if (seg[3] == 'months') return (200, {'login': login, 'currency': _account(login)!['currency'], 'months': _months(login)});
    if (seg[3] == 'statement') {
      final f = query['format'] ?? 'pdf';
      if (f == 'json') return (200, {'login': login, 'from': query['from'], 'to': query['to'], 'deals': previewDeals(login)});
      return (200, previewFile('statement', f));
    }
  }
  if (method == 'POST' && path == 'growth/shares') {
    final trade = body['kind'] == 'trade';
    return (
      200,
      {
        'share': {
          'code': trade ? 'T${body['dealId']}' : 'P${body['login']}',
          'kind': trade ? 'trade' : 'period',
          'login': body['login'],
          'showAmounts': body['showAmounts'] == true,
          'createdAt': DateTime.now().toUtc().toIso8601String(),
          'views': 0,
          'url': 'https://app.ezymex.com/s/${trade ? 'T${body['dealId']}' : 'P${body['login']}'}',
          'data': {
            'name': 'Arjun',
            'symbol': trade ? 'XAUUSD' : null,
            'side': trade ? 'buy' : null,
            'currency': 'USD',
            'brand': 'Ezymex',
            'referralCode': 'ARJUN26',
          },
        },
      },
    );
  }
  return null;
}
