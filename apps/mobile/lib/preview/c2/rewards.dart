// Sample answers for the rewards screens (previews and widget tests only; shapes of the real API: services/growth via
// apps/crm/app/api/growth, typed in apps/crm/components/growth/api.ts). Return null for paths this module doesn't own.
//   GET  growth/rewards · points · redemptions · vouchers · cashback · promotions · contests · contests/{id} · banners
//   POST growth/redeem · cashback/{id}/enrol · bonuses/{id}/claim · promo · contests/{id}/join · banners/{id}/events
// `growth/rewards` is also the dashboard's points card: it keeps points.balance, pointValue and tier.name.

String _iso(Duration d) => DateTime.now().add(d).toUtc().toIso8601String();
String _day(int daysAgo) {
  final d = DateTime.now().subtract(Duration(days: daysAgo));
  return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

Map<String, dynamic> _err(String code, String message) => {
  'error': {'code': code, 'message': message},
};

/* ------------------------------------------------------------------ loyalty */

const _tiers = [
  {'key': 'bronze', 'name': 'Bronze', 'rank': 1, 'minPoints': 0, 'multiplier': 1, 'perks': <String>[]},
  {
    'key': 'silver',
    'name': 'Silver',
    'rank': 2,
    'minPoints': 5000,
    'multiplier': 1.25,
    'perks': ['Priority support'],
  },
  {
    'key': 'gold',
    'name': 'Gold',
    'rank': 3,
    'minPoints': 15000,
    'multiplier': 1.5,
    'perks': ['Priority support', 'Monthly market outlook', '10% off prop challenges'],
  },
  {
    'key': 'platinum',
    'name': 'Platinum',
    'rank': 4,
    'minPoints': 40000,
    'multiplier': 1.75,
    'perks': ['Dedicated manager', 'Free VPS', '20% off prop challenges'],
  },
  {
    'key': 'diamond',
    'name': 'Diamond',
    'rank': 5,
    'minPoints': 100000,
    'multiplier': 2,
    'perks': ['Dedicated manager', 'Free VPS', 'Event invitations'],
  },
];

const _catalogue = [
  {
    'id': 1,
    'name': r'$25 cashback',
    'description': 'Straight to your Kalks Wallet.',
    'kind': 'cashback',
    'costPoints': 2500,
    'value': 25,
    'minTier': null,
    'stock': null,
    'active': true,
    'params': <String, dynamic>{},
  },
  {
    'id': 2,
    'name': r'$50 trading bonus',
    'description': '',
    'kind': 'bonus_credit',
    'costPoints': 4000,
    'value': 50,
    'minTier': null,
    'stock': null,
    'active': true,
    'params': <String, dynamic>{},
  },
  {
    'id': 3,
    'name': '20% off a prop challenge',
    'description': 'A voucher for your next funded challenge.',
    'kind': 'fee_discount',
    'costPoints': 3000,
    'value': 20,
    'minTier': 'gold',
    'stock': null,
    'active': true,
    'params': {'appliesTo': 'prop'},
  },
  {
    'id': 4,
    'name': r'$100 cashback',
    'description': 'Straight to your Kalks Wallet.',
    'kind': 'cashback',
    'costPoints': 9500,
    'value': 100,
    'minTier': null,
    'stock': 40,
    'active': true,
    'params': <String, dynamic>{},
  },
  {
    'id': 5,
    'name': '50% off commission',
    'description': 'One month of half-price commission.',
    'kind': 'fee_discount',
    'costPoints': 12000,
    'value': 50,
    'minTier': 'platinum',
    'stock': null,
    'active': true,
    'params': {'appliesTo': 'commission'},
  },
  {
    'id': 6,
    'name': r'$250 trading bonus',
    'description': '',
    'kind': 'bonus_credit',
    'costPoints': 20000,
    'value': 250,
    'minTier': null,
    'stock': null,
    'active': true,
    'params': <String, dynamic>{},
  },
];

final List<Map<String, dynamic>> _pointsTx = [
  for (final (i, (kind, points, desc, login, ago)) in [
    ('earn', 312, 'EURUSD · 1.20 lots closed', 10042817, 2),
    ('earn', 186, 'XAUUSD · 0.62 lots closed', 10042817, 5),
    ('redeem', -2500, r'Redeemed $25 cashback', null, 26),
    ('earn', 540, 'US500 · 3.60 lots closed', 10042817, 30),
    ('bonus', 250, 'Referral bonus · Rohan K.', null, 50),
    ('promo', 500, 'Promo code AUTUMN500', null, 75),
    ('earn', 1210, 'GBPUSD · 8.06 lots closed', 10051123, 100),
    ('expire', -120, 'Points expired', null, 200),
    ('earn', 420, 'BTCUSD · 0.35 lots closed', 10042817, 260),
    ('adjust', 100, 'Goodwill adjustment', null, 300),
    ('earn', 96, 'USDJPY · 0.64 lots closed', 10042817, 340),
    ('earn', 260, 'NAS100 · 1.73 lots closed', 10042817, 400),
  ].indexed)
    {
      'id': 5000 - i,
      'kind': kind,
      'points': points,
      'description': desc,
      'login': login,
      'dealId': login == null ? null : 880000 + i,
      'createdAt': _iso(Duration(hours: -ago)),
    },
];

Map<String, dynamic> _rewards() => {
  'points': {
    'balance': 18420,
    'lifetime': 26100,
    'earnedThisMonth': 2140,
    'lotsThisMonth': 21.4,
    'earned12m': 26100,
    'expiringSoon': {'points': 640, 'at': _iso(const Duration(days: 23))},
  },
  'tier': {
    'key': 'gold',
    'name': 'Gold',
    'rank': 3,
    'multiplier': 1.5,
    'minPoints': 15000,
    'perks': ['Priority support', 'Monthly market outlook', '10% off prop challenges'],
  },
  'nextTier': {'key': 'platinum', 'name': 'Platinum', 'minPoints': 40000, 'pointsToGo': 13900},
  'tiers': _tiers,
  'rules': [
    {'id': 1, 'name': '', 'assetClass': 'forex', 'symbols': <String>[], 'accountGroups': <String>[], 'accountType': 'live', 'pointsPerLot': 10},
    {'id': 2, 'name': '', 'assetClass': 'metals', 'symbols': <String>[], 'accountGroups': <String>[], 'accountType': 'live', 'pointsPerLot': 12},
    {'id': 3, 'name': '', 'assetClass': 'indices', 'symbols': <String>[], 'accountGroups': <String>[], 'accountType': 'live', 'pointsPerLot': 6},
    {'id': 4, 'name': '', 'assetClass': 'crypto', 'symbols': <String>[], 'accountGroups': <String>[], 'accountType': 'live', 'pointsPerLot': 8},
    {
      'id': 5,
      'name': 'Majors bonus',
      'assetClass': null,
      'symbols': ['EURUSD', 'GBPUSD', 'USDJPY'],
      'accountGroups': <String>[],
      'accountType': 'live',
      'pointsPerLot': 15,
    },
    {'id': 6, 'name': '', 'assetClass': 'energy', 'symbols': <String>[], 'accountGroups': <String>[], 'accountType': 'any', 'pointsPerLot': 5},
  ],
  'pointValue': 0.01,
  'minHoldSeconds': 120,
  'pointsExpiryMonths': 12,
  'catalogue': _catalogue,
  'recent': _pointsTx.take(5).toList(),
  'series': [
    for (var i = 29; i >= 0; i--) {'day': _day(i), 'points': i % 4 == 3 ? 0 : 40 + (i * 37) % 160},
  ],
};

Map<String, dynamic> _points(String? kind) {
  final items = _pointsTx.where((x) => kind == null || kind.isEmpty || x['kind'] == kind).toList();
  return {'items': items, 'page': 1, 'limit': 100, 'total': items.length};
}

final List<Map<String, dynamic>> _redemptions = [
  {
    'id': 71,
    'itemId': 1,
    'itemName': r'$25 cashback',
    'kind': 'cashback',
    'points': 2500,
    'value': 25,
    'status': 'completed',
    'login': null,
    'voucherCode': null,
    'grantId': null,
    'error': null,
    'createdAt': _iso(const Duration(days: -1, hours: -2)),
    'completedAt': _iso(const Duration(days: -1, hours: -2)),
  },
  {
    'id': 64,
    'itemId': 3,
    'itemName': '20% off a prop challenge',
    'kind': 'fee_discount',
    'points': 3000,
    'value': 20,
    'status': 'completed',
    'login': null,
    'voucherCode': 'KLX-PROP-7Q4M',
    'grantId': null,
    'error': null,
    'createdAt': _iso(const Duration(days: -18)),
    'completedAt': _iso(const Duration(days: -18)),
  },
  {
    'id': 52,
    'itemId': 2,
    'itemName': r'$50 trading bonus',
    'kind': 'bonus_credit',
    'points': 4000,
    'value': 50,
    'status': 'completed',
    'login': 10042817,
    'voucherCode': null,
    'grantId': 908,
    'error': null,
    'createdAt': _iso(const Duration(days: -41)),
    'completedAt': _iso(const Duration(days: -41)),
  },
];

final List<Map<String, dynamic>> _vouchers = [
  {
    'id': 31,
    'code': 'KLX-PROP-7Q4M',
    'kind': 'fee_discount',
    'pct': 20,
    'appliesTo': 'prop',
    'status': 'active',
    'expiresAt': _iso(const Duration(days: 42)),
    'usedAt': null,
    'source': 'redemption',
  },
  {
    'id': 24,
    'code': 'KLX-FEES-2B9T',
    'kind': 'fee_discount',
    'pct': 10,
    'appliesTo': 'any',
    'status': 'used',
    'expiresAt': _iso(const Duration(days: -10)),
    'usedAt': _iso(const Duration(days: -25)),
    'source': 'promo',
  },
];

(int, Object) _redeem(Map<String, dynamic> body) {
  final id = body['itemId'];
  final item = _catalogue.where((c) => c['id'] == id).firstOrNull;
  if (item == null) return (404, _err('not_found', 'Reward not found.'));
  final cost = item['costPoints']! as int;
  if (cost > 18420) return (409, _err('insufficient_points', "You don't have enough points for this reward."));
  final voucher = item['kind'] == 'fee_discount';
  return (
    200,
    {
      'redemption': {
        'id': 90,
        'itemId': id,
        'itemName': item['name'],
        'kind': item['kind'],
        'points': cost,
        'value': item['value'],
        'status': item['kind'] == 'bonus_credit' ? 'pending' : 'completed',
        'login': body['login'],
        'voucherCode': voucher ? 'KLX-NEW-5R8D' : null,
        'grantId': null,
        'error': null,
        'createdAt': _iso(Duration.zero),
        'completedAt': voucher ? _iso(Duration.zero) : null,
      },
      'balance': 18420 - cost,
    },
  );
}

/* ------------------------------------------------------------------ cashback */

Map<String, dynamic> _cashback() {
  final base = _cashbackBase();
  return {
    ...base,
    'programmes': [
      for (final p in (base['programmes'] as List).cast<Map<String, dynamic>>()) {...p, if (_enrolled.contains('${p['id']}')) 'enrolled': true},
    ],
  };
}

Map<String, dynamic> _cashbackBase() {
  const symbols = ['EURUSD', 'XAUUSD', 'GBPUSD', 'US500', 'USDJPY', 'BTCUSD', 'NAS100'];
  final accruals = [
    for (var i = 0; i < 14; i++)
      {
        'id': 7000 - i,
        'programmeId': i % 3 == 2 ? 2 : 1,
        'programme': i % 3 == 2 ? 'Gold & metals boost' : 'Everyday cashback',
        'dealId': 881200 - i * 7,
        'login': i % 4 == 3 ? 10051123 : 10042817,
        'symbol': symbols[i % symbols.length],
        'lots': ((i * 37) % 180 + 20) / 100,
        'amount': (((i * 37) % 180 + 20) / 100) * (i % 3 == 2 ? 4 : 2.5),
        'status': i < 5 ? 'accrued' : 'paid',
        'createdAt': _iso(Duration(hours: -(i * 19 + 3))),
      },
  ];
  return {
    'programmes': [
      {
        'id': 1,
        'name': 'Everyday cashback',
        'description': 'Paid on every closed live trade, no sign-up needed.',
        'assetClasses': ['forex', 'indices'],
        'symbols': <String>[],
        'accountGroups': <String>[],
        'usdPerLot': 2.5,
        'maxPerMonth': null,
        'optIn': false,
        'enrolled': false,
        'startsAt': _iso(const Duration(days: -200)),
        'endsAt': null,
        'lotsMonth': 38.6,
        'earnedMonth': 96.5,
      },
      {
        'id': 2,
        'name': 'Gold & metals boost',
        'description': 'Extra cashback on metals this quarter.',
        'assetClasses': ['metals'],
        'symbols': <String>[],
        'accountGroups': <String>[],
        'usdPerLot': 4,
        'maxPerMonth': 250,
        'optIn': true,
        'enrolled': true,
        'startsAt': _iso(const Duration(days: -30)),
        'endsAt': _iso(const Duration(days: 60)),
        'lotsMonth': 14.6,
        'earnedMonth': 58.4,
      },
      {
        'id': 3,
        'name': 'Crypto weekend',
        'description': 'Weekend crypto trades earn cashback after you opt in.',
        'assetClasses': ['crypto'],
        'symbols': <String>[],
        'accountGroups': ['pro'],
        'usdPerLot': 3,
        'maxPerMonth': 150,
        'optIn': true,
        'enrolled': false,
        'startsAt': _iso(const Duration(days: -5)),
        'endsAt': _iso(const Duration(days: 25)),
        'lotsMonth': 0,
        'earnedMonth': 0,
      },
    ],
    'totals': {'accrued': 38.2, 'paid': 1124.6, 'month': 154.9, 'lifetime': 1162.8},
    'accruals': accruals,
    'payouts': [
      {'id': 41, 'amount': 186.42, 'status': 'paid', 'createdAt': _iso(const Duration(days: -7)), 'paidAt': _iso(const Duration(days: -7))},
      {'id': 38, 'amount': 212.1, 'status': 'paid', 'createdAt': _iso(const Duration(days: -37)), 'paidAt': _iso(const Duration(days: -37))},
      {'id': 35, 'amount': 164.8, 'status': 'paid', 'createdAt': _iso(const Duration(days: -68)), 'paidAt': _iso(const Duration(days: -68))},
    ],
    'series': [
      for (var i = 29; i >= 0; i--) {'day': _day(i), 'amount': i % 6 == 5 ? 0 : ((i * 53) % 90) / 10 + 1.2},
    ],
  };
}

/* ------------------------------------------------------------------ promotions */

Map<String, dynamic> _promotions() {
  final base = _promotionsBase();
  return {
    ...base,
    'campaigns': [
      for (final c in (base['campaigns'] as List).cast<Map<String, dynamic>>()) {...c, if (_claimed.contains('${c['id']}')) 'claimed': true},
    ],
  };
}

Map<String, dynamic> _promotionsBase() => {
  'campaigns': [
    {
      'id': 11,
      'name': 'Welcome deposit bonus',
      'description': 'Get 50% on your next deposit, released as you trade.',
      'terms': 'One bonus per client. The bonus counts toward equity and margin.\nUnreleased bonus is removed on withdrawal.',
      'kind': 'deposit',
      'pct': 50,
      'cap': 500,
      'fixedAmount': 0,
      'minDeposit': 100,
      'releasePerLot': 5,
      'expiryDays': 60,
      'forfeitOnWithdrawal': true,
      'claimWindowDays': 14,
      'startsAt': _iso(const Duration(days: -20)),
      'endsAt': _iso(const Duration(days: 40)),
      'eligible': true,
      'reason': null,
      'claimed': false,
    },
    {
      'id': 12,
      'name': r'$30 trading credit',
      'description': 'A no-deposit bonus to try a new instrument.',
      'terms': '',
      'kind': 'fixed',
      'pct': 0,
      'cap': 0,
      'fixedAmount': 30,
      'minDeposit': 0,
      'releasePerLot': 3,
      'expiryDays': 30,
      'forfeitOnWithdrawal': false,
      'claimWindowDays': 0,
      'startsAt': _iso(const Duration(days: -3)),
      'endsAt': null,
      'eligible': true,
      'reason': null,
      'claimed': false,
    },
    {
      'id': 9,
      'name': 'Autumn reload 25%',
      'description': '',
      'terms': '',
      'kind': 'deposit',
      'pct': 25,
      'cap': 1000,
      'fixedAmount': 0,
      'minDeposit': 250,
      'releasePerLot': 4,
      'expiryDays': 45,
      'forfeitOnWithdrawal': true,
      'claimWindowDays': 7,
      'startsAt': _iso(const Duration(days: -30)),
      'endsAt': _iso(const Duration(days: 10)),
      'eligible': false,
      'reason': 'Only for clients who joined before September.',
      'claimed': false,
    },
  ],
  'grants': [
    {
      'id': 908,
      'campaignId': 7,
      'campaign': 'Summer deposit bonus',
      'status': 'active',
      'source': 'claim',
      'login': 10042817,
      'depositAmount': 600,
      'amount': 300,
      'released': 115,
      'remaining': 185,
      'lotsTraded': 23,
      'lotsRequired': 60,
      'releasePerLot': 5,
      'progressPct': 38.3,
      'claimedAt': _iso(const Duration(days: -41)),
      'grantedAt': _iso(const Duration(days: -40)),
      'expiresAt': _iso(const Duration(days: 19)),
      'endedAt': null,
      'endReason': null,
      'claimDeadline': null,
    },
    {
      'id': 911,
      'campaignId': 11,
      'campaign': 'Welcome deposit bonus',
      'status': 'awaiting_deposit',
      'source': 'promo',
      'login': null,
      'depositAmount': null,
      'amount': 0,
      'released': 0,
      'remaining': 0,
      'lotsTraded': 0,
      'lotsRequired': 0,
      'releasePerLot': 5,
      'progressPct': 0,
      'claimedAt': _iso(const Duration(days: -2)),
      'grantedAt': null,
      'expiresAt': null,
      'endedAt': null,
      'endReason': null,
      'claimDeadline': _iso(const Duration(days: 12)),
    },
    {
      'id': 870,
      'campaignId': 4,
      'campaign': r'$20 trading credit',
      'status': 'completed',
      'source': 'claim',
      'login': 10051123,
      'depositAmount': null,
      'amount': 20,
      'released': 20,
      'remaining': 0,
      'lotsTraded': 10,
      'lotsRequired': 10,
      'releasePerLot': 2,
      'progressPct': 100,
      'claimedAt': _iso(const Duration(days: -95)),
      'grantedAt': _iso(const Duration(days: -95)),
      'expiresAt': null,
      'endedAt': _iso(const Duration(days: -70)),
      'endReason': null,
      'claimDeadline': null,
    },
  ],
  'promoHistory': [
    {'id': 301, 'code': 'WELCOME50', 'kind': 'bonus', 'status': 'applied', 'reason': null, 'createdAt': _iso(const Duration(days: -2))},
    {'id': 288, 'code': 'AUTUMN500', 'kind': 'points', 'status': 'applied', 'reason': null, 'createdAt': _iso(const Duration(days: -3))},
    {'id': 251, 'code': 'VIP2025', 'kind': 'bonus', 'status': 'blocked', 'reason': 'This code has expired.', 'createdAt': _iso(const Duration(days: -60))},
  ],
};

(int, Object) _promo(Map<String, dynamic> body) {
  final code = '${body['code'] ?? ''}'.toUpperCase();
  if (code == 'EXPIRED' || code == 'BADCODE') return (400, _err('promo_invalid', 'This promo code is not valid or has expired.'));
  return (
    200,
    {
      'result': {'kind': 'points', 'message': '500 points were added to your balance.', 'points': 500},
    },
  );
}

(int, Object) _claim(String id, Map<String, dynamic> body) {
  if (_claimed.contains(id)) return (409, _err('already_claimed', 'You have already claimed this bonus.'));
  _claimed.add(id);
  final fixed = id == '12';
  return (
    200,
    {
      'grant': {
        'id': 920,
        'campaignId': int.tryParse(id) ?? 0,
        'campaign': fixed ? r'$30 trading credit' : 'Welcome deposit bonus',
        'status': fixed ? 'active' : 'awaiting_deposit',
        'source': 'claim',
        'login': fixed ? body['login'] : null,
        'depositAmount': null,
        'amount': fixed ? 30 : 0,
        'released': 0,
        'remaining': fixed ? 30 : 0,
        'lotsTraded': 0,
        'lotsRequired': fixed ? 10 : 0,
        'releasePerLot': fixed ? 3 : 5,
        'progressPct': 0,
        'claimedAt': _iso(Duration.zero),
        'grantedAt': fixed ? _iso(Duration.zero) : null,
        'expiresAt': fixed ? _iso(const Duration(days: 30)) : null,
        'endedAt': null,
        'endReason': null,
        'claimDeadline': fixed ? null : _iso(const Duration(days: 14)),
      },
    },
  );
}

/* ------------------------------------------------------------------ contests */

const _people = [
  ('Mei Lin', 'sg'),
  ('Omar Haddad', 'ae'),
  ('Lukas Weber', 'de'),
  ('Priya Nair', 'in'),
  ('Carlos Ruiz', 'es'),
  ('Aisha Bello', 'ng'),
  ('Tomás Silva', 'br'),
  ('Yuki Tanaka', 'jp'),
  ('Emma Laurent', 'fr'),
  ('Daniel Kim', 'kr'),
  ('Fatima Zahra', 'ma'),
  ('Noah Smith', 'gb'),
  ('Sara Rossi', 'it'),
  ('Emre Yılmaz', 'tr'),
  ('Rizky Pratama', 'id'),
  ('Nurul Aina', 'my'),
  ('Minh Tran', 'vn'),
  ('Kanya S.', 'th'),
  ('Thabo M.', 'za'),
  ('Diego López', 'mx'),
];

Map<String, dynamic> _contest(
  int id, {
  required String name,
  required String description,
  required String kind,
  required String status,
  required Duration start,
  required Duration end,
  required String scoring,
  required List<(int, int, num, String)> prizes,
  required int entrants,
  int minTrades = 0,
  int? maxEntrants,
  num? startingBalance,
  num? minEquity,
  bool kyc = false,
  String instrument = 'cfd',
  num? minPremium,
  String rules = '',
}) => {
  'id': id,
  'slug': name.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-'),
  'name': name,
  'description': description,
  'kind': kind,
  'instrument': instrument,
  'minPremium': minPremium,
  'status': status,
  'startsAt': _iso(start),
  'endsAt': _iso(end),
  'scoring': scoring,
  'minTrades': minTrades,
  'maxEntrants': maxEntrants,
  'entrants': entrants,
  'startingBalance': startingBalance,
  'demoGroup': kind == 'demo' ? 'contest-demo' : null,
  'accountGroups': <String>[],
  'kycRequired': kyc,
  'minEquity': minEquity,
  'prizes': [
    for (final (from, to, amount, payout) in prizes) {'rankFrom': from, 'rankTo': to, 'amount': amount, 'payout': payout},
  ],
  'prizePool': prizes.fold<num>(0, (s, p) => s + p.$3 * (p.$2 - p.$1 + 1)),
  'rules': rules,
  'antiCheat': {'minHoldSeconds': 60, 'maxSingleTradePct': 40, 'disqualifyOnBalanceChange': kind == 'live'},
  'updatedAt': _iso(const Duration(minutes: -1)),
};

Map<String, dynamic> _standing(
  int entry,
  int? rank,
  String name,
  String? country, {
  required double ret,
  required int trades,
  bool me = false,
  int? login,
  double? prize,
  String? prizeStatus,
  bool qualified = true,
}) => {
  'entryId': entry,
  'userId': me ? 80412 : null,
  'name': name,
  'country': country,
  'login': me ? login : null,
  'rank': rank,
  'score': ret,
  'returnPct': ret,
  'profit': ret * 100,
  'lots': trades * 0.42,
  'contracts': trades * 3,
  'trades': trades,
  'qualified': qualified,
  'status': 'active',
  'prize': prize,
  'prizeStatus': prizeStatus,
  'me': me,
  'updatedAt': _iso(const Duration(minutes: -1)),
};

Map<String, dynamic> get _goldRush => _contest(
  101,
  name: 'Autumn Gold Rush 2026',
  description: r'Four weeks. One leaderboard. $50,000 in real prizes.',
  kind: 'live',
  status: 'running',
  start: const Duration(days: -9),
  end: const Duration(days: 19, hours: 6),
  scoring: 'return_pct',
  minTrades: 5,
  minEquity: 500,
  kyc: true,
  entrants: 1284,
  prizes: [(1, 1, 10000, 'wallet'), (2, 2, 6000, 'wallet'), (3, 3, 4000, 'wallet'), (4, 10, 2000, 'wallet'), (11, 50, 400, 'wallet')],
  rules: 'Trade any CFD on the entered live account.\n- Hedged positions across accounts are reviewed.',
);

Map<String, dynamic> get _sprint => _contest(
  102,
  name: 'October Demo Sprint',
  description: 'Two weeks on a fresh demo account. No deposit needed.',
  kind: 'demo',
  status: 'running',
  start: const Duration(days: -3),
  end: const Duration(days: 11, hours: 3),
  scoring: 'profit',
  minTrades: 3,
  maxEntrants: 500,
  entrants: 342,
  startingBalance: 10000,
  prizes: [(1, 1, 500, 'wallet'), (2, 2, 300, 'wallet'), (3, 3, 200, 'wallet'), (4, 10, 50, 'wallet')],
);

Map<String, dynamic> get _optionsCup => _contest(
  103,
  name: 'FX Options Cup',
  description: 'Kalks FX Options only: the most contracts traded wins.',
  kind: 'live',
  status: 'scheduled',
  start: const Duration(days: 5, hours: 4),
  end: const Duration(days: 33),
  scoring: 'contracts',
  instrument: 'options',
  minPremium: 5,
  maxEntrants: 200,
  entrants: 57,
  prizes: [(1, 1, 3000, 'wallet'), (2, 2, 1500, 'wallet'), (3, 3, 750, 'wallet'), (4, 10, 250, 'credit')],
);

Map<String, dynamic> get _september => _contest(
  99,
  name: 'September Demo Sprint',
  description: 'Two weeks on a fresh demo account.',
  kind: 'demo',
  status: 'finalized',
  start: const Duration(days: -40),
  end: const Duration(days: -26),
  scoring: 'profit',
  minTrades: 3,
  maxEntrants: 500,
  entrants: 488,
  startingBalance: 10000,
  prizes: [(1, 1, 500, 'wallet'), (2, 2, 300, 'wallet'), (3, 3, 200, 'wallet'), (4, 10, 50, 'wallet')],
);

Map<String, dynamic> get _summer => _contest(
  95,
  name: 'Summer Live Cup',
  description: 'The summer live-account championship.',
  kind: 'live',
  status: 'paid',
  start: const Duration(days: -100),
  end: const Duration(days: -72),
  scoring: 'return_pct',
  minTrades: 5,
  entrants: 1960,
  prizes: [(1, 1, 8000, 'wallet'), (2, 2, 4000, 'wallet'), (3, 3, 2000, 'wallet'), (4, 20, 300, 'wallet')],
);

/// Contests joined in this preview session (contest id -> the new entry), so a join shows up like on the real API.
final Map<int, Map<String, dynamic>> _joined = {};

/// Cashback programmes enrolled in and bonuses claimed in this preview session (ids).
final Set<String> _enrolled = {}, _claimed = {};

/// Back to the starting sample (tests call it in setUp).
void resetPreviewRewards() {
  _joined.clear();
  _enrolled.clear();
  _claimed.clear();
}

Map<String, dynamic>? _myEntry(int id) => _joined[id] ?? _sampleEntry(id);

Map<String, dynamic>? _sampleEntry(int id) => switch (id) {
  101 => _standing(9001, 14, 'Arjun Mehta', 'in', ret: 18.42, trades: 23, me: true, login: 10042817),
  99 => _standing(8801, 3, 'Arjun Mehta', 'in', ret: 31.6, trades: 41, me: true, login: 20019920, prize: 200, prizeStatus: 'paid'),
  95 => _standing(8501, 42, 'Arjun Mehta', 'in', ret: 6.1, trades: 17, me: true, login: 10042817),
  _ => null,
};

/// A contest card: the contest with my entry, one more entrant for each contest joined here.
Map<String, dynamic> _withJoins(Map<String, dynamic> c) {
  final id = c['id'] as int;
  return {...c, 'entrants': (c['entrants'] as int) + (_joined.containsKey(id) ? 1 : 0), 'myEntry': _myEntry(id)};
}

Map<String, dynamic>? _contestById(int id) => switch (id) {
  101 => _goldRush,
  102 => _sprint,
  103 => _optionsCup,
  99 => _september,
  95 => _summer,
  _ => null,
};

Map<String, dynamic> _contests() => {
  'items': [
    for (final c in [_goldRush, _sprint, _optionsCup, _september, _summer]) _withJoins(c),
  ],
  'stats': {'entered': 6, 'prizesWon': 1350, 'prizeFinishes': 2, 'bestRank': 3, 'active': 1},
};

Map<String, dynamic> _detail(int id) {
  final c = _withJoins(_contestById(id)!)..remove('myEntry');
  final me = _myEntry(id);
  final upcoming = c['status'] == 'scheduled';
  final board = <Map<String, dynamic>>[];
  if (!upcoming) {
    for (var i = 0; i < 20; i++) {
      final rank = i + 1;
      if (me != null && me['rank'] == rank) {
        board.add(me);
        continue;
      }
      final p = _people[i % _people.length];
      final ret = 64.0 - i * 2.35 - (i * i) * 0.04;
      final prize = c['status'] == 'running'
          ? null
          : ((c['prizes'] as List)
                        .cast<Map<String, dynamic>>()
                        .where((b) => rank >= (b['rankFrom'] as num) && rank <= (b['rankTo'] as num))
                        .firstOrNull?['amount']
                    as num?)
                ?.toDouble();
      board.add(
        _standing(
          9100 + i,
          rank,
          p.$1,
          p.$2,
          ret: double.parse(ret.toStringAsFixed(2)),
          trades: 40 - i,
          prize: prize,
          prizeStatus: prize == null ? null : 'paid',
        ),
      );
    }
    // one entry under the minimum trades, unranked
    board.add(_standing(9199, null, 'Lena Fischer', 'de', ret: 12.4, trades: 2, qualified: false));
  }
  return {'contest': c, 'leaderboard': board, 'myEntry': me, 'entrants': c['entrants']};
}

(int, Object) _join(int id, Map<String, dynamic> body) {
  final c = _contestById(id);
  if (c == null) return (404, _err('not_found', 'Contest not found.'));
  if (c['instrument'] == 'options') {
    return (403, _err('options_intro_required', 'Options contests are for clients who can trade Kalks FX Options.'));
  }
  if (_myEntry(id) != null) return (409, _err('already_joined', 'You have already joined this contest.'));
  final entry = _standing(9300, null, 'Arjun Mehta', 'in', ret: 0, trades: 0, me: true, login: body['login'] as int? ?? 20031188, qualified: false);
  _joined[id] = entry;
  if (c['kind'] == 'demo') {
    return (
      200,
      {
        'entry': entry,
        'credentials': {'login': 20031188, 'password': 'Kx7!pR2m', 'investorPassword': 'Rv9#tQ4w'},
      },
    );
  }
  return (200, {'entry': entry});
}

/* ------------------------------------------------------------------ banners */

Map<String, dynamic> _banners(String? placement) => {
  'items': placement == 'rewards'
      ? [
          {
            'id': 501,
            'title': 'Double points on gold this week',
            'body': 'Every lot of XAUUSD earns 2× loyalty points until Sunday.',
            'ctaLabel': 'How you earn',
            'ctaUrl': '/rewards/loyalty',
            'imageUrl': null,
            'tone': 'gold',
            'placement': 'rewards',
            'dismissible': true,
          },
        ]
      : <Map<String, dynamic>>[],
};

/* ------------------------------------------------------------------ router */

(int, Object)? previewRewards(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  if (!path.startsWith('growth/')) return null;
  final p = path.substring('growth/'.length);
  if (method == 'GET') {
    switch (p) {
      case 'rewards':
        return (200, _rewards());
      case 'points':
        return (200, _points(query['kind']));
      case 'redemptions':
        return (200, {'items': _redemptions});
      case 'vouchers':
        return (200, {'items': _vouchers});
      case 'cashback':
        return (200, _cashback());
      case 'promotions':
        return (200, _promotions());
      case 'contests':
        return (200, _contests());
      case 'banners':
        return (200, _banners(query['placement']));
      case 'shares':
        return (200, {'items': <Object>[]});
    }
    final m = RegExp(r'^contests/(\d+)$').firstMatch(p);
    if (m != null) {
      final id = int.parse(m[1]!);
      return _contestById(id) == null ? (404, _err('not_found', 'Contest not found.')) : (200, _detail(id));
    }
    return null;
  }
  if (method != 'POST') return null;
  if (p == 'redeem') return _redeem(body);
  if (p == 'promo') return _promo(body);
  final enrol = RegExp(r'^cashback/(\w+)/enrol$').firstMatch(p);
  if (enrol != null) {
    _enrolled.add(enrol[1]!);
    return (200, {'ok': true});
  }
  final claim = RegExp(r'^bonuses/(\w+)/claim$').firstMatch(p);
  if (claim != null) return _claim(claim[1]!, body);
  final join = RegExp(r'^contests/(\d+)/join$').firstMatch(p);
  if (join != null) return _join(int.parse(join[1]!), body);
  if (RegExp(r'^banners/\w+/events$').hasMatch(p)) return (200, {'ok': true});
  return null;
}
