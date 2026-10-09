// Sample answers for the staking screens (previews, the in-app demo and widget tests; shapes of the real API:
// services/staking/README.md through apps/crm/app/api/staking/[[...path]]/route.ts). Four plans (two open with
// settled months, one full and new, one paused) and the sample client's positions: Stable 3M and Growth 6M active, an
// older Stable 3M matured, a Growth 6M whose payment failed. Months and dates are relative to now; figures are fixed.
// Subscribing checks the limits and the sample wallet (3,000.40 USDT) like the service.

// Return null for paths this module doesn't own.
(int, Object)? previewStaking(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  if (!path.startsWith('staking/')) return null;
  final p = path.substring(8).split('/');
  final now = DateTime.now().toUtc();
  Map<String, dynamic> error(String code, String message) => {
    'error': {'code': code, 'message': message},
  };

  if (method == 'GET' && p.length == 1) {
    switch (p[0]) {
      case 'plans':
        return (
          200,
          {
            'plans': _plans(now),
            'currencies': ['USDT'],
            'currentPeriod': _period(now, 0),
            'nextPayoutAfter': _monthStart(now, 1).toIso8601String(),
            'serverTime': now.toIso8601String(),
          },
        );
      case 'portfolio':
        return (200, _portfolio(now));
      case 'history':
        final page = int.tryParse(query['page'] ?? '') ?? 1;
        final limit = int.tryParse(query['limit'] ?? '') ?? 20;
        final all = _history(now);
        final items = all.skip((page - 1) * limit).take(limit).toList();
        return (200, {'items': items, 'total': all.length, 'page': page, 'limit': limit});
      case 'positions':
        return (200, {'positions': _positions(now)});
    }
    return (404, error('not_found', 'Not found.'));
  }

  if (method == 'GET' && p.length == 2 && p[0] == 'positions') {
    final id = int.tryParse(p[1]);
    final pos = _positions(now).where((x) => x['id'] == id).firstOrNull;
    if (pos == null) return (404, error('not_found', 'Not found.'));
    final plan = _plans(now).firstWhere((x) => x['id'] == pos['planId']);
    return (200, {'position': pos, 'terms': _terms(plan), 'returns': _returns(now, id!)});
  }

  if (method == 'POST' && p.length == 1 && p[0] == 'positions') return _subscribe(now, body);
  return (404, error('not_found', 'Not found.'));
}

/* ------------------------------------------------------------------ dates */

/// "YYYY-MM" of the month `back` months before now (0: this month).
String _period(DateTime now, int back) {
  final d = DateTime.utc(now.year, now.month - back);
  return '${d.year}-${d.month.toString().padLeft(2, '0')}';
}

DateTime _monthStart(DateTime now, int ahead) => DateTime.utc(now.year, now.month + ahead).subtract(const Duration(hours: 3));

DateTime _addMonths(DateTime d, int months) {
  final last = DateTime.utc(d.year, d.month + months + 1, 0).day;
  return DateTime.utc(d.year, d.month + months, d.day < last ? d.day : last, d.hour, d.minute);
}

/* ------------------------------------------------------------------ plans */

const _riskStable =
    'Returns are set by the broker each month and can be zero. Your principal is locked for three months and is returned to your wallet at maturity. Staking is not a bank deposit and is not covered by any deposit guarantee scheme.';
const _riskGrowth =
    'Returns depend on the broker\'s results and are set after each month; they can be zero. Your principal is locked for six months with no early withdrawal. Only stake funds you can leave untouched for the whole term.';

List<Map<String, dynamic>> _plans(DateTime now) => [
  {
    'id': 1,
    'name': 'Stable 3M',
    'currency': 'USDT',
    'status': 'active',
    'termMonths': 3,
    'minAmount': 100,
    'maxAmount': 50000,
    'perUserMax': 100000,
    'capacityLeft': 742500,
    'full': false,
    'invested': 1000,
    'maxNow': 50000,
    'description': 'A short term with a steady monthly return. Your USDT is locked for three months, then returns to your wallet.',
    'riskText': _riskStable,
    'version': 3,
    'recentRates': [
      {'period': _period(now, 3), 'ratePct': 0.78},
      {'period': _period(now, 2), 'ratePct': 0.92},
      {'period': _period(now, 1), 'ratePct': 0.85},
    ],
  },
  {
    'id': 2,
    'name': 'Growth 6M',
    'currency': 'USDT',
    'status': 'active',
    'termMonths': 6,
    'minAmount': 500,
    'maxAmount': null,
    'perUserMax': 25000,
    'capacityLeft': 120000,
    'full': false,
    'invested': 2500,
    'maxNow': 22500,
    'description': 'A longer lock for a higher monthly return. Returns are credited each month after the month is settled.',
    'riskText': _riskGrowth,
    'version': 2,
    'recentRates': [
      {'period': _period(now, 4), 'ratePct': 1.10},
      {'period': _period(now, 3), 'ratePct': 1.20},
      {'period': _period(now, 2), 'ratePct': 1.05},
      {'period': _period(now, 1), 'ratePct': 1.25},
    ],
  },
  {
    'id': 3,
    'name': 'Prime 12M',
    'currency': 'USDT',
    'status': 'active',
    'termMonths': 12,
    'minAmount': 1000,
    'maxAmount': 100000,
    'perUserMax': null,
    'capacityLeft': 0,
    'full': true,
    'invested': 0,
    'maxNow': 0,
    'description': 'Twelve months, for clients who plan to hold.',
    'riskText': 'Returns are not guaranteed and can be zero. Your principal is locked for twelve months.',
    'version': 1,
    'recentRates': <Object>[],
  },
  {
    'id': 4,
    'name': 'Starter 1M',
    'currency': 'USDT',
    'status': 'paused',
    'termMonths': 1,
    'minAmount': 50,
    'maxAmount': 5000,
    'perUserMax': 5000,
    'capacityLeft': 40000,
    'full': false,
    'invested': 0,
    'maxNow': 5000,
    'description': 'One month to try staking.',
    'riskText': 'Returns are not guaranteed and can be zero. Your principal is locked for one month.',
    'version': 1,
    'recentRates': [
      {'period': _period(now, 1), 'ratePct': 0.40},
    ],
  },
];

Map<String, dynamic> _terms(Map<String, dynamic> plan) => {
  'name': plan['name'],
  'termMonths': plan['termMonths'],
  'currency': plan['currency'],
  'minAmount': plan['minAmount'],
  'maxAmount': plan['maxAmount'],
  'description': plan['description'],
  'riskText': plan['riskText'],
};

/* ------------------------------------------------------------------ positions */

Map<String, dynamic> _position(
  DateTime now, {
  required int id,
  required int planId,
  required String planName,
  required int term,
  required double principal,
  required String status,
  required int daysAgo,
  double returnsPaid = 0,
  Map<String, dynamic>? lastReturn,
  String? failureReason,
}) {
  final created = now.subtract(Duration(days: daysAgo));
  final started = status == 'active' || status == 'matured' ? created : null;
  final matures = started == null ? null : _addMonths(started, term);
  final total = matures == null ? 0 : matures.difference(started!).inDays;
  final elapsed = started == null ? 0 : now.difference(started).inDays.clamp(0, total);
  return {
    'id': id,
    'planId': planId,
    'planName': planName,
    'currency': 'USDT',
    'termMonths': term,
    'principal': principal,
    'status': status,
    'startedAt': started?.toIso8601String(),
    'maturesAt': matures?.toIso8601String(),
    'maturedAt': status == 'matured' ? matures?.toIso8601String() : null,
    'returnsPaid': returnsPaid,
    'daysTotal': total,
    'daysElapsed': elapsed,
    'failureReason': failureReason,
    'lastReturn': lastReturn,
    'termsAcceptedAt': created.toIso8601String(),
    'riskAcknowledgedAt': created.toIso8601String(),
    'createdAt': created.toIso8601String(),
  };
}

List<Map<String, dynamic>> _positions(DateTime now) => [
  _position(
    now,
    id: 1051,
    planId: 2,
    planName: 'Growth 6M',
    term: 6,
    principal: 2500,
    status: 'active',
    daysAgo: 75,
    returnsPaid: 52.75,
    lastReturn: {'period': _period(now, 1), 'ratePct': 1.25, 'amount': 31.25},
  ),
  _position(
    now,
    id: 1042,
    planId: 1,
    planName: 'Stable 3M',
    term: 3,
    principal: 1000,
    status: 'active',
    daysAgo: 40,
    returnsPaid: 8.2,
    lastReturn: {'period': _period(now, 1), 'ratePct': 0.85, 'amount': 8.2},
  ),
  _position(
    now,
    id: 1063,
    planId: 2,
    planName: 'Growth 6M',
    term: 6,
    principal: 4000,
    status: 'payment_failed',
    daysAgo: 12,
    failureReason: 'Your USDT wallet balance is too low.',
  ),
  _position(
    now,
    id: 987,
    planId: 1,
    planName: 'Stable 3M',
    term: 3,
    principal: 500,
    status: 'matured',
    daysAgo: 130,
    returnsPaid: 12.4,
    lastReturn: {'period': _period(now, 2), 'ratePct': 0.92, 'amount': 4.6},
  ),
];

List<Map<String, dynamic>> _returns(DateTime now, int id) {
  Map<String, dynamic> r(int back, double rate, int days, int inMonth, double amount, {String status = 'paid'}) => {
    'period': _period(now, back),
    'ratePct': rate,
    'daysActive': days,
    'daysInMonth': inMonth,
    'amount': amount,
    'status': status,
    'paidAt': status == 'paid' ? _monthStart(now, 1 - back).add(const Duration(days: 4)).toIso8601String() : null,
  };
  return switch (id) {
    1051 => [r(2, 1.05, 25, 31, 21.5), r(1, 1.25, 30, 30, 31.25)],
    1042 => [r(1, 0.85, 29, 30, 8.2)],
    987 => [r(4, 0.8, 18, 31, 2.32), r(3, 0.78, 31, 31, 3.9), r(2, 0.92, 30, 30, 4.6), r(1, 0.85, 10, 31, 1.58, status: 'processing')],
    _ => <Map<String, dynamic>>[],
  };
}

/* ------------------------------------------------------------------ portfolio, history */

Map<String, dynamic> _portfolio(DateTime now) {
  final positions = _positions(now);
  final next = positions.where((p) => p['status'] == 'active').toList()..sort((a, b) => '${a['maturesAt']}'.compareTo('${b['maturesAt']}'));
  return {
    'summary': {
      'currency': 'USDT',
      'invested': 3500,
      'pending': 0,
      'returnsPaid': 73.35,
      'returnsThisYear': 73.35,
      'activePositions': 2,
      'nextPayout': {'period': _period(now, 0), 'after': _monthStart(now, 1).toIso8601String()},
      'nextMaturity': next.isEmpty
          ? null
          : {'positionId': next.first['id'], 'planName': next.first['planName'], 'date': next.first['maturesAt'], 'principal': next.first['principal']},
    },
    'positions': positions,
    'monthly': [
      {'period': _period(now, 5), 'amount': 3.95},
      {'period': _period(now, 4), 'amount': 8.45},
      {'period': _period(now, 3), 'amount': 18.2},
      {'period': _period(now, 2), 'amount': 21.55},
      {'period': _period(now, 1), 'amount': 21.2},
    ],
    'serverTime': now.toIso8601String(),
  };
}

List<Map<String, dynamic>> _history(DateTime now) {
  Map<String, dynamic> e(String kind, int daysAgo, int positionId, String plan, double amount, {int? back, double? rate, int? days}) => {
    'kind': kind,
    'at': now.subtract(Duration(days: daysAgo, hours: 5)).toIso8601String(),
    'positionId': positionId,
    'planName': plan,
    'amount': amount,
    'currency': 'USDT',
    'period': back == null ? null : _period(now, back),
    'ratePct': rate,
    'days': days,
  };
  // returns are paid a few days into the next month
  final paid = now.day < 5 ? 5 : now.day + 1;
  return [
    e('reward', paid - 4, 1051, 'Growth 6M', 31.25, back: 1, rate: 1.25, days: 30),
    e('reward', paid - 4, 1042, 'Stable 3M', 8.2, back: 1, rate: 0.85, days: 29),
    e('payment_failed', 12, 1063, 'Growth 6M', 4000),
    e('principal', 38, 987, 'Stable 3M', 500),
    e('subscribe', 40, 1042, 'Stable 3M', 1000),
    e('reward', paid + 26, 1051, 'Growth 6M', 21.5, back: 2, rate: 1.05, days: 25),
    e('reward', paid + 26, 987, 'Stable 3M', 4.6, back: 2, rate: 0.92, days: 30),
    e('subscribe', 75, 1051, 'Growth 6M', 2500),
    e('reward', paid + 57, 987, 'Stable 3M', 3.9, back: 3, rate: 0.78, days: 31),
    e('reward', paid + 87, 987, 'Stable 3M', 2.32, back: 4, rate: 0.8, days: 18),
    e('subscribe', 130, 987, 'Stable 3M', 500),
  ]..sort((a, b) => '${b['at']}'.compareTo('${a['at']}'));
}

/* ------------------------------------------------------------------ subscribe */

const double _wallet = 3000.40;

(int, Object) _subscribe(DateTime now, Map<String, dynamic> body) {
  Map<String, dynamic> error(String code, String message) => {
    'error': {'code': code, 'message': message},
  };
  final plan = _plans(now).where((x) => x['id'] == body['planId']).firstOrNull;
  final key = '${body['idempotencyKey'] ?? ''}';
  if (key.isEmpty || key.length > 80 || !RegExp(r'^[A-Za-z0-9_-]+$').hasMatch(key)) {
    return (400, error('invalid', 'idempotencyKey: 1–80 letters, digits, - or _'));
  }
  if (body['acceptTerms'] != true) return (422, error('terms_required', 'Accept the plan terms to subscribe.'));
  if (body['acceptRisk'] != true) return (422, error('risk_ack_required', 'Confirm that you understand the risks.'));
  final amount = double.tryParse('${body['amount']}') ?? 0;
  if (amount <= 0) return (400, error('invalid', 'Enter the amount to invest.'));
  if (plan == null || plan['status'] != 'active') return (422, error('plan_unavailable', "This plan isn't open for new subscriptions."));
  if (plan['full'] == true) return (422, error('capacity_reached', 'This plan is full.'));
  if (amount < (plan['minAmount'] as num)) return (422, error('below_minimum', 'The minimum for this plan is ${plan['minAmount']} USDT.'));
  final max = plan['maxAmount'] as num?;
  if (max != null && amount > max) return (422, error('above_maximum', 'The maximum per subscription is $max USDT.'));
  final room = plan['maxNow'] as num?;
  if (room != null && amount > room) return (422, error('user_limit', 'This is more than your limit for this plan.'));
  if (amount > _wallet) return (422, error('insufficient_funds', 'Your USDT wallet balance is too low.'));
  final term = plan['termMonths'] as int;
  final pos = _position(now, id: 1077, planId: plan['id'] as int, planName: '${plan['name']}', term: term, principal: amount, status: 'active', daysAgo: 0);
  return (200, {'position': pos, 'terms': _terms(plan), 'returns': <Object>[]});
}
