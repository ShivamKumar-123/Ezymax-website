// The reports service's analytics answer (`GET reports/analytics?login=all|<login>&from&to`, services/reports
// README GET /v1/me/analytics; web components/reports/live-analytics.tsx `Analytics`). Amounts are USD (cent
// accounts converted); times are server time.

double _d(Object? v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;
double? _dn(Object? v) => v is num && v.isFinite ? v.toDouble() : null;
int _i(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;
String _s(Object? v) => v == null ? '' : '$v';
Map<String, dynamic> _m(Object? v) => v is Map ? v.cast<String, dynamic>() : const {};
List<Map<String, dynamic>> _ms(Object? v) => [
  for (final x in (v is List ? v : const []))
    if (x is Map) x.cast<String, dynamic>(),
];

/// The best / worst trade of a period.
class TradeRef {
  const TradeRef({
    required this.deal,
    required this.ticket,
    required this.login,
    required this.symbol,
    required this.side,
    required this.volume,
    required this.net,
  });
  final int deal, ticket, login;
  final String symbol, side;
  final double volume, net;

  static TradeRef? fromJson(Object? v) {
    if (v is! Map) return null;
    final j = v.cast<String, dynamic>();
    return TradeRef(
      deal: _i(j['deal']),
      ticket: _i(j['ticket']),
      login: _i(j['login']),
      symbol: _s(j['symbol']),
      side: _s(j['side']),
      volume: _d(j['volume']),
      net: _d(j['net']),
    );
  }
}

/// Trade statistics of all, long or short trades (web Stats).
class TradeStats {
  const TradeStats({
    this.trades = 0,
    this.wins = 0,
    this.losses = 0,
    this.winRate = 0,
    this.grossProfit = 0,
    this.grossLoss = 0,
    this.net = 0,
    this.avgWin = 0,
    this.avgLoss = 0,
    this.profitFactor,
    this.expectancy = 0,
    this.rewardRisk,
    this.avgHoldSecs = 0,
    this.avgHoldWinSecs = 0,
    this.avgHoldLossSecs = 0,
    this.lots = 0,
    this.commission = 0,
    this.swap = 0,
    this.profit = 0,
    this.maxConsecWins = 0,
    this.maxConsecLosses = 0,
    this.best,
    this.worst,
  });

  final int trades, wins, losses, maxConsecWins, maxConsecLosses;
  final double winRate, grossProfit, grossLoss, net, avgWin, avgLoss, expectancy, avgHoldSecs, avgHoldWinSecs, avgHoldLossSecs, lots, commission, swap, profit;
  final double? profitFactor, rewardRisk;
  final TradeRef? best, worst;

  static TradeStats fromJson(Map<String, dynamic> j) => TradeStats(
    trades: _i(j['trades']),
    wins: _i(j['wins']),
    losses: _i(j['losses']),
    winRate: _d(j['winRate']),
    grossProfit: _d(j['grossProfit']),
    grossLoss: _d(j['grossLoss']),
    net: _d(j['net']),
    avgWin: _d(j['avgWin']),
    avgLoss: _d(j['avgLoss']),
    profitFactor: _dn(j['profitFactor']),
    expectancy: _d(j['expectancy']),
    rewardRisk: _dn(j['rewardRisk']),
    avgHoldSecs: _d(j['avgHoldSecs']),
    avgHoldWinSecs: _d(j['avgHoldWinSecs']),
    avgHoldLossSecs: _d(j['avgHoldLossSecs']),
    lots: _d(j['lots']),
    commission: _d(j['commission']),
    swap: _d(j['swap']),
    profit: _d(j['profit']),
    maxConsecWins: _i(j['maxConsecWins']),
    maxConsecLosses: _i(j['maxConsecLosses']),
    best: TradeRef.fromJson(j['best']),
    worst: TradeRef.fromJson(j['worst']),
  );
}

/// A by-symbol / by-weekday group.
class AnGroup {
  const AnGroup({required this.key, required this.trades, required this.wins, required this.winRate, required this.net, required this.lots});
  final String key;
  final int trades, wins;
  final double winRate, net, lots;

  static AnGroup fromJson(Map<String, dynamic> j) =>
      AnGroup(key: _s(j['key']), trades: _i(j['trades']), wins: _i(j['wins']), winRate: _d(j['winRate']), net: _d(j['net']), lots: _d(j['lots']));
}

/// A trading session (Asia, London, New York, …) of the open time.
class AnSession {
  const AnSession({required this.session, required this.hours, required this.trades, required this.net, required this.winRate});
  final String session, hours;
  final int trades;
  final double net, winRate;

  static AnSession fromJson(Map<String, dynamic> j) =>
      AnSession(session: _s(j['session']), hours: _s(j['hours']), trades: _i(j['trades']), net: _d(j['net']), winRate: _d(j['winRate']));
}

/// A behaviour insight (texts come from the service).
class AnInsight {
  const AnInsight({required this.id, required this.tone, required this.title, required this.stat, required this.text, required this.tip});

  /// overtrading | revenge | risk | hold_losers | stop_out | sl_tp | session | …
  final String id;

  /// up | down | warn | info
  final String tone;
  final String title, stat, text, tip;

  static AnInsight fromJson(Map<String, dynamic> j) =>
      AnInsight(id: _s(j['id']), tone: _s(j['tone']), title: _s(j['title']), stat: _s(j['stat']), text: _s(j['text']), tip: _s(j['tip']));
}

/// One server day of the equity curve.
class AnPoint {
  const AnPoint({required this.day, required this.balance, required this.equity, required this.flow, required this.index, required this.drawdown});
  final String day;
  final double balance, equity, flow, index;

  /// Drawdown from the peak in percent (0 or below).
  final double drawdown;

  static AnPoint fromJson(Map<String, dynamic> j) =>
      AnPoint(day: _s(j['day']), balance: _d(j['balance']), equity: _d(j['equity']), flow: _d(j['flow']), index: _d(j['index']), drawdown: _d(j['drawdown']));
}

class AnCurve {
  const AnCurve({required this.points, this.maxDrawdown = 0, this.currentDrawdown = 0, this.returnPct = 0, this.sharpe, this.sortino, this.volatility});
  final List<AnPoint> points;
  final double maxDrawdown, currentDrawdown, returnPct;
  final double? sharpe, sortino, volatility;

  static AnCurve fromJson(Map<String, dynamic> j) => AnCurve(
    points: [for (final p in _ms(j['points'])) AnPoint.fromJson(p)],
    maxDrawdown: _d(j['maxDrawdown']),
    currentDrawdown: _d(j['currentDrawdown']),
    returnPct: _d(j['returnPct']),
    sharpe: _dn(j['sharpe']),
    sortino: _dn(j['sortino']),
    volatility: _dn(j['volatility']),
  );
}

/// An account the answer covers (the account menu of the Analytics page).
class AnAccount {
  const AnAccount({required this.login, required this.type, required this.groupName, required this.currency, required this.cent});
  final int login;

  /// live | demo
  final String type;
  final String groupName, currency;
  final bool cent;

  static AnAccount fromJson(Map<String, dynamic> j) =>
      AnAccount(login: _i(j['login']), type: _s(j['type']), groupName: _s(j['groupName'] ?? j['group']), currency: _s(j['currency']), cent: j['cent'] == true);
}

/// Where the money came from and went (the waterfall).
class MoneyFlow {
  const MoneyFlow({
    this.deposits = 0,
    this.withdrawals = 0,
    this.tradingPnl = 0,
    this.commission = 0,
    this.performanceFees = 0,
    this.bonus = 0,
    this.adjustments = 0,
    this.earnings = 0,
    this.optionPremiums = 0,
    this.optionSettlements = 0,
    this.equityNow = 0,
  });
  final double deposits, withdrawals, tradingPnl, commission, performanceFees, bonus, adjustments, earnings, optionPremiums, optionSettlements, equityNow;

  static MoneyFlow fromJson(Map<String, dynamic> j) => MoneyFlow(
    deposits: _d(j['deposits']),
    withdrawals: _d(j['withdrawals']),
    tradingPnl: _d(j['tradingPnl']),
    commission: _d(j['commission']),
    performanceFees: _d(j['performanceFees']),
    bonus: _d(j['bonus']),
    adjustments: _d(j['adjustments']),
    earnings: _d(j['earnings']),
    optionPremiums: _d(j['optionPremiums']),
    optionSettlements: _d(j['optionSettlements']),
    equityNow: _d(j['equityNow']),
  );
}

/// What trading cost (all positive).
class Charges {
  const Charges({this.commission = 0, this.swapPaid = 0, this.swapEarned = 0, this.performanceFees = 0, this.walletFees = 0, this.spreadEstimate = 0});
  final double commission, swapPaid, swapEarned, performanceFees, walletFees, spreadEstimate;

  static Charges fromJson(Map<String, dynamic> j) => Charges(
    commission: _d(j['commission']),
    swapPaid: _d(j['swapPaid']),
    swapEarned: _d(j['swapEarned']),
    performanceFees: _d(j['performanceFees']),
    walletFees: _d(j['walletFees']),
    spreadEstimate: _d(j['spreadEstimate']),
  );
}

class Behaviour {
  const Behaviour({this.insights = const []});
  final List<AnInsight> insights;

  static Behaviour fromJson(Map<String, dynamic> j) => Behaviour(insights: [for (final x in _ms(j['insights'])) AnInsight.fromJson(x)]);
}

class Analytics {
  const Analytics({
    required this.scope,
    required this.from,
    required this.to,
    required this.accounts,
    required this.curve,
    required this.stats,
    required this.long,
    required this.short,
    required this.bySymbol,
    required this.byWeekday,
    required this.bySession,
    required this.hourHeatmap,
    required this.hourTrades,
    required this.moneyFlow,
    required this.charges,
    required this.behaviour,
  });

  /// account | live
  final String scope;
  final String from, to;
  final List<AnAccount> accounts;
  final AnCurve curve;
  final TradeStats stats, long, short;
  final List<AnGroup> bySymbol, byWeekday;
  final List<AnSession> bySession;

  /// 7 weekdays (Monday first) x 24 hours: net P&L and trades of the closes.
  final List<List<double>> hourHeatmap;
  final List<List<int>> hourTrades;
  final MoneyFlow moneyFlow;
  final Charges charges;
  final Behaviour behaviour;

  /// Nothing to show for the period (web AnalyticsBody's empty state).
  bool get empty => stats.trades == 0 && curve.points.length < 2;

  static Analytics fromJson(Map<String, dynamic> j) => Analytics(
    scope: _s(j['scope']),
    from: _s(j['from']),
    to: _s(j['to']),
    accounts: [for (final a in _ms(j['accounts'])) AnAccount.fromJson(a)],
    curve: AnCurve.fromJson(_m(j['curve'])),
    stats: TradeStats.fromJson(_m(j['stats'])),
    long: TradeStats.fromJson(_m(j['long'])),
    short: TradeStats.fromJson(_m(j['short'])),
    bySymbol: [for (final g in _ms(j['bySymbol'])) AnGroup.fromJson(g)],
    byWeekday: [for (final g in _ms(j['byWeekday'])) AnGroup.fromJson(g)],
    bySession: [for (final s in _ms(j['bySession'])) AnSession.fromJson(s)],
    hourHeatmap: [
      for (final r in (j['hourHeatmap'] is List ? j['hourHeatmap'] as List : const [])) [for (final v in (r is List ? r : const [])) _d(v)],
    ],
    hourTrades: [
      for (final r in (j['hourTrades'] is List ? j['hourTrades'] as List : const [])) [for (final v in (r is List ? r : const [])) _i(v)],
    ],
    moneyFlow: MoneyFlow.fromJson(_m(j['moneyFlow'])),
    charges: Charges.fromJson(_m(j['charges'])),
    behaviour: Behaviour.fromJson(_m(j['behaviour'])),
  );
}

/// One calendar month of an account (`GET reports/accounts/{login}/months`), newest first.
class MonthRow {
  const MonthRow({
    required this.month,
    required this.from,
    required this.to,
    required this.net,
    required this.deposits,
    required this.withdrawals,
    required this.trades,
  });
  final String month, from, to;
  final double net, deposits, withdrawals;
  final int trades;

  static MonthRow fromJson(Map<String, dynamic> j) => MonthRow(
    month: _s(j['month']),
    from: _s(j['from']),
    to: _s(j['to']),
    net: _d(j['net']),
    deposits: _d(j['deposits']),
    withdrawals: _d(j['withdrawals']),
    trades: _i(j['trades']),
  );
}
