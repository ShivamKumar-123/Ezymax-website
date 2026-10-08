// Sample answers for the partner screens (previews and widget tests only; shapes of the real API: the web's
// components/partner/live/api.ts types, services/ib/src/api/client.rs). A Silver partner with three sub-IBs, a
// three-tier network, a year of commission, weekly payouts and a few campaign links. Writes change this in memory.
import 'dart:math' as math;

(int, Object)? previewPartner(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  if (path != 'partner' && !path.startsWith('partner/')) return null;
  final rest = path == 'partner' ? '' : path.substring('partner/'.length);
  final s = _PartnerState.instance;
  if (method == 'GET') {
    if (rest == '') return (200, s.dashboard());
    if (rest == 'programme') return (200, _programme());
    if (rest == 'campaigns') return (200, {'code': _code, 'items': s.campaigns, 'linkBase': _base});
    if (rest == 'clients') return (200, {'items': _clients, 'visibility': 'full', 'tiers': 3, 'linkBase': _base});
    final trades = RegExp(r'^clients/(\d+)/trades$').firstMatch(rest);
    if (trades != null) return (200, {'items': _trades(int.parse(trades[1]!))});
    if (rest == 'network') return (200, _network());
    if (rest == 'commissions') return (200, _commissionsPage(query));
    if (rest == 'payouts') return (200, _payouts());
  }
  if (method == 'PUT' && rest == 'settings') return s.saveSettings(body);
  if (method == 'POST' && rest == 'campaigns') return s.createCampaign(body);
  final patch = RegExp(r'^campaigns/(\d+)$').firstMatch(rest);
  if (method == 'PATCH' && patch != null) return s.patchCampaign(int.parse(patch[1]!), body);
  return (
    404,
    {
      'error': {'code': 'not_found', 'message': 'Not found.'},
    },
  );
}

const String _code = 'ARJUN24';
const String _base = 'https://app.ezymex.com';

Map<String, dynamic> _err(String code, String message, [String? field]) => {
  'error': {'code': code, 'message': message, 'field': ?field},
};

DateTime get _now => DateTime.now().toUtc();
String _iso(DateTime d) => d.toUtc().toIso8601String();
String _ago({int days = 0, int hours = 0, int minutes = 0}) => _iso(_now.subtract(Duration(days: days, hours: hours, minutes: minutes)));
DateTime _midnight(DateTime d) => DateTime.utc(d.year, d.month, d.day);
String _day(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Next Monday 00:00 UTC (the weekly batch close).
DateTime get _nextClose {
  final today = _midnight(_now);
  return today.add(Duration(days: 8 - today.weekday));
}

double _r2(double v) => double.parse(v.toStringAsFixed(2));

/* ------------------------------------------------------------------ programme */

const _groups = ['fx-major', 'fx-minor', 'metals', 'indices', 'energies', 'crypto', 'stocks'];

List<Map<String, dynamic>> _levels() {
  const table = [
    ('bronze', 'Bronze', 1, [5, 6, 8, 2, 4, 6, 1], 200, 0, 0, ['Base rate card', 'Standard materials'], 'coin'),
    ('silver', 'Silver', 2, [7, 8, 10, 3, 5, 8, 1.5], 200, 10, 200, ['+\$2/lot on majors', 'Custom landing pages'], 'crown'),
    ('gold', 'Gold', 3, [9, 10, 12, 4, 6, 10, 2], 300, 50, 1000, ['+\$2/lot on all groups', 'CPA \$300', 'Dedicated partner manager'], '1st_place_medal'),
    ('platinum', 'Platinum', 4, [11, 12, 13.5, 5, 7, 12, 2.5], 300, 150, 3000, ['Priority payouts', 'Co-branded campaigns'], 'trophy'),
    ('diamond', 'Diamond', 5, [13, 14, 15, 6, 8, 14, 3], 300, 400, 8000, ['Top rate card', 'Quarterly review'], 'gem_stone'),
  ];
  return [
    for (final (key, name, rank, rates, cpa, clients, lots, perks, icon) in table)
      {
        'key': key,
        'name': name,
        'rank': rank,
        'icon': icon,
        'perks': perks,
        'minActiveClients': clients,
        'minMonthlyLots': lots,
        'cpaAmount': cpa,
        'rates': {for (var i = 0; i < _groups.length; i++) _groups[i]: rates[i]},
        'optionsRate': 0,
      },
  ];
}

Map<String, dynamic> _programme() => {
  'levels': _levels(),
  'symbolGroups': [
    {
      'key': 'fx-major',
      'name': 'Forex majors',
      'assetClass': 'forex',
      'symbols': ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'USDCAD'],
    },
    {
      'key': 'fx-minor',
      'name': 'Forex minors & crosses',
      'assetClass': 'forex',
      'symbols': ['GBPJPY', 'EURJPY', 'USDINR'],
    },
    {
      'key': 'metals',
      'name': 'Metals',
      'assetClass': 'metals',
      'symbols': ['XAUUSD', 'XAGUSD'],
    },
    {
      'key': 'indices',
      'name': 'Indices',
      'assetClass': 'indices',
      'symbols': ['NAS100', 'US30', 'GER40'],
    },
    {
      'key': 'energies',
      'name': 'Energies',
      'assetClass': 'energies',
      'symbols': ['USOIL', 'UKOIL'],
    },
    {
      'key': 'crypto',
      'name': 'Crypto',
      'assetClass': 'crypto',
      'symbols': ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'],
    },
    {'key': 'stocks', 'name': 'Stocks', 'assetClass': 'stocks', 'symbols': <String>[]},
  ],
  'tiers': [
    {'tier': 1, 'pct': 100},
    {'tier': 2, 'pct': 20},
    {'tier': 3, 'pct': 10},
  ],
  'cpa': {'enabled': true, 'minFirstDeposit': 200, 'requireFirstTrade': true, 'holdDays': 30},
  'minTradeSeconds': 120,
  'payout': {'schedule': 'weekly', 'minAmount': 50, 'nextClose': _iso(_nextClose)},
  'maxRebatePct': 50,
  'maxSplitPct': 50,
  'clientVisibility': 'full',
  'excludedGroups': ['real\\zero-spread'],
};

/* ------------------------------------------------------------------ people (clients = network) */

// (id, parent, tier, name, country, kyc, campaign, lotsMonth, lotsTotal, earned, deposit, daysAgo)
const _people = [
  (1001, null, 1, 'Priya Sharma', 'in', 'verified', 'YouTube gold webinar', 48.6, 412.3, 1840.20, 5000.0, 410),
  (1002, null, 1, 'Rahul Verma', 'in', 'verified', null, 31.2, 298.7, 1312.45, 2500.0, 380),
  (1003, null, 1, 'Fatima Al Zahra', 'ae', 'verified', 'Telegram channel', 22.4, 176.0, 902.10, 10000.0, 300),
  (1004, null, 1, 'Wei Jie Tan', 'sg', 'verified', 'YouTube gold webinar', 64.8, 380.4, 1520.80, 3000.0, 260),
  (1005, null, 1, 'Aisha Bello', 'ng', 'verified', null, 18.2, 96.5, 402.60, 500.0, 210),
  (1006, null, 1, 'Daniel Okafor', 'ng', 'verified', 'Telegram channel', 12.6, 74.1, 296.30, 800.0, 190),
  (1007, null, 1, 'Siti Nurhaliza', 'my', 'verified', null, 9.4, 41.8, 188.20, 1000.0, 150),
  (1008, null, 1, 'Ahmed Khan', 'pk', 'verified', 'Diwali gold promo', 7.1, 33.0, 141.75, 400.0, 120),
  (1009, null, 1, 'Nguyen Van An', 'vn', 'pending', null, 0.0, 12.4, 52.40, 300.0, 95),
  (1010, null, 1, 'Grace Wanjiru', 'ke', 'verified', null, 5.3, 18.9, 76.30, 250.0, 80),
  (1011, null, 1, 'Rohan Iyer', 'in', 'verified', 'Diwali gold promo', 3.8, 3.8, 32.10, 1500.0, 21),
  (1012, null, 1, 'Somchai Wong', 'th', 'pending', null, 0.0, 0.0, 0.0, null, 14),
  (1013, null, 1, 'Maria Santos', 'ph', 'unverified', 'YouTube gold webinar', 0.0, 0.0, 0.0, null, 9),
  (1014, null, 1, 'Omar Hassan', 'eg', 'verified', null, 2.2, 6.1, 24.80, 300.0, 40),
  (1015, null, 1, 'Tanvir Ahmed', 'bd', 'unverified', null, 0.0, 0.0, 0.0, null, 3),
  (2001, 1001, 2, 'Kavya Nair', 'in', 'verified', null, 14.2, 88.4, 64.30, 1200.0, 240),
  (2002, 1001, 2, 'Arjun Kapoor', 'in', 'verified', null, 8.6, 40.2, 31.80, 600.0, 200),
  (2003, 1001, 2, 'Sneha Reddy', 'in', 'verified', null, 0.0, 9.3, 4.10, 300.0, 150),
  (2004, 1001, 2, 'Vikram Singh', 'in', 'pending', null, 0.0, 0.0, 0.0, null, 30),
  (2005, 1002, 2, 'Meera Joshi', 'in', 'verified', null, 6.4, 22.7, 18.90, 500.0, 170),
  (2006, 1002, 2, 'Imran Sheikh', 'ae', 'verified', null, 10.8, 51.5, 42.70, 2000.0, 160),
  (2007, 1003, 2, 'Layla Haddad', 'sa', 'verified', null, 4.9, 15.2, 12.30, 750.0, 110),
  (2008, 1003, 2, 'Yusuf Rahman', 'ae', 'pending', null, 0.0, 0.0, 0.0, null, 18),
  (3001, 2001, 3, 'Ananya Das', 'in', 'verified', null, 3.6, 12.8, 5.20, 400.0, 90),
  (3002, 2001, 3, 'Karan Mehta', 'in', 'verified', null, 0.0, 2.1, 0.80, 200.0, 60),
  (3003, 2006, 3, 'Hamza Ali', 'pk', 'unverified', null, 0.0, 0.0, 0.0, null, 12),
];

/// The broker shares full names with this partner (visibility "full").
List<Map<String, dynamic>> get _clients {
  final refs = <int, int>{};
  for (final p in _people) {
    if (p.$2 != null) refs[p.$2!] = (refs[p.$2!] ?? 0) + 1;
  }
  return [
    for (final (i, p) in _people.indexed)
      () {
        final (id, parent, tier, name, country, kyc, campaign, lotsMonth, lotsTotal, earned, deposit, days) = p;
        final first = name.split(' ').first.toLowerCase();
        return {
          'id': id,
          'tier': tier,
          'name': name,
          'email': '$first.${id % 97}@example.com',
          'country': country,
          'joinedAt': _ago(days: days),
          'kycStatus': kyc,
          'level': refs.containsKey(id) ? 'bronze' : '',
          'parentId': parent,
          'campaign': campaign,
          'referrals': refs[id] ?? 0,
          'firstDepositAt': deposit == null ? null : _ago(days: days - 2),
          'firstDepositAmount': deposit,
          'firstTradeAt': lotsTotal > 0 ? _ago(days: days - 3) : null,
          'lastTradeAt': lotsMonth > 0 ? _ago(hours: 3 + i * 7) : (lotsTotal > 0 ? _ago(days: 40 + i) : null),
          'lotsMonth': lotsMonth,
          'lotsTotal': lotsTotal,
          'earned': earned,
          'status': lotsMonth > 0 ? 'active' : (deposit != null ? 'funded' : 'registered'),
        };
      }(),
  ];
}

List<Map<String, dynamic>> _trades(int id) {
  final p = _people.where((x) => x.$1 == id).firstOrNull;
  if (p == null || p.$9 == 0) return const [];
  const symbols = ['XAUUSD', 'EURUSD', 'NAS100', 'GBPJPY', 'BTCUSD', 'XAUUSD', 'USOIL', 'EURUSD-20261009-1.1650-C'];
  return [
    for (var i = 0; i < 9; i++)
      () {
        final sym = symbols[(id + i) % symbols.length];
        final option = sym.contains('-');
        final held = i == 3 ? 45 : 600 + i * 1900;
        final close = _now.subtract(Duration(hours: 5 + i * 19));
        final lots = option ? 0.0 : _r2(0.2 + ((id + i * 7) % 9) * 0.35);
        final qualified = i != 3 && i != 6;
        return {
          'dealId': 7102400 + id * 10 + i,
          'source': i == 5 ? 'copy' : (i == 7 ? 'pamm' : 'engine'),
          'login': 5100200 + id,
          'symbol': sym,
          'side': i.isEven ? 'buy' : 'sell',
          'volume': option ? 3 : lots * 100000,
          'lots': lots,
          'instrument': option ? 'option' : 'cfd',
          'contracts': option ? 3 : 0,
          'openTime': _iso(close.subtract(Duration(seconds: held))),
          'closeTime': _iso(close),
          'qualified': qualified,
          'reason': i == 3 ? 'short_duration' : (i == 6 ? 'excluded_group' : null),
          'reversed': false,
          'earned': qualified ? _r2(option ? 0 : lots * 10) : 0,
        };
      }(),
  ];
}

Map<String, dynamic> _network() => {
  'root': {'id': 80412, 'name': 'Arjun Mehta', 'level': 'silver', 'code': _code},
  'nodes': [
    for (final p in _people)
      {
        'id': p.$1,
        'parentId': p.$2,
        'tier': p.$3,
        'name': p.$4,
        'country': p.$5,
        'level': '',
        'joinedAt': _ago(days: p.$12),
        'lotsMonth': p.$8,
        'earnedMonth': _r2(p.$8 * (p.$3 == 1 ? 9.2 : (p.$3 == 2 ? 1.84 : 0.92))),
      },
  ],
  'tiers': 3,
};

/* ------------------------------------------------------------------ commission */

/// A deterministic year of daily commission (no randomness between runs).
List<({DateTime day, double amount})> get _daily {
  final today = _midnight(_now);
  final out = <({DateTime day, double amount})>[];
  for (var i = 179; i >= 0; i--) {
    final d = today.subtract(Duration(days: i));
    if (d.weekday == DateTime.saturday) continue;
    final wave = 38 + 22 * math.sin(i / 9) + (179 - i) * 0.18 + ((i * 37) % 23);
    out.add((day: d, amount: _r2(math.max(4, wave))));
  }
  return out;
}

const double _lifetime = 9119.45;

Map<String, dynamic> _commission(int i) {
  const kinds = ['lot', 'lot', 'lot', 'split', 'lot', 'rebate', 'lot', 'cpa', 'lot', 'lot', 'clawback', 'lot', 'adjustment'];
  final kind = kinds[i % kinds.length];
  final p = _people[(i * 5) % _people.length];
  const syms = ['XAUUSD', 'EURUSD', 'NAS100', 'GBPJPY', 'BTCUSD', 'USOIL', 'EURUSD-20261009-1.1650-C'];
  final sym = syms[(i * 3) % syms.length];
  final option = sym.contains('-');
  final lots = option ? 0.0 : _r2(0.5 + (i % 7) * 0.4);
  final rate = option ? 0.5 : (sym == 'XAUUSD' ? 10.0 : 7.0);
  final tier = kind == 'split' ? 2 : (kind == 'lot' ? p.$3 : (kind == 'rebate' ? 1 : 0));
  final share = kind == 'lot' ? (tier == 1 ? 100.0 : (tier == 2 ? 20.0 : 10.0)) : (kind == 'rebate' ? 10.0 : (kind == 'split' ? 20.0 : 0.0));
  final double amount = switch (kind) {
    'lot' => _r2(option ? 3 * rate : lots * rate * share / 100),
    'split' => _r2(-lots * rate * 0.2 * 0.2),
    'rebate' => _r2(-lots * rate * 0.1),
    'cpa' => 200,
    'clawback' => _r2(-lots * rate),
    _ => i.isEven ? 25 : -12.5,
  };
  final hours = 2 + i * 9;
  final status = i == 4
      ? 'rejected'
      : i == 17
      ? 'void'
      : hours < 24 * 7
      ? 'pending'
      : hours < 24 * 14
      ? 'approved'
      : 'paid';
  final created = _now.subtract(Duration(hours: hours));
  return {
    'id': 90500 - i,
    'kind': kind,
    'status': status,
    'amount': amount,
    'tier': tier,
    'rate': kind == 'lot' ? rate : 0,
    'sharePct': share,
    'lots': kind == 'cpa' || kind == 'adjustment' || option ? 0 : lots,
    'contracts': option && kind != 'cpa' && kind != 'adjustment' ? 3 : 0,
    'symbol': kind == 'cpa' || kind == 'adjustment' ? null : sym,
    'symbolGroup': option ? 'options' : (kind == 'cpa' || kind == 'adjustment' ? null : (sym == 'XAUUSD' ? 'metals' : 'fx-major')),
    'dealId': kind == 'cpa' || kind == 'adjustment' ? null : 7200100 + i * 13,
    'source': i % 11 == 2 ? 'copy' : (i % 13 == 5 ? 'pamm' : 'engine'),
    'levelKey': 'silver',
    'client': {'id': p.$1, 'name': p.$4, 'country': p.$5},
    'createdAt': _iso(created),
    'availableAt': _iso(created.add(const Duration(days: 7))),
    'batchId': status == 'paid' ? 412 - i ~/ 18 : null,
    'note': kind == 'adjustment' ? (i.isEven ? 'Goodwill credit' : 'Rounding correction') : null,
  };
}

final List<Map<String, dynamic>> _ledger = [for (var i = 0; i < 64; i++) _commission(i)];

Map<String, dynamic> _commissionsPage(Map<String, String> q) {
  final status = q['status'];
  final kind = q['kind'];
  final page = math.max(1, int.tryParse(q['page'] ?? '') ?? 1);
  final limit = (int.tryParse(q['limit'] ?? '') ?? 25).clamp(1, 100);
  final rows = _ledger.where((e) => (status == null || e['status'] == status) && (kind == null || e['kind'] == kind)).toList();
  final totals = <String, double>{'pending': 0, 'approved': 0, 'paid': 0, 'rejected': 0, 'void': 0};
  for (final e in _ledger) {
    totals[e['status'] as String] = _r2(totals[e['status']]! + (e['amount'] as num).toDouble());
  }
  return {'items': rows.skip((page - 1) * limit).take(limit).toList(), 'page': page, 'limit': limit, 'total': rows.length, 'totals': totals};
}

/* ------------------------------------------------------------------ payouts */

Map<String, dynamic> _payouts() {
  final close = _nextClose;
  final items = <Map<String, dynamic>>[];
  for (var i = 0; i < 12; i++) {
    final end = close.subtract(Duration(days: 7 * (i + 1)));
    final status = i == 0 ? 'awaiting_approval' : (i == 1 ? 'processing' : (i == 6 ? 'rejected' : 'paid'));
    final amount = _r2(380 + 140 * math.sin(i * 1.3) + (11 - i) * 18);
    items.add({
      'id': 812 - i,
      'batchId': 412 - i,
      'amount': amount,
      'lines': 40 + (i * 17) % 31,
      'status': status,
      'createdAt': _iso(end.add(const Duration(minutes: 5))),
      'paidAt': status == 'paid' ? _iso(end.add(const Duration(days: 1, hours: 4))) : null,
      'periodStart': _iso(end.subtract(const Duration(days: 7))),
      'periodEnd': _iso(end),
      'schedule': 'weekly',
      'destination': 'Wallet · USDT',
    });
  }
  return {'items': items, 'unbatched': 412.30, 'schedule': 'weekly', 'minAmount': 50, 'nextClose': _iso(close)};
}

/* ------------------------------------------------------------------ state (writes) */

/// Back to the sample data as first served (widget tests start from it).
void resetPreviewPartner() => _PartnerState.instance = _PartnerState._();

class _PartnerState {
  _PartnerState._();
  static _PartnerState instance = _PartnerState._();

  double rebate = 10, split = 20;
  int _nextId = 48;

  final List<Map<String, dynamic>> campaigns = [
    _campaign(47, 'diwali-gold', 'Diwali gold promo', 'instagram', 'story', 'diwali-26', 12, 640, 52, 14, 9800, 61.4),
    _campaign(46, 'telegram', 'Telegram channel', 'telegram', 'post', null, 40, 1320, 118, 31, 21400, 142.8),
    _campaign(45, 'yt-gold-webinar', 'YouTube gold webinar', 'youtube', 'video', 'gold-webinar', 75, 1890, 164, 48, 38250, 288.6),
    {..._campaign(44, 'flyer-expo', 'Dubai expo flyer', 'flyer', 'print', 'expo-25', 160, 96, 7, 2, 1200, 8.4), 'active': false},
    _campaign(null, '', 'Default link', null, null, null, 0, 874, 71, 31, 16420, 111.2),
  ];

  static Map<String, dynamic> _campaign(
    int? id,
    String slug,
    String name,
    String? src,
    String? medium,
    String? camp,
    int daysAgo,
    int clicks,
    int signups,
    int ftds,
    double deposits,
    double lots,
  ) => {
    'id': id,
    'slug': slug,
    'name': name,
    'landing': '/register',
    'utmSource': src,
    'utmMedium': medium,
    'utmCampaign': camp,
    'active': true,
    'createdAt': id == null ? null : _ago(days: daysAgo),
    'clicks': clicks,
    'uniqueClicks': (clicks * 0.78).round(),
    'signups': signups,
    'ftds': ftds,
    'deposits': deposits,
    'lots': lots,
    'trend': [
      for (var d = 0; d < 30; d++) clicks == 0 ? 0 : math.max(0, ((clicks / 40) * (1 + math.sin((d + (id ?? 3)) / 3)) + (d * 7 + (id ?? 0)) % 5).round()),
    ],
  };

  (int, Object) saveSettings(Map<String, dynamic> b) {
    final r = (b['rebatePct'] as num?)?.toDouble();
    final s = (b['splitPct'] as num?)?.toDouble();
    if (r == null || r < 0 || r > 50) return (422, _err('validation', 'Rebate must be between 0 and 50%.', 'rebatePct'));
    if (s == null || s < 0 || s > 50) return (422, _err('validation', 'Split must be between 0 and 50%.', 'splitPct'));
    rebate = _r2(r);
    split = _r2(s);
    return (200, {'rebatePct': rebate, 'splitPct': split});
  }

  (int, Object) createCampaign(Map<String, dynamic> b) {
    final name = '${b['name'] ?? ''}'.trim();
    if (name.isEmpty) return (422, _err('validation', 'Give the campaign a name.', 'name'));
    if (name.length > 60) return (422, _err('validation', 'At most 60 characters.', 'name'));
    var slug = '${b['slug'] ?? ''}'.trim().toLowerCase();
    if (slug.isNotEmpty && !RegExp(r'^[a-z0-9_-]{1,40}$').hasMatch(slug)) return (422, _err('validation', 'Use 1–40 letters, digits, - or _.', 'slug'));
    if (slug.isEmpty) slug = name.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-+|-+$'), '');
    if (slug.length > 40) slug = slug.substring(0, 40).replaceAll(RegExp(r'-+$'), '');
    if (slug.isEmpty) return (422, _err('validation', 'Use 1–40 letters, digits, - or _.', 'slug'));
    if (campaigns.any((c) => c['slug'] == slug)) return (409, _err('exists', "You already have a link called '$slug'."));
    final id = _nextId++;
    campaigns.insert(0, {
      ..._campaign(id, slug, name, b['utmSource'] as String?, b['utmMedium'] as String?, b['utmCampaign'] as String?, 0, 0, 0, 0, 0, 0),
      'createdAt': _iso(_now),
    });
    return (200, {'id': id, 'slug': slug, 'name': name, 'landing': '/register'});
  }

  (int, Object) patchCampaign(int id, Map<String, dynamic> b) {
    final i = campaigns.indexWhere((c) => c['id'] == id);
    if (i < 0) return (404, _err('not_found', 'Not found.'));
    campaigns[i] = {...campaigns[i], if (b['active'] is bool) 'active': b['active'], if (b['name'] is String) 'name': b['name']};
    return (200, {'status': 'ok'});
  }

  Map<String, dynamic> dashboard() {
    final levels = _levels();
    final today = _midnight(_now);
    final daily = _daily;
    final sum = daily.fold<double>(0, (s, d) => s + d.amount);
    var acc = _lifetime - sum;
    final series = [
      for (final d in daily) {'date': _day(d.day), 'amount': d.amount, 'cumulative': _r2(acc += d.amount)},
    ];
    final monday = today.subtract(Duration(days: today.weekday - 1));
    final weekly = <Map<String, dynamic>>[];
    for (var w = 11; w >= 0; w--) {
      final start = monday.subtract(Duration(days: 7 * w));
      final end = start.add(const Duration(days: 7));
      final amount = daily.where((d) => !d.day.isBefore(start) && d.day.isBefore(end)).fold<double>(0, (s, d) => s + d.amount);
      if (amount > 0) weekly.add({'week': _day(start), 'amount': _r2(amount)});
    }
    final monthEnds = DateTime.utc(_now.year, _now.month + 1);
    return {
      'member': {
        'userId': 80412,
        'code': _code,
        'name': 'Arjun Mehta',
        'level': levels[1],
        'levelSince': '2025-11-01T00:00:00Z',
        'joinedAt': '2024-03-14T09:20:00Z',
        'rebatePct': rebate,
        'splitPct': split,
        'status': 'active',
        'hasUpline': false,
      },
      'progress': {
        'month': '${_now.year}-${_now.month.toString().padLeft(2, '0')}',
        'monthEnds': _iso(monthEnds),
        'activeClients': 38,
        'monthlyLots': 612.4,
        'prevMonthLots': 540.2,
        'next': levels[2],
        'levels': levels,
      },
      'earnings': {
        'pending': 412.30,
        'approved': 286.40,
        'paid': 8420.75,
        'rejected': 12.0,
        'month': 1240.5,
        'prevMonth': 1105.2,
        'lifetime': _lifetime,
        'cpaEarned': 2400,
        'cpaCount': 12,
        'cpaWaiting': 3,
      },
      'counts': {'referrals': 126, 'referralsThisMonth': 9, 'funded': 64, 'subIbs': 5},
      'funnel': {'clicks': 4820, 'signups': 412, 'ftds': 126},
      'series': series,
      'weekly': weekly,
      'topClients': [
        for (final p in _people.where((p) => p.$3 == 1 && p.$8 > 0).toList()..sort((a, b) => b.$8.compareTo(a.$8)))
          {'id': p.$1, 'name': p.$4, 'country': p.$5, 'lotsMonth': p.$8},
      ].take(6).toList(),
      'recent': _ledger.take(10).toList(),
      'programme': _programme(),
      'linkBase': _base,
    };
  }
}
