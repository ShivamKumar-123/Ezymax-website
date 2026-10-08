// Sample answers for the developer screens (previews and widget tests only; shapes of the real API: the ALGO BFF
// /api/algo/<path>, apps/crm/components/algo/api.ts and services/algo). Return null for paths this module doesn't own.
import 'dart:math' as math;

String _ago(Duration d) => DateTime.now().toUtc().subtract(d).toIso8601String();
int _unix(DateTime d) => d.millisecondsSinceEpoch ~/ 1000;
final DateTime _now = DateTime.now().toUtc();

const _base = 'https://api.kalkstrade.com/algo/public/v1';

(int, Object)? previewDeveloper(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  if (!path.startsWith('algo/')) return null;
  final p = path.substring(5);
  final seg = p.split('/');
  final id = seg.length > 1 ? int.tryParse(seg[1]) : null;
  final ok = <String, Object?>{'ok': true};

  if (method == 'GET') {
    switch (p) {
      case 'accounts':
        return (200, {'items': _accounts});
      case 'meta':
        return (200, _meta);
      case 'keys':
        return (200, _keys());
      case 'webhooks':
        return (200, _hooks());
      case 'strategies':
        return (200, {'items': _strategies()});
      case 'deployments':
        return (200, {'items': _deployments()});
      case 'controls':
        return (
          200,
          {'killed': _killedAt != null, 'killedAt': _killedAt, 'killedBy': _killedAt == null ? null : 'client', 'reason': null, 'globalKill': false},
        );
      case 'backtests':
        return (200, {'items': _backtests()});
      case 'market/listings':
        var items = _listings();
        final q = (query['q'] ?? '').toLowerCase();
        if (q.isNotEmpty) items = items.where((l) => '${l['title']} ${l['author']} ${l['symbol']}'.toLowerCase().contains(q)).toList();
        if (query['price'] == 'free') items = items.where((l) => l['priceMonthly'] == 0).toList();
        if (query['price'] == 'paid') items = items.where((l) => (l['priceMonthly'] as num) > 0).toList();
        if (query['sort'] == 'rating') items.sort((a, b) => (b['rating'] as num).compareTo(a['rating'] as num));
        if (query['sort'] == 'subscribers') items.sort((a, b) => (b['subscribers'] as num).compareTo(a['subscribers'] as num));
        return (
          200,
          {
            'items': items,
            'subscribed': [3],
            'platformCutPct': 20,
          },
        );
      case 'market/subscriptions':
        return (
          200,
          {
            'items': [
              {
                'id': 41,
                'listingId': 3,
                'title': 'London breakout · gold',
                'author': 'Ravi K.',
                'symbol': 'XAUUSD',
                'timeframe': 'M15',
                'mode': 'copy',
                'status': 'active',
                'login': 80412337,
                'deploymentStatus': 'running',
                'price': 19,
                'periodEnd': _now.add(const Duration(days: 21)).toIso8601String(),
                'autoRenew': true,
              },
            ],
          },
        );
      case 'market/mine':
        return (
          200,
          {
            'items': [
              {..._listings()[1], 'status': 'approved', 'moderationNote': null},
            ],
            'earned': 182.4,
            'platformFees': 45.6,
            'payments': 12,
          },
        );
    }
    if (seg.first == 'keys' && seg.length == 3 && seg[2] == 'activity') return (200, {'items': _keyActivity()});
    if (seg.first == 'webhooks' && id != null) return (200, _hookDetail(id));
    if (seg.first == 'strategies' && id != null) return (200, _strategyDetail(id));
    if (seg.first == 'deployments' && id != null) return (200, _deploymentDetail(id));
    if (seg.first == 'backtests' && id != null) return (200, _backtestDetail(id));
    if (seg.first == 'market' && seg.length == 3 && seg[1] == 'listings') return (200, _listingDetail(int.tryParse(seg[2]) ?? 1));
    return null;
  }

  // writes
  switch (p) {
    case 'keys':
      final r = _createKey(body);
      return (r.containsKey('error') ? 422 : 200, r);
    case 'webhooks':
      return (200, {'id': 3, 'url': 'https://api.kalkstrade.com/algo/hooks/wh_5f2c9a71d0e44b8ab3c6e2f19d7a0b6c'});
    case 'validate':
      return (200, _validate(body));
    case 'ai/strategy':
      return (200, _aiReply(body));
    case 'strategies':
      return (200, {'id': 1, 'version': 1, 'valid': true});
    case 'deployments':
      return (200, {'id': 501});
    case 'controls/kill':
      return (200, _kill(body));
    case 'backtests':
      return _runBacktest(body);
    case 'market/listings':
      return (200, {'id': 9, 'status': 'pending'});
  }
  if (seg.first == 'keys' && seg.length == 3 && seg[2] == 'revoke') {
    if (id != null) _revoked.add(id);
    return (200, ok);
  }
  if (seg.first == 'webhooks' && seg.length == 3 && seg[2] == 'rotate') {
    return (200, {'url': 'https://api.kalkstrade.com/algo/hooks/wh_0b7e3d5a9c1f48e2a6d4b8c0e2f4a6b8'});
  }
  if (seg.first == 'webhooks' && seg.length == 3 && seg[2] == 'test') {
    return (
      200,
      {
        'status': 'accepted',
        'results': [
          {'login': 80412337, 'status': 'accepted', 'ticket': 1000418, 'volume': 0.01},
        ],
      },
    );
  }
  if (seg.first == 'webhooks') return (200, ok);
  if (seg.first == 'strategies' && seg.length == 3 && seg[2] == 'versions') return (200, {'id': id ?? 1, 'version': 4, 'valid': true});
  if (seg.first == 'strategies') return (200, ok);
  if (seg.first == 'deployments' && seg.length == 3 && id != null) return _depAction(id, seg[2], body);
  if (seg.first == 'backtests' && seg.length == 3) return (200, ok);
  if (seg.first == 'market' && seg.length == 4 && seg[3] == 'subscribe') {
    return (200, {'deploymentId': 503, 'clonedStrategyId': body['mode'] == 'clone' ? 12 : null, 'charged': 19});
  }
  if (seg.first == 'market' && seg.length == 4 && seg[3] == 'reviews') return (200, ok);
  if (seg.first == 'market' && seg.length == 4 && seg[3] == 'cancel') return (200, {'status': 'cancelled'});
  return (200, ok);
}

/* ------------------------------------------------------------------ accounts, meta */

final _accounts = [
  {
    'login': 80412337,
    'type': 'demo',
    'group': 'demo\\standard',
    'groupName': 'Standard',
    'mode': 'hedging',
    'currency': 'USD',
    'balance': 10250.4,
    'equity': 10318.92,
    'status': 'active',
    'name': 'Demo',
    'leverage': 500,
  },
  {
    'login': 50021894,
    'type': 'live',
    'group': 'real\\pro',
    'groupName': 'Pro',
    'mode': 'hedging',
    'currency': 'USD',
    'balance': 4820.15,
    'equity': 4791.6,
    'status': 'active',
    'name': 'Live',
    'leverage': 200,
  },
];

const _example = '''# EMA trend with an H4 filter
name("EMA trend H1")
symbol("EURUSD")
timeframe("H1")
lots(0.10)
stop_loss(atr=2, period=14)
take_profit(rr=2)
breakeven(trigger=150, offset=10)
max_trades_per_day(3)

fast = ema(close, 20)
slow = ema(close, 50)
trend_up = htf("H4", close > ema(close, 50))

buy = crosses_above(fast, slow) and rsi(close, 14) < 70 and trend_up
sell = crosses_below(fast, slow) and rsi(close, 14) > 30 and not trend_up
exit_buy = close < slow
exit_sell = close > slow
''';

final Map<String, Object?> _meta = {
  'symbols': [
    for (final s in [
      ('EURUSD', 'forex'),
      ('GBPUSD', 'forex'),
      ('USDJPY', 'forex'),
      ('AUDUSD', 'forex'),
      ('XAUUSD', 'metals'),
      ('XAGUSD', 'metals'),
      ('US30', 'indices'),
      ('NAS100', 'indices'),
      ('USOIL', 'energies'),
      ('BTCUSD', 'crypto'),
      ('ETHUSD', 'crypto'),
    ])
      {
        'symbol': s.$1,
        'assetClass': s.$2,
        'digits': 5,
        'point': 0.00001,
        'pipSize': 0.0001,
        'lotMin': 0.01,
        'lotMax': 100,
        'lotStep': 0.01,
        'session': 'fx',
        'core': true,
      },
  ],
  'timeframes': ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'],
  'indicators': [
    for (final i in [
      ('sma', 'SMA', 'Simple moving average', 20, 0, 0, 0),
      ('ema', 'EMA', 'Exponential moving average', 20, 0, 0, 0),
      ('wma', 'WMA', 'Weighted moving average', 20, 0, 0, 0),
      ('rsi', 'RSI', 'Relative strength index', 14, 0, 0, 0),
      ('macd', 'MACD line', 'MACD (fast EMA − slow EMA)', 12, 26, 9, 0),
      ('macd_signal', 'MACD signal', 'Signal line of the MACD', 12, 26, 9, 0),
      ('macd_hist', 'MACD histogram', 'MACD − signal', 12, 26, 9, 0),
      ('bb_upper', 'Bollinger upper', 'Upper Bollinger band', 20, 0, 0, 2),
      ('bb_middle', 'Bollinger middle', 'Bollinger basis (SMA)', 20, 0, 0, 2),
      ('bb_lower', 'Bollinger lower', 'Lower Bollinger band', 20, 0, 0, 2),
      ('atr', 'ATR', 'Average true range (Wilder)', 14, 0, 0, 0),
      ('stoch_k', 'Stochastic %K', 'Stochastic oscillator %K', 14, 3, 0, 0),
      ('stoch_d', 'Stochastic %D', 'Stochastic oscillator %D', 14, 3, 0, 0),
      ('highest', 'Highest high', 'Highest high of the N bars before this one', 20, 0, 0, 0),
      ('lowest', 'Lowest low', 'Lowest low of the N bars before this one', 20, 0, 0, 0),
      ('cci', 'CCI', 'Commodity channel index (typical price)', 20, 0, 0, 0),
      ('adx', 'ADX', 'Average directional index', 14, 14, 0, 0),
    ])
      {'key': i.$1, 'label': i.$2, 'description': i.$3, 'period': i.$4, 'period2': i.$5, 'period3': i.$6, 'mult': i.$7, 'priceScale': false},
  ],
  'priceFields': ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'],
  'patterns': ['bullish', 'bearish', 'bullish_engulfing', 'bearish_engulfing', 'hammer', 'shooting_star', 'doji', 'inside_bar'],
  'operators': ['gt', 'lt', 'gte', 'lte', 'crosses_above', 'crosses_below'],
  'distanceModes': ['none', 'points', 'pips', 'price', 'percent', 'atr', 'level', 'rr'],
  'trailModes': ['none', 'points', 'pips', 'atr'],
  'dsl': {
    'signals': ['buy', 'sell', 'exit_buy', 'exit_sell'],
    'functions': [
      {'syntax': 'sma(src, n) · ema · wma · rma', 'text': 'moving averages of any series'},
      {'syntax': 'rsi(src, n) · cci(n) · willr(n) · momentum(src, n) · roc(src, n)', 'text': 'oscillators'},
      {'syntax': 'macd(src, fast, slow, signal) · macd_signal(…) · macd_hist(…)', 'text': 'MACD'},
      {'syntax': 'bb_upper(src, n, dev) · bb_middle · bb_lower · stddev(src, n)', 'text': 'Bollinger bands'},
      {'syntax': 'crosses_above(a, b) · crosses_below(a, b) · crosses(a, b)', 'text': 'crossings on this bar'},
      {'syntax': 'htf("H4", expr)', 'text': 'evaluate on a higher timeframe (last closed bar)'},
    ],
    'settings': [
      {'syntax': 'name("…") · symbol("EURUSD") · timeframe("H1")', 'text': 'identity'},
      {'syntax': 'lots(0.1) · risk(1.0) · max_lots(1)', 'text': 'sizing (risk = % of balance, needs a stop loss)'},
      {'syntax': 'stop_loss(pips=20 | points= | price= | percent= | atr=2, period=14 | level=)', 'text': 'stop loss'},
      {'syntax': 'take_profit(… | rr=2)', 'text': 'take profit (rr = multiple of the stop)'},
    ],
    'limits': {'sourceChars': 20000, 'statements': 200, 'depth': 48, 'nodes': 4000, 'period': 1000},
    'example': _example,
  },
  'ai': {'configured': true, 'model': 'claude-sonnet'},
  'publicUrl': 'https://api.kalkstrade.com/algo',
};

/* ------------------------------------------------------------------ keys */

/// Keys created and revoked in this session (the sample list changes with the writes).
final List<Map<String, Object?>> _newKeys = [];
final Set<int> _revoked = {};
int _nextKey = 9;

/// Back to the sample data as first served (widget tests start from it).
void resetPreviewDeveloper() {
  _newKeys.clear();
  _revoked.clear();
  _nextKey = 9;
  _depStatus.clear();
  _killedAt = null;
  _newRuns.clear();
}

Map<String, Object?> _createKey(Map<String, dynamic> b) {
  final id = _nextKey++;
  final login = b['login'] is num ? (b['login'] as num).toInt() : 80412337;
  final acct = _accounts.firstWhere((a) => a['login'] == login, orElse: () => _accounts.first);
  final scopes = b['scopes'] is List ? [for (final x in b['scopes'] as List) '$x'] : ['read'];
  final ips = b['ipWhitelist'] is List ? [for (final x in b['ipWhitelist'] as List) '$x'] : <String>[];
  if (acct['type'] == 'live' && scopes.contains('trade') && ips.isEmpty) {
    return {
      'error': {'code': 'validation', 'message': 'Trade keys on a live account need an IP whitelist.', 'field': 'ipWhitelist'},
    };
  }
  final keyId = 'kk_7Qm2xW9pLs${id.toString().padLeft(2, '0')}';
  final name = '${b['name'] ?? ''}'.trim().isEmpty ? 'Trading bot' : '${b['name']}'.trim();
  final days = b['expiresInDays'] is num ? (b['expiresInDays'] as num).toInt() : null;
  _newKeys.insert(0, {
    'id': id,
    'name': name,
    'keyId': keyId,
    'login': login,
    'accountType': acct['type'],
    'scopes': scopes,
    'ipWhitelist': ips,
    'ratePerMin': null,
    'expiresAt': days == null ? null : _now.add(Duration(days: days)).toIso8601String(),
    'status': 'active',
    'createdAt': DateTime.now().toUtc().toIso8601String(),
    'lastUsedAt': null,
    'lastIp': null,
  });
  return {'id': id, 'keyId': keyId, 'secret': 'ks_Hc8vR2nZ0tYq4mWb6eKx1jPu5sDf7gAo', 'name': name};
}

Map<String, Object?> _keys() {
  final k = _keysBase();
  return {
    ...k,
    'items': [
      for (final x in [..._newKeys, ...(k['items'] as List).cast<Map<String, Object?>>()]) _revoked.contains(x['id']) ? {...x, 'status': 'revoked'} : x,
    ],
  };
}

Map<String, Object?> _keysBase() => {
  'items': [
    {
      'id': 7,
      'name': 'Trading bot',
      'keyId': 'kk_3fJ8aQ2vNx0p',
      'login': 80412337,
      'accountType': 'demo',
      'scopes': ['read', 'trade'],
      'ipWhitelist': ['203.0.113.10'],
      'ratePerMin': null,
      'expiresAt': _now.add(const Duration(days: 74)).toIso8601String(),
      'status': 'active',
      'createdAt': _ago(const Duration(days: 16)),
      'lastUsedAt': _ago(const Duration(minutes: 4)),
      'lastIp': '203.0.113.10',
    },
    {
      'id': 5,
      'name': 'Portfolio dashboard',
      'keyId': 'kk_9mW1sD4kLe7c',
      'login': 50021894,
      'accountType': 'live',
      'scopes': ['read'],
      'ipWhitelist': <String>[],
      'ratePerMin': null,
      'expiresAt': null,
      'status': 'active',
      'createdAt': _ago(const Duration(days: 40)),
      'lastUsedAt': _ago(const Duration(hours: 3)),
      'lastIp': '198.51.100.24',
    },
    {
      'id': 2,
      'name': 'Old script',
      'keyId': 'kk_1aB7cD0eF3gH',
      'login': 80412337,
      'accountType': 'demo',
      'scopes': ['read', 'trade'],
      'ipWhitelist': <String>[],
      'ratePerMin': null,
      'expiresAt': null,
      'status': 'revoked',
      'createdAt': _ago(const Duration(days: 92)),
      'lastUsedAt': _ago(const Duration(days: 33)),
      'lastIp': null,
    },
  ],
  'usage': {
    'requests24h': 14268,
    'errors24h': 37,
    'rateLimited24h': 4,
    'p50': 18.4,
    'p99': 84.2,
    'writes24h': 212,
    'hourly': [
      for (var i = 0; i < 24; i++) {'t': _ago(Duration(hours: 24 - i)), 'n': 420 + (math.sin(i / 3) * 180).round() + (i * 7)},
    ],
  },
  'baseUrl': _base,
};

List<Map<String, Object?>> _keyActivity() => [
  for (var i = 0; i < 12; i++)
    {
      'at': _ago(Duration(minutes: 4 + i * 37)),
      'method': i % 3 == 0 ? 'POST' : 'GET',
      'path': i % 3 == 0 ? '/public/v1/orders' : (i.isEven ? '/public/v1/account' : '/public/v1/positions'),
      'status': i == 5 ? 422 : 200,
      'ip': '203.0.113.10',
      'ms': 12 + (i * 7) % 40,
    },
];

/* ------------------------------------------------------------------ webhooks */

Map<String, Object?> _hookRow(int id) => id == 1
    ? {
        'id': 1,
        'name': 'TradingView · gold',
        'status': 'active',
        'tokenHint': 'a0b6c',
        'passphrase': true,
        'createdAt': _ago(const Duration(days: 12)),
        'lastUsedAt': _ago(const Duration(minutes: 18)),
        'routes': 2,
        'events24h': 9,
      }
    : {
        'id': 2,
        'name': 'Crypto signals',
        'status': 'disabled',
        'tokenHint': 'f19d7',
        'passphrase': false,
        'createdAt': _ago(const Duration(days: 30)),
        'lastUsedAt': _ago(const Duration(days: 3)),
        'routes': 1,
        'events24h': 0,
      };

Map<String, Object?> _hooks() => {
  'items': [_hookRow(1), _hookRow(2)],
  'events': <Object?>[],
  'baseUrl': 'https://api.kalkstrade.com/algo/hooks',
};

Map<String, Object?> _hookDetail(int id) => {
  ..._hookRow(id == 2 ? 2 : 1),
  'routes': id == 2
      ? [
          {
            'id': 4,
            'login': 80412337,
            'accountType': 'demo',
            'sizing': {'mode': 'alert', 'value': 0},
            'enabled': true,
          },
        ]
      : [
          {
            'id': 1,
            'login': 80412337,
            'accountType': 'demo',
            'sizing': {'mode': 'fixed', 'value': 0.1},
            'enabled': true,
          },
          {
            'id': 2,
            'login': 50021894,
            'accountType': 'live',
            'sizing': {'mode': 'risk', 'value': 1, 'maxLots': 0.5},
            'enabled': true,
          },
        ],
  'events': id == 2
      ? <Object?>[]
      : [
          {
            'id': 301,
            'webhookId': 1,
            'receivedAt': _ago(const Duration(minutes: 18)),
            'ip': '52.89.214.238',
            'payload': {'action': 'buy', 'symbol': 'XAUUSD', 'volume': 1},
            'status': 'accepted',
            'error': null,
            'results': [
              {'login': 80412337, 'symbol': 'XAUUSD', 'status': 'accepted', 'ticket': 1000412, 'volume': 0.1},
              {'login': 50021894, 'symbol': 'XAUUSD', 'status': 'accepted', 'ticket': 2000187, 'volume': 0.12},
            ],
          },
          {
            'id': 297,
            'webhookId': 1,
            'receivedAt': _ago(const Duration(hours: 5)),
            'ip': '52.89.214.238',
            'payload': {'action': 'close', 'symbol': 'XAUUSD'},
            'status': 'partial',
            'error': null,
            'results': [
              {'login': 80412337, 'status': 'accepted', 'ticket': 1000398},
              {'login': 50021894, 'status': 'rejected', 'error': 'market_closed'},
            ],
          },
          {
            'id': 290,
            'webhookId': 1,
            'receivedAt': _ago(const Duration(hours: 9)),
            'ip': '34.212.75.30',
            'payload': {'action': 'sell', 'symbol': 'XAUUSD'},
            'status': 'rejected',
            'error': 'Wrong passphrase.',
            'results': <Object?>[],
          },
        ],
};

/* ------------------------------------------------------------------ strategies */

List<Map<String, Object?>> _strategies() => [
  {
    'id': 1,
    'name': 'EMA trend H1',
    'symbol': 'EURUSD',
    'timeframe': 'H1',
    'kind': 'visual',
    'origin': 'template',
    'version': 3,
    'versionId': 13,
    'valid': true,
    'running': 1,
    'listed': false,
    'lastBacktest': {'netProfit': 1284.5, 'returnPct': 12.85, 'trades': 64, 'winRate': 46.9, 'profitFactor': 1.42, 'maxDrawdownPct': 6.1, 'sharpe': 1.18},
    'summary': {'buy': 'crosses_above(ema(close, 20), ema(close, 50))', 'sell': 'crosses_below(ema(close, 20), ema(close, 50))'},
    'createdAt': _ago(const Duration(days: 20)),
    'updatedAt': _ago(const Duration(days: 2)),
  },
  {
    'id': 2,
    'name': 'Gold breakout',
    'symbol': 'XAUUSD',
    'timeframe': 'M15',
    'kind': 'code',
    'origin': 'ai',
    'version': 2,
    'versionId': 22,
    'valid': true,
    'running': 1,
    'listed': true,
    'lastBacktest': {'netProfit': -214.2, 'returnPct': -2.14, 'trades': 128, 'winRate': 38.3, 'profitFactor': 0.92, 'maxDrawdownPct': 9.4, 'sharpe': -0.21},
    'summary': {'buy': 'crosses_above(close, highest(20))'},
    'createdAt': _ago(const Duration(days: 9)),
    'updatedAt': _ago(const Duration(days: 1)),
  },
  {
    'id': 3,
    'name': 'RSI pullback',
    'symbol': 'GBPUSD',
    'timeframe': 'M15',
    'kind': 'visual',
    'origin': 'manual',
    'version': 1,
    'versionId': 31,
    'valid': false,
    'running': 0,
    'listed': false,
    'lastBacktest': null,
    'summary': null,
    'createdAt': _ago(const Duration(days: 1)),
    'updatedAt': _ago(const Duration(hours: 6)),
  },
];

Map<String, Object?> _op(
  String kind, {
  String field = 'close',
  String ind = 'none',
  int p = 0,
  int p2 = 0,
  int p3 = 0,
  num mult = 0,
  num value = 0,
  String pattern = 'none',
}) => {'kind': kind, 'field': field, 'indicator': ind, 'period': p, 'period2': p2, 'period3': p3, 'mult': mult, 'value': value, 'pattern': pattern};

Map<String, Object?> _rs(List<Map<String, Object?>> conditions) => {
  'logic': 'all',
  'groups': conditions.isEmpty
      ? <Object?>[]
      : [
          {'logic': 'all', 'conditions': conditions},
        ],
};

Map<String, Object?> _spec1() => {
  'name': 'EMA trend H1',
  'symbol': 'EURUSD',
  'timeframe': 'H1',
  'long': _rs([
    {'left': _op('indicator', ind: 'ema', p: 20), 'op': 'crosses_above', 'right': _op('indicator', ind: 'ema', p: 50), 'timeframe': 'same'},
    {'left': _op('indicator', ind: 'rsi', p: 14), 'op': 'lt', 'right': _op('value', value: 70), 'timeframe': 'same'},
  ]),
  'short': _rs([
    {'left': _op('indicator', ind: 'ema', p: 20), 'op': 'crosses_below', 'right': _op('indicator', ind: 'ema', p: 50), 'timeframe': 'same'},
  ]),
  'exitLong': _rs([]),
  'exitShort': _rs([]),
  'exitIntrabar': false,
  'sizing': {'mode': 'lots', 'lots': 0.1, 'riskPct': 1},
  'maxLots': 0.1,
  'sl': {'mode': 'atr', 'value': 2, 'atrPeriod': 14},
  'tp': {'mode': 'rr', 'value': 2, 'atrPeriod': 14},
  'trailing': {'mode': 'none', 'value': 0, 'atrPeriod': 14, 'breakevenTrigger': 150, 'breakevenOffset': 10},
  'sessions': [
    {'start': '08:00', 'end': '20:00'},
  ],
  'days': [1, 2, 3, 4, 5],
  'closeOutsideSession': false,
  'maxTradesPerDay': 3,
  'maxDailyLoss': 0,
  'oneAtATime': true,
};

const _code2 = '''name("Gold breakout")
symbol("XAUUSD")
timeframe("M15")
lots(0.05)
stop_loss(atr=1.5, period=14)
trailing(atr=2, period=14)
session("08:00", "17:00")

buy = crosses_above(close, highest(20))
sell = crosses_below(close, lowest(20))
''';

Map<String, Object?> _strategyDetail(int id) {
  final row = _strategies().firstWhere((s) => s['id'] == id, orElse: () => _strategies().first);
  final code = id == 2;
  final spec = id == 1 ? _spec1() : {..._spec1(), 'name': row['name'], 'symbol': row['symbol'], 'timeframe': row['timeframe']};
  final built = code ? _validateCode(_code2, 'XAUUSD', 'M15') : _validateSpec(spec);
  return {
    'id': row['id'],
    'name': row['name'],
    'symbol': row['symbol'],
    'timeframe': row['timeframe'],
    'kind': row['kind'],
    'origin': row['origin'],
    'status': 'active',
    'latestVersion': row['version'],
    'current': {...built, 'id': row['versionId'], 'version': row['version'], 'note': null, 'prompt': null, 'createdAt': _ago(const Duration(days: 2))},
    'versions': [
      {'id': row['versionId'], 'version': row['version'], 'kind': row['kind'], 'valid': row['valid'], 'note': null, 'createdAt': _ago(const Duration(days: 2))},
    ],
    'deployments': [
      for (final d in _deployments())
        if (d['strategyId'] == id) d,
    ],
    'backtests': [
      for (final b in _backtests())
        if (b['strategyId'] == id) b,
    ],
  };
}

String _opText(Map<String, dynamic> o) {
  switch (o['kind']) {
    case 'value':
      final v = o['value'] as num? ?? 0;
      return v == v.roundToDouble() ? v.toInt().toString() : '$v';
    case 'price':
      return '${o['field']}';
    case 'candle':
      return '${o['pattern']}()';
  }
  final ind = '${o['indicator']}';
  final args = <String>[
    if (!['atr', 'highest', 'lowest', 'adx', 'stoch_k', 'stoch_d'].contains(ind)) 'close',
    '${o['period']}',
  ];
  if (ind.startsWith('macd')) args.addAll(['${o['period2']}', '${o['period3']}']);
  if (ind.startsWith('bb_')) args.add('${o['mult']}');
  return '$ind(${args.join(', ')})';
}

String? _ruleText(Object? rs) {
  if (rs is! Map) return null;
  final groups = (rs['groups'] as List? ?? const []).whereType<Map<String, dynamic>>().toList();
  if (groups.isEmpty) return null;
  String cond(Map<String, dynamic> c) {
    final l = _opText((c['left'] as Map).cast<String, dynamic>());
    if ((c['left'] as Map)['kind'] == 'candle') return l;
    final r = _opText((c['right'] as Map).cast<String, dynamic>());
    final op = '${c['op']}';
    final e = op.startsWith('crosses') ? '$op($l, $r)' : '$l ${const {'gt': '>', 'lt': '<', 'gte': '>=', 'lte': '<='}[op] ?? op} $r';
    return c['timeframe'] != null && c['timeframe'] != 'same' ? 'htf("${c['timeframe']}", $e)' : e;
  }

  final parts = [
    for (final g in groups) (g['conditions'] as List? ?? const []).whereType<Map<String, dynamic>>().map(cond).join(g['logic'] == 'any' ? ' or ' : ' and '),
  ];
  return parts.length == 1 ? parts.first : parts.map((p) => '($p)').join(rs['logic'] == 'any' ? ' or ' : ' and ');
}

Map<String, Object?> _validateSpec(Map<String, dynamic> spec) {
  final summary = <String, String>{
    for (final e in {'buy': 'long', 'sell': 'short', 'exit_buy': 'exitLong', 'exit_sell': 'exitShort'}.entries)
      if (_ruleText(spec[e.value]) != null) e.key: _ruleText(spec[e.value])!,
  };
  final sizing = (spec['sizing'] as Map?) ?? const {};
  final code = [
    'name("${spec['name']}")',
    'symbol("${spec['symbol']}")',
    'timeframe("${spec['timeframe']}")',
    sizing['mode'] == 'risk' ? 'risk(${sizing['riskPct']})' : 'lots(${sizing['lots']})',
    '',
    for (final e in summary.entries) '${e.key} = ${e.value}',
  ].join('\n');
  return {
    'kind': 'visual',
    'valid': summary.isNotEmpty,
    'errors': summary.isEmpty
        ? [
            {'message': 'Add at least one buy or sell rule.'},
          ]
        : <Object?>[],
    'warnings': <Object?>[],
    'spec': spec,
    'code': code,
    'source': null,
    'timeframes': [spec['timeframe']],
    'lookback': 200,
    'summary': summary,
  };
}

Map<String, Object?> _validateCode(String source, String symbol, String timeframe) {
  final summary = <String, String>{};
  for (final line in source.split('\n')) {
    final m = RegExp(r'^\s*(buy|sell|exit_buy|exit_sell)\s*=\s*(.+)$').firstMatch(line);
    if (m != null) summary[m.group(1)!] = m.group(2)!.trim();
  }
  final name = RegExp(r'name\("([^"]*)"\)').firstMatch(source)?.group(1) ?? 'Untitled strategy';
  return {
    'kind': 'code',
    'valid': summary.isNotEmpty,
    'errors': summary.isEmpty
        ? [
            {'line': 1, 'col': 1, 'message': 'No signal: assign buy or sell.'},
          ]
        : <Object?>[],
    'warnings': <Object?>[],
    'spec': {'name': name, 'symbol': symbol, 'timeframe': timeframe},
    'code': source,
    'source': source,
    'timeframes': [timeframe],
    'lookback': 200,
    'summary': summary,
  };
}

Map<String, Object?> _validate(Map<String, dynamic> body) {
  if (body['kind'] == 'code') return _validateCode('${body['source'] ?? ''}', '${body['symbol'] ?? 'EURUSD'}', '${body['timeframe'] ?? 'H1'}');
  final spec = body['spec'] is Map ? (body['spec'] as Map).cast<String, dynamic>() : _spec1();
  return _validateSpec(spec);
}

Map<String, Object?> _aiReply(Map<String, dynamic> body) {
  final target = '${body['target'] ?? 'visual'}';
  final symbol = '${body['symbol'] ?? 'EURUSD'}';
  final tf = '${body['timeframe'] ?? 'H1'}';
  final result = target == 'code'
      ? _validateCode(
          'name("RSI rebound $symbol")\nsymbol("$symbol")\ntimeframe("$tf")\nlots(0.1)\nstop_loss(atr=1.5, period=14)\ntake_profit(rr=2)\n\nbuy = crosses_above(rsi(close, 14), 30) and close > sma(close, 200)\nsell = crosses_below(rsi(close, 14), 70) and close < sma(close, 200)\n',
          symbol,
          tf,
        )
      : _validateSpec({
          ..._spec1(),
          'name': 'RSI rebound $symbol',
          'symbol': symbol,
          'timeframe': tf,
          'long': _rs([
            {'left': _op('indicator', ind: 'rsi', p: 14), 'op': 'crosses_above', 'right': _op('value', value: 30), 'timeframe': 'same'},
            {'left': _op('price'), 'op': 'gt', 'right': _op('indicator', ind: 'sma', p: 200), 'timeframe': 'same'},
          ]),
          'short': _rs([
            {'left': _op('indicator', ind: 'rsi', p: 14), 'op': 'crosses_below', 'right': _op('value', value: 70), 'timeframe': 'same'},
          ]),
        });
  return {
    'configured': true,
    'model': 'claude-sonnet',
    'target': target,
    'status': 'ok',
    'questions': <Object?>[],
    'assumptions': ['Stop loss 1.5 × ATR(14) and a 2R target, since none was given.', 'One position at a time.'],
    'result': result,
  };
}

/* ------------------------------------------------------------------ deployments */

/// Status changes of this session (pause / resume / stop / kill, the kill switch).
final Map<int, String> _depStatus = {};
String? _killedAt;

List<Map<String, Object?>> _deployments() => [
  for (final d in _deploymentsBase())
    _depStatus.containsKey(d['id'])
        ? {
            ...d,
            'status': _depStatus[d['id']],
            if (_depStatus[d['id']] == 'stopped' || _depStatus[d['id']] == 'killed') 'stoppedAt': d['stoppedAt'] ?? _ago(Duration.zero),
          }
        : d,
];

/// POST deployments/{id}/{action}.
(int, Object) _depAction(int id, String action, Map<String, dynamic> body) {
  final d = _deployments().where((x) => x['id'] == id).firstOrNull;
  if (d == null) {
    return (
      404,
      {
        'error': {'code': 'not_found', 'message': 'Not found.'},
      },
    );
  }
  final live = d['status'] == 'running' || d['status'] == 'paused';
  final open = (d['openPositions'] as num?)?.toInt() ?? 0;
  switch (action) {
    case 'pause' when d['status'] == 'running':
      _depStatus[id] = 'paused';
    case 'resume' when d['status'] == 'paused':
      if (_killedAt != null) {
        return (
          409,
          {
            'error': {'code': 'killed', 'message': 'The kill switch is on.'},
          },
        );
      }
      _depStatus[id] = 'running';
    case 'stop' when live:
      _depStatus[id] = 'stopped';
    case 'kill' when live:
      _depStatus[id] = 'killed';
      return (200, {'ok': true, 'closed': body['closePositions'] == true ? open : 0, 'failed': 0});
    case 'close-positions':
      return (200, {'ok': true, 'closed': open, 'failed': 0});
    default:
      return (
        409,
        {
          'error': {'code': 'conflict', 'message': 'The deployment is ${d['status']}.'},
        },
      );
  }
  return (200, {'ok': true});
}

/// POST controls/kill.
Map<String, Object?> _kill(Map<String, dynamic> body) {
  if (body['killed'] != true) {
    _killedAt = null;
    return {'stopped': 0, 'closed': 0, 'failed': 0};
  }
  var stopped = 0, closed = 0;
  for (final d in _deployments()) {
    if (d['status'] == 'running' || d['status'] == 'paused') {
      _depStatus[d['id'] as int] = 'killed';
      stopped++;
      if (body['closePositions'] == true) closed += (d['openPositions'] as num?)?.toInt() ?? 0;
    }
  }
  _killedAt = DateTime.now().toUtc().toIso8601String();
  return {'stopped': stopped, 'closed': closed, 'failed': 0};
}

List<Map<String, Object?>> _deploymentsBase() => [
  {
    'id': 501,
    'userId': 1,
    'strategyId': 1,
    'strategyName': 'EMA trend H1',
    'symbol': 'EURUSD',
    'timeframe': 'H1',
    'versionId': 13,
    'version': 3,
    'login': 80412337,
    'accountType': 'demo',
    'status': 'running',
    'risk': {'lotMultiplier': 1},
    'stats': {'trades': 18, 'wins': 10, 'realized': 326.2, 'open': 1, 'orders': 37, 'lastOrderAt': _ago(const Duration(hours: 2))},
    'subscriptionId': null,
    'openPositions': 1,
    'lastBarT': _unix(_now) - 1800,
    'lastEvalAt': _ago(const Duration(minutes: 12)),
    'error': null,
    'stopReason': null,
    'startBalance': '10000.00',
    'createdAt': _ago(const Duration(days: 14)),
    'stoppedAt': null,
  },
  {
    'id': 502,
    'userId': 1,
    'strategyId': 2,
    'strategyName': 'Gold breakout',
    'symbol': 'XAUUSD',
    'timeframe': 'M15',
    'versionId': 22,
    'version': 2,
    'login': 50021894,
    'accountType': 'live',
    'status': 'paused',
    'risk': {'lotMultiplier': 0.5, 'maxOpenPositions': 2, 'maxDailyLoss': 150},
    'stats': {'trades': 9, 'wins': 3, 'realized': -84.6, 'open': 0, 'orders': 18},
    'subscriptionId': null,
    'openPositions': 0,
    'lastBarT': _unix(_now) - 900,
    'lastEvalAt': _ago(const Duration(hours: 5)),
    'error': null,
    'stopReason': null,
    'startBalance': '4900.00',
    'createdAt': _ago(const Duration(days: 6)),
    'stoppedAt': null,
  },
  {
    'id': 488,
    'userId': 1,
    'strategyId': 1,
    'strategyName': 'EMA trend H1',
    'symbol': 'EURUSD',
    'timeframe': 'H1',
    'versionId': 11,
    'version': 1,
    'login': 80412337,
    'accountType': 'demo',
    'status': 'stopped',
    'risk': <String, Object?>{},
    'stats': {'trades': 6, 'wins': 2, 'realized': -41.3},
    'subscriptionId': null,
    'openPositions': 0,
    'lastBarT': null,
    'lastEvalAt': _ago(const Duration(days: 15)),
    'error': null,
    'stopReason': 'Stopped by you',
    'startBalance': '10000.00',
    'createdAt': _ago(const Duration(days: 20)),
    'stoppedAt': _ago(const Duration(days: 15)),
  },
];

Map<String, Object?> _deploymentDetail(int id) {
  final d = _deployments().firstWhere((x) => x['id'] == id, orElse: () => _deployments().first);
  final running = d['id'] == 501;
  var r = 0.0;
  return {
    ...d,
    'logs': [
      for (final (i, l) in [
        ('info', 'eval', 'Bar 14:00 closed · no signal'),
        ('info', 'signal', 'BUY: crosses_above(ema(close, 20), ema(close, 50)) and rsi(close, 14) < 70'),
        ('info', 'order', 'Market BUY 0.10 EURUSD filled at 1.08412 · #1000412'),
        ('info', 'manage', 'Stop moved to breakeven (+10 pts)'),
        ('warn', 'eval', 'Spread 2.4 pips above the session median'),
        ('info', 'close', 'Closed #1000398 at take profit · +42.10'),
      ].indexed)
        {'id': 900 + i, 'at': _ago(Duration(minutes: 12 + i * 47)), 'level': l.$1, 'kind': l.$2, 'message': l.$3},
    ],
    'positions': [
      if (running)
        {
          'ticket': 1000412,
          'symbol': d['symbol'],
          'side': 'buy',
          'volume': 0.1,
          'openPrice': 1.08412,
          'openedAt': _ago(const Duration(hours: 2)),
          'closedAt': null,
          'closePrice': null,
          'profit': null,
          'reason': null,
        },
      {
        'ticket': 1000398,
        'symbol': d['symbol'],
        'side': 'buy',
        'volume': 0.1,
        'openPrice': 1.08051,
        'openedAt': _ago(const Duration(days: 1, hours: 4)),
        'closedAt': _ago(const Duration(days: 1)),
        'closePrice': 1.08472,
        'profit': 42.1,
        'reason': 'tp',
      },
      {
        'ticket': 1000377,
        'symbol': d['symbol'],
        'side': 'sell',
        'volume': 0.1,
        'openPrice': 1.08933,
        'openedAt': _ago(const Duration(days: 2, hours: 6)),
        'closedAt': _ago(const Duration(days: 2)),
        'closePrice': 1.09121,
        'profit': -18.8,
        'reason': 'sl',
      },
    ],
    'daily': [
      for (var i = 13; i >= 0; i--)
        {
          'day': _now.subtract(Duration(days: i)).toIso8601String().substring(0, 10),
          'realized': r = double.parse((math.sin(i * 1.3) * 38 + 12).toStringAsFixed(2)),
          'trades': 1 + i % 3,
          'wins': i % 2,
        },
    ],
    'summary': {'buy': 'crosses_above(ema(close, 20), ema(close, 50)) and rsi(close, 14) < 70', 'sell': 'crosses_below(ema(close, 20), ema(close, 50))'},
    'spec': {'maxLots': 0.1, 'oneAtATime': true, 'maxDailyLoss': 0},
    'rulesHidden': false,
    'lastRealized': r,
  };
}

/* ------------------------------------------------------------------ backtests */

/// Backtests started in this session (finished at once: the sample has no queue): id -> strategy id.
final Map<int, int> _newRuns = {};

/// POST backtests.
(int, Object) _runBacktest(Map<String, dynamic> body) {
  final sid = body['strategyId'] is num ? (body['strategyId'] as num).toInt() : 0;
  final s = _strategies().where((x) => x['id'] == sid).firstOrNull;
  if (s == null) {
    return (
      404,
      {
        'error': {'code': 'not_found', 'message': 'Strategy not found.'},
      },
    );
  }
  if (s['valid'] != true) {
    return (
      422,
      {
        'error': {'code': 'validation', 'message': 'Fix the strategy before you backtest it.'},
      },
    );
  }
  final id = 72 + _newRuns.length;
  _newRuns[id] = sid;
  return (200, {'id': id});
}

List<Map<String, Object?>> _backtests() {
  final from = _unix(_now.subtract(const Duration(days: 365)));
  final to = _unix(_now);
  Map<String, Object?> row(
    int id,
    int strategyId,
    String name,
    String symbol,
    String tf,
    int version,
    String status,
    double progress,
    Map<String, Object?>? summary, {
    String? error,
  }) => {
    'id': id,
    'versionId': strategyId * 10 + version,
    'params': {'from': from, 'to': to, 'initialBalance': 10000, 'symbol': symbol, 'timeframe': tf, 'group': 'standard'},
    'status': status,
    'progress': progress,
    'summary': summary,
    'error': error,
    'createdAt': _ago(Duration(hours: id)),
    'finishedAt': status == 'done' ? _ago(Duration(hours: id - 1)) : null,
    'strategyId': strategyId,
    'strategyName': name,
    'version': version,
  };
  final runs = [
    for (final e in _newRuns.entries.toList().reversed)
      if (_strategies().where((x) => x['id'] == e.value).firstOrNull case final st?)
        row(e.key, e.value, '${st['name']}', '${st['symbol']}', '${st['timeframe']}', (st['version'] as num?)?.toInt() ?? 1, 'done', 1, {
          'netProfit': 1284.5,
          'returnPct': 12.85,
          'trades': 64,
          'winRate': 46.9,
          'profitFactor': 1.42,
          'maxDrawdownPct': 6.1,
          'sharpe': 1.18,
          'symbol': st['symbol'],
          'timeframe': st['timeframe'],
          'firstBar': from,
          'lastBar': to,
        }),
  ];
  return [
    ...runs,
    row(71, 1, 'EMA trend H1', 'EURUSD', 'H1', 3, 'done', 1, {
      'netProfit': 1284.5,
      'returnPct': 12.85,
      'trades': 64,
      'winRate': 46.9,
      'profitFactor': 1.42,
      'maxDrawdownPct': 6.1,
      'sharpe': 1.18,
      'symbol': 'EURUSD',
      'timeframe': 'H1',
      'firstBar': from,
      'lastBar': to,
    }),
    row(70, 2, 'Gold breakout', 'XAUUSD', 'M15', 2, 'running', 0.62, null),
    row(66, 2, 'Gold breakout', 'XAUUSD', 'M15', 1, 'done', 1, {
      'netProfit': -214.2,
      'returnPct': -2.14,
      'trades': 128,
      'winRate': 38.3,
      'profitFactor': 0.92,
      'maxDrawdownPct': 9.4,
      'sharpe': -0.21,
      'symbol': 'XAUUSD',
      'timeframe': 'M15',
      'firstBar': from,
      'lastBar': to,
    }),
    row(61, 3, 'RSI pullback', 'GBPUSD', 'M15', 1, 'failed', 0.1, null, error: 'No M1 history before 2024-01-02 for GBPUSD.'),
  ];
}

Map<String, Object?> _backtestDetail(int id) {
  final rows = _backtests();
  final row = rows.firstWhere((b) => b['id'] == id, orElse: () => rows.first);
  if (row['status'] != 'done') return {...row, 'stage': row['status'] == 'running' ? 'Simulating orders & fills…' : null, 'cpuMs': null, 'report': null};
  final params = row['params']! as Map<String, Object?>;
  final from = params['from']! as int, to = params['to']! as int;
  final up = id == 71 || _newRuns.containsKey(id);
  const n = 180;
  final equity = <Map<String, Object?>>[];
  var peak = 10000.0;
  for (var i = 0; i <= n; i++) {
    final v = 10000 + (up ? 1284.5 : -214.2) * i / n + math.sin(i / 7) * 160 + math.sin(i / 2.3) * 55;
    peak = math.max(peak, v);
    equity.add({'t': from + (to - from) * i ~/ n, 'balance': v, 'equity': v, 'dd': -((peak - v) / peak * 100)});
  }
  final trades = [
    for (var i = 1; i <= 40; i++)
      {
        'id': i,
        'side': i % 3 == 0 ? 'sell' : 'buy',
        'volume': 0.1,
        'openTime': from + i * 760000,
        'openPrice': 1.081 + i * 0.0004,
        'closeTime': from + i * 760000 + 36000,
        'closePrice': 1.0815 + i * 0.0004,
        'sl': null,
        'tp': null,
        'profit': ((math.sin(i * 1.7) * 60) + (up ? 18 : -4)),
        'commission': -0.7,
        'swap': -0.12,
        'net': double.parse(((math.sin(i * 1.7) * 60) + (up ? 18 : -4) - 0.82).toStringAsFixed(2)),
        'reason': i % 4 == 0 ? 'sl' : (i % 4 == 1 ? 'tp' : 'signal'),
        'bars': 6 + i % 9,
        'mae': -12.4,
        'mfe': 33.1,
      },
  ];
  final m = row['summary']! as Map<String, Object?>;
  return {
    ...row,
    'stage': null,
    'cpuMs': 3420,
    'report': {
      'metrics': {
        'initialBalance': 10000,
        'finalBalance': 10000 + (m['netProfit']! as num),
        'netProfit': m['netProfit'],
        'returnPct': m['returnPct'],
        'cagrPct': m['returnPct'],
        'grossProfit': 4120.6,
        'grossLoss': -2836.1,
        'profitFactor': m['profitFactor'],
        'trades': m['trades'],
        'wins': ((m['trades']! as num) * (m['winRate']! as num) / 100).round(),
        'losses': (m['trades']! as num) - ((m['trades']! as num) * (m['winRate']! as num) / 100).round(),
        'winRate': m['winRate'],
        'longTrades': 38,
        'longWinRate': 50.0,
        'shortTrades': 26,
        'shortWinRate': 42.3,
        'avgWin': 137.4,
        'avgLoss': -84.1,
        'largestWin': 412.0,
        'largestLoss': -198.6,
        'expectancy': (m['netProfit']! as num) / (m['trades']! as num),
        'payoffRatio': 1.63,
        'maxConsecutiveWins': 5,
        'maxConsecutiveLosses': 6,
        'maxDrawdown': 642.3,
        'maxDrawdownPct': m['maxDrawdownPct'],
        'recoveryFactor': 2.0,
        'sharpe': m['sharpe'],
        'sortino': 1.71,
        'avgBarsHeld': 11.4,
        'exposurePct': 23.8,
        'totalCommission': -44.8,
        'totalSwap': -7.7,
        'spreadCost': -96.0,
        'barsTested': 6210,
      },
      'equity': equity,
      'monthly': [
        {
          'year': _now.year - 1,
          'months': [null, null, null, null, null, null, null, null, null, 1.2, -0.8, 2.4],
          'total': 2.8,
        },
        {
          'year': _now.year,
          'months': [0.6, 1.9, -1.4, 3.1, 0.2, -2.2, 1.7, 2.6, 0.9, null, null, null],
          'total': up ? 7.4 : -1.1,
        },
      ],
      'trades': trades,
      'tradesTruncated': false,
      'signals': {'buy': 41, 'sell': 29, 'exitBuy': 12, 'exitSell': 7},
      'skipped': [
        {'reason': 'one_at_a_time', 'count': 6},
      ],
      'model': 'M1 OHLC ticks',
      'intrabarM1Bars': 525600,
      'coverage': {
        'requested': {'from': from, 'to': to},
        'segments': [
          {'tf': params['timeframe'], 'source': 'history', 'from': from, 'to': to},
        ],
        'm1From': from,
        'm1Bars': 371520,
        'costs': {
          'group': 'Standard',
          'spread': 0.00012,
          'spreadPoints': 12,
          'spreadSource': 'median',
          'commissionPerLot': 7,
          'swaps': true,
          'quoteToUsd': 1,
          'usdBase': false,
        },
      },
      'notes': up ? <String>[] : ['Fewer than 30 trades in the last 3 months: results may not be representative.'],
      'firstBar': from,
      'lastBar': to,
    },
  };
}

/* ------------------------------------------------------------------ marketplace */

List<Map<String, Object?>> _listings() {
  List<double> curve(double end, int seed) => [for (var i = 0; i < 30; i++) end * i / 29 + math.sin((i + seed) / 3) * end.abs() * 0.12];
  Map<String, Object?> l(
    int id,
    String title,
    String author,
    String symbol,
    String tf,
    num price,
    double ret,
    double win,
    int trades,
    double dd,
    double rating,
    int ratings,
    int subs, {
    bool house = false,
    bool clone = false,
  }) => {
    'id': id,
    'title': title,
    'description':
        'Trend-following on $symbol $tf: enters on a fast/slow EMA cross confirmed by the H4 trend, ATR stops, 2R targets. One position at a time, no trading around rollover.',
    'author': author,
    'authorUserId': 100 + id,
    'symbol': symbol,
    'timeframe': tf,
    'priceMonthly': price,
    'currency': 'USDT',
    'allowClone': clone,
    'status': 'approved',
    'moderationNote': null,
    'rating': rating,
    'ratings': ratings,
    'subscribers': subs,
    'track': {
      'returnPct': ret,
      'winRate': win,
      'trades': trades,
      'maxDrawdownPct': dd,
      'days': 64.5,
      'accountType': house ? 'live' : 'demo',
      'curve': curve(ret, id),
    },
    'createdAt': _ago(Duration(days: 30 + id)),
    'house': house,
  };
  return [
    l(1, 'EURUSD trend rider', 'Kalks', 'EURUSD', 'H1', 0, 9.84, 51.2, 86, 4.3, 4.6, 23, 214, house: true),
    l(2, 'EMA trend H1', 'Amir M.', 'EURUSD', 'H1', 0, 6.12, 46.9, 64, 6.1, 4.2, 11, 58, clone: true),
    l(3, 'London breakout · gold', 'Ravi K.', 'XAUUSD', 'M15', 19, 14.36, 41.8, 152, 8.7, 4.8, 37, 312),
    l(4, 'Bitcoin swing', 'Sara L.', 'BTCUSD', 'H4', 29, -3.42, 37.5, 24, 12.9, 3.4, 5, 19),
  ];
}

Map<String, Object?> _listingDetail(int id) {
  final l = _listings().firstWhere((x) => x['id'] == id, orElse: () => _listings().first);
  final track = Map<String, Object?>.from(l['track']! as Map);
  final ret = track['returnPct']! as double;
  return {
    ...l,
    'track': {
      ...track,
      'curve': [
        for (var i = 0; i < 30; i++)
          {
            'day': _now.subtract(Duration(days: 29 - i)).toIso8601String().substring(0, 10),
            'realized': 12.0,
            'equity': 10000 + ret * 100 * i / 29 + math.sin(i / 3) * 80,
          },
      ],
      'netProfit': ret * 100,
      'since': _ago(const Duration(days: 64)),
      'deploymentStatus': 'running',
    },
    'risk': {
      'sizing': {'mode': 'lots', 'lots': 0.1, 'riskPct': 1},
      'sl': {'mode': 'atr', 'value': 2},
      'tp': {'mode': 'rr', 'value': 2},
    },
    'summary': l['allowClone'] == true
        ? {'buy': 'crosses_above(ema(close, 20), ema(close, 50))', 'sell': 'crosses_below(ema(close, 20), ema(close, 50))'}
        : null,
    'kind': 'visual',
    'reviews': [
      {
        'id': 1,
        'user': 'Nadia R.',
        'rating': 5,
        'comment': 'Clean entries, the drawdown stayed small on my demo.',
        'createdAt': _ago(const Duration(days: 6)),
        'mine': false,
      },
      {'id': 2, 'user': 'Chen W.', 'rating': 4, 'comment': '', 'createdAt': _ago(const Duration(days: 19)), 'mine': false},
    ],
    'subscription': id == 3
        ? {
            'id': 41,
            'mode': 'copy',
            'status': 'active',
            'login': 80412337,
            'deploymentId': 503,
            'clonedStrategyId': null,
            'periodEnd': _now.add(const Duration(days: 21)).toIso8601String(),
            'autoRenew': true,
          }
        : null,
    'isAuthor': id == 2,
    'platformCutPct': 20,
    'backtest': l['house'] == true
        ? {
            'kind': 'backtest',
            'label': 'Backtest on 2 years of EURUSD H1 history',
            'summary': {
              'returnPct': 18.4,
              'trades': 212,
              'winRate': 48.1,
              'maxDrawdownPct': 7.2,
              'profitFactor': 1.37,
              'firstBar': _unix(_now) - 730 * 86400,
              'lastBar': _unix(_now),
            },
            'curve': [
              for (var i = 0; i < 40; i++) {'t': _unix(_now) - (40 - i) * 18 * 86400, 'equity': 10000 + 1840 * i / 39 + math.sin(i / 4) * 140},
            ],
            'notes': null,
          }
        : null,
  };
}
