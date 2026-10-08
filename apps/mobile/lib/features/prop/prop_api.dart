// Prop Challenges data: the port of apps/crm/components/prop-live/api.ts (shapes of services/prop/README.md, served by
// the Client Area BFF apps/crm/app/api/prop/[...path]/route.ts, here under /api/mobile/prop/*). Same paths, same poll
// intervals as the web's usePropPoll calls, the same error texts (FRIENDLY / PREFER_SERVICE) and labels.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/format/format.dart';
import '../../core/lifecycle.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';

/* ------------------------------------------------------------------ parsing helpers */

double _d(Object? v, [double f = 0]) => v is num ? v.toDouble() : (double.tryParse('${v ?? ''}') ?? f);
double? _dn(Object? v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
int _i(Object? v, [int f = 0]) => v is num ? v.toInt() : (int.tryParse('${v ?? ''}') ?? f);
int? _in(Object? v) => v == null ? null : (v is num ? v.toInt() : int.tryParse('$v'));
String _s(Object? v, [String f = '']) => v == null ? f : '$v';
String? _sn(Object? v) => v == null ? null : '$v';
bool _b(Object? v, [bool f = false]) => v is bool ? v : f;
DateTime? _dt(Object? v) => v is String && v.isNotEmpty ? DateTime.tryParse(v) : null;
Map<String, dynamic> _m(Object? v) => v is Map ? v.cast<String, dynamic>() : const {};
List<Map<String, dynamic>> _l(Object? v) => v is List ? [for (final e in v.whereType<Map<dynamic, dynamic>>()) e.cast<String, dynamic>()] : const [];

/* ------------------------------------------------------------------ service shapes */

class PlanSize {
  const PlanSize({required this.size, required this.fee, required this.leverage, required this.enabled});
  final double size, fee;
  final int leverage;
  final bool enabled;

  factory PlanSize.fromJson(Map<String, dynamic> j) =>
      PlanSize(size: _d(j['size']), fee: _d(j['fee']), leverage: _i(j['leverage'], 100), enabled: j['enabled'] != false);
}

class PlanPhase {
  const PlanPhase({required this.name, required this.target, required this.minDays, required this.timeLimit});
  final String name;
  final double target;
  final int minDays, timeLimit;

  factory PlanPhase.fromJson(Map<String, dynamic> j) =>
      PlanPhase(name: _s(j['name']), target: _d(j['target']), minDays: _i(j['minDays']), timeLimit: _i(j['timeLimit']));
}

class Plan {
  const Plan({
    required this.id,
    required this.name,
    required this.type,
    required this.sizes,
    required this.phases,
    required this.dailyLoss,
    required this.dailyBasis,
    required this.maxDD,
    required this.ddType,
    required this.trailingLock,
    required this.consistency,
    required this.newsTrading,
    required this.newsWindow,
    required this.newsBreachFails,
    required this.weekendHolding,
    required this.eaAllowed,
    required this.banned,
    required this.split,
    required this.splitMax,
    required this.scalingEvery,
    required this.scalingIncrease,
    required this.scalingProfit,
    required this.scalingCap,
    required this.refundFee,
    required this.payoutFreq,
    required this.firstPayoutDays,
    required this.minPayout,
  });

  final String id, name;

  /// "1-step" | "2-step" | "instant".
  final String type;
  final List<PlanSize> sizes;
  final List<PlanPhase> phases;
  final double dailyLoss;
  final String dailyBasis;
  final double maxDD;
  final String ddType;
  final bool trailingLock;
  final double consistency;
  final bool newsTrading;
  final int newsWindow;
  final bool newsBreachFails, weekendHolding, eaAllowed;
  final List<String> banned;
  final double split, splitMax;
  final int scalingEvery;
  final double scalingIncrease, scalingProfit, scalingCap;
  final bool refundFee;
  final String payoutFreq;
  final int firstPayoutDays;
  final double minPayout;

  bool get hasTimeLimit => phases.any((p) => p.timeLimit > 0);

  Plan withSizes(List<PlanSize> s) => Plan(
    id: id,
    name: name,
    type: type,
    sizes: s,
    phases: phases,
    dailyLoss: dailyLoss,
    dailyBasis: dailyBasis,
    maxDD: maxDD,
    ddType: ddType,
    trailingLock: trailingLock,
    consistency: consistency,
    newsTrading: newsTrading,
    newsWindow: newsWindow,
    newsBreachFails: newsBreachFails,
    weekendHolding: weekendHolding,
    eaAllowed: eaAllowed,
    banned: banned,
    split: split,
    splitMax: splitMax,
    scalingEvery: scalingEvery,
    scalingIncrease: scalingIncrease,
    scalingProfit: scalingProfit,
    scalingCap: scalingCap,
    refundFee: refundFee,
    payoutFreq: payoutFreq,
    firstPayoutDays: firstPayoutDays,
    minPayout: minPayout,
  );

  factory Plan.fromJson(Map<String, dynamic> j) => Plan(
    id: _s(j['id']),
    name: _s(j['name']),
    type: _s(j['type'], '2-step'),
    sizes: [for (final s in _l(j['sizes'])) PlanSize.fromJson(s)],
    phases: [for (final p in _l(j['phases'])) PlanPhase.fromJson(p)],
    dailyLoss: _d(j['dailyLoss']),
    dailyBasis: _s(j['dailyBasis'], 'balance'),
    maxDD: _d(j['maxDD']),
    ddType: _s(j['ddType'], 'static'),
    trailingLock: _b(j['trailingLock']),
    consistency: _d(j['consistency']),
    newsTrading: _b(j['newsTrading'], true),
    newsWindow: _i(j['newsWindow']),
    newsBreachFails: _b(j['newsBreachFails']),
    weekendHolding: _b(j['weekendHolding'], true),
    eaAllowed: _b(j['eaAllowed'], true),
    banned: [for (final b in (j['banned'] is List ? j['banned'] as List : const [])) '$b'],
    split: _d(j['split']),
    splitMax: _d(j['splitMax'], _d(j['split'])),
    scalingEvery: _i(j['scalingEvery']),
    scalingIncrease: _d(j['scalingIncrease']),
    scalingProfit: _d(j['scalingProfit']),
    scalingCap: _d(j['scalingCap']),
    refundFee: _b(j['refundFee']),
    payoutFreq: _s(j['payoutFreq'], 'monthly'),
    firstPayoutDays: _i(j['firstPayoutDays']),
    minPayout: _d(j['minPayout']),
  );
}

/// The live rule dashboard from the last evaluation (PhaseAccount.rules).
class LiveRules {
  const LiveRules({
    required this.dailyLimit,
    required this.dailyRef,
    required this.dailyFloor,
    required this.dailyUsed,
    required this.ddLimit,
    required this.ddFloor,
    required this.ddUsed,
    required this.hwm,
    required this.profit,
    required this.targetAmount,
    required this.targetReached,
    required this.tradingDays,
    required this.minDays,
    required this.daysOk,
    required this.bestDay,
    required this.consistencyLimit,
    required this.consistencyOk,
    required this.deadline,
    required this.nextReset,
    required this.weekendWindow,
    required this.equity,
    required this.balance,
  });

  final double dailyLimit, dailyRef, dailyFloor, dailyUsed, ddLimit, ddFloor, ddUsed, hwm, profit;
  final double? targetAmount;
  final bool targetReached;
  final int tradingDays, minDays;
  final bool daysOk;
  final double? bestDay, consistencyLimit;
  final bool consistencyOk;
  final DateTime? deadline, nextReset;
  final bool weekendWindow;
  final double equity, balance;

  factory LiveRules.fromJson(Map<String, dynamic> j) => LiveRules(
    dailyLimit: _d(j['dailyLimit']),
    dailyRef: _d(j['dailyRef']),
    dailyFloor: _d(j['dailyFloor']),
    dailyUsed: _d(j['dailyUsed']),
    ddLimit: _d(j['ddLimit']),
    ddFloor: _d(j['ddFloor']),
    ddUsed: _d(j['ddUsed']),
    hwm: _d(j['hwm']),
    profit: _d(j['profit']),
    targetAmount: _dn(j['targetAmount']),
    targetReached: _b(j['targetReached']),
    tradingDays: _i(j['tradingDays']),
    minDays: _i(j['minDays']),
    daysOk: _b(j['daysOk']),
    bestDay: _dn(j['bestDay']),
    consistencyLimit: _dn(j['consistencyLimit']),
    consistencyOk: _b(j['consistencyOk'], true),
    deadline: _dt(j['deadline']),
    nextReset: _dt(j['nextReset']),
    weekendWindow: _b(j['weekendWindow']),
    equity: _d(j['equity']),
    balance: _d(j['balance']),
  );
}

class TradingStats {
  const TradingStats({
    required this.trades,
    required this.open,
    required this.winRate,
    required this.avgWin,
    required this.avgLoss,
    required this.profitFactor,
    required this.lots,
    required this.bestDay,
    required this.bestDayProfit,
  });
  final int trades;
  final int? open;
  final double? winRate;
  final double avgWin, avgLoss;
  final double? profitFactor;
  final double lots;
  final DateTime? bestDay;
  final double bestDayProfit;

  factory TradingStats.fromJson(Map<String, dynamic> j) {
    final best = j['bestDay'] is Map ? _m(j['bestDay']) : null;
    return TradingStats(
      trades: _i(j['trades']),
      open: _in(j['open']),
      winRate: _dn(j['winRate']),
      avgWin: _d(j['avgWin']),
      avgLoss: _d(j['avgLoss']),
      profitFactor: _dn(j['profitFactor']),
      lots: _d(j['lots']),
      bestDay: best == null ? null : _dt(best['day']),
      bestDayProfit: best == null ? 0 : _d(best['profit']),
    );
  }
}

class PhaseAccount {
  const PhaseAccount({
    required this.id,
    required this.phaseIndex,
    required this.phase,
    required this.funded,
    required this.login,
    required this.status,
    required this.initialBalance,
    required this.targetPct,
    required this.minDays,
    required this.timeLimitDays,
    required this.startedAt,
    required this.endedAt,
    required this.endReason,
    required this.balance,
    required this.equity,
    required this.openPositions,
    required this.tradingDays,
    required this.rules,
    required this.stats,
  });

  final int id, phaseIndex;
  final String phase;
  final bool funded;
  final int? login;

  /// provisioning | active | passed | failed | closed.
  final String status;
  final double initialBalance;
  final double? targetPct;
  final int minDays, timeLimitDays;
  final DateTime? startedAt, endedAt;
  final String? endReason;
  final double? balance, equity;
  final int openPositions, tradingDays;
  final LiveRules? rules;
  final TradingStats? stats;

  factory PhaseAccount.fromJson(Map<String, dynamic> j) => PhaseAccount(
    id: _i(j['id']),
    phaseIndex: _i(j['phaseIndex']),
    phase: _s(j['phase']),
    funded: _b(j['funded']),
    login: _in(j['login']),
    status: _s(j['status'], 'provisioning'),
    initialBalance: _d(j['initialBalance']),
    targetPct: _dn(j['targetPct']),
    minDays: _i(j['minDays']),
    timeLimitDays: _i(j['timeLimitDays']),
    startedAt: _dt(j['startedAt']),
    endedAt: _dt(j['endedAt']),
    endReason: _sn(j['endReason']),
    balance: _dn(j['balance']),
    equity: _dn(j['equity']),
    openPositions: _i(j['openPositions']),
    tradingDays: _i(j['tradingDays']),
    rules: j['rules'] is Map ? LiveRules.fromJson(_m(j['rules'])) : null,
    stats: j['stats'] is Map ? TradingStats.fromJson(_m(j['stats'])) : null,
  );
}

class PayoutQuote {
  const PayoutQuote({
    required this.eligibleFrom,
    required this.profit,
    required this.split,
    required this.traderAmount,
    required this.firmAmount,
    required this.feeRefund,
    required this.total,
    required this.minPayout,
    required this.blockers,
    required this.eligible,
  });
  final DateTime? eligibleFrom;
  final double profit, split, traderAmount, firmAmount, feeRefund, total, minPayout;
  final List<String> blockers;
  final bool eligible;

  factory PayoutQuote.fromJson(Map<String, dynamic> j) => PayoutQuote(
    eligibleFrom: _dt(j['eligibleFrom']),
    profit: _d(j['profit']),
    split: _d(j['split']),
    traderAmount: _d(j['traderAmount']),
    firmAmount: _d(j['firmAmount']),
    feeRefund: _d(j['feeRefund']),
    total: _d(j['total']),
    minPayout: _d(j['minPayout']),
    blockers: [for (final b in (j['blockers'] is List ? j['blockers'] as List : const [])) '$b'],
    eligible: _b(j['eligible']),
  );
}

class RuleEvent {
  const RuleEvent({
    required this.id,
    required this.accountId,
    required this.login,
    required this.rule,
    required this.severity,
    required this.at,
    required this.equity,
    required this.threshold,
    required this.message,
    required this.kind,
  });
  final int id, accountId;
  final int? login;
  final String rule, severity;
  final DateTime? at;
  final double? equity, threshold;
  final String message;

  /// details.kind of a banned_strategy event.
  final String? kind;

  factory RuleEvent.fromJson(Map<String, dynamic> j) => RuleEvent(
    id: _i(j['id']),
    accountId: _i(j['accountId']),
    login: _in(j['login']),
    rule: _s(j['rule']),
    severity: _s(j['severity'], 'info'),
    at: _dt(j['at']),
    equity: _dn(j['equity']),
    threshold: _dn(j['threshold']),
    message: _s(j['message']),
    kind: j['details'] is Map ? _sn(_m(j['details'])['kind']) : null,
  );
}

class Certificate {
  const Certificate({
    required this.code,
    required this.kind,
    required this.title,
    required this.traderName,
    required this.planName,
    required this.size,
    required this.amount,
    required this.phase,
    required this.issuedAt,
    required this.revoked,
    required this.challengeId,
  });
  final String code;

  /// pass | funded | payout.
  final String kind;
  final String title, traderName, planName;
  final double size;
  final double? amount;
  final String? phase;
  final DateTime? issuedAt;
  final bool revoked;
  final int challengeId;

  factory Certificate.fromJson(Map<String, dynamic> j) => Certificate(
    code: _s(j['code']),
    kind: _s(j['kind'], 'pass'),
    title: _s(j['title']),
    traderName: _s(j['traderName']),
    planName: _s(j['planName']),
    size: _d(j['size']),
    amount: _dn(j['amount']),
    phase: _sn(j['phase']),
    issuedAt: _dt(j['issuedAt']),
    revoked: _b(j['revoked']),
    challengeId: _i(j['challengeId']),
  );
}

class Challenge {
  const Challenge({
    required this.id,
    required this.planName,
    required this.type,
    required this.size,
    required this.fee,
    required this.leverage,
    required this.status,
    required this.phaseIndex,
    required this.split,
    required this.failureReason,
    required this.plan,
    required this.phases,
    required this.current,
    this.payout,
    this.events = const [],
    this.certificates = const [],
  });

  final int id;
  final String planName, type;
  final double size, fee;
  final int leverage;

  /// pending_payment | provisioning | active | funded | failed | closed | payment_failed.
  final String status;
  final int phaseIndex;
  final double split;
  final String? failureReason;
  final Plan plan;
  final List<PhaseAccount> phases;
  final PhaseAccount? current;

  /// Detail answer only (GET challenges/{id}).
  final PayoutQuote? payout;
  final List<RuleEvent> events;
  final List<Certificate> certificates;

  factory Challenge.fromJson(Map<String, dynamic> j) => Challenge(
    id: _i(j['id']),
    planName: _s(j['planName']),
    type: _s(j['type'], '2-step'),
    size: _d(j['size']),
    fee: _d(j['fee']),
    leverage: _i(j['leverage'], 100),
    status: _s(j['status'], 'provisioning'),
    phaseIndex: _i(j['phaseIndex']),
    split: _d(j['split']),
    failureReason: _sn(j['failureReason']),
    plan: Plan.fromJson(_m(j['plan'])),
    phases: [for (final p in _l(j['phases'])) PhaseAccount.fromJson(p)],
    current: j['current'] is Map ? PhaseAccount.fromJson(_m(j['current'])) : null,
    payout: j['payout'] is Map ? PayoutQuote.fromJson(_m(j['payout'])) : null,
    events: [for (final e in _l(j['events'])) RuleEvent.fromJson(e)],
    certificates: [for (final c in _l(j['certificates'])) Certificate.fromJson(c)],
  );
}

class Payout {
  const Payout({
    required this.id,
    required this.challengeId,
    required this.login,
    required this.profit,
    required this.split,
    required this.traderAmount,
    required this.feeRefund,
    required this.total,
    required this.status,
    required this.requestedAt,
    required this.decidedAt,
    required this.note,
    required this.planName,
    required this.size,
  });
  final int id, challengeId;
  final int? login;
  final double profit, split, traderAmount, feeRefund, total;

  /// pending | approved | paid | rejected | failed.
  final String status;
  final DateTime? requestedAt, decidedAt;
  final String? note;
  final String planName;
  final double size;

  factory Payout.fromJson(Map<String, dynamic> j) => Payout(
    id: _i(j['id']),
    challengeId: _i(j['challengeId']),
    login: _in(j['login']),
    profit: _d(j['profit']),
    split: _d(j['split']),
    traderAmount: _d(j['traderAmount']),
    feeRefund: _d(j['feeRefund']),
    total: _d(j['total']),
    status: _s(j['status'], 'pending'),
    requestedAt: _dt(j['requestedAt']),
    decidedAt: _dt(j['decidedAt']),
    note: _sn(j['note']),
    planName: _s(j['planName']),
    size: _d(j['size']),
  );
}

class FundedAccount {
  const FundedAccount({
    required this.challengeId,
    required this.planName,
    required this.size,
    required this.login,
    required this.balance,
    required this.equity,
    required this.quote,
    required this.refundFee,
    required this.feeRefunded,
  });
  final int challengeId;
  final String planName;
  final double size;
  final int? login;
  final double? balance, equity;
  final PayoutQuote quote;
  final bool refundFee, feeRefunded;

  factory FundedAccount.fromJson(Map<String, dynamic> j) => FundedAccount(
    challengeId: _i(j['challengeId']),
    planName: _s(j['planName']),
    size: _d(j['size']),
    login: _in(j['login']),
    balance: _dn(j['balance']),
    equity: _dn(j['equity']),
    quote: PayoutQuote.fromJson(_m(j['quote'])),
    refundFee: _b(j['refundFee']),
    feeRefunded: _b(j['feeRefunded']),
  );
}

class PayoutsData {
  const PayoutsData({required this.payouts, required this.funded, required this.kycStatus});
  final List<Payout> payouts;
  final List<FundedAccount> funded;
  final String kycStatus;
}

class PropTrade {
  const PropTrade({
    required this.ticket,
    required this.symbol,
    required this.side,
    required this.volume,
    required this.openTime,
    required this.closeTime,
    required this.openPrice,
    required this.closePrice,
    required this.profit,
    required this.durationSecs,
  });
  final int ticket;
  final String symbol, side;
  final double volume;
  final DateTime? openTime, closeTime;
  final num openPrice, closePrice;
  final double profit;
  final double durationSecs;

  factory PropTrade.fromJson(Map<String, dynamic> j) => PropTrade(
    ticket: _i(j['ticket']),
    symbol: _s(j['symbol']),
    side: _s(j['side'], 'buy'),
    volume: _d(j['volume']),
    openTime: _dt(j['openTime']),
    closeTime: _dt(j['closeTime']),
    openPrice: j['openPrice'] is num ? j['openPrice'] as num : _d(j['openPrice']),
    closePrice: j['closePrice'] is num ? j['closePrice'] as num : _d(j['closePrice']),
    profit: _d(j['profit']),
    durationSecs: _d(j['durationSecs']),
  );
}

class EquityPoint {
  const EquityPoint(this.at, this.balance, this.equity);
  final DateTime at;
  final double balance, equity;
}

class PurchaseCredentials {
  const PurchaseCredentials({required this.login, required this.password, required this.investorPassword});
  final int login;
  final String password, investorPassword;
}

class PurchaseResult {
  const PurchaseResult({required this.challenge, required this.credentials});
  final Challenge challenge;
  final PurchaseCredentials? credentials;

  factory PurchaseResult.fromJson(Map<String, dynamic> j) {
    final c = j['credentials'] is Map ? _m(j['credentials']) : null;
    return PurchaseResult(
      challenge: Challenge.fromJson(_m(j['challenge'])),
      credentials: c == null ? null : PurchaseCredentials(login: _i(c['login']), password: _s(c['password']), investorPassword: _s(c['investorPassword'])),
    );
  }
}

/* ------------------------------------------------------------------ providers (the web's usePropPoll calls) */

const List<String> kPlanTypeOrder = ['1-step', '2-step', 'instant'];

/// GET plans (store: once). Enabled sizes only, sorted; plans without sizes dropped; 1-Step, 2-Step, Instant.
final propPlansProvider = FutureProvider.autoDispose<List<Plan>>((ref) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('prop/plans');
  final list = [
    for (final p in _l(j['plans']).map(Plan.fromJson)) p.withSizes(p.sizes.where((s) => s.enabled).toList()..sort((a, b) => a.size.compareTo(b.size))),
  ].where((p) => p.sizes.isNotEmpty).toList();
  int rank(Plan p) => kPlanTypeOrder.contains(p.type) ? kPlanTypeOrder.indexOf(p.type) : -1;
  list.sort((a, b) => rank(a).compareTo(rank(b)));
  return list;
});

/// GET challenges; the argument is the web's poll interval in seconds (0 = once: store, payouts; 10: My challenges).
final propChallengesProvider = FutureProvider.autoDispose.family<List<Challenge>, int>((ref, pollSeconds) async {
  if (pollSeconds > 0) ref.pollEvery(Duration(seconds: pollSeconds));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('prop/challenges');
  return [for (final c in _l(j['challenges'])) Challenge.fromJson(c)];
});

/// GET challenges/{id} (+ payout quote, events, certificates), every 2 s like the web.
final propChallengeProvider = FutureProvider.autoDispose.family<Challenge, int>((ref, id) async {
  ref.pollEvery(const Duration(seconds: 2));
  return Challenge.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('prop/challenges/$id'));
});

typedef PhaseKey = ({int id, int phase, bool live});

/// GET challenges/{id}/equity?phase&limit=2000 (every 30 s while the phase is tradable).
final propEquityProvider = FutureProvider.autoDispose.family<List<EquityPoint>, PhaseKey>((ref, k) async {
  if (k.live) ref.pollEvery(const Duration(seconds: 30));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('prop/challenges/${k.id}/equity', query: {'phase': k.phase, 'limit': 2000});
  return [
    for (final p in _l(j['points']))
      if (_dt(p['at']) != null) EquityPoint(_dt(p['at'])!, _d(p['balance']), _d(p['equity'])),
  ];
});

/// GET challenges/{id}/trades?phase (every 15 s while the phase is tradable).
final propTradesProvider = FutureProvider.autoDispose.family<List<PropTrade>, PhaseKey>((ref, k) async {
  if (k.live) ref.pollEvery(const Duration(seconds: 15));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('prop/challenges/${k.id}/trades', query: {'phase': k.phase});
  return [for (final t in _l(j['trades'])) PropTrade.fromJson(t)];
});

/// GET payouts (every 15 s).
final propPayoutsProvider = FutureProvider.autoDispose<PayoutsData>((ref) async {
  ref.pollEvery(const Duration(seconds: 15));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('prop/payouts');
  return PayoutsData(
    payouts: [for (final p in _l(j['payouts'])) Payout.fromJson(p)],
    funded: [for (final f in _l(j['funded'])) FundedAccount.fromJson(f)],
    kycStatus: _s(j['kycStatus'], 'unverified'),
  );
});

/// GET certificates (once).
final propCertificatesProvider = FutureProvider.autoDispose<List<Certificate>>((ref) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('prop/certificates');
  return [for (final c in _l(j['certificates'])) Certificate.fromJson(c)];
});

/// POST challenges {planId, size, idempotencyKey}: buys a challenge from the USDT wallet. Never retried on its own; a
/// retry by the client reuses the same key, so the fee is never charged twice.
Future<PurchaseResult> buyChallenge(ApiClient api, {required String planId, required double size, required String key}) async {
  final j = await api.post<Map<String, dynamic>>('prop/challenges', body: {'planId': planId, 'size': size, 'idempotencyKey': key});
  return PurchaseResult.fromJson(j);
}

/// POST challenges/{id}/payouts: requests the payout of the current quote.
Future<Payout> requestPayout(ApiClient api, int challengeId) async {
  final j = await api.post<Map<String, dynamic>>('prop/challenges/$challengeId/payouts', body: const <String, dynamic>{});
  return Payout.fromJson(_m(j['payout']));
}

/* ------------------------------------------------------------------ errors (propApi) */

/// Codes that need an action outside this page: shown with a link (web ERROR_LINK).
const Map<String, (String href, String labelKey)> kPropErrorLink = {
  'insufficient_funds': ('/wallet/deposit', 'prop.errorLink.deposit'),
  'kyc_required': ('/profile/verification', 'prop.errorLink.verify'),
};

const Map<String, String> _friendly = {
  'insufficient_funds': 'prop.error.insufficientFunds',
  'kyc_required': 'prop.error.kycRequired',
  'payment_pending': 'prop.error.paymentPending',
  'payment_failed': 'prop.error.paymentFailed',
  'wallet_pending': 'prop.error.walletPending',
  'wallet_rejected': 'prop.error.walletRejected',
  'provisioning': 'prop.error.provisioning',
  'plan_unavailable': 'prop.error.planUnavailable',
  'not_yet_eligible': 'prop.error.notYetEligible',
  'below_minimum': 'prop.error.belowMinimum',
  'positions_open': 'prop.error.positionsOpen',
  'payout_pending': 'prop.error.payoutPending',
  'consistency': 'prop.error.consistency',
  'not_funded': 'prop.error.notFunded',
  'account_unavailable': 'prop.error.accountUnavailable',
  'idempotency_conflict': 'prop.error.idempotencyConflict',
  'not_active': 'prop.error.notActive',
  'account_limit': 'prop.error.accountLimit',
};

const Set<String> _preferService = {'not_yet_eligible', 'below_minimum', 'consistency', 'positions_open', 'payout_pending', 'plan_unavailable'};

String propErrorCode(Object? e) => e is ApiException ? e.code : 'error';

/// The web's propApi message: the service's own text for the payout gates, the friendly text for known codes.
String propErrorText(Object? e, T t) {
  if (e is! ApiException) return t('prop.error.generic');
  if (e.isNetwork) return t('prop.error.network');
  final code = e.code;
  if (_preferService.contains(code) && e.message.isNotEmpty) return e.message;
  final key = _friendly[code];
  if (key != null) return t(key);
  if (code.startsWith('engine_') && e.message.isEmpty) return t('prop.error.engine');
  return localizeError(e, t);
}

/* ------------------------------------------------------------------ formatting (api.ts) */

String _trimNum(double v, int d) {
  var s = v.toStringAsFixed(d);
  if (s.contains('.')) s = s.replaceFirst(RegExp(r'\.?0+$'), '');
  return s;
}

/// "$1,234.50" (web usd); "—" when missing.
String usd(num? v, [int decimals = 2]) {
  if (v == null || !v.isFinite) return '—';
  return '${v < 0 ? '-' : ''}\$${Fmt.number(v.abs(), decimals)}';
}

/// A fee: no decimals when whole.
String feeText(double fee) => usd(fee, fee % 1 != 0 ? 2 : 0);

/// "+$12.50" / "-$3.00" (web signedUsd).
String signedUsd(double v) => '${v > 0 ? '+' : (v < 0 ? '-' : '')}${usd(v.abs())}';

/// "$10k", "$200k", "$1M" (web sizeLabel).
String sizeLabel(num n) => n >= 1000000 ? '\$${_trimNum(n / 1000000, 2)}M' : (n >= 1000 ? '\$${_trimNum(n / 1000, 1)}k' : '\$${_trimNum(n.toDouble(), 0)}');

/// A number as JS prints it inside a sentence (8, 2.5): for message placeholders.
String numText(num v) => _trimNum(v.toDouble(), 2);

/// A percentage as the web prints it (`${x}%` with JS number formatting: 8, 2.5).
String pctText(num v) => '${numText(v)}%';

String typeLabel(T t, String type) => switch (type) {
  '1-step' => t('prop.type.oneStep'),
  '2-step' => t('prop.type.twoStep'),
  'instant' => t('prop.type.instant'),
  _ => type,
};

IconData typeIcon(String type) => switch (type) {
  '1-step' => LucideIcons.target,
  'instant' => LucideIcons.zap,
  _ => LucideIcons.layers,
};

const Map<String, String> _bannedKey = {
  'hft': 'prop.banned.hft',
  'latency_arbitrage': 'prop.banned.latencyArbitrage',
  'tick_scalping': 'prop.banned.tickScalping',
  'cross_account_copying': 'prop.banned.crossAccountCopying',
  'cross_account_hedging': 'prop.banned.crossAccountHedging',
  'martingale': 'prop.banned.martingale',
  'grid': 'prop.banned.grid',
};

String bannedLabel(T t, String k) => _bannedKey[k] != null ? t(_bannedKey[k]!) : k.replaceAll('_', ' ');

const Map<String, String> _payoutFreqKey = {
  'weekly': 'prop.payoutFreq.weekly',
  'bi-weekly': 'prop.payoutFreq.biWeekly',
  'monthly': 'prop.payoutFreq.monthly',
  'on-demand': 'prop.payoutFreq.onDemand',
};

String payoutFreqLabel(T t, String f) => _payoutFreqKey[f] != null ? t(_payoutFreqKey[f]!) : f;

const Map<String, String> _ruleKey = {
  'daily_loss': 'prop.rule.dailyLoss',
  'max_drawdown': 'prop.rule.maxDrawdown',
  'profit_target': 'prop.rule.profitTarget',
  'time_limit': 'prop.rule.timeLimit',
  'weekend_holding': 'prop.rule.weekendHolding',
  'news_window': 'prop.rule.newsWindow',
  'banned_strategy': 'prop.rule.bannedStrategy',
  'consistency': 'prop.rule.consistency',
  'manual': 'prop.rule.riskDesk',
  'override': 'prop.rule.riskDesk',
};

String ruleLabel(T t, String r) {
  if (_ruleKey[r] != null) return t(_ruleKey[r]!);
  final s = r.replaceAll('_', ' ');
  return s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';
}

const Map<String, String> _blockerKey = {
  'not_yet_eligible': 'prop.blocker.notYetEligible',
  'below_minimum': 'prop.blocker.belowMinimum',
  'positions_open': 'prop.blocker.positionsOpen',
  'payout_pending': 'prop.blocker.payoutPending',
  'consistency': 'prop.blocker.consistency',
};

String blockerText(T t, String b) => _blockerKey[b] != null ? t(_blockerKey[b]!) : b.replaceAll('_', ' ');

String basisLabel(T t, String b) => t.dyn('prop.basis.$b', fallback: b);
String ddTypeLabel(T t, String d) => t.dyn('prop.ddType.$d', fallback: d);
String daysText(T t, int n) => t('prop.days', {'count': n});

/// "24 Sep 2026" (web fmtDate); "—" when missing.
String fmtDate(T t, DateTime? d) => d == null ? '—' : LocaleFormat(t.locale).date(d);

/// "24 Sep, 21:40" (web fmtDateTime); "—" when missing.
String fmtDateTime(T t, DateTime? d) => d == null ? '—' : LocaleFormat(t.locale).dateTime(d);

String fmtDuration(T t, double secs) {
  if (!secs.isFinite || secs < 0) return '—';
  final s = secs.round();
  if (secs < 60) return t('prop.duration.s', {'s': s});
  if (secs < 3600) return t('prop.duration.ms', {'m': s ~/ 60, 's': s % 60});
  if (secs < 86400) return t('prop.duration.hm', {'h': s ~/ 3600, 'm': (s % 3600) ~/ 60});
  return t('prop.duration.dh', {'d': s ~/ 86400, 'h': (s % 86400) ~/ 3600});
}

/// Steps of a plan: Phase 1 → Phase 2 → Funded / Evaluation → Funded / Funded.
List<String> planSteps(T t, Plan p) => [...p.phases.map((x) => x.name), t('prop.status.funded')];

/// Stepper index for a challenge.
int stepIndex(Challenge c) => c.status == 'funded' ? c.plan.phases.length : (c.phaseIndex < c.plan.phases.length ? c.phaseIndex : c.plan.phases.length);

KChipTone challengeTone(String s) => switch (s) {
  'pending_payment' => KChipTone.warn,
  'provisioning' => KChipTone.info,
  'active' => KChipTone.ember,
  'funded' => KChipTone.gold,
  'failed' || 'payment_failed' => KChipTone.down,
  _ => KChipTone.neutral,
};

String challengeStatusLabel(T t, String s) => switch (s) {
  'pending_payment' => t('prop.status.pendingPayment'),
  'provisioning' => t('prop.status.provisioning'),
  'active' => t('prop.status.active'),
  'funded' => t('prop.status.funded'),
  'failed' => t('prop.status.failed'),
  'closed' => t('prop.status.closed'),
  'payment_failed' => t('prop.status.paymentFailed'),
  _ => s,
};

/// "Phase 2 · Active", "Funded", "Phase 1 · Failed".
String stageLabel(T t, Challenge c) {
  final cur = c.current;
  if (c.status == 'funded') return t('prop.status.funded');
  if (c.status == 'active' && cur != null) return t('prop.stage.active', {'phase': cur.phase});
  if (c.status == 'failed' && cur != null) return t('prop.stage.failed', {'phase': cur.phase});
  return challengeStatusLabel(t, c.status);
}

/* ------------------------------------------------------------------ the rule view (mine.tsx viewOf) */

/// The live rules of a phase account, or the plan's terms before the first evaluation.
class RuleView {
  const RuleView({
    required this.dailyLimit,
    required this.dailyRef,
    required this.dailyFloor,
    required this.dailyUsed,
    required this.ddLimit,
    required this.ddFloor,
    required this.ddUsed,
    required this.hwm,
    required this.profit,
    required this.targetAmount,
    required this.targetReached,
    required this.tradingDays,
    required this.minDays,
    required this.daysOk,
    required this.bestDay,
    required this.consistencyLimit,
    required this.consistencyOk,
    required this.deadline,
    required this.nextReset,
    required this.weekendWindow,
    required this.equity,
    required this.balance,
    required this.initial,
    required this.live,
  });

  final double dailyLimit, dailyRef, dailyFloor, dailyUsed, ddLimit, ddFloor, ddUsed, hwm, profit;
  final double? targetAmount;
  final bool targetReached;
  final int tradingDays, minDays;
  final bool daysOk;
  final double? bestDay, consistencyLimit;
  final bool consistencyOk;
  final DateTime? deadline, nextReset;
  final bool weekendWindow;
  final double equity, balance, initial;
  final bool live;

  factory RuleView.of(Challenge c, PhaseAccount a) {
    final init = a.initialBalance;
    final r = a.rules;
    final eq = a.equity ?? r?.equity ?? init;
    final bal = a.balance ?? r?.balance ?? init;
    if (r != null) {
      return RuleView(
        dailyLimit: r.dailyLimit,
        dailyRef: r.dailyRef,
        dailyFloor: r.dailyFloor,
        dailyUsed: r.dailyUsed,
        ddLimit: r.ddLimit,
        ddFloor: r.ddFloor,
        ddUsed: r.ddUsed,
        hwm: r.hwm,
        profit: r.profit,
        targetAmount: r.targetAmount,
        targetReached: r.targetReached,
        tradingDays: r.tradingDays,
        minDays: r.minDays,
        daysOk: r.daysOk,
        bestDay: r.bestDay,
        consistencyLimit: r.consistencyLimit,
        consistencyOk: r.consistencyOk,
        deadline: r.deadline,
        nextReset: r.nextReset,
        weekendWindow: r.weekendWindow,
        equity: eq,
        balance: bal,
        initial: init,
        live: true,
      );
    }
    final dl = init * c.plan.dailyLoss / 100;
    final dd = init * c.plan.maxDD / 100;
    return RuleView(
      dailyLimit: dl,
      dailyRef: init,
      dailyFloor: init - dl,
      dailyUsed: 0,
      ddLimit: dd,
      ddFloor: init - dd,
      ddUsed: 0,
      hwm: init,
      profit: eq - init,
      targetAmount: a.targetPct != null ? init * a.targetPct! / 100 : null,
      targetReached: false,
      tradingDays: a.tradingDays,
      minDays: a.minDays,
      daysOk: a.tradingDays >= a.minDays,
      bestDay: null,
      consistencyLimit: null,
      consistencyOk: true,
      deadline: a.timeLimitDays > 0 && a.startedAt != null ? a.startedAt!.add(Duration(days: a.timeLimitDays)) : null,
      nextReset: null,
      weekendWindow: false,
      equity: eq,
      balance: bal,
      initial: init,
      live: false,
    );
  }
}

/// a / b as a percentage (0 when b is 0).
double ratio(double a, double b) => b > 0 ? (a / b * 100).clamp(0, double.infinity).toDouble() : 0;

/// A phase account can be traded now (web tradable).
bool tradable(Challenge c, PhaseAccount a) => a.status == 'active' && (c.status == 'active' || c.status == 'funded') && c.current?.id == a.id;

/// The selector's progress bar: profit towards the target (funded: towards the drawdown amount).
double progressOf(Challenge c) {
  final a = c.current;
  if (a == null) return 0;
  final v = RuleView.of(c, a);
  final p = v.profit < 0 ? 0.0 : v.profit;
  if (a.funded || v.targetAmount == null || v.targetAmount == 0) return ratio(p, a.initialBalance * c.plan.maxDD / 100);
  return ratio(p, v.targetAmount!);
}

/// Active and funded first, then opening, then the rest; newest first.
List<Challenge> sortChallenges(List<Challenge> list) {
  int rank(Challenge c) => c.status == 'active' || c.status == 'funded' ? 0 : (c.status == 'provisioning' || c.status == 'pending_payment' ? 1 : 2);
  return [...list]..sort((a, b) {
    final r = rank(a).compareTo(rank(b));
    return r != 0 ? r : b.id.compareTo(a.id);
  });
}

/* ------------------------------------------------------------------ daily reset (ui.tsx) */

/// Next 17:00 New York (21:00 UTC during US DST, 22:00 UTC otherwise).
DateTime nextNyClose(DateTime now) {
  final u = now.toUtc();
  final y = u.year;
  int nthSunday(int month, int n) {
    final first = DateTime.utc(y, month).weekday % 7; // 0 = Sunday
    return 1 + ((7 - first) % 7) + (n - 1) * 7;
  }

  final dstStart = DateTime.utc(y, 3, nthSunday(3, 2), 7);
  final dstEnd = DateTime.utc(y, 11, nthSunday(11, 1), 6);
  final hour = !u.isBefore(dstStart) && u.isBefore(dstEnd) ? 21 : 22;
  var t = DateTime.utc(u.year, u.month, u.day, hour);
  if (!t.isAfter(u)) t = t.add(const Duration(days: 1));
  return t;
}

/// "HH:MM:SS" (web hms).
String hms(Duration d) {
  final s = d.isNegative ? 0 : d.inSeconds;
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(s ~/ 3600)}:${two((s % 3600) ~/ 60)}:${two(s % 60)}';
}
