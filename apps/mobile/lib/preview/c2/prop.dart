// Sample answers for the prop screens (previews and widget tests only; shapes of the real API: services/prop/README.md
// through apps/crm/app/api/prop/[...path]/route.ts). Three challenges of the sample client: Kalks Classic 2-Step $50k
// in Phase 2 (54 % of today's loss limit used), Kalks Classic 1-Step $100k funded with an eligible payout, and a
// failed $25k. Dates are relative to now; every figure is fixed.
import 'dart:math' as math;

// Return null for paths this module doesn't own.
(int, Object)? previewProp(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  if (!path.startsWith('prop/')) return null;
  final p = path.substring(5).split('/');
  final now = DateTime.now().toUtc();
  Map<String, dynamic> error(String code, String message) => {
    'error': {'code': code, 'message': message},
  };

  if (method == 'GET' && p.length == 1) {
    switch (p[0]) {
      case 'plans':
        return (200, {'plans': _plans});
      case 'challenges':
        return (200, {'challenges': _challenges(now, detail: false)});
      case 'payouts':
        return (200, _payouts(now));
      case 'certificates':
        return (200, {'certificates': _certificates(now)});
      case 'notifications':
        return (200, {'notifications': <Object>[], 'unread': 0});
    }
    return (404, error('not_found', 'Not found.'));
  }

  if (method == 'POST' && p.length == 1 && p[0] == 'challenges') return _buy(now, body);

  if (p[0] == 'challenges' && p.length >= 2) {
    final id = int.tryParse(p[1]);
    final c = _challenges(now, detail: true).where((c) => c['id'] == id).firstOrNull;
    if (c == null) return (404, error('not_found', 'Not found.'));
    if (method == 'GET' && p.length == 2) return (200, c);
    final phase = int.tryParse(query['phase'] ?? '') ?? (c['phaseIndex'] as int);
    final acc = (c['phases'] as List).cast<Map<String, dynamic>>().where((a) => a['phaseIndex'] == phase).firstOrNull;
    if (method == 'GET' && p.length == 3 && p[2] == 'equity') {
      return (200, {'points': acc == null ? <Object>[] : _equity(now, acc), 'initialBalance': acc?['initialBalance'] ?? c['size']});
    }
    if (method == 'GET' && p.length == 3 && p[2] == 'trades') return (200, {'trades': acc == null ? <Object>[] : _trades(acc)});
    if (method == 'POST' && p.length == 3 && p[2] == 'payouts') {
      if (c['status'] != 'funded') return (422, error('not_funded', 'Payouts are available on funded accounts only.'));
      final q = c['payout'] as Map<String, dynamic>;
      return (
        200,
        {
          'payout': {
            'id': 84,
            'challengeId': id,
            'login': 80519120,
            'profit': q['profit'],
            'split': q['split'],
            'traderAmount': q['traderAmount'],
            'firmAmount': q['firmAmount'],
            'feeRefund': q['feeRefund'],
            'total': q['total'],
            'status': 'pending',
            'kycStatus': 'verified',
            'requestedAt': now.toIso8601String(),
            'decidedAt': null,
            'note': null,
            'error': null,
            'planName': c['planName'],
            'size': c['size'],
          },
        },
      );
    }
  }
  return (404, error('not_found', 'Not found.'));
}

/* ------------------------------------------------------------------ plans */

const _bannedCore = ['hft', 'latency_arbitrage', 'tick_scalping'];

Map<String, dynamic> _plan({
  required String id,
  required String name,
  required String type,
  required List<List<num>> sizes,
  required List<Map<String, dynamic>> phases,
  required num dailyLoss,
  required String dailyBasis,
  required num maxDD,
  required String ddType,
  bool trailingLock = false,
  num consistency = 0,
  bool newsTrading = true,
  int newsWindow = 2,
  bool newsBreachFails = false,
  bool weekendHolding = true,
  bool eaAllowed = true,
  List<String> banned = _bannedCore,
  required num split,
  required num splitMax,
  int scalingEvery = 4,
  num scalingIncrease = 25,
  num scalingProfit = 10,
  num scalingCap = 2000000,
  required bool refundFee,
  required String payoutFreq,
  required int firstPayoutDays,
  required num minPayout,
}) => {
  'id': id,
  'name': name,
  'type': type,
  'status': 'active',
  'version': 3,
  'group': 'prop',
  'sizes': [
    for (final s in sizes) {'size': s[0], 'fee': s[1], 'leverage': s[2], 'enabled': true},
  ],
  'phases': phases,
  'dailyLoss': dailyLoss,
  'dailyBasis': dailyBasis,
  'maxDD': maxDD,
  'ddType': ddType,
  'trailingLock': trailingLock,
  'consistency': consistency,
  'newsTrading': newsTrading,
  'newsWindow': newsWindow,
  'newsBreachFails': newsBreachFails,
  'weekendHolding': weekendHolding,
  'eaAllowed': eaAllowed,
  'banned': banned,
  'split': split,
  'splitMax': splitMax,
  'scalingEvery': scalingEvery,
  'scalingIncrease': scalingIncrease,
  'scalingProfit': scalingProfit,
  'scalingCap': scalingCap,
  'refundFee': refundFee,
  'payoutFreq': payoutFreq,
  'firstPayoutDays': firstPayoutDays,
  'minPayout': minPayout,
};

Map<String, dynamic> _phase(String name, num target, int minDays, int timeLimit) => {
  'name': name,
  'target': target,
  'minDays': minDays,
  'timeLimit': timeLimit,
};

final Map<String, dynamic> _oneStep = _plan(
  id: 'classic-1-step',
  name: 'Kalks Classic 1-Step',
  type: '1-step',
  sizes: [
    [10000, 99, 100],
    [25000, 199, 100],
    [50000, 329, 100],
    [100000, 549, 100],
    [200000, 999, 50],
  ],
  phases: [_phase('Phase 1', 10, 3, 0)],
  dailyLoss: 4,
  dailyBasis: 'equity',
  maxDD: 8,
  ddType: 'trailing',
  trailingLock: true,
  split: 80,
  splitMax: 90,
  refundFee: true,
  payoutFreq: 'bi-weekly',
  firstPayoutDays: 14,
  minPayout: 50,
);

final Map<String, dynamic> _twoStep = _plan(
  id: 'classic-2-step',
  name: 'Kalks Classic 2-Step',
  type: '2-step',
  sizes: [
    [10000, 89, 100],
    [25000, 179, 100],
    [50000, 299, 100],
    [100000, 499, 100],
    [200000, 949, 50],
  ],
  phases: [_phase('Phase 1', 8, 4, 0), _phase('Phase 2', 5, 4, 0)],
  dailyLoss: 5,
  dailyBasis: 'balance',
  maxDD: 10,
  ddType: 'static',
  banned: [..._bannedCore, 'cross_account_copying', 'cross_account_hedging'],
  split: 80,
  splitMax: 90,
  refundFee: true,
  payoutFreq: 'weekly',
  firstPayoutDays: 14,
  minPayout: 50,
);

final List<Map<String, dynamic>> _plans = [
  _oneStep,
  _twoStep,
  _plan(
    id: 'swift-2-step',
    name: 'Kalks Swift 2-Step',
    type: '2-step',
    sizes: [
      [25000, 149, 100],
      [50000, 249, 100],
      [100000, 449, 100],
    ],
    phases: [_phase('Phase 1', 10, 3, 30), _phase('Phase 2', 5, 3, 60)],
    dailyLoss: 5,
    dailyBasis: 'equity',
    maxDD: 10,
    ddType: 'static',
    consistency: 40,
    newsTrading: false,
    weekendHolding: false,
    eaAllowed: false,
    banned: ['hft', 'martingale', 'grid'],
    split: 75,
    splitMax: 75,
    scalingEvery: 3,
    scalingIncrease: 20,
    scalingCap: 1000000,
    refundFee: false,
    payoutFreq: 'monthly',
    firstPayoutDays: 30,
    minPayout: 100,
  ),
  _plan(
    id: 'instant-funded',
    name: 'Kalks Instant',
    type: 'instant',
    sizes: [
      [5000, 249, 50],
      [10000, 449, 50],
      [25000, 999, 50],
      [50000, 1899, 50],
      [100000, 3499, 50],
    ],
    phases: [],
    dailyLoss: 3,
    dailyBasis: 'balance',
    maxDD: 6,
    ddType: 'trailing',
    trailingLock: true,
    consistency: 30,
    newsTrading: false,
    newsWindow: 5,
    newsBreachFails: true,
    weekendHolding: false,
    split: 70,
    splitMax: 80,
    refundFee: false,
    payoutFreq: 'on-demand',
    firstPayoutDays: 7,
    minPayout: 100,
  ),
];

/* ------------------------------------------------------------------ challenges */

String _iso(DateTime d) => d.toIso8601String();

DateTime _nextReset(DateTime now) {
  var t = DateTime.utc(now.year, now.month, now.day, 21);
  if (!t.isAfter(now)) t = t.add(const Duration(days: 1));
  return t;
}

Map<String, dynamic> _rules(
  DateTime now, {
  required num dailyLimit,
  required num dailyRef,
  required num dailyUsed,
  required num ddLimit,
  required num ddFloor,
  required num ddUsed,
  required num hwm,
  required num profit,
  required num? targetAmount,
  bool targetReached = false,
  required int tradingDays,
  required int minDays,
  num? bestDay,
  required num equity,
  required num balance,
}) => {
  'day': _iso(now).substring(0, 10),
  'dailyLimit': dailyLimit,
  'dailyRef': dailyRef,
  'dailyFloor': dailyRef - dailyLimit,
  'dailyUsed': dailyUsed,
  'ddLimit': ddLimit,
  'ddFloor': ddFloor,
  'ddUsed': ddUsed,
  'hwm': hwm,
  'profit': profit,
  'targetAmount': targetAmount,
  'targetReached': targetReached,
  'tradingDays': tradingDays,
  'minDays': minDays,
  'daysOk': tradingDays >= minDays,
  'bestDay': bestDay,
  'consistencyLimit': null,
  'consistencyOk': true,
  'deadline': null,
  'verdict': {'kind': targetReached ? 'pass' : 'ok'},
  'warn': null,
  'nextReset': _iso(_nextReset(now)),
  'weekendWindow': false,
  'equity': equity,
  'balance': balance,
  'at': _iso(now),
};

Map<String, dynamic> _stats(
  DateTime now, {
  required int trades,
  required int open,
  required num winRate,
  required num avgWin,
  required num avgLoss,
  required num pf,
  required num lots,
  required int bestAgo,
  required num best,
}) => {
  'trades': trades,
  'open': open,
  'wins': (trades * winRate / 100).round(),
  'losses': trades - (trades * winRate / 100).round(),
  'winRate': winRate,
  'avgWin': avgWin,
  'avgLoss': avgLoss,
  'profitFactor': pf,
  'lots': lots,
  'bestDay': {'day': _iso(now.subtract(Duration(days: bestAgo))).substring(0, 10), 'profit': best},
  'days': <String>[],
  'dayProfits': <Object>[],
};

Map<String, dynamic> _account({
  required int id,
  required int challengeId,
  required int phaseIndex,
  required String phase,
  bool funded = false,
  required int login,
  required String status,
  required num initial,
  required num? targetPct,
  required int minDays,
  int timeLimitDays = 0,
  required DateTime startedAt,
  DateTime? endedAt,
  String? endReason,
  required num balance,
  required num equity,
  int openPositions = 0,
  required int tradingDays,
  Map<String, dynamic>? rules,
  Map<String, dynamic>? stats,
}) => {
  'id': id,
  'challengeId': challengeId,
  'phaseIndex': phaseIndex,
  'phase': phase,
  'funded': funded,
  'login': login,
  'status': status,
  'initialBalance': initial,
  'targetPct': targetPct,
  'minDays': minDays,
  'timeLimitDays': timeLimitDays,
  'startedAt': _iso(startedAt),
  'endedAt': endedAt == null ? null : _iso(endedAt),
  'endReason': endReason,
  'balance': balance,
  'equity': equity,
  'openPositions': openPositions,
  'tradingDays': tradingDays,
  'lastEvalAt': _iso(startedAt),
  'lastPayoutAt': null,
  'scaledAt': null,
  'rules': rules,
  'stats': stats,
};

Map<String, dynamic> _event(
  int id,
  int accountId,
  int login,
  String rule,
  String severity,
  DateTime at,
  String message, {
  num? equity,
  num? threshold,
  Object? details,
}) => {
  'id': id,
  'accountId': accountId,
  'login': login,
  'rule': rule,
  'severity': severity,
  'at': _iso(at),
  'equity': equity,
  'balance': equity,
  'threshold': threshold,
  'message': message,
  'details': details,
};

Map<String, dynamic> _cert(String code, String kind, String title, String plan, num size, DateTime at, int challengeId, {num? amount, String? phase}) => {
  'code': code,
  'kind': kind,
  'title': title,
  'traderName': 'Arjun Mehta',
  'planName': plan,
  'size': size,
  'amount': amount,
  'phase': phase,
  'issuedAt': _iso(at),
  'revoked': false,
  'challengeId': challengeId,
  'verifyUrl': 'https://app.kalkstrade.com/verify/$code',
};

List<Map<String, dynamic>> _certificates(DateTime now) => [
  _cert('KC-2026-3010-0077', 'payout', 'Payout certificate', 'Kalks Classic 1-Step', 100000, now.subtract(const Duration(days: 23)), 1038, amount: 3829),
  _cert('KC-2026-3101-0001', 'pass', 'Phase 1 passed', 'Kalks Classic 2-Step', 50000, now.subtract(const Duration(days: 9)), 1051, phase: 'Phase 1'),
  _cert('KC-2026-3010-0002', 'funded', 'Funded trader', 'Kalks Classic 1-Step', 100000, now.subtract(const Duration(days: 45)), 1038),
  _cert('KC-2026-2980-0001', 'pass', 'Phase 1 passed', 'Kalks Classic 1-Step', 100000, now.subtract(const Duration(days: 45)), 1038, phase: 'Phase 1'),
];

Map<String, dynamic> _quote(DateTime now) => {
  'eligibleFrom': _iso(now.subtract(const Duration(days: 2))),
  'profit': 6240,
  'split': 80,
  'traderAmount': 4992,
  'firmAmount': 1248,
  'feeRefund': 0,
  'total': 4992,
  'minPayout': 50,
  'blockers': <String>[],
  'eligible': true,
};

List<Map<String, dynamic>> _challenges(DateTime now, {required bool detail}) {
  DateTime ago(int days, [int hours = 0]) => now.subtract(Duration(days: days, hours: hours));

  // 1051: Classic 2-Step $50k, Phase 1 passed, Phase 2 live
  final p1 = _account(
    id: 3101,
    challengeId: 1051,
    phaseIndex: 0,
    phase: 'Phase 1',
    login: 80519877,
    status: 'passed',
    initial: 50000,
    targetPct: 8,
    minDays: 4,
    startedAt: ago(19),
    endedAt: ago(9, 2),
    endReason: 'Profit target reached',
    balance: 54180,
    equity: 54180,
    tradingDays: 7,
    rules: _rules(
      ago(9, 2),
      dailyLimit: 2500,
      dailyRef: 53620,
      dailyUsed: 0,
      ddLimit: 5000,
      ddFloor: 45000,
      ddUsed: 0,
      hwm: 54180,
      profit: 4180,
      targetAmount: 4000,
      targetReached: true,
      tradingDays: 7,
      minDays: 4,
      bestDay: 1120,
      equity: 54180,
      balance: 54180,
    ),
    stats: _stats(now, trades: 31, open: 0, winRate: 61.3, avgWin: 398.4, avgLoss: -352.9, pf: 1.78, lots: 22.6, bestAgo: 12, best: 1120),
  );
  final p2 = _account(
    id: 3142,
    challengeId: 1051,
    phaseIndex: 1,
    phase: 'Phase 2',
    login: 80520114,
    status: 'active',
    initial: 50000,
    targetPct: 5,
    minDays: 4,
    startedAt: ago(9),
    balance: 51210,
    equity: 51640,
    openPositions: 2,
    tradingDays: 5,
    rules: _rules(
      now,
      dailyLimit: 2500,
      dailyRef: 52990,
      dailyUsed: 1350,
      ddLimit: 5000,
      ddFloor: 45000,
      ddUsed: 0,
      hwm: 53420,
      profit: 1640,
      targetAmount: 2500,
      tradingDays: 5,
      minDays: 4,
      bestDay: 980,
      equity: 51640,
      balance: 51210,
    ),
    stats: _stats(now, trades: 23, open: 2, winRate: 60.9, avgWin: 412.6, avgLoss: -386.2, pf: 1.66, lots: 18.4, bestAgo: 3, best: 980),
  );

  // 1038: Classic 1-Step $100k, funded, payout eligible
  final f1 = _account(
    id: 2980,
    challengeId: 1038,
    phaseIndex: 0,
    phase: 'Phase 1',
    login: 80518800,
    status: 'passed',
    initial: 100000,
    targetPct: 10,
    minDays: 3,
    startedAt: ago(62),
    endedAt: ago(45, 3),
    endReason: 'Profit target reached',
    balance: 110420,
    equity: 110420,
    tradingDays: 9,
    rules: _rules(
      ago(45, 3),
      dailyLimit: 4000,
      dailyRef: 108900,
      dailyUsed: 0,
      ddLimit: 8000,
      ddFloor: 100000,
      ddUsed: 0,
      hwm: 110420,
      profit: 10420,
      targetAmount: 10000,
      targetReached: true,
      tradingDays: 9,
      minDays: 3,
      bestDay: 2210,
      equity: 110420,
      balance: 110420,
    ),
    stats: _stats(now, trades: 38, open: 0, winRate: 63.2, avgWin: 702.5, avgLoss: -486.0, pf: 2.01, lots: 41.8, bestAgo: 50, best: 2210),
  );
  final f2 = _account(
    id: 3010,
    challengeId: 1038,
    phaseIndex: 1,
    phase: 'Funded',
    funded: true,
    login: 80519120,
    status: 'active',
    initial: 100000,
    targetPct: null,
    minDays: 0,
    startedAt: ago(45),
    balance: 106240,
    equity: 106240,
    tradingDays: 21,
    rules: _rules(
      now,
      dailyLimit: 4000,
      dailyRef: 106620,
      dailyUsed: 380,
      ddLimit: 8000,
      ddFloor: 98900,
      ddUsed: 660,
      hwm: 106900,
      profit: 6240,
      targetAmount: null,
      tradingDays: 21,
      minDays: 0,
      bestDay: 1320,
      equity: 106240,
      balance: 106240,
    ),
    stats: _stats(now, trades: 64, open: 0, winRate: 57.8, avgWin: 615.3, avgLoss: -498.1, pf: 1.52, lots: 71.2, bestAgo: 12, best: 1320),
  );

  // 1012: Classic 2-Step $25k, failed on the daily loss limit
  final x1 = _account(
    id: 2711,
    challengeId: 1012,
    phaseIndex: 0,
    phase: 'Phase 1',
    login: 80517002,
    status: 'failed',
    initial: 25000,
    targetPct: 8,
    minDays: 4,
    startedAt: ago(80),
    endedAt: ago(71, 5),
    endReason: 'Daily loss limit breached',
    balance: 23612.4,
    equity: 23612.4,
    tradingDays: 6,
    rules: _rules(
      ago(71, 5),
      dailyLimit: 1250,
      dailyRef: 24870,
      dailyUsed: 1257.6,
      ddLimit: 2500,
      ddFloor: 22500,
      ddUsed: 1387.6,
      hwm: 25410,
      profit: -1387.6,
      targetAmount: 2000,
      tradingDays: 6,
      minDays: 4,
      bestDay: 640,
      equity: 23612.4,
      balance: 23612.4,
    ),
    stats: _stats(now, trades: 19, open: 0, winRate: 42.1, avgWin: 355.2, avgLoss: -389.7, pf: 0.69, lots: 14.1, bestAgo: 76, best: 640),
  );

  Map<String, dynamic> challenge(
    int id,
    Map<String, dynamic> plan,
    num size,
    num fee,
    String status,
    int phaseIndex,
    List<Map<String, dynamic>> phases,
    DateTime created, {
    String? failureReason,
    bool feeRefunded = false,
    Map<String, dynamic>? payout,
    List<Map<String, dynamic>> events = const [],
    List<Map<String, dynamic>> certificates = const [],
  }) => {
    'id': id,
    'traderName': 'Arjun Mehta',
    'planId': plan['id'],
    'planName': plan['name'],
    'type': plan['type'],
    'size': size,
    'fee': fee,
    'leverage': 100,
    'group': 'prop',
    'status': status,
    'phaseIndex': phaseIndex,
    'feeRefunded': feeRefunded,
    'split': plan['split'],
    'failureReason': failureReason,
    'createdAt': _iso(created),
    'plan': plan,
    'phases': phases,
    'current': phases[phaseIndex],
    if (detail) ...{'payout': payout, 'events': events, 'certificates': certificates},
  };

  final certs = _certificates(now);
  return [
    challenge(
      1051,
      _twoStep,
      50000,
      299,
      'active',
      1,
      [p1, p2],
      ago(19, 1),
      events: [
        _event(
          912,
          3142,
          80520114,
          'daily_loss',
          'warning',
          now.subtract(const Duration(minutes: 38)),
          '50% of today\'s loss limit used (\$1,350.00 of \$2,500.00).',
          equity: 51640,
          threshold: 50490,
        ),
        _event(
          905,
          3142,
          80520114,
          'news_window',
          'info',
          ago(2, 4),
          'Position opened 1 minute before US CPI. News trading is allowed on this plan.',
          equity: 52410,
        ),
        _event(874, 3101, 80519877, 'profit_target', 'info', ago(9, 2), 'Profit target reached: Phase 1 passed.', equity: 54180, threshold: 54000),
      ],
      certificates: certs.where((c) => c['challengeId'] == 1051).toList(),
    ),
    challenge(
      1038,
      _oneStep,
      100000,
      549,
      'funded',
      1,
      [f1, f2],
      ago(62, 2),
      feeRefunded: true,
      payout: _quote(now),
      events: [
        _event(
          861,
          3010,
          80519120,
          'banned_strategy',
          'violation',
          ago(20, 6),
          'Trades held under 30 seconds on XAUUSD were flagged for review.',
          equity: 103880,
          details: {'kind': 'tick_scalping'},
        ),
        _event(
          822,
          3010,
          80519120,
          'daily_loss',
          'warning',
          ago(6, 3),
          '50% of today\'s loss limit used (\$2,010.00 of \$4,000.00).',
          equity: 104610,
          threshold: 102620,
        ),
      ],
      certificates: certs.where((c) => c['challengeId'] == 1038).toList(),
    ),
    challenge(
      1012,
      _twoStep,
      25000,
      179,
      'failed',
      0,
      [x1],
      ago(80, 2),
      failureReason: 'Daily loss limit breached',
      events: [
        _event(
          640,
          2711,
          80517002,
          'daily_loss',
          'breach',
          ago(71, 5),
          'Equity \$23,612.40 fell below the daily loss floor \$23,620.00. All positions were closed.',
          equity: 23612.4,
          threshold: 23620,
        ),
      ],
    ),
  ];
}

/* ------------------------------------------------------------------ equity, trades */

/// A fixed path from the starting balance to the account's current equity (60 samples over the phase).
List<Map<String, dynamic>> _equity(DateTime now, Map<String, dynamic> a) {
  final start = DateTime.parse(a['startedAt'] as String);
  final end = a['endedAt'] == null ? now.subtract(const Duration(minutes: 10)) : DateTime.parse(a['endedAt'] as String);
  final init = (a['initialBalance'] as num).toDouble();
  final lastEq = (a['equity'] as num).toDouble();
  final lastBal = (a['balance'] as num).toDouble();
  const n = 60;
  final seed = (a['id'] as int) % 7;
  final span = init * 0.012;
  return [
    for (var i = 0; i < n; i++)
      () {
        final f = i / (n - 1);
        final wave = math.sin(i * 0.55 + seed) * span * math.sin(math.pi * f) + math.sin(i * 1.7 + seed * 2) * span * 0.35 * math.sin(math.pi * f);
        final eq = init + (lastEq - init) * f + wave;
        final bal = init + (lastBal - init) * (f * n).floorToDouble() / n + wave * 0.6;
        return {
          'at': _iso(start.add(Duration(milliseconds: (end.difference(start).inMilliseconds * f).round()))),
          'balance': double.parse((i == n - 1 ? lastBal : bal).toStringAsFixed(2)),
          'equity': double.parse((i == n - 1 ? lastEq : eq).toStringAsFixed(2)),
        };
      }(),
  ];
}

const _symbols = [('EURUSD', 1.0842, 4), ('XAUUSD', 2648.35, 2), ('GBPUSD', 1.2731, 4), ('US30', 42180.5, 1), ('USDJPY', 149.62, 2), ('BTCUSD', 63250.0, 1)];
const _profits = [412.6, -286.1, 538.2, 96.4, -402.8, 721.5, -158.3, 264.9, 389.0, -512.4, 175.6, 640.2, -95.7, 318.8, -241.5, 452.3, 88.1, -366.9];

List<Map<String, dynamic>> _trades(Map<String, dynamic> a) {
  final start = DateTime.parse(a['startedAt'] as String);
  final count = a['status'] == 'failed' ? 12 : (a['funded'] == true ? 18 : 14);
  final seed = (a['id'] as int) % 5;
  final scale = (a['initialBalance'] as num) / 50000;
  return [
    for (var i = 0; i < count; i++)
      () {
        final s = _symbols[(i + seed) % _symbols.length];
        final open = start.add(Duration(hours: 6 + i * 13, minutes: (i * 17) % 60));
        final secs = 240 + ((i * 7919 + seed * 131) % 21600);
        final profit = double.parse((_profits[(i + seed) % _profits.length] * scale * (a['status'] == 'failed' && i == count - 1 ? -3 : 1)).toStringAsFixed(2));
        final move = s.$2 * 0.0012 * (i.isEven ? 1 : -1);
        return {
          'ticket': 4100000 + (a['id'] as int) * 100 + i,
          'symbol': s.$1,
          'side': (i + seed).isEven ? 'buy' : 'sell',
          'volume': double.parse((0.5 + ((i * 3 + seed) % 7) * 0.25).toStringAsFixed(2)),
          'openTime': _iso(open),
          'closeTime': _iso(open.add(Duration(seconds: secs))),
          'openPrice': double.parse(s.$2.toStringAsFixed(s.$3)),
          'closePrice': double.parse((s.$2 + move).toStringAsFixed(s.$3)),
          'profit': profit,
          'durationSecs': secs,
        };
      }(),
  ].reversed.toList();
}

/* ------------------------------------------------------------------ payouts, purchase */

Map<String, dynamic> _payouts(DateTime now) => {
  'payouts': [
    {
      'id': 77,
      'challengeId': 1038,
      'login': 80519120,
      'profit': 4100,
      'split': 80,
      'traderAmount': 3280,
      'firmAmount': 820,
      'feeRefund': 549,
      'total': 3829,
      'status': 'paid',
      'kycStatus': 'verified',
      'requestedAt': _iso(now.subtract(const Duration(days: 24, hours: 3))),
      'decidedAt': _iso(now.subtract(const Duration(days: 23))),
      'note': null,
      'error': null,
      'planName': 'Kalks Classic 1-Step',
      'size': 100000,
    },
    {
      'id': 61,
      'challengeId': 1038,
      'login': 80519120,
      'profit': 1240,
      'split': 80,
      'traderAmount': 992,
      'firmAmount': 248,
      'feeRefund': 549,
      'total': 1541,
      'status': 'rejected',
      'kycStatus': 'verified',
      'requestedAt': _iso(now.subtract(const Duration(days: 31, hours: 5))),
      'decidedAt': _iso(now.subtract(const Duration(days: 30))),
      'note': 'Consistency rule not met in this cycle; the profit was returned to the account.',
      'error': null,
      'planName': 'Kalks Classic 1-Step',
      'size': 100000,
    },
  ],
  'funded': [
    {
      'challengeId': 1038,
      'planName': 'Kalks Classic 1-Step',
      'size': 100000,
      'login': 80519120,
      'balance': 106240,
      'equity': 106240,
      'quote': _quote(now),
      'refundFee': true,
      'feeRefunded': true,
    },
  ],
  'kycStatus': 'verified',
};

// the USDT available in the wallet sample (lib/preview/c1/preview_wallet.dart: 3,250.40 total, 250 locked)
const double _walletUsdt = 3000.40;

(int, Object) _buy(DateTime now, Map<String, dynamic> body) {
  final plan = _plans.where((p) => p['id'] == body['planId']).firstOrNull;
  final size = body['size'] is num ? body['size'] as num : 0;
  final s = plan == null ? null : (plan['sizes'] as List).cast<Map<String, dynamic>>().where((x) => x['size'] == size).firstOrNull;
  if (plan == null || s == null) {
    return (
      422,
      {
        'error': {'code': 'plan_unavailable', 'message': "This plan or size isn't available any more."},
      },
    );
  }
  if ((s['fee'] as num) > _walletUsdt) {
    return (
      422,
      {
        'error': {'code': 'insufficient_funds', 'message': 'Insufficient USDT balance.'},
      },
    );
  }
  final phases = (plan['phases'] as List).cast<Map<String, dynamic>>();
  final first = phases.firstOrNull;
  final acc = _account(
    id: 3200,
    challengeId: 1060,
    phaseIndex: 0,
    phase: first == null ? 'Funded' : first['name'] as String,
    funded: first == null,
    login: 80520391,
    status: 'active',
    initial: size,
    targetPct: first == null ? null : first['target'] as num,
    minDays: first == null ? 0 : first['minDays'] as int,
    timeLimitDays: first == null ? 0 : first['timeLimit'] as int,
    startedAt: now,
    balance: size,
    equity: size,
    tradingDays: 0,
  );
  return (
    200,
    {
      'challenge': {
        'id': 1060,
        'traderName': 'Arjun Mehta',
        'planId': plan['id'],
        'planName': plan['name'],
        'type': plan['type'],
        'size': size,
        'fee': s['fee'],
        'leverage': s['leverage'],
        'group': 'prop',
        'status': first == null ? 'funded' : 'active',
        'phaseIndex': 0,
        'feeRefunded': false,
        'split': plan['split'],
        'failureReason': null,
        'createdAt': _iso(now),
        'plan': plan,
        'phases': [acc],
        'current': acc,
      },
      'credentials': {'login': 80520391, 'password': 'Kx7#pQ2v!mR9', 'investorPassword': 'iN4\$wT8zLq'},
    },
  );
}
