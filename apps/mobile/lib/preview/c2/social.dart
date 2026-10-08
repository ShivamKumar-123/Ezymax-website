// Sample answers for the Copy & PAMM screens (previews and widget tests only). Shapes of the real API: the engine's
// social routes (services/trading README "Social API" and "MAM") through apps/crm/app/api/social/[...path]/route.ts
// and lib/mam-bff.ts, typed in apps/crm/components/social-live/api.ts and mam-api.ts.
//   GET   social/leaderboard · masters/{id}[?invite] · masters/{id}/preview · symbols · subscriptions ·
//         subscriptions/{id} · subscriptions/{id}/execution · funds · funds/{id} · funds/{id}/statement · investments ·
//         master/me · master/dashboard · mam/managers · mam/managers/{id} · mam/links · mam/links/{id} · mam/manager ·
//         mam/manager/preview
//   POST  social/subscriptions · subscriptions/{id}/stop · …/funds · …/accept-terms · funds · funds/{id}/invest ·
//         funds/{id}/redeem · requests/{id}/cancel · master/apply · master/announcements · mam/links ·
//         mam/links/{id}/revoke · mam/manager
//   PATCH social/subscriptions/{id} · funds/{id} · investments/{fundId} · master/me · mam/links/{id} · mam/manager ·
//         mam/manager/links/{id}
// The sample client (Arjun Mehta) copies three masters (one paused, one with new terms to accept) and stopped a
// fourth, holds two PAMM funds with requests pending, is an approved master himself ("Arjun Macro", with a PAMM fund)
// running a MAM programme, and has one account managed by a MAM programme. Writes change the sample state, so a
// screen shows the result after its reload. Dates are relative to now; every figure is fixed.
import 'dart:math' as math;

/* ------------------------------------------------------------------ switches */

/// The sample client is an approved master (web preview URL `?socialMaster=0` shows the application instead).
bool _isMaster = Uri.base.queryParameters['socialMaster'] != '0';

/// …running a MAM programme (`?mamProgramme=0` shows the "open a programme" form).
bool _hasProgramme = Uri.base.queryParameters['mamProgramme'] != '0';

/// Tests start from the sample state (optionally as a client who isn't a master / has no MAM programme yet).
void resetPreviewSocial({bool master = true, bool programme = true}) {
  _isMaster = master;
  _hasProgramme = programme;
  _state = null;
}

_State? _state;
_State get _s => _state ??= _State();

/* ------------------------------------------------------------------ helpers */

DateTime get _now => DateTime.now().toUtc();
String _iso(DateTime d) => d.toIso8601String();
String _ago(Duration d) => _iso(_now.subtract(d));
String _in(Duration d) => _iso(_now.add(d));
String _pad2(int v) => v.toString().padLeft(2, '0');
String _ymd(DateTime d) => '${d.year}-${_pad2(d.month)}-${_pad2(d.day)}';
double _r2(num v) => (v * 100).round() / 100;
double _r4(num v) => (v * 10000).round() / 10000;

Map<String, dynamic> _err(String code, String message, [Map<String, dynamic> extra = const {}]) => {
  'error': {'code': code, 'message': message, ...extra},
};
(int, Object) _notFound() => (404, _err('not_found', 'Not found.'));

/// Midnight server time (GMT+3) is 21:00 UTC: the next daily / weekly (Monday) / monthly (the 1st) rollover.
String _nextRollover(String period) {
  final n = _now;
  var d = DateTime.utc(n.year, n.month, n.day, 21);
  if (period == 'monthly') {
    d = DateTime.utc(n.year, n.month + 1).subtract(const Duration(hours: 3));
    if (!d.isAfter(n)) d = DateTime.utc(n.year, n.month + 2).subtract(const Duration(hours: 3));
    return _iso(d);
  }
  if (!d.isAfter(n)) d = d.add(const Duration(days: 1));
  if (period == 'weekly') {
    while (d.weekday != DateTime.sunday) {
      d = d.add(const Duration(days: 1));
    }
  }
  return _iso(d);
}

String _lastRollover(String period) {
  final next = DateTime.parse(_nextRollover(period));
  return _iso(switch (period) {
    'daily' => next.subtract(const Duration(days: 1)),
    'weekly' => next.subtract(const Duration(days: 7)),
    _ => () {
      final nb = next.add(const Duration(hours: 3));
      return DateTime.utc(nb.year, nb.month - 1).subtract(const Duration(hours: 3));
    }(),
  });
}

/// A small deterministic generator (the same figures on every run).
class _Rng {
  _Rng(int seed) : _v = seed * 7919 + 17;
  int _v;
  double next() {
    _v = (_v * 1103515245 + 12345) & 0x7fffffff;
    return _v / 0x7fffffff;
  }
}

/// Price, notional of one lot in USD and price digits of the symbols the masters trade.
const Map<String, (double, double, int)> _px = {
  'EURUSD': (1.08420, 100000, 5),
  'GBPUSD': (1.34180, 100000, 5),
  'USDJPY': (149.320, 100000, 3),
  'AUDUSD': (0.66840, 100000, 5),
  'NZDUSD': (0.60120, 100000, 5),
  'USDCHF': (0.86310, 100000, 5),
  'EURGBP': (0.83460, 100000, 5),
  'EURCHF': (0.93580, 100000, 5),
  'AUDJPY': (99.840, 100000, 3),
  'EURJPY': (161.880, 100000, 3),
  'GBPJPY': (200.360, 100000, 3),
  'XAUUSD': (2658.40, 265840, 2),
  'XAGUSD': (31.420, 157100, 3),
  'USOIL': (71.840, 71840, 2),
  'US500': (5742.6, 57426, 1),
  'NAS100': (20118.4, 40236, 1),
  'US30': (42210.0, 42210, 1),
  'GER40': (19284.0, 38568, 1),
  'BTCUSD': (67020.0, 67020, 1),
  'ETHUSD': (2640.50, 26405, 2),
};

double _round(double v, int digits) {
  final f = math.pow(10, digits);
  return (v * f).round() / f;
}

/* ------------------------------------------------------------------ masters */

typedef _Seed = ({
  int id,
  String nick,
  String strategy,
  String desc,
  String program,
  num fee,
  String period,
  num minAlloc,
  int age,
  num r1m,
  num r3m,
  num r1y,
  num rAll,
  num maxDd,
  num curDd,
  num vol,
  int risk,
  num equity,
  num aum,
  int followers,
  int investors,
  int trades,
  num win,
  bool house,
  bool accepting,
  int? maxFollowers,
  int? fund,
  bool inviteOnly,
  List<String> symbols,
  num lot,
});

const int _ownMasterId = 120;
const int _ownMasterLogin = 10044120;
const String _invite = 'ALPHA7KX';
const num _platformMin = 100;
const num _platformCut = 20;

const List<_Seed> _seeds = [
  (
    id: 101,
    nick: 'AlphaWave',
    strategy: 'Trend following on the majors, H4',
    desc: 'Rule-based trend entries on EUR, GBP, JPY and gold. Every trade carries a stop; no grid, no martingale. Typical holding time two to five days.',
    program: 'both',
    fee: 20,
    period: 'monthly',
    minAlloc: 100,
    age: 812,
    r1m: 3.8,
    r3m: 12.4,
    r1y: 41.7,
    rAll: 96.3,
    maxDd: 14.2,
    curDd: 3.1,
    vol: 9.8,
    risk: 4,
    equity: 84250,
    aum: 1284000,
    followers: 642,
    investors: 118,
    trades: 1904,
    win: 61.2,
    house: false,
    accepting: true,
    maxFollowers: null,
    fund: 501,
    inviteOnly: false,
    symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'AUDUSD'],
    lot: 2,
  ),
  (
    id: 102,
    nick: 'GoldSmith FX',
    strategy: 'Gold breakouts at the London and New York opens',
    desc: 'Breakout entries on gold and silver around the session opens, partial profits at 1R and a trailing stop on the rest.',
    program: 'copy',
    fee: 25,
    period: 'weekly',
    minAlloc: 200,
    age: 540,
    r1m: 6.9,
    r3m: 18.6,
    r1y: 52.3,
    rAll: 88.1,
    maxDd: 27.5,
    curDd: 8.4,
    vol: 18.7,
    risk: 7,
    equity: 42100,
    aum: 612500,
    followers: 389,
    investors: 0,
    trades: 2611,
    win: 54.8,
    house: false,
    accepting: true,
    maxFollowers: null,
    fund: null,
    inviteOnly: false,
    symbols: ['XAUUSD', 'XAGUSD', 'EURUSD'],
    lot: 1,
  ),
  (
    id: 103,
    nick: 'Steady Carry',
    strategy: 'Low-risk carry and mean reversion on the majors',
    desc: 'Small positions held for the swap and mean reversion on range-bound majors. Risk per trade below 0.5 % of equity.',
    program: 'copy',
    fee: 15,
    period: 'monthly',
    minAlloc: 100,
    age: 1095,
    r1m: 1.2,
    r3m: 4.1,
    r1y: 15.8,
    rAll: 49.2,
    maxDd: 6.3,
    curDd: 1.0,
    vol: 4.2,
    risk: 2,
    equity: 128400,
    aum: 2042000,
    followers: 1208,
    investors: 0,
    trades: 3402,
    win: 72.4,
    house: false,
    accepting: true,
    maxFollowers: null,
    fund: null,
    inviteOnly: false,
    symbols: ['AUDJPY', 'NZDUSD', 'EURUSD', 'USDCHF', 'EURGBP'],
    lot: 3,
  ),
  (
    id: 104,
    nick: 'Kalks Quant Desk',
    strategy: 'Automated multi-asset momentum',
    desc: 'A systematic momentum model across FX, gold, oil and US indices, rebalanced daily. Operated by Kalks.',
    program: 'copy',
    fee: 10,
    period: 'monthly',
    minAlloc: 100,
    age: 410,
    r1m: 2.4,
    r3m: 7.9,
    r1y: 22.6,
    rAll: 31.0,
    maxDd: 9.1,
    curDd: 2.2,
    vol: 6.5,
    risk: 3,
    equity: 250000,
    aum: 3480000,
    followers: 1940,
    investors: 0,
    trades: 5820,
    win: 58.3,
    house: true,
    accepting: true,
    maxFollowers: null,
    fund: null,
    inviteOnly: false,
    symbols: ['US500', 'EURUSD', 'XAUUSD', 'USDJPY', 'USOIL', 'BTCUSD'],
    lot: 4,
  ),
  (
    id: 105,
    nick: 'Nordic Swing',
    strategy: 'Swing trading EUR and GBP crosses',
    desc: 'Weekly swing positions on the European crosses, managed as one PAMM fund with a weekly rollover.',
    program: 'pamm',
    fee: 20,
    period: 'weekly',
    minAlloc: 250,
    age: 690,
    r1m: 2.9,
    r3m: 9.6,
    r1y: 28.4,
    rAll: 64.7,
    maxDd: 11.8,
    curDd: 4.6,
    vol: 8.1,
    risk: 4,
    equity: 64000,
    aum: 948000,
    followers: 0,
    investors: 214,
    trades: 1120,
    win: 63.0,
    house: false,
    accepting: true,
    maxFollowers: null,
    fund: 502,
    inviteOnly: false,
    symbols: ['EURGBP', 'GBPJPY', 'EURCHF', 'GBPUSD'],
    lot: 5,
  ),
  (
    id: 106,
    nick: 'Tokyo Scalper',
    strategy: 'Asian-session scalping on the yen pairs',
    desc: 'Short intraday trades during the Tokyo session on USDJPY and the yen crosses. Many trades, small targets.',
    program: 'copy',
    fee: 30,
    period: 'weekly',
    minAlloc: 250,
    age: 365,
    r1m: -2.1,
    r3m: 5.3,
    r1y: 33.9,
    rAll: 47.5,
    maxDd: 19.4,
    curDd: 6.8,
    vol: 14.2,
    risk: 6,
    equity: 31800,
    aum: 402000,
    followers: 250,
    investors: 0,
    trades: 6240,
    win: 66.1,
    house: false,
    accepting: false,
    maxFollowers: 250,
    fund: null,
    inviteOnly: false,
    symbols: ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY'],
    lot: 1.5,
  ),
  (
    id: 107,
    nick: 'IndexPilot',
    strategy: 'US indices, intraday and overnight',
    desc: 'Index futures-style trading on the S&P 500, Nasdaq 100 and Dow, flat before major data releases.',
    program: 'both',
    fee: 20,
    period: 'monthly',
    minAlloc: 150,
    age: 300,
    r1m: 4.5,
    r3m: 10.2,
    r1y: 26.1,
    rAll: 26.1,
    maxDd: 16.0,
    curDd: 5.2,
    vol: 11.4,
    risk: 5,
    equity: 56300,
    aum: 721000,
    followers: 301,
    investors: 96,
    trades: 1480,
    win: 57.9,
    house: false,
    accepting: true,
    maxFollowers: 400,
    fund: 503,
    inviteOnly: false,
    symbols: ['US500', 'NAS100', 'US30', 'GER40'],
    lot: 2,
  ),
  (
    id: 108,
    nick: 'Momentum Lab',
    strategy: 'Crypto and FX momentum, small sizes',
    desc: 'Momentum breakouts on Bitcoin, Ether and cable. A young track record with high volatility.',
    program: 'both',
    fee: 25,
    period: 'monthly',
    minAlloc: 100,
    age: 120,
    r1m: -4.8,
    r3m: -1.9,
    r1y: 18.4,
    rAll: 18.4,
    maxDd: 31.2,
    curDd: 12.6,
    vol: 22.9,
    risk: 8,
    equity: 12400,
    aum: 98000,
    followers: 77,
    investors: 19,
    trades: 860,
    win: 49.2,
    house: false,
    accepting: true,
    maxFollowers: null,
    fund: 505,
    inviteOnly: false,
    symbols: ['BTCUSD', 'ETHUSD', 'GBPUSD', 'XAUUSD'],
    lot: 0.5,
  ),
  (
    id: 109,
    nick: 'Private Alpha',
    strategy: 'Macro positions for invited followers',
    desc: 'Concentrated macro trades shared with a small group through a private link.',
    program: 'copy',
    fee: 20,
    period: 'monthly',
    minAlloc: 1000,
    age: 460,
    r1m: 1.9,
    r3m: 6.2,
    r1y: 24.8,
    rAll: 37.6,
    maxDd: 10.4,
    curDd: 2.0,
    vol: 7.7,
    risk: 4,
    equity: 96000,
    aum: 310000,
    followers: 42,
    investors: 0,
    trades: 640,
    win: 60.4,
    house: false,
    accepting: true,
    maxFollowers: 60,
    fund: null,
    inviteOnly: true,
    symbols: ['EURUSD', 'USDJPY', 'XAUUSD', 'US500'],
    lot: 3,
  ),
  (
    id: _ownMasterId,
    nick: 'Arjun Macro',
    strategy: 'Macro swing trades on the majors and gold',
    desc: 'Swing positions on EURUSD, GBPUSD, USDJPY and gold around central-bank cycles. Risk per trade capped at 1 %.',
    program: 'both',
    fee: 20,
    period: 'monthly',
    minAlloc: 200,
    age: 220,
    r1m: 2.2,
    r3m: 6.8,
    r1y: 19.4,
    rAll: 19.4,
    maxDd: 9.6,
    curDd: 2.4,
    vol: 7.4,
    risk: 4,
    equity: 18420,
    aum: 96300,
    followers: 38,
    investors: 12,
    trades: 412,
    win: 59.5,
    house: false,
    accepting: true,
    maxFollowers: null,
    fund: 504,
    inviteOnly: false,
    symbols: ['EURUSD', 'XAUUSD', 'GBPUSD', 'USDJPY'],
    lot: 1,
  ),
];

_Seed? _seed(int id) => _seeds.where((s) => s.id == id).firstOrNull;

/// The equity index since inception (1.0 at the start, 1 + returnAll at the end), with drawdowns along the way.
List<(DateTime, double)> _curve(_Seed s) {
  final r = _Rng(s.id);
  final end = 1 + s.rAll / 100;
  final today = DateTime.utc(_now.year, _now.month, _now.day);
  final step = s.age > 400 ? 3 : (s.age > 200 ? 2 : 1);
  final out = <(DateTime, double)>[];
  var wobble = 0.0;
  for (var d = s.age; d >= 0; d--) {
    if (d > 92 && d % step != 0) continue;
    final x = (s.age - d) / s.age;
    wobble = wobble * 0.92 + (r.next() - 0.5) * s.vol / 260;
    final dip = math.sin(x * math.pi * 3.3 + s.id) * s.maxDd / 260;
    final v = math.pow(end, x) * (1 + (wobble + dip) * (x * (1 - x) * 4));
    out.add((today.subtract(Duration(days: d)), _r4(v)));
  }
  return out;
}

List<double> _spark(_Seed s) {
  final c = _curve(s);
  final from = math.max(0, c.length - 60);
  final tail = c.sublist(from);
  return [for (var i = 0; i < tail.length; i += 2) tail[i].$2];
}

Map<String, dynamic> _fundCard(int id) {
  final f = _fundSeed(id)!;
  return {'id': f.id, 'name': f.name, 'nav': f.nav, 'period': f.period, 'perfFeePct': f.fee, 'lockInDays': f.lock, 'minInvestment': f.min, 'status': f.status};
}

Map<String, dynamic> _masterView(_Seed s, {bool private = false}) {
  final own = s.id == _ownMasterId;
  final m = <String, dynamic>{
    'id': s.id,
    'nickname': s.nick,
    'strategy': s.strategy,
    'description': s.desc,
    'program': s.program,
    'perfFeePct': own ? _s.ownFee : s.fee,
    'feePeriod': own ? _s.ownPeriod : s.period,
    'minAllocation': s.minAlloc,
    'status': 'approved',
    'hidden': false,
    'frozen': false,
    'since': _ago(Duration(days: s.age)),
    'ageDays': s.age,
    'stats': {
      'return1m': s.r1m,
      'return3m': s.r3m,
      'return1y': s.r1y,
      'returnAll': s.rAll,
      'maxDd': s.maxDd,
      'currentDd': s.curDd,
      'volatility': s.vol,
      'riskScore': s.risk,
      'equity': s.equity,
      'aum': s.aum,
      'followers': s.followers,
      'investors': s.investors,
      'trades': s.trades,
      'winRate': s.win,
      'spark': _spark(s),
    },
    'fund': s.fund == null ? null : _fundCard(s.fund!),
    'house': s.house,
    'acceptingNew': own ? _s.ownAcceptNew : s.accepting,
    'inviteOnly': s.inviteOnly,
    'maxFollowers': own ? _s.ownMaxFollowers : s.maxFollowers,
    'minAllocationEffective': math.max(_platformMin, s.minAlloc),
  };
  if (private) {
    m.addAll({
      'nickname': _s.ownNick,
      'strategy': _s.ownStrategy,
      'description': _s.ownDesc,
      'minAllocation': _s.ownMinAlloc,
      'acceptNew': _s.ownAcceptNew,
      'inviteCode': _s.ownInvite,
      'inviteOnly': _s.ownInvite != null,
      'login': _ownMasterLogin,
      'kycVerified': true,
      'reviewNote': null,
      'createdAt': _ago(Duration(days: s.age + 6)),
    });
  }
  return m;
}

double _ret(_Seed s, String period) => switch (period) {
  '1m' => s.r1m.toDouble(),
  '1y' => s.r1y.toDouble(),
  'all' => s.rAll.toDouble(),
  _ => s.r3m.toDouble(),
};

(int, Object) _leaderboard(Map<String, String> q) {
  final visible = _seeds.where((s) => !s.inviteOnly).toList();
  final period = q['period'] ?? '3m';
  final program = q['program'] ?? 'all';
  final risk = q['risk'] ?? 'all';
  final minDays = int.tryParse(q['minDays'] ?? '') ?? 0;
  final maxDd = num.tryParse(q['maxDd'] ?? '');
  final maxFee = num.tryParse(q['maxFee'] ?? '');
  final minFollowers = int.tryParse(q['minFollowers'] ?? '') ?? 0;
  final openOnly = q['openOnly'] == 'true';
  final rows = visible.where((s) {
    if (program == 'copy' && s.program == 'pamm') return false;
    if (program == 'pamm' && (s.program == 'copy' || s.fund == null)) return false;
    if (risk == 'low' && s.risk > 3) return false;
    if (risk == 'med' && (s.risk < 4 || s.risk > 6)) return false;
    if (risk == 'high' && s.risk < 7) return false;
    if (s.age < minDays) return false;
    if (maxDd != null && s.maxDd > maxDd) return false;
    if (maxFee != null && s.fee > maxFee) return false;
    if (s.followers < minFollowers) return false;
    if (openOnly && (!s.accepting || s.program == 'pamm')) return false;
    return true;
  }).toList();
  rows.sort(
    (a, b) => switch (q['sort'] ?? 'return') {
      'dd' => a.maxDd.compareTo(b.maxDd),
      'aum' => b.aum.compareTo(a.aum),
      'followers' => b.followers.compareTo(a.followers),
      'age' => b.age.compareTo(a.age),
      _ => _ret(b, period).compareTo(_ret(a, period)),
    },
  );
  return (
    200,
    {
      'items': [for (final s in rows) _masterView(s)],
      'totals': {
        'masters': visible.length,
        'aum': visible.fold<num>(0, (a, s) => a + s.aum),
        'followers': visible.fold<int>(0, (a, s) => a + s.followers),
        'investors': visible.fold<int>(0, (a, s) => a + s.investors),
      },
    },
  );
}

List<Map<String, dynamic>> _masterTrades(_Seed s) {
  final r = _Rng(s.id * 31);
  final out = <Map<String, dynamic>>[];
  var close = _now.subtract(const Duration(minutes: 45));
  for (var i = 0; i < 24; i++) {
    final sym = s.symbols[(i * 3 + i ~/ 2) % s.symbols.length];
    final (base, notional, digits) = _px[sym]!;
    final buy = r.next() < 0.55;
    final volume = _r2(s.lot * (0.4 + r.next() * 0.8));
    final open = _round(base * (1 + (r.next() - 0.5) * 0.012), digits);
    final win = r.next() * 100 < s.win;
    final move = (win ? 1 : -0.7) * (0.0008 + r.next() * 0.004);
    final closePrice = _round(open * (1 + (buy ? move : -move)), digits);
    final profit = _r2((buy ? 1 : -1) * (closePrice / open - 1) * volume * notional);
    final held = Duration(minutes: 40 + (r.next() * 60 * 30).round());
    out.add({
      'id': 4000000 + s.id * 1000 + i,
      'symbol': sym,
      'side': buy ? 'buy' : 'sell',
      'volume': volume,
      'openPrice': open,
      'closePrice': closePrice,
      'openTime': _iso(close.subtract(held)),
      'closeTime': _iso(close),
      'profit': profit,
    });
    close = close.subtract(Duration(minutes: 200 + (r.next() * 60 * 14).round()));
  }
  return out;
}

(int, Object) _profile(int id, Map<String, String> q) {
  final s = _seed(id);
  if (s == null) return _notFound();
  if (s.inviteOnly && q['invite'] != _invite) return _notFound();
  final curve = _curve(s);
  final eqEnd = s.equity;
  final endIdx = curve.last.$2;
  final r = _Rng(s.id * 13);
  final months = <Map<String, dynamic>>[];
  final first = DateTime.utc(_now.year, _now.month - math.min(23, s.age ~/ 30));
  for (var m = first; !m.isAfter(_now); m = DateTime.utc(m.year, m.month + 1)) {
    months.add({'month': '${m.year}-${_pad2(m.month)}', 'returnPct': _r2(s.r1y / 12 + (r.next() - 0.45) * (s.vol / 2))});
  }
  final weights = [34, 24, 18, 12, 8, 4];
  final symbols = [
    for (var i = 0; i < s.symbols.length; i++)
      {
        'symbol': s.symbols[i],
        'trades': (s.trades * weights[i] / 100).round(),
        'share': weights[i] + (i == s.symbols.length - 1 ? weights.skip(s.symbols.length).fold<int>(0, (a, w) => a + w) : 0),
      },
  ];
  return (
    200,
    {
      'master': _masterView(s),
      'equity': [
        for (final (d, v) in curve) {'day': _ymd(d), 'equity': _r2(eqEnd * v / endIdx), 'index': v},
      ],
      'monthly': months,
      'trades': _masterTrades(s),
      'symbols': symbols,
      'tradeDelayMinutes': s.house ? 0 : 30,
      'terms': {
        'perfFeePct': s.id == _ownMasterId ? _s.ownFee : s.fee,
        'feePeriod': s.id == _ownMasterId ? _s.ownPeriod : s.period,
        'hwm': true,
        'minAllocation': math.max(_platformMin, s.minAlloc),
        'platformCutPct': _platformCut,
      },
    },
  );
}

/// A9: what following with these settings could cost (GET masters/{id}/preview).
(int, Object) _riskPreview(int id, Map<String, String> q) {
  final s = _seed(id);
  if (s == null || (s.inviteOnly && q['invite'] != _invite)) return _notFound();
  final alloc = double.tryParse(q['allocation'] ?? '');
  if (alloc == null || alloc <= 0) return (400, _err('bad_request', 'Invalid allocation.'));
  final stop = double.tryParse(q['equityStop'] ?? '');
  final dd = double.tryParse(q['maxDdPct'] ?? '');
  final (loss, basis) = stop != null && stop < alloc ? (alloc - stop, 'equity_stop') : (dd != null ? (alloc * dd / 100, 'max_dd') : (alloc, 'allocation'));
  final mode = q['sizing'] ?? 'equity';
  final value = double.tryParse(q['value'] ?? '') ?? 1;
  final example = <Map<String, dynamic>>[];
  for (final t in _masterTrades(s).take(5)) {
    final mv = (t['volume'] as num).toDouble();
    var yv = switch (mode) {
      'fixed_lot' => value,
      'multiplier' => value * mv,
      'allocation' => value / s.equity * mv,
      _ => alloc / s.equity * mv,
    };
    yv = (yv * 100 + 1e-9).floorToDouble() / 100;
    final skipped = yv < 0.01;
    example.add({
      'symbol': t['symbol'],
      'side': t['side'],
      'closeTime': t['closeTime'],
      'masterVolume': mv,
      'masterProfit': t['profit'],
      'yourVolume': skipped ? null : yv,
      'yourProfit': skipped ? null : _r2((t['profit'] as num) * yv / mv),
      'skipped': skipped,
    });
  }
  return (
    200,
    {
      'allocation': alloc,
      'masterEquity': s.equity,
      'worstCase': {'loss': _r2(loss), 'basis': basis, 'pctOfAllocation': _r2(loss / alloc * 100)},
      'master': {'maxDdPct': s.maxDd, 'currentDdPct': s.curDd, 'riskScore': s.risk, 'volatility': s.vol, 'lossAtMaxDd': _r2(alloc * s.maxDd / 100)},
      'example': example,
      'tradeDelayMinutes': s.house ? 0 : 30,
    },
  );
}

const List<String> _symbolList = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'EURCHF', //
  'EURAUD', 'GBPCHF', 'CADJPY', 'XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL', 'NATGAS', 'US500', 'NAS100', 'US30', 'GER40', 'UK100', //
  'JPN225', 'BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD',
];

String _assetClass(String s) => s.startsWith('XA')
    ? 'metals'
    : (s.endsWith('OIL') || s == 'NATGAS'
          ? 'energy'
          : (RegExp(r'\d').hasMatch(s) ? 'indices' : (['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'].contains(s) ? 'crypto' : 'forex')));

/* ------------------------------------------------------------------ PAMM funds */

typedef _FundSeed = ({
  int id,
  int master,
  String name,
  String status,
  String period,
  num fee,
  int lock,
  num min,
  num maxDd,
  num nav,
  num navPeak,
  num aum,
  int investors,
  num r1m,
  num rAll,
  num masterShare,
  int age,
  int login,
});

const List<_FundSeed> _fundSeeds = [
  (
    id: 501,
    master: 101,
    name: 'AlphaWave Growth Fund',
    status: 'active',
    period: 'monthly',
    fee: 20,
    lock: 30,
    min: 500,
    maxDd: 25,
    nav: 1.4826,
    navPeak: 1.5013,
    aum: 486200,
    investors: 118,
    r1m: 2.9,
    rAll: 48.26,
    masterShare: 8.4,
    age: 540,
    login: 10090501,
  ),
  (
    id: 502,
    master: 105,
    name: 'Nordic Swing Fund',
    status: 'active',
    period: 'weekly',
    fee: 20,
    lock: 0,
    min: 250,
    maxDd: 20,
    nav: 1.6472,
    navPeak: 1.6531,
    aum: 948000,
    investors: 214,
    r1m: 2.1,
    rAll: 64.72,
    masterShare: 6.7,
    age: 690,
    login: 10090502,
  ),
  (
    id: 503,
    master: 107,
    name: 'IndexPilot US Indices',
    status: 'active',
    period: 'monthly',
    fee: 20,
    lock: 14,
    min: 300,
    maxDd: 30,
    nav: 1.2610,
    navPeak: 1.2902,
    aum: 214800,
    investors: 96,
    r1m: 3.6,
    rAll: 26.10,
    masterShare: 10.2,
    age: 300,
    login: 10090503,
  ),
  (
    id: 504,
    master: _ownMasterId,
    name: 'Arjun Macro Fund',
    status: 'active',
    period: 'weekly',
    fee: 20,
    lock: 7,
    min: 100,
    maxDd: 25,
    nav: 1.0842,
    navPeak: 1.0918,
    aum: 38450,
    investors: 12,
    r1m: 1.4,
    rAll: 8.42,
    masterShare: 24.0,
    age: 150,
    login: 10090504,
  ),
  (
    id: 505,
    master: 108,
    name: 'Momentum Lab Fund',
    status: 'frozen',
    period: 'daily',
    fee: 25,
    lock: 0,
    min: 100,
    maxDd: 30,
    nav: 0.6880,
    navPeak: 1.0005,
    aum: 41300,
    investors: 19,
    r1m: -6.2,
    rAll: -31.20,
    masterShare: 12.0,
    age: 120,
    login: 10090505,
  ),
];

_FundSeed? _fundSeed(int id) => _fundSeeds.where((f) => f.id == id).firstOrNull;

Map<String, dynamic> _fundView(_FundSeed f) {
  final own = f.master == _ownMasterId;
  final name = own ? _s.ownFundName : f.name;
  final equity = _r2(f.aum / (1 - f.masterShare / 100));
  return {
    'id': f.id,
    'masterId': f.master,
    'master': {'id': f.master, 'nickname': _seed(f.master)!.nick},
    'name': name,
    'status': f.status,
    'period': f.period,
    'perfFeePct': f.fee,
    'lockInDays': f.lock,
    'minInvestment': f.min,
    'maxDdPct': f.maxDd,
    'minOwnPct': 5,
    'nav': f.nav,
    'units': _r4(equity / f.nav),
    'equity': equity,
    'aum': f.aum,
    'investors': f.investors,
    'masterSharePct': f.masterShare,
    'navPeak': f.navPeak,
    'drawdownPct': _r2((1 - f.nav / f.navPeak) * 100),
    'returnAll': f.rAll,
    'return1m': f.r1m,
    'lastRolloverAt': _lastRollover(f.period),
    'nextRolloverAt': f.status == 'active' ? _nextRollover(f.period) : null,
    'createdAt': _ago(Duration(days: f.age)),
    if (own) 'login': f.login,
  };
}

List<Map<String, dynamic>> _navHistory(_FundSeed f) {
  final r = _Rng(f.id);
  final out = <Map<String, dynamic>>[];
  final days = math.min(f.age, 180);
  final start = f.nav / (1 + f.rAll / 100 * days / f.age);
  for (var d = days; d >= 0; d -= (f.period == 'monthly' ? 3 : 1)) {
    final x = (days - d) / days;
    var v = start + (f.nav - start) * x + (r.next() - 0.5) * 0.012 * math.sin(x * math.pi);
    if (f.status == 'frozen') v = 1.0 - 0.312 * math.pow(x, 1.6) + (r.next() - 0.5) * 0.01;
    out.add({'at': _ago(Duration(days: d)), 'nav': _r4(d == 0 ? f.nav : v)});
  }
  return out;
}

List<Map<String, dynamic>> _rollovers(_FundSeed f) {
  final step = switch (f.period) {
    'daily' => 1,
    'weekly' => 7,
    _ => 30,
  };
  final last = DateTime.parse(_lastRollover(f.period));
  final r = _Rng(f.id * 3);
  return [
    for (var i = 0; i < 6; i++)
      {
        'at': _iso(last.subtract(Duration(days: step * i))),
        'nav': _r4(f.nav * (1 - i * f.r1m / 100 / (30 / step)) + (r.next() - 0.5) * 0.004),
        'invested': _r2(1200 + r.next() * 9000),
        'redeemed': _r2(r.next() * 6000),
        'fees': _r2(f.status == 'frozen' ? 0 : r.next() * 900),
      },
  ];
}

Map<String, dynamic> _request({
  required int id,
  required int fundId,
  required String kind,
  num? amount,
  num? units,
  bool all = false,
  String status = 'pending',
  required Duration ago,
  num? nav,
  num? unitsDelta,
  num? amountOut,
  num? fee,
  String? reason,
}) => {
  'id': id,
  'fundId': fundId,
  'kind': kind,
  'amount': amount,
  'units': units,
  'all': all,
  'status': status,
  'reason': reason,
  'createdAt': _ago(ago),
  'executedAt': status == 'done' ? _ago(ago - const Duration(hours: 6)) : null,
  'nav': nav,
  'unitsDelta': unitsDelta,
  'amountOut': amountOut,
  'fee': fee,
};

Map<String, dynamic> _investment(Map<String, dynamic> h) {
  final f = _fundSeed(h['fundId'] as int)!;
  final units = (h['units'] as num).toDouble();
  final value = _r2(units * f.nav);
  final net = (h['netInvested'] as num).toDouble();
  return {
    'fundId': f.id,
    'fund': _fundView(f),
    'units': units,
    'nav': f.nav,
    'value': value,
    'netInvested': net,
    'pnl': _r2(value - net),
    'pnlPct': _r2((value / net - 1) * 100),
    'hwmNav': f.navPeak,
    'stopLossPct': h['stopLossPct'],
    'lockedUntil': h['lockedUntil'],
    'feesPaid': h['feesPaid'],
    'pending': [
      for (final r in _s.requests)
        if (r['fundId'] == f.id && r['status'] == 'pending') r,
    ],
  };
}

/* ------------------------------------------------------------------ copy subscriptions */

Map<String, dynamic> _sub({
  required int id,
  required int master,
  required int login,
  required String status,
  String? stopReason,
  required Map<String, dynamic> sizing,
  num? maxLot,
  num? equityStop,
  num? maxDdPct,
  List<String> excluded = const [],
  required num allocation,
  required num netDeposits,
  required num balance,
  required num equity,
  required num hwm,
  required num feesPaid,
  required num feesPending,
  int positions = 0,
  int orders = 0,
  required int days,
  int? stoppedDays,
  num? autoSlPips,
  Map<String, dynamic>? pendingTerms,
}) {
  final s = _seed(master)!;
  return {
    'id': id,
    'masterId': master,
    'master': {'id': master, 'nickname': s.nick, 'strategy': s.strategy, 'riskScore': s.risk, 'frozen': false, 'status': 'approved', 'house': s.house},
    'login': login,
    'status': status,
    'stopReason': stopReason,
    'sizing': sizing,
    'maxLot': maxLot,
    'equityStop': equityStop,
    'maxDdPct': maxDdPct,
    'excludedSymbols': excluded,
    'perfFeePct': s.fee,
    'feePeriod': s.period,
    'allocation': allocation,
    'netDeposits': netDeposits,
    'hwm': hwm,
    'peakEquity': math.max(hwm, equity),
    'feesPaid': feesPaid,
    'feesPending': feesPending,
    'balance': balance,
    'equity': equity,
    'profit': _r2(equity - netDeposits + (status == 'stopped' ? -312.40 : 0)),
    'returnPct': netDeposits > 0 ? _r2((equity / netDeposits - 1) * 100) : -31.24,
    'positions': positions,
    'orders': orders,
    'createdAt': _ago(Duration(days: days)),
    'stoppedAt': stoppedDays == null ? null : _ago(Duration(days: stoppedDays)),
    'nextFeeAt': status == 'stopped' ? null : _nextRollover(s.period),
    'lastFeeAt': _lastRollover(s.period),
    'withdrawable': status == 'stopped' ? balance : _r2(math.max(0, equity - positions * 95.5 - orders * 40)),
    'autoSlPips': autoSlPips,
    'pauseReason': null,
    'attention': null,
    'pendingTerms': pendingTerms,
    'trial': false,
    'trialEndsAt': null,
  };
}

Map<String, dynamic> _position(
  int ticket,
  int login,
  String symbol,
  String side,
  num volume,
  num open,
  num current,
  num profit,
  Duration ago, {
  num? sl,
  num? tp,
  String source = 'copy',
  String platform = 'Copy',
}) => {
  'ticket': ticket,
  'login': login,
  'symbol': symbol,
  'side': side,
  'volume': volume,
  'openPrice': open,
  'openTime': _ago(ago),
  'sl': sl,
  'tp': tp,
  'swap': _r2(-0.42 * volume * (ago.inHours / 24).ceil()),
  'commission': _r2(-3.5 * volume),
  'currentPrice': current,
  'profit': profit,
  'source': source,
  'platform': platform,
  'comment': source == 'mam' ? 'MAM' : 'copy',
  'option': null,
};

Map<String, dynamic> _order(int ticket, String symbol, String side, String type, num volume, num price, Duration ago, {num? sl, num? tp}) => {
  'ticket': ticket,
  'symbol': symbol,
  'side': side,
  'type': type,
  'volume': volume,
  'price': price,
  'stopLimit': null,
  'sl': sl,
  'tp': tp,
  'expiry': 'GTC',
  'placedAt': _ago(ago),
  'status': 'pending',
  'option': null,
};

Map<String, dynamic> _fee({
  required int id,
  required String source,
  required int masterId,
  int? subscriptionId,
  int? fundId,
  int? linkId,
  required Object login,
  required num amount,
  required int periodEndDays,
  required int periodDays,
  required num hwmBefore,
  required num hwmAfter,
  required num equity,
  required String status,
  num? perf,
  num? mgmt,
}) => {
  'id': id,
  'source': source,
  'masterId': masterId,
  'master': _seed(masterId)?.nick ?? '',
  'subscriptionId': subscriptionId,
  'fundId': fundId,
  'linkId': ?linkId,
  'login': login,
  'amount': amount,
  'perfAmount': perf ?? amount,
  'mgmtAmount': mgmt ?? 0,
  'platformCut': _r2(amount * _platformCut / 100),
  'masterAmount': _r2(amount * (100 - _platformCut) / 100),
  'periodStart': _ago(Duration(days: periodEndDays + periodDays)),
  'periodEnd': _ago(Duration(days: periodEndDays)),
  'hwmBefore': hwmBefore,
  'hwmAfter': hwmAfter,
  'equity': equity,
  'status': status,
  'note': null,
  'createdAt': _ago(Duration(days: periodEndDays)),
  'paidAt': status == 'paid' ? _ago(Duration(days: math.max(0, periodEndDays - 1))) : null,
};

Map<String, dynamic> _subDetail(Map<String, dynamic> sub) {
  final id = sub['id'] as int;
  final login = sub['login'] as int;
  final open = sub['status'] != 'stopped';
  final positions = <Map<String, dynamic>>[
    if (open && id == 3001) ...[
      _position(1204411, login, 'EURUSD', 'buy', 0.04, 1.08212, 1.08420, 8.32, const Duration(hours: 31), sl: 1.07750),
      _position(1204480, login, 'XAUUSD', 'sell', 0.02, 2671.40, 2658.40, 26.0, const Duration(hours: 9), sl: 2690.0, tp: 2620.0),
    ],
    if (open && id == 3003) _position(1205020, login, 'XAUUSD', 'buy', 0.25, 2649.10, 2658.40, 232.5, const Duration(hours: 5), sl: 2631.0),
  ];
  final orders = <Map<String, dynamic>>[
    if (open && id == 3001) _order(1204502, 'GBPUSD', 'buy', 'limit', 0.03, 1.33650, const Duration(hours: 3), sl: 1.33100),
  ];
  final log = <Map<String, dynamic>>[
    for (var i = 0; i < 8; i++)
      {
        'at': _ago(Duration(hours: 3 + i * 7)),
        'action': ['open', 'close', 'modify', 'open', 'order', 'partial_close', 'close', 'open'][i],
        'masterTicket': 1190000 + i * 17,
        'followerTicket': i == 5 && id == 3002 ? null : 1204400 + i * 11,
        'volume': [0.04, 0.03, null, 0.02, 0.03, 0.01, 0.05, 0.04][i],
        'status': i == 5 && id == 3002 ? 'skipped' : 'done',
        'message': i == 5 && id == 3002 ? 'XAUUSD is excluded' : null,
        'masterPrice': [1.08212, 1.34102, null, 2671.40, 1.33650, 149.410, 0.66710, 1.08190][i],
        'followerPrice': [1.08214, 1.34101, null, 2671.10, 1.33650, 149.412, 0.66712, 1.08193][i],
        'slippagePips': [0.2, -0.1, null, -3.0, 0, 0.2, 0.2, 0.3][i],
        'delayMs': [182, 240, 160, 410, 95, 230, 205, 1240][i],
      },
  ];
  final fees = <Map<String, dynamic>>[
    if ((sub['feesPending'] as num) > 0)
      _fee(
        id: 7700 + id % 100,
        source: 'copy',
        masterId: sub['masterId'] as int,
        subscriptionId: id,
        login: login,
        amount: sub['feesPending'] as num,
        periodEndDays: 1,
        periodDays: 30,
        hwmBefore: _r2((sub['hwm'] as num) - 34.2),
        hwmAfter: sub['hwm'] as num,
        equity: sub['equity'] as num,
        status: 'pending',
      ),
    if ((sub['feesPaid'] as num) > 0)
      _fee(
        id: 7600 + id % 100,
        source: 'copy',
        masterId: sub['masterId'] as int,
        subscriptionId: id,
        login: login,
        amount: sub['feesPaid'] as num,
        periodEndDays: 31,
        periodDays: 30,
        hwmBefore: sub['allocation'] as num,
        hwmAfter: _r2((sub['hwm'] as num) - 34.2),
        equity: _r2((sub['hwm'] as num) - 20),
        status: 'paid',
      ),
  ];
  return {
    'subscription': sub,
    'positions': positions,
    'orders': orders,
    'log': log,
    'fees': fees,
    'execution': {'trades': 7, 'avgSlippagePips': 0.04, 'avgDelayMs': 335, 'maxDelayMs': 1240, 'worstSlippagePips': 0.3},
    'announcements': sub['masterId'] == 101
        ? [
            {
              'id': 41,
              'title': 'Lower exposure into the US election week',
              'body': 'I am halving position sizes from Monday until the result is in. Open trades keep their stops.',
              'recipients': 642,
              'createdAt': _ago(const Duration(days: 2, hours: 4)),
            },
            {
              'id': 37,
              'title': 'September recap: +4.1%',
              'body': 'Trend trades on the yen paid most of the month. Drawdown stayed under 3 %.',
              'recipients': 618,
              'createdAt': _ago(const Duration(days: 9)),
            },
          ]
        : <Object>[],
  };
}

Map<String, dynamic> _execution(Map<String, dynamic> sub) {
  final d = _subDetail(sub);
  final rows = [
    for (final l in d['log'] as List)
      if ((l as Map)['followerPrice'] != null)
        {
          'at': l['at'],
          'action': l['action'],
          'masterTicket': l['masterTicket'],
          'followerTicket': l['followerTicket'],
          'volume': l['volume'],
          'masterPrice': l['masterPrice'],
          'followerPrice': l['followerPrice'],
          'slippagePips': l['slippagePips'],
          'delayMs': l['delayMs'],
        },
  ];
  return {'items': rows, 'summary': d['execution']};
}

/* ------------------------------------------------------------------ the master's own dashboard */

Map<String, dynamic> _masterSettings() => {
  'feeMinPct': 0,
  'feeMaxPct': 50,
  'minTrackDays': 30,
  'minOwnCapitalPct': 5,
  'minMasterEquity': 500,
  'platformCutPct': _platformCut,
  'minAllocation': _platformMin,
};

List<Map<String, dynamic>> _candidates() {
  Map<String, dynamic> check(String key, bool ok, String label, String detail) => {'key': key, 'ok': ok, 'label': label, 'detail': detail};
  return [
    {
      'login': _ownMasterLogin,
      'group': 'Pro',
      'equity': 18420.0,
      'ageDays': 226,
      'eligible': true,
      'checks': [
        check('kyc', true, 'Identity verified', 'Your identity was verified on 4 Mar 2026.'),
        check('live', true, 'Live account', 'Pro · hedging · USD'),
        check('track', true, 'Track record', '226 days of trading (30 needed)'),
        check('equity', true, 'Equity', r'$18,420.00 ($500.00 needed)'),
        check('free', true, 'Not linked elsewhere', 'Not a copy, PAMM or MAM account'),
      ],
    },
    {
      'login': 10042817,
      'group': 'Pro',
      'equity': 12893.4,
      'ageDays': 220,
      'eligible': true,
      'checks': [
        check('kyc', true, 'Identity verified', 'Your identity was verified on 4 Mar 2026.'),
        check('live', true, 'Live account', 'Pro · hedging · USD'),
        check('track', true, 'Track record', '220 days of trading (30 needed)'),
        check('equity', true, 'Equity', r'$12,893.40 ($500.00 needed)'),
        check('free', true, 'Not linked elsewhere', 'Not a copy, PAMM or MAM account'),
      ],
    },
    {
      'login': 10051123,
      'group': 'Cent',
      'equity': 2519.8,
      'ageDays': 214,
      'eligible': false,
      'checks': [
        check('kyc', true, 'Identity verified', 'Your identity was verified on 4 Mar 2026.'),
        check('live', true, 'Live account', 'Cent · hedging · USC'),
        check('track', true, 'Track record', '214 days of trading (30 needed)'),
        check('equity', true, 'Equity', r'$2,519.80 ($500.00 needed)'),
        check('free', false, 'Not linked elsewhere', 'The account is linked to a MAM programme'),
      ],
    },
  ];
}

(int, Object) _masterMe() {
  final own = _seed(_ownMasterId)!;
  Map<String, dynamic>? master;
  if (_isMaster) {
    master = _masterView(own, private: true);
  } else if (_s.applied != null) {
    master = _s.applied;
  }
  return (200, {'master': master, 'settings': _masterSettings(), 'candidates': _candidates()});
}

(int, Object) _dashboard() {
  if (!_isMaster) return (403, _err('not_master', 'You are not a master yet.'));
  final own = _seed(_ownMasterId)!;
  final r = _Rng(77);
  final followers = <Map<String, dynamic>>[
    for (var i = 0; i < 9; i++)
      {
        'subscriptionId': 3100 + i * 7,
        'since': _ago(Duration(days: 4 + i * 23)),
        'status': i == 7 ? 'stopped' : (i == 3 ? 'paused' : 'active'),
        'sizing': i.isEven ? {'mode': 'equity', 'value': 1} : {'mode': 'multiplier', 'value': i == 1 ? 0.5 : 2},
        'equity': i == 7 ? 0 : _r2(400 + r.next() * 4800),
        'profit': _r2((r.next() - 0.3) * 420),
        'stoppedAt': i == 7 ? _ago(const Duration(days: 11)) : null,
        'stopReason': i == 7 ? 'max_dd' : null,
        'netDeposits': i == 7 ? 0 : _r2(500 + r.next() * 4000),
        'perfFeePct': _s.ownFee,
        'termsPending': false,
      },
  ];
  final fund = _fundView(_fundSeed(504)!);
  fund['investors'] = [
    for (var i = 0; i < 6; i++)
      {'investorId': 88100 + i * 13, 'units': _r4(2200 + i * 1730.5), 'value': _r2((2200 + i * 1730.5) * 1.0842), 'since': _ago(Duration(days: 140 - i * 19))},
  ];
  fund['pending'] = [
    _request(id: 9120, fundId: 504, kind: 'invest', amount: 1500, ago: const Duration(hours: 20)),
    _request(id: 9118, fundId: 504, kind: 'redeem', units: 400, ago: const Duration(days: 1, hours: 2)),
  ];
  final fees = <Map<String, dynamic>>[
    _fee(
      id: 7810,
      source: 'copy',
      masterId: _ownMasterId,
      subscriptionId: 3100,
      login: 10061100,
      amount: 48.6,
      periodEndDays: 1,
      periodDays: 30,
      hwmBefore: 2140,
      hwmAfter: 2383,
      equity: 2383,
      status: 'pending',
    ),
    _fee(
      id: 7811,
      source: 'pamm',
      masterId: _ownMasterId,
      fundId: 504,
      login: 10090504,
      amount: 35.6,
      periodEndDays: 2,
      periodDays: 7,
      hwmBefore: 1.0861,
      hwmAfter: 1.0918,
      equity: 50592,
      status: 'pending',
    ),
    _fee(
      id: 7790,
      source: 'copy',
      masterId: _ownMasterId,
      subscriptionId: 3107,
      login: 10061107,
      amount: 112.4,
      periodEndDays: 31,
      periodDays: 30,
      hwmBefore: 3880,
      hwmAfter: 4442,
      equity: 4442,
      status: 'paid',
    ),
    _fee(
      id: 7782,
      source: 'pamm',
      masterId: _ownMasterId,
      fundId: 504,
      login: 10090504,
      amount: 61.2,
      periodEndDays: 9,
      periodDays: 7,
      hwmBefore: 1.0702,
      hwmAfter: 1.0861,
      equity: 48120,
      status: 'paid',
    ),
    _fee(
      id: 7765,
      source: 'copy',
      masterId: _ownMasterId,
      subscriptionId: 3114,
      login: 10061114,
      amount: 22.8,
      periodEndDays: 31,
      periodDays: 30,
      hwmBefore: 960,
      hwmAfter: 1074,
      equity: 1074,
      status: 'rejected',
    ),
  ];
  return (
    200,
    {
      'master': _masterView(own, private: true),
      'followers': followers,
      'funds': [fund],
      'fees': fees,
      'totals': {
        'followers': own.followers,
        'aum': own.aum,
        'feesPending': 84.2,
        'feesPaid': 1412.6,
        'new30d': 6,
        'left30d': 2,
        'churn30dPct': 5.6,
        'termsPending': 0,
      },
      'announcements': _s.announcements,
    },
  );
}

/* ------------------------------------------------------------------ MAM */

typedef _MgrSeed = ({
  int id,
  int master,
  String name,
  String desc,
  String method,
  num perf,
  num mgmt,
  String period,
  num minEquity,
  int accounts,
  num aum,
  int age,
});

const List<_MgrSeed> _mgrSeeds = [
  (
    id: 201,
    master: 101,
    name: 'AlphaWave MAM',
    desc: 'The AlphaWave trend strategy traded on your own account: majors and gold, H4 entries, every trade with a stop.',
    method: 'equity',
    perf: 20,
    mgmt: 0,
    period: 'monthly',
    minEquity: 1000,
    accounts: 48,
    aum: 612400,
    age: 400,
  ),
  (
    id: 202,
    master: 103,
    name: 'Steady Carry Managed',
    desc: 'Carry and mean reversion with small sizes. Each account trades the block times its own multiplier.',
    method: 'multiplier',
    perf: 15,
    mgmt: 1,
    period: 'monthly',
    minEquity: 500,
    accounts: 112,
    aum: 1084900,
    age: 610,
  ),
  (
    id: 203,
    master: 102,
    name: 'GoldSmith Gold MAM',
    desc: 'Gold breakouts at the session opens, split by account balance.',
    method: 'balance',
    perf: 25,
    mgmt: 2,
    period: 'weekly',
    minEquity: 2000,
    accounts: 31,
    aum: 286500,
    age: 260,
  ),
  (
    id: 204,
    master: 107,
    name: 'IndexPilot MAM',
    desc: 'US index trading; each account takes a set percentage of every block.',
    method: 'percent',
    perf: 20,
    mgmt: 0,
    period: 'monthly',
    minEquity: 1500,
    accounts: 22,
    aum: 198200,
    age: 150,
  ),
];

_MgrSeed? _mgrSeed(int id) => _mgrSeeds.where((m) => m.id == id).firstOrNull;

Map<String, dynamic> _managerView(_MgrSeed m) {
  final s = _seed(m.master)!;
  return {
    'id': m.id,
    'masterId': m.master,
    'nickname': s.nick,
    'name': m.name,
    'description': m.desc,
    'method': m.method,
    'perfFeePct': m.perf,
    'mgmtFeePct': m.mgmt,
    'feePeriod': m.period,
    'minEquity': m.minEquity,
    'status': 'active',
    'freezeReason': null,
    'createdAt': _ago(Duration(days: m.age)),
    'accounts': m.accounts,
    'aum': m.aum,
    'track': {'return1m': s.r1m, 'return1y': s.r1y, 'returnAll': s.rAll, 'maxDd': s.maxDd, 'riskScore': s.risk, 'since': _ago(Duration(days: s.age))},
  };
}

String _methodText(String m) => switch (m) {
  'balance' => "each account's share of the linked balance",
  'multiplier' => "the block times each account's multiplier",
  'percent' => "each account's percentage of the block",
  _ => "each account's share of the linked equity",
};

String _terms({required String nick, required String name, required String method, required num perf, required num mgmt, required String period}) =>
    '1. Trading authority. You grant $nick authority to open, change and close trades on the linked account through the '
    '$name programme. '
    '2. No access to your money. The manager cannot deposit, withdraw or transfer funds, and nothing can be withdrawn below '
    'the margin of open trades. '
    '3. Allocation. Each block on the MAM master account is allocated by ${_methodText(method)}, rounded down to the lot '
    'step; an account below the minimum lot is skipped for that block. '
    '4. Fees. ${_nt(perf)}% of new MAM gains above the high-water mark${mgmt > 0 ? ' and ${_nt(mgmt)}% a year of equity' : ''}, '
    'settled $period and debited from the linked account. '
    '5. Your limits. Your max lot and equity stop apply to every MAM trade; at the equity stop the MAM trades are closed '
    'and the link stops. Your own trades are never touched. '
    '6. Revocation. You can revoke at any time; fees due up to that moment are settled at once. '
    '7. Risk. Trading leveraged products carries a high level of risk; past results do not guarantee future returns.';

String _nt(num v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();

String _hash(int seed) => List.generate(64, (i) => '0123456789abcdef'[(seed * 7 + i * 13 + i * i) % 16]).join();

List<Map<String, dynamic>> _linkCandidates() => [
  {'login': 10042817, 'group': 'Pro', 'equity': 12893.4, 'balance': 12480.55, 'positions': 3, 'eligible': true, 'reason': null},
  {
    'login': 10051123,
    'group': 'Cent',
    'equity': 2519.8,
    'balance': 2543.0,
    'positions': 1,
    'eligible': !_s.links.any((l) => l['login'] == 10051123 && l['status'] == 'active'),
    'reason': _s.links.any((l) => l['login'] == 10051123 && l['status'] == 'active') ? 'Already managed by Steady Carry Managed' : null,
  },
  {
    'login': _ownMasterLogin,
    'group': 'Pro',
    'equity': 18420.0,
    'balance': 18102.6,
    'positions': 4,
    'eligible': false,
    'reason': "Copy-trading master accounts can't be linked",
  },
];

Map<String, dynamic> _link({
  required int id,
  required int manager,
  required Object login,
  String status = 'active',
  String? stopReason,
  required num value,
  num? maxLot,
  num? equityStop,
  required num hwm,
  required num feesPaid,
  required num feesPending,
  required num startEquity,
  required num equity,
  required num balance,
  required num realized,
  required num floating,
  int positions = 0,
  int orders = 0,
  required num volume,
  required int days,
  int? endedDays,
  num? perf,
  num? mgmt,
  String? period,
}) {
  final m = _mgrSeed(manager);
  return {
    'id': id,
    'managerId': manager,
    'manager': m == null ? null : {'id': m.id, 'name': m.name, 'nickname': _seed(m.master)!.nick, 'method': m.method, 'status': 'active'},
    'login': login,
    'status': status,
    'stopReason': stopReason,
    'allocValue': value,
    'maxLot': maxLot,
    'equityStop': equityStop,
    'perfFeePct': perf ?? m?.perf ?? 20,
    'mgmtFeePct': mgmt ?? m?.mgmt ?? 0,
    'feePeriod': period ?? m?.period ?? 'monthly',
    'hwm': hwm,
    'feesPaid': feesPaid,
    'feesPending': feesPending,
    'startEquity': startEquity,
    'equity': equity,
    'balance': balance,
    'mamResult': _r2(realized + floating),
    'mamRealized': realized,
    'mamFloating': floating,
    'mamPositions': positions,
    'mamOrders': orders,
    'mamVolume': volume,
    'createdAt': _ago(Duration(days: days)),
    'endedAt': endedDays == null ? null : _ago(Duration(days: endedDays)),
    'endedBy': endedDays == null ? null : (stopReason == 'client' ? 'client' : 'system'),
    'lastFeeAt': _lastRollover(period ?? m?.period ?? 'monthly'),
    'nextFeeAt': status == 'active' ? _nextRollover(period ?? m?.period ?? 'monthly') : null,
    'consentAt': _ago(Duration(days: days)),
  };
}

Map<String, dynamic> _linkDetail(Map<String, dynamic> l) {
  final id = l['id'] as int;
  final login = l['login'] as int;
  final active = l['status'] == 'active';
  final m = _mgrSeed(l['managerId'] as int)!;
  final positions = <Map<String, dynamic>>[
    if (active && id == 701) ...[
      _position(1306115, login, 'AUDJPY', 'buy', 0.45, 99.412, 99.840, 19.29, const Duration(days: 3, hours: 2), sl: 98.6, source: 'mam', platform: 'MAM'),
      _position(1306240, login, 'NZDUSD', 'sell', 0.3, 0.60610, 0.60120, 14.70, const Duration(hours: 20), sl: 0.6110, source: 'mam', platform: 'MAM'),
    ],
    if (active && id != 701 && (l['mamPositions'] as int) > 0)
      _position(1307001, login, 'EURUSD', 'buy', 0.2, 1.08300, 1.08420, 2.4, const Duration(hours: 2), source: 'mam', platform: 'MAM'),
  ];
  final orders = <Map<String, dynamic>>[
    if (active && id == 701) _order(1306301, 'EURGBP', 'sell', 'limit', 0.3, 0.83820, const Duration(hours: 6), sl: 0.8420),
  ];
  Map<String, dynamic> deal(int i, String symbol, String side, String entry, num volume, num price, num profit, Duration ago) => {
    'id': 2300000 + id * 10 + i,
    'positionTicket': 1305000 + id + i ~/ 2,
    'symbol': symbol,
    'side': side,
    'entry': entry,
    'volume': volume,
    'price': price,
    'profit': profit,
    'swap': entry == 'in' ? 0 : -0.84,
    'commission': entry == 'in' ? 1.05 : 0,
    'reason': 'mam',
    'time': _ago(ago),
  };
  final deals = id == 701
      ? [
          deal(1, 'EURUSD', 'sell', 'out', 0.45, 1.08611, 88.20, const Duration(days: 2, hours: 5)),
          deal(0, 'EURUSD', 'buy', 'in', 0.45, 1.08415, 0, const Duration(days: 4)),
          deal(3, 'USDCHF', 'buy', 'out', 0.3, 0.86102, 41.65, const Duration(days: 6, hours: 1)),
          deal(2, 'USDCHF', 'sell', 'in', 0.3, 0.86221, 0, const Duration(days: 7)),
          deal(5, 'AUDJPY', 'sell', 'out', 0.45, 99.120, -27.40, const Duration(days: 12)),
          deal(4, 'AUDJPY', 'buy', 'in', 0.45, 99.210, 0, const Duration(days: 13)),
          deal(7, 'EURGBP', 'buy', 'out', 0.3, 0.83510, 112.15, const Duration(days: 21)),
          deal(6, 'EURGBP', 'sell', 'in', 0.3, 0.83880, 0, const Duration(days: 24)),
        ]
      : [
          deal(1, 'XAUUSD', 'buy', 'out', 0.1, 2618.20, -61.30, const Duration(days: 72)),
          deal(0, 'XAUUSD', 'sell', 'in', 0.1, 2612.07, 0, const Duration(days: 73)),
          deal(3, 'XAGUSD', 'sell', 'out', 0.2, 30.884, -25.10, const Duration(days: 90)),
          deal(2, 'XAGUSD', 'buy', 'in', 0.2, 30.912, 0, const Duration(days: 91)),
        ];
  final log = <Map<String, dynamic>>[
    for (final (i, d) in deals.indexed)
      {
        'at': d['time'],
        'action': d['entry'] == 'in' ? 'open' : 'close',
        'masterTicket': 1180000 + i * 9,
        'ticket': d['positionTicket'],
        'volume': d['volume'],
        'status': 'done',
        'message': d['entry'] == 'in' ? 'Block ${_nt(_r2((d['volume'] as num) / (l['allocValue'] as num)))} × ${_nt(l['allocValue'] as num)}' : '',
      },
    if (id == 701)
      {
        'at': _ago(const Duration(days: 9)),
        'action': 'open',
        'masterTicket': 1180110,
        'ticket': null,
        'volume': null,
        'status': 'skipped',
        'message': 'Below the minimum lot (0.004)',
      },
  ]..sort((a, b) => (b['at'] as String).compareTo(a['at'] as String));
  final fees = <Map<String, dynamic>>[
    if ((l['feesPending'] as num) > 0)
      _fee(
        id: 7900 + id % 100,
        source: 'mam',
        masterId: m.master,
        linkId: id,
        login: login,
        amount: l['feesPending'] as num,
        perf: _r2((l['feesPending'] as num) * 0.62),
        mgmt: _r2((l['feesPending'] as num) * 0.38),
        periodEndDays: 1,
        periodDays: 30,
        hwmBefore: _r2((l['hwm'] as num) - 20),
        hwmAfter: l['hwm'] as num,
        equity: l['equity'] as num,
        status: 'pending',
      ),
    if ((l['feesPaid'] as num) > 0)
      _fee(
        id: 7880 + id % 100,
        source: 'mam',
        masterId: m.master,
        linkId: id,
        login: login,
        amount: l['feesPaid'] as num,
        perf: _r2((l['feesPaid'] as num) * 0.8),
        mgmt: _r2((l['feesPaid'] as num) * 0.2),
        periodEndDays: 31,
        periodDays: 30,
        hwmBefore: 0,
        hwmAfter: _r2((l['hwm'] as num) - 20),
        equity: _r2((l['equity'] as num) - 60),
        status: 'paid',
      ),
  ];
  return {
    'link': l,
    'positions': positions,
    'orders': orders,
    'deals': deals,
    'log': log,
    'fees': fees,
    'terms':
        '${_terms(nick: _seed(m.master)!.nick, name: m.name, method: m.method, perf: l['perfFeePct'] as num, mgmt: l['mgmtFeePct'] as num, period: l['feePeriod'] as String)}'
        ' Account #$login. Accepted by Arjun Mehta (client 80412).',
  };
}

Map<String, dynamic> _ownManager() {
  final s = _s;
  final active = s.mgrLinks.where((l) => l['status'] == 'active').toList();
  return {
    'id': 210,
    'masterId': _ownMasterId,
    'nickname': 'Arjun Macro',
    'name': s.mgrName,
    'description': s.mgrDesc,
    'method': s.mgrMethod,
    'perfFeePct': s.mgrPerf,
    'mgmtFeePct': s.mgrMgmt,
    'feePeriod': s.mgrPeriod,
    'minEquity': s.mgrMinEquity,
    'status': 'active',
    'freezeReason': null,
    'createdAt': _ago(const Duration(days: 75)),
    'accounts': active.length,
    'aum': _r2(active.fold<num>(0, (a, l) => a + (l['equity'] as num))),
    'login': s.mgrLogin,
    'track': null,
  };
}

List<Map<String, dynamic>> _allocations() {
  final links = _s.mgrLinks.where((l) => l['status'] == 'active').toList();
  final method = _s.mgrMethod;
  Map<String, dynamic> alloc(int id, int ticket, String action, String symbol, String side, num block, Duration ago) {
    final rows = _allocate(links, method, block);
    final done = rows.where((r) => r['volume'] != null).toList();
    return {
      'id': id,
      'managerId': 210,
      'masterTicket': ticket,
      'action': action,
      'symbol': symbol,
      'side': side,
      'block': block,
      'method': method,
      'allocated': _r2(done.fold<num>(0, (a, r) => a + (r['volume'] as num))),
      'accounts': done.length,
      'details': [
        for (final r in rows)
          {
            'linkId': r['linkId'],
            'login': r['account'],
            'equity': r['equity'],
            'balance': r['balance'],
            'value': r['value'],
            'maxLot': r['maxLot'],
            'basis': r['basis'],
            'raw': r['raw'],
            'volume': r['volume'],
            'reason': r['reason'],
            'status': r['volume'] == null ? 'skipped' : 'done',
            'ticket': r['volume'] == null ? null : 1400000 + id * 10 + (r['linkId'] as int) % 10,
            'message': r['volume'] == null ? 'Below the minimum lot' : '',
          },
      ],
      'at': _ago(ago),
    };
  }

  return [
    alloc(5512, 1399120, 'open', 'EURUSD', 'buy', 2, const Duration(hours: 3)),
    alloc(5508, 1399004, 'order', 'XAUUSD', 'sell', 1, const Duration(hours: 9)),
    alloc(5501, 1398870, 'open', 'GBPUSD', 'sell', 0.3, const Duration(days: 1, hours: 2)),
    alloc(5497, 1398802, 'add', 'EURUSD', 'buy', 0.5, const Duration(days: 1, hours: 7)),
    alloc(5490, 1398655, 'open', 'USDJPY', 'buy', 0.05, const Duration(days: 2, hours: 4)),
    alloc(5482, 1398510, 'open', 'XAUUSD', 'buy', 1.5, const Duration(days: 3)),
  ];
}

/// Splits a block over the active links (allocation::allocate): shares or per-account values, capped at the max
/// lot, rounded down to 0.01, below 0.01 skipped.
List<Map<String, dynamic>> _allocate(List<Map<String, dynamic>> links, String method, num block) {
  final share = method == 'equity' || method == 'balance';
  final total = links.fold<num>(0, (a, l) => a + (l[method == 'balance' ? 'balance' : 'equity'] as num));
  return [
    for (final l in links)
      () {
        final basis = share
            ? ((l[method == 'balance' ? 'balance' : 'equity'] as num) / (total == 0 ? 1 : total))
            : (l['allocValue'] as num) / (method == 'percent' ? 100 : 1);
        final raw = block * basis;
        var vol = (raw * 100 + 1e-9).floorToDouble() / 100;
        String? reason;
        final maxLot = l['maxLot'] as num?;
        if (maxLot != null && vol > maxLot) {
          vol = maxLot.toDouble();
          reason = 'max_lot';
        }
        if (vol < 0.01) reason = 'below_min_lot';
        return <String, dynamic>{
          'linkId': l['id'],
          'account': l['login'],
          'equity': l['equity'],
          'balance': l['balance'],
          'value': share ? null : l['allocValue'],
          'maxLot': maxLot,
          'basis': _r4(basis),
          'raw': _r4(raw),
          'volume': vol < 0.01 ? null : _r2(vol),
          'reason': reason,
        };
      }(),
  ];
}

Map<String, dynamic> _ownTerms() => {
  'text': _terms(nick: 'Arjun Macro', name: _s.mgrName, method: _s.mgrMethod, perf: _s.mgrPerf, mgmt: _s.mgrMgmt, period: _s.mgrPeriod),
  'hash': _hash(210 + _s.mgrVersion),
};

(int, Object) _managerMe() {
  final settings = {'feeMinPct': 0, 'feeMaxPct': 50, 'mgmtMaxPct': 2, 'platformCutPct': _platformCut};
  final master = _isMaster ? {'id': _ownMasterId, 'nickname': 'Arjun Macro', 'status': 'approved', 'frozen': false} : null;
  if (!_isMaster || !_s.programme) return (200, {'master': master, 'settings': settings, 'manager': null});
  final links = _s.mgrLinks;
  final active = links.where((l) => l['status'] == 'active');
  final fees = <Map<String, dynamic>>[
    _fee(
      id: 7960,
      source: 'mam',
      masterId: _ownMasterId,
      linkId: 801,
      login: '••4417',
      amount: 96.4,
      perf: 78.1,
      mgmt: 18.3,
      periodEndDays: 1,
      periodDays: 30,
      hwmBefore: 1060,
      hwmAfter: 1288.4,
      equity: 32410.2,
      status: 'pending',
    ),
    _fee(
      id: 7961,
      source: 'mam',
      masterId: _ownMasterId,
      linkId: 802,
      login: '••0932',
      amount: 86.0,
      perf: 74.6,
      mgmt: 11.4,
      periodEndDays: 1,
      periodDays: 30,
      hwmBefore: 230,
      hwmAfter: 602.15,
      equity: 18906.75,
      status: 'pending',
    ),
    _fee(
      id: 7931,
      source: 'mam',
      masterId: _ownMasterId,
      linkId: 801,
      login: '••4417',
      amount: 512.3,
      perf: 471.9,
      mgmt: 40.4,
      periodEndDays: 31,
      periodDays: 30,
      hwmBefore: 0,
      hwmAfter: 1060,
      equity: 31120,
      status: 'paid',
    ),
    _fee(
      id: 7932,
      source: 'mam',
      masterId: _ownMasterId,
      linkId: 802,
      login: '••0932',
      amount: 248.1,
      perf: 221.5,
      mgmt: 26.6,
      periodEndDays: 31,
      periodDays: 30,
      hwmBefore: 0,
      hwmAfter: 230,
      equity: 18400,
      status: 'paid',
    ),
    _fee(
      id: 7933,
      source: 'mam',
      masterId: _ownMasterId,
      linkId: 803,
      login: '••7781',
      amount: 170.25,
      perf: 151.0,
      mgmt: 19.25,
      periodEndDays: 31,
      periodDays: 30,
      hwmBefore: 0,
      hwmAfter: 380,
      equity: 12010,
      status: 'paid',
    ),
    _fee(
      id: 7934,
      source: 'mam',
      masterId: _ownMasterId,
      linkId: 804,
      login: '••2056',
      amount: 196.4,
      perf: 180.2,
      mgmt: 16.2,
      periodEndDays: 31,
      periodDays: 30,
      hwmBefore: 0,
      hwmAfter: 410,
      equity: 15600,
      status: 'paid',
    ),
    _fee(
      id: 7935,
      source: 'mam',
      masterId: _ownMasterId,
      linkId: 805,
      login: '••6610',
      amount: 79.7,
      perf: 75.3,
      mgmt: 4.4,
      periodEndDays: 31,
      periodDays: 30,
      hwmBefore: 0,
      hwmAfter: 108,
      equity: 4890,
      status: 'paid',
    ),
  ];
  return (
    200,
    {
      'master': master,
      'settings': settings,
      'manager': _ownManager(),
      'totals': {
        'accounts': active.length,
        'equity': _r2(active.fold<num>(0, (a, l) => a + (l['equity'] as num))),
        'mamResult': _r2(active.fold<num>(0, (a, l) => a + (l['mamResult'] as num))),
        'feesPending': 182.4,
        'feesPaid': 1206.75,
      },
      'links': links,
      'allocations': _allocations(),
      'fees': fees,
      'terms': _ownTerms(),
    },
  );
}

/* ------------------------------------------------------------------ mutable sample state */

class _State {
  final List<Map<String, dynamic>> subs = [
    _sub(
      id: 3001,
      master: 101,
      login: 10061001,
      status: 'active',
      sizing: {'mode': 'equity', 'value': 1},
      maxDdPct: 30,
      allocation: 1500,
      netDeposits: 1500,
      balance: 1612.45,
      equity: 1684.2,
      hwm: 1650,
      feesPaid: 36.84,
      feesPending: 6.84,
      positions: 2,
      orders: 1,
      days: 96,
    ),
    _sub(
      id: 3002,
      master: 103,
      login: 10061002,
      status: 'paused',
      sizing: {'mode': 'fixed_lot', 'value': 0.05},
      maxLot: 0.5,
      equityStop: 600,
      excluded: ['XAUUSD', 'BTCUSD'],
      allocation: 800,
      netDeposits: 800,
      balance: 836.1,
      equity: 836.1,
      hwm: 830,
      feesPaid: 5.4,
      feesPending: 0,
      days: 61,
      autoSlPips: 40,
    ),
    _sub(
      id: 3003,
      master: 102,
      login: 10061003,
      status: 'active',
      sizing: {'mode': 'multiplier', 'value': 0.5},
      maxDdPct: 40,
      allocation: 1000,
      netDeposits: 1000,
      balance: 1088.3,
      equity: 1121.75,
      hwm: 1090,
      feesPaid: 22.1,
      feesPending: 7.94,
      positions: 1,
      days: 34,
      pendingTerms: {'perfFeePct': 30, 'feePeriod': 'weekly', 'deadline': _in(const Duration(days: 4, hours: 6))},
    ),
    _sub(
      id: 2984,
      master: 108,
      login: 10060984,
      status: 'stopped',
      stopReason: 'max_dd',
      sizing: {'mode': 'equity', 'value': 1},
      maxDdPct: 30,
      allocation: 1000,
      netDeposits: 0,
      balance: 0,
      equity: 0,
      hwm: 1000,
      feesPaid: 0,
      feesPending: 0,
      days: 88,
      stoppedDays: 12,
    ),
  ];

  final List<Map<String, dynamic>> holdings = [
    {'fundId': 501, 'units': 1011.6421, 'netInvested': 1250, 'stopLossPct': 20, 'lockedUntil': null, 'feesPaid': 48.3},
    {'fundId': 502, 'units': 455.2108, 'netInvested': 600, 'stopLossPct': null, 'lockedUntil': null, 'feesPaid': 31.02},
  ];

  final List<Map<String, dynamic>> requests = [
    _request(id: 9105, fundId: 503, kind: 'invest', amount: 400, ago: const Duration(hours: 5)),
    _request(id: 9104, fundId: 502, kind: 'redeem', units: 100, ago: const Duration(hours: 26)),
    _request(id: 9099, fundId: 502, kind: 'redeem', units: 50, status: 'cancelled', ago: const Duration(days: 19)),
    _request(id: 9098, fundId: 502, kind: 'invest', amount: 600, status: 'done', ago: const Duration(days: 64), nav: 1.3181, unitsDelta: 455.2108),
    _request(id: 9091, fundId: 501, kind: 'invest', amount: 1250, status: 'done', ago: const Duration(days: 150), nav: 1.2356, unitsDelta: 1011.6421),
  ];

  // the master's own profile (PATCH master/me)
  String ownNick = 'Arjun Macro';
  String ownStrategy = 'Macro swing trades on the majors and gold';
  String ownDesc = 'Swing positions on EURUSD, GBPUSD, USDJPY and gold around central-bank cycles. Risk per trade capped at 1 %.';
  num ownFee = 20;
  String ownPeriod = 'monthly';
  num ownMinAlloc = 200;
  bool ownAcceptNew = true;
  int? ownMaxFollowers;
  String? ownInvite;
  String ownFundName = 'Arjun Macro Fund';
  Map<String, dynamic>? applied;
  final List<Map<String, dynamic>> announcements = [
    {
      'id': 52,
      'title': 'Gold position closed, back to flat',
      'body': 'Took profit on the gold long ahead of the CPI release. No open trades over the weekend.',
      'recipients': 38,
      'createdAt': _ago(const Duration(days: 3, hours: 2)),
    },
  ];

  // the client's MAM links
  final List<Map<String, dynamic>> links = [
    _link(
      id: 701,
      manager: 202,
      login: 10051123,
      value: 1.5,
      maxLot: 2,
      equityStop: 1800,
      hwm: 214.6,
      feesPaid: 32.19,
      feesPending: 4.85,
      startEquity: 2180,
      equity: 2519.8,
      balance: 2543.0,
      realized: 214.6,
      floating: 33.99,
      positions: 2,
      orders: 1,
      volume: 14.6,
      days: 58,
    ),
    _link(
      id: 688,
      manager: 203,
      login: 10038890,
      status: 'revoked',
      stopReason: 'client',
      value: 0,
      hwm: 0,
      feesPaid: 0,
      feesPending: 0,
      startEquity: 2400,
      equity: 0,
      balance: 0,
      realized: -86.4,
      floating: 0,
      volume: 0.6,
      days: 160,
      endedDays: 70,
    ),
  ];

  // the MAM programme the client runs as a manager
  bool programme = _hasProgramme;
  String mgrName = 'Arjun Macro MAM';
  String mgrDesc = 'The Arjun Macro swing strategy on your own account. Each linked account takes a set percentage of every block.';
  String mgrMethod = 'percent';
  num mgrPerf = 20;
  num mgrMgmt = 1.5;
  String mgrPeriod = 'monthly';
  num mgrMinEquity = 500;
  int mgrLogin = 10070215;
  int mgrVersion = 0;
  final List<Map<String, dynamic>> mgrLinks = [
    for (final (id, login, value, maxLot, equity, realized, floating, pos, days) in [
      (801, '••4417', 100, 5, 32410.2, 1201.15, 87.25, 2, 70),
      (802, '••0932', 50, null, 18906.75, 571.2, 30.95, 2, 66),
      (803, '••7781', 25, 1, 12240.0, 418.4, 13.2, 1, 52),
      (804, '••2056', 20, null, 15830.1, 452.75, 24.2, 2, 31),
      (805, '••6610', 10, 0.5, 4933.5, 112.3, 3.4, 1, 12),
    ])
      _link(
        id: id,
        manager: 210,
        login: login,
        value: value,
        maxLot: maxLot,
        hwm: _r2(realized * 0.9),
        feesPaid: switch (id) {
          801 => 512.3,
          802 => 248.1,
          803 => 170.25,
          804 => 196.4,
          _ => 79.7,
        },
        feesPending: switch (id) {
          801 => 96.4,
          802 => 86.0,
          _ => 0,
        },
        startEquity: _r2(equity - realized - floating),
        equity: equity,
        balance: _r2(equity - floating),
        realized: realized,
        floating: floating,
        positions: pos,
        volume: _r2(value / 4),
        days: days,
        perf: 20,
        mgmt: 1.5,
        period: 'monthly',
      ),
    _link(
      id: 796,
      manager: 210,
      login: '••3349',
      status: 'stopped',
      stopReason: 'equity_stop',
      value: 50,
      equityStop: 1500,
      hwm: 0,
      feesPaid: 0,
      feesPending: 0,
      startEquity: 1800.2,
      equity: 1412.0,
      balance: 1412.0,
      realized: -388.2,
      floating: 0,
      volume: 3.1,
      days: 60,
      endedDays: 21,
      perf: 20,
      mgmt: 1.5,
      period: 'monthly',
    ),
  ];
  int nextId = 1;
}

/* ------------------------------------------------------------------ router */

(int, Object)? previewSocial(String method, String path, Map<String, dynamic> body, Map<String, String> query) {
  if (!path.startsWith('social/')) return null;
  final p = path.substring(7).split('/');
  final n = p.length;
  final a = p[0];
  final b = n > 1 ? p[1] : null;
  final c = n > 2 ? p[2] : null;
  final id = int.tryParse(b ?? '');
  if (a == 'mam') return _mam(method, p, body, query);

  if (method == 'GET') {
    if (n == 1 && a == 'leaderboard') return _leaderboard(query);
    if (a == 'masters' && id != null && n == 2) return _profile(id, query);
    if (a == 'masters' && id != null && n == 3 && c == 'preview') return _riskPreview(id, query);
    if (n == 1 && a == 'symbols') {
      return (
        200,
        {
          'symbols': [
            for (final s in _symbolList) {'symbol': s, 'assetClass': _assetClass(s)},
          ],
        },
      );
    }
    if (n == 2 && a == 'master' && b == 'me') return _masterMe();
    if (n == 2 && a == 'master' && b == 'dashboard') return _dashboard();
    if (n == 1 && a == 'subscriptions') return (200, {'items': _s.subs});
    if (a == 'subscriptions' && id != null) {
      final sub = _s.subs.where((x) => x['id'] == id).firstOrNull;
      if (sub == null) return _notFound();
      if (n == 2) return (200, _subDetail(sub));
      if (n == 3 && c == 'execution') return (200, _execution(sub));
    }
    if (n == 1 && a == 'funds') {
      return (
        200,
        {
          'items': [
            for (final f in _fundSeeds)
              if (f.status != 'closed') _fundView(f),
          ],
        },
      );
    }
    if (a == 'funds' && id != null) {
      final f = _fundSeed(id);
      if (f == null) return _notFound();
      if (n == 2) {
        return (200, {'fund': _fundView(f), 'master': _masterView(_seed(f.master)!), 'navHistory': _navHistory(f), 'rollovers': _rollovers(f)});
      }
      if (n == 3 && c == 'statement') return (200, _statement(f));
    }
    if (n == 1 && a == 'investments') {
      return (
        200,
        {
          'items': [for (final h in _s.holdings) _investment(h)],
          'requests': _s.requests,
        },
      );
    }
    return _notFound();
  }

  if (method == 'POST') {
    if (n == 1 && a == 'subscriptions') return _follow(body);
    if (a == 'subscriptions' && id != null && n == 3) {
      final sub = _s.subs.where((x) => x['id'] == id).firstOrNull;
      if (sub == null) return _notFound();
      if (c == 'stop') return _stop(sub, body);
      if (c == 'funds') return _subFunds(sub, body);
      if (c == 'accept-terms') {
        final terms = sub['pendingTerms'] as Map<String, dynamic>?;
        if (terms == null) return (409, _err('no_pending_terms', 'There are no new terms to accept.'));
        sub
          ..['perfFeePct'] = terms['perfFeePct']
          ..['feePeriod'] = terms['feePeriod']
          ..['pendingTerms'] = null
          ..['pauseReason'] = null;
        return (200, {'subscription': sub});
      }
    }
    if (n == 2 && a == 'master' && b == 'apply') return _apply(body);
    if (n == 2 && a == 'master' && b == 'announcements') {
      final title = '${body['title'] ?? ''}'.trim();
      if (title.length < 3) return (422, _err('validation', 'Enter a title of at least 3 characters.'));
      final ann = {'id': 60 + _s.nextId++, 'title': title, 'body': '${body['body'] ?? ''}', 'recipients': 37, 'createdAt': _iso(_now)};
      _s.announcements.insert(0, ann);
      return (200, {'announcement': ann, 'items': _s.announcements});
    }
    if (n == 1 && a == 'funds') {
      final f = _fundView(_fundSeed(504)!);
      return (
        200,
        {
          'fund': {...f, 'id': 506, 'name': '${body['name'] ?? 'New fund'}', 'nav': 1, 'aum': 0, 'investors': 0, 'returnAll': 0, 'return1m': 0},
          'credentials': {'login': 10090506, 'password': 'Pm8!vT3qXw', 'investorPassword': 'iN5#rK2cLd'},
        },
      );
    }
    if (a == 'funds' && id != null && n == 3 && c == 'invest') return _invest(id, body);
    if (a == 'funds' && id != null && n == 3 && c == 'redeem') return _redeem(id, body);
    if (a == 'requests' && id != null && n == 3 && c == 'cancel') {
      final r = _s.requests.where((x) => x['id'] == id).firstOrNull;
      if (r == null) return _notFound();
      if (r['status'] != 'pending') return (409, _err('request_done', 'The request was already executed.'));
      r['status'] = 'cancelled';
      return (200, {'request': r});
    }
    return _notFound();
  }

  if (method == 'PATCH') {
    if (a == 'subscriptions' && id != null && n == 2) {
      final sub = _s.subs.where((x) => x['id'] == id).firstOrNull;
      if (sub == null) return _notFound();
      if (sub['status'] == 'stopped') return (409, _err('stopped', 'This subscription is stopped.'));
      if (body['paused'] is bool) sub['status'] = body['paused'] == true ? 'paused' : 'active';
      for (final k in ['sizing', 'maxLot', 'equityStop', 'maxDdPct', 'excludedSymbols', 'autoSlPips']) {
        if (body.containsKey(k)) sub[k] = body[k] ?? (k == 'excludedSymbols' ? <String>[] : null);
      }
      return (200, {'subscription': sub});
    }
    if (n == 2 && a == 'master' && b == 'me') {
      if (!_isMaster) return (403, _err('not_master', 'You are not a master yet.'));
      final st = _s;
      final feeChanged = (body['perfFeePct'] != null && body['perfFeePct'] != st.ownFee) || (body['feePeriod'] != null && body['feePeriod'] != st.ownPeriod);
      if (body['nickname'] is String) st.ownNick = body['nickname'] as String;
      if (body['strategy'] is String) st.ownStrategy = body['strategy'] as String;
      if (body['description'] is String) st.ownDesc = body['description'] as String;
      if (body['perfFeePct'] is num) st.ownFee = body['perfFeePct'] as num;
      if (body['feePeriod'] is String) st.ownPeriod = body['feePeriod'] as String;
      if (body['minAllocation'] is num) st.ownMinAlloc = body['minAllocation'] as num;
      if (body['acceptNew'] is bool) st.ownAcceptNew = body['acceptNew'] as bool;
      if (body.containsKey('maxFollowers')) st.ownMaxFollowers = (body['maxFollowers'] as num?)?.toInt();
      if (body['inviteOnly'] is bool) st.ownInvite = body['inviteOnly'] == true ? (st.ownInvite ?? 'ARJ4MCRO') : null;
      return (
        200,
        {
          'master': _masterView(_seed(_ownMasterId)!, private: true),
          if (feeChanged) 'terms': {'applied': 0, 'pending': 31},
        },
      );
    }
    if (a == 'funds' && id != null && n == 2) {
      final f = _fundSeed(id);
      if (f == null) return _notFound();
      if (body['name'] is String) _s.ownFundName = body['name'] as String;
      return (200, {'fund': _fundView(f)});
    }
    if (a == 'investments' && id != null && n == 2) {
      final h = _s.holdings.where((x) => x['fundId'] == id).firstOrNull;
      if (h == null) return _notFound();
      h['stopLossPct'] = body['stopLossPct'];
      return (200, {'investment': _investment(h)});
    }
    return _notFound();
  }
  return _notFound();
}

(int, Object) _follow(Map<String, dynamic> body) {
  final masterId = body['masterId'] is num ? (body['masterId'] as num).toInt() : null;
  final s = masterId == null ? null : _seed(masterId);
  if (s == null) return _notFound();
  if (s.id == _ownMasterId && _isMaster) return (422, _err('own_subscription', "You can't copy your own master profile."));
  if (!s.accepting) return (409, _err('not_accepting', 'This master is not taking new followers right now.'));
  if (s.inviteOnly && body['inviteCode'] != _invite) return (403, _err('invite_required', 'This master can be followed through a private link only.'));
  final alloc = body['allocation'] is num ? (body['allocation'] as num).toDouble() : 0.0;
  final min = math.max(_platformMin, s.minAlloc);
  if (alloc < min) return (422, _err('min_allocation', 'The minimum allocation for this master is \$${_nt(min)}.'));
  if (alloc > 3250.40) return (422, _err('wallet_rejected', 'Not enough USDT in your wallet.'));
  final id = 3010 + _s.nextId++;
  final login = 10061000 + id % 1000;
  final sub = _sub(
    id: id,
    master: s.id,
    login: login,
    status: 'active',
    sizing: (body['sizing'] as Map?)?.cast<String, dynamic>() ?? {'mode': 'equity', 'value': 1},
    maxLot: body['maxLot'] as num?,
    equityStop: body['equityStop'] as num?,
    maxDdPct: body['maxDdPct'] as num?,
    excluded: [for (final x in (body['excludedSymbols'] as List? ?? const [])) '$x'],
    allocation: alloc,
    netDeposits: alloc,
    balance: alloc,
    equity: alloc,
    hwm: alloc,
    feesPaid: 0,
    feesPending: 0,
    days: 0,
    autoSlPips: body['autoSlPips'] as num?,
  );
  _s.subs.insert(0, sub);
  return (
    200,
    {
      'subscription': sub,
      'account': {'login': login, 'group': 'copy', 'currency': 'USD'},
      'funding': {'status': 'done'},
    },
  );
}

(int, Object) _stop(Map<String, dynamic> sub, Map<String, dynamic> body) {
  if (sub['status'] == 'stopped') return (409, _err('stopped', 'This subscription is already stopped.'));
  final close = body['closePositions'] != false;
  final returnFunds = body['returnFunds'] == true;
  final closed = close ? [for (final x in _subDetail(sub)['positions'] as List) (x as Map)['ticket']] : <Object>[];
  final equity = (sub['equity'] as num).toDouble();
  sub
    ..['status'] = 'stopped'
    ..['stopReason'] = 'client'
    ..['stoppedAt'] = _iso(_now)
    ..['nextFeeAt'] = null
    ..['positions'] = close ? 0 : sub['positions']
    ..['orders'] = 0;
  if (returnFunds) {
    sub
      ..['balance'] = 0
      ..['equity'] = 0
      ..['withdrawable'] = 0
      ..['netDeposits'] = 0;
  } else {
    sub['withdrawable'] = _r2(equity);
  }
  return (200, {'subscription': sub, 'closed': closed, 'failed': <Object>[], 'returned': returnFunds ? _r2(equity) : null, 'returnError': null});
}

(int, Object) _subFunds(Map<String, dynamic> sub, Map<String, dynamic> body) {
  final dir = body['direction'] == 'withdraw' ? 'withdraw' : 'add';
  final amount = body['amount'] is num ? (body['amount'] as num).toDouble() : 0.0;
  if (amount <= 0) return (422, _err('validation', 'Enter an amount above zero.'));
  if (dir == 'add' && sub['status'] == 'stopped') return (409, _err('stopped', 'This subscription is stopped.'));
  if (dir == 'add' && amount > 3250.40) return (422, _err('wallet_rejected', 'Not enough USDT in your wallet.'));
  if (dir == 'withdraw' && amount > ((sub['withdrawable'] as num?) ?? 0)) {
    return (422, _err('insufficient_funds', 'More than the free margin of the copy account.'));
  }
  final sign = dir == 'add' ? 1 : -1;
  for (final k in ['balance', 'equity', 'netDeposits', 'withdrawable']) {
    sub[k] = _r2((sub[k] as num? ?? 0) + sign * amount);
  }
  if (dir == 'add') sub['allocation'] = _r2((sub['allocation'] as num) + amount);
  return (200, {'direction': dir, 'amount': amount, 'balance': sub['balance'], 'subscription': sub});
}

(int, Object) _apply(Map<String, dynamic> body) {
  if (_isMaster) return (409, _err('master_status', 'You already have a master profile.'));
  final login = body['login'] is num ? (body['login'] as num).toInt() : null;
  final cand = _candidates().where((c) => c['login'] == login).firstOrNull;
  if (cand == null) return (422, _err('validation', 'Choose one of your live accounts.'));
  if (cand['eligible'] != true) {
    return (422, _err('requirements', 'The account does not meet every requirement yet.', {'checks': cand['checks']}));
  }
  _s.applied = {
    ..._masterView(_seed(_ownMasterId)!, private: true),
    'nickname': '${body['nickname'] ?? ''}',
    'strategy': '${body['strategy'] ?? ''}',
    'description': '${body['description'] ?? ''}',
    'program': '${body['program'] ?? 'copy'}',
    'perfFeePct': body['perfFeePct'] ?? 20,
    'feePeriod': '${body['feePeriod'] ?? 'monthly'}',
    'minAllocation': body['minAllocation'] ?? _platformMin,
    'status': 'pending',
    'login': login,
    'fund': null,
    'createdAt': _iso(_now),
  };
  return (200, {'master': _s.applied});
}

(int, Object) _invest(int fundId, Map<String, dynamic> body) {
  final f = _fundSeed(fundId);
  if (f == null) return _notFound();
  if (f.status != 'active') return (409, _err('fund_frozen', 'The fund is frozen: no new investments.'));
  final amount = body['amount'] is num ? (body['amount'] as num).toDouble() : 0.0;
  if (amount < f.min) return (422, _err('min_investment', 'The minimum investment is \$${_nt(f.min)}.'));
  if (amount > 3250.40) return (422, _err('wallet_rejected', 'Not enough USDT in your wallet.'));
  final r = _request(id: 9130 + _s.nextId++, fundId: fundId, kind: 'invest', amount: amount, ago: Duration.zero);
  _s.requests.insert(0, r);
  if (body['stopLossPct'] is num) {
    _s.holdings.where((h) => h['fundId'] == fundId).firstOrNull?['stopLossPct'] = body['stopLossPct'];
  }
  return (200, {'request': r});
}

(int, Object) _redeem(int fundId, Map<String, dynamic> body) {
  final f = _fundSeed(fundId);
  final h = _s.holdings.where((x) => x['fundId'] == fundId).firstOrNull;
  if (f == null || h == null) return _notFound();
  final locked = DateTime.tryParse('${h['lockedUntil']}');
  if (locked != null && locked.isAfter(_now)) return (409, _err('locked', 'The investment is locked until ${h['lockedUntil']}.'));
  final have = (h['units'] as num).toDouble();
  final all = body['all'] == true;
  final units = body['units'] is num ? (body['units'] as num).toDouble() : null;
  final amount = body['amount'] is num ? (body['amount'] as num).toDouble() : null;
  if ((units != null && units > have) || (amount != null && amount > have * f.nav)) {
    return (422, _err('insufficient_units', 'More than you hold in the fund.'));
  }
  final r = _request(id: 9130 + _s.nextId++, fundId: fundId, kind: 'redeem', units: units, amount: amount, all: all, ago: Duration.zero);
  _s.requests.insert(0, r);
  return (200, {'request': r});
}

Map<String, dynamic> _statement(_FundSeed f) {
  final mine = _s.requests.where((r) => r['fundId'] == f.id).toList();
  final items = <Map<String, dynamic>>[
    for (final r in mine)
      if (r['status'] == 'done')
        {
          'at': r['executedAt'],
          'kind': r['kind'],
          'units': r['kind'] == 'redeem' ? -((r['unitsDelta'] as num?) ?? 0).abs() : r['unitsDelta'],
          'nav': r['nav'],
          'amount': r['kind'] == 'redeem' ? r['amountOut'] : r['amount'],
        },
    if (f.id == 501 || f.id == 502)
      {
        'at': _ago(const Duration(days: 30)),
        'kind': 'fee',
        'units': f.id == 501 ? -21.4102 : -12.9877,
        'nav': _r4(f.nav * 0.982),
        'amount': f.id == 501 ? 31.18 : 21.02,
      },
    if (f.id == 501) {'at': _ago(const Duration(days: 61)), 'kind': 'fee', 'units': -12.0219, 'nav': 1.4288, 'amount': 17.12},
  ]..sort((x, y) => '${y['at']}'.compareTo('${x['at']}'));
  return {'items': items, 'requests': mine};
}

/* ------------------------------------------------------------------ MAM routes */

(int, Object) _mam(String method, List<String> p, Map<String, dynamic> body, Map<String, String> query) {
  final n = p.length;
  final b = n > 1 ? p[1] : null;
  final c = n > 2 ? p[2] : null;
  final d = n > 3 ? p[3] : null;
  final id = int.tryParse(c ?? '');
  final s = _s;

  if (method == 'GET') {
    if (n == 2 && b == 'managers') {
      return (
        200,
        {
          'items': [for (final m in _mgrSeeds) _managerView(m)],
        },
      );
    }
    if (n == 3 && b == 'managers' && id != null) {
      final m = _mgrSeed(id);
      if (m == null) return _notFound();
      return (
        200,
        {
          'manager': _managerView(m),
          'terms': {
            'text': _terms(nick: _seed(m.master)!.nick, name: m.name, method: m.method, perf: m.perf, mgmt: m.mgmt, period: m.period),
            'hash': _hash(m.id),
          },
          'accounts': _linkCandidates(),
          'own': false,
        },
      );
    }
    if (n == 2 && b == 'links') return (200, {'items': s.links, 'accounts': _linkCandidates()});
    if (n == 3 && b == 'links' && id != null) {
      final l = s.links.where((x) => x['id'] == id).firstOrNull;
      return l == null ? _notFound() : (200, _linkDetail(l));
    }
    if (n == 2 && b == 'manager') return _managerMe();
    if (n == 3 && b == 'manager' && c == 'allocations') return (200, {'items': _allocations()});
    if (n == 3 && b == 'manager' && c == 'preview') {
      final symbol = query['symbol'] ?? '';
      final volume = double.tryParse(query['volume'] ?? '');
      if (!RegExp(r'^[A-Z0-9._]{2,20}$').hasMatch(symbol)) return (400, _err('bad_request', 'Invalid symbol.'));
      if (volume == null || volume <= 0) return (400, _err('bad_request', 'Invalid volume.'));
      final rows = _allocate(s.mgrLinks.where((l) => l['status'] == 'active').toList(), s.mgrMethod, volume);
      final allocated = rows.fold<num>(0, (a, r) => a + ((r['volume'] as num?) ?? 0));
      final share = s.mgrMethod == 'equity' || s.mgrMethod == 'balance';
      return (
        200,
        {
          'symbol': symbol,
          'block': volume,
          'method': s.mgrMethod,
          'lotStep': 0.01,
          'lotMin': 0.01,
          'allocated': _r2(allocated),
          'unallocated': share ? _r2(volume - allocated) : 0,
          'rows': rows,
        },
      );
    }
    return _notFound();
  }

  if (method == 'POST') {
    if (n == 2 && b == 'links') {
      final m = _mgrSeed(body['managerId'] is num ? (body['managerId'] as num).toInt() : -1);
      if (m == null) return _notFound();
      if (body['termsHash'] != _hash(m.id)) return (409, _err('terms_changed', 'The terms changed: read them again and accept the new version.'));
      final login = body['login'] is num ? (body['login'] as num).toInt() : null;
      final cand = _linkCandidates().where((x) => x['login'] == login).firstOrNull;
      if (cand == null || cand['eligible'] != true) return (422, _err('not_eligible', '${cand?['reason'] ?? 'This account cannot be linked.'}'));
      if ((cand['equity'] as num) < m.minEquity) return (422, _err('not_eligible', 'The programme needs an account equity of at least \$${_nt(m.minEquity)}.'));
      final link = _link(
        id: 720 + s.nextId++,
        manager: m.id,
        login: login!,
        value: m.method == 'percent' ? 100 : 1,
        maxLot: body['maxLot'] as num?,
        equityStop: body['equityStop'] as num?,
        hwm: 0,
        feesPaid: 0,
        feesPending: 0,
        startEquity: cand['equity'] as num,
        equity: cand['equity'] as num,
        balance: cand['balance'] as num,
        realized: 0,
        floating: 0,
        volume: 0,
        days: 0,
      );
      s.links.insert(0, link);
      return (200, {'link': link});
    }
    if (n == 4 && b == 'links' && id != null && d == 'revoke') {
      final l = s.links.where((x) => x['id'] == id).firstOrNull;
      if (l == null) return _notFound();
      if (l['status'] != 'active') return (409, _err('link_status', 'The link has already ended.'));
      final close = body['closePositions'] == true;
      final closed = close ? [for (final x in _linkDetail(l)['positions'] as List) (x as Map)['ticket']] : <Object>[];
      final fee = (l['feesPending'] as num) > 0 ? l['feesPending'] : null;
      l
        ..['status'] = 'revoked'
        ..['stopReason'] = 'client'
        ..['endedAt'] = _iso(_now)
        ..['endedBy'] = 'client'
        ..['nextFeeAt'] = null
        ..['mamPositions'] = close ? 0 : l['mamPositions']
        ..['mamOrders'] = 0
        ..['feesPaid'] = _r2((l['feesPaid'] as num) + ((fee as num?) ?? 0))
        ..['feesPending'] = 0;
      return (200, {'closed': closed, 'failed': <Object>[], 'fee': fee, 'link': l});
    }
    if (n == 2 && b == 'manager') {
      if (!_isMaster) return (403, _err('not_master', 'Only approved masters can open a MAM programme.'));
      if (s.programme) return (409, _err('manager_exists', 'You already run a MAM programme.'));
      final name = '${body['name'] ?? ''}'.trim();
      if (name.length < 3) return (422, _err('validation', 'Enter a programme name (3–60 characters).'));
      s
        ..programme = true
        ..mgrName = name
        ..mgrDesc = '${body['description'] ?? ''}'
        ..mgrMethod = '${body['method'] ?? 'equity'}'
        ..mgrPerf = (body['perfFeePct'] as num?) ?? 20
        ..mgrMgmt = (body['mgmtFeePct'] as num?) ?? 0
        ..mgrPeriod = '${body['feePeriod'] ?? 'monthly'}'
        ..mgrMinEquity = (body['minEquity'] as num?) ?? 0
        ..mgrLogin = 10070288
        ..mgrLinks.clear();
      return (
        200,
        {
          'manager': _ownManager(),
          'credentials': {
            'login': 10070288,
            'password': 'Kx7#mP2vQ9',
            'investorPassword': 'rD4!wN8sL1',
            'funding': body['seed'] is num ? {'status': 'done', 'amount': body['seed']} : null,
          },
        },
      );
    }
    return _notFound();
  }

  if (method == 'PATCH') {
    if (n == 3 && b == 'links' && id != null) {
      final l = s.links.where((x) => x['id'] == id).firstOrNull;
      if (l == null) return _notFound();
      if (l['status'] != 'active') return (409, _err('link_status', 'The link has already ended.'));
      if (body.containsKey('maxLot')) l['maxLot'] = body['maxLot'];
      if (body.containsKey('equityStop')) l['equityStop'] = body['equityStop'];
      return (200, {'link': l});
    }
    if (n == 2 && b == 'manager') {
      if (!s.programme) return _notFound();
      final linked = s.mgrLinks.any((l) => l['status'] == 'active');
      if (body['method'] != null && body['method'] != s.mgrMethod && linked) {
        return (409, _err('method_locked', 'The allocation method is fixed while accounts are linked.'));
      }
      if (body['name'] is String) s.mgrName = body['name'] as String;
      if (body['description'] is String) s.mgrDesc = body['description'] as String;
      if (body['method'] is String) s.mgrMethod = body['method'] as String;
      if (body['perfFeePct'] is num) s.mgrPerf = body['perfFeePct'] as num;
      if (body['mgmtFeePct'] is num) s.mgrMgmt = body['mgmtFeePct'] as num;
      if (body['feePeriod'] is String) s.mgrPeriod = body['feePeriod'] as String;
      if (body['minEquity'] is num) s.mgrMinEquity = body['minEquity'] as num;
      s.mgrVersion++;
      return (200, {'manager': _ownManager()});
    }
    if (n == 4 && b == 'manager' && c == 'links') {
      final l = s.mgrLinks.where((x) => '${x['id']}' == d).firstOrNull;
      if (l == null) return _notFound();
      final v = body['value'];
      if (v is! num || v < 0.01 || v > (s.mgrMethod == 'percent' ? 1000 : 100)) return (422, _err('validation', 'Invalid value.'));
      l['allocValue'] = v;
      return (200, {'link': l});
    }
    return _notFound();
  }
  return _notFound();
}
