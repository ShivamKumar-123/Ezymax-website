// Contests & Rewards data: the port of apps/crm/components/growth/api.ts (shapes of services/growth, served by the
// Client Area BFF /api/growth/* = the app's /api/mobile/growth/*). Same paths, same poll intervals as the web's
// useGrowth hooks: contests 60 s, a contest 15 s, cashback 60 s, promotions 60 s; the rest load once (and again on
// pull to refresh or after a write).
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/format/format.dart';
import '../../core/lifecycle.dart';
import '../../i18n/i18n.dart';

/* ------------------------------------------------------------------ parsing helpers */

double _d(Object? v) => v is num ? v.toDouble() : (v is String ? double.tryParse(v) ?? 0 : 0);
double? _dn(Object? v) => v is num ? v.toDouble() : (v is String ? double.tryParse(v) : null);
int _i(Object? v) => v is num ? v.round() : (v is String ? int.tryParse(v) ?? 0 : 0);
int? _in(Object? v) => v is num ? v.round() : (v is String ? int.tryParse(v) : null);
String _s(Object? v) => v == null ? '' : '$v';
String? _sn(Object? v) => v == null ? null : '$v';
bool _b(Object? v) => v == true;
DateTime? _t(Object? v) => v is String ? DateTime.tryParse(v) : null;
List<String> _strs(Object? v) => [for (final x in (v is List ? v : const [])) '$x'];
Map<String, dynamic> _m(Object? v) => v is Map ? v.cast<String, dynamic>() : const {};
List<Map<String, dynamic>> _ms(Object? v) => [for (final x in (v is List ? v : const [])) _m(x)];

/* ------------------------------------------------------------------ loyalty */

class Tier {
  const Tier({required this.key, required this.name, required this.rank, required this.minPoints, required this.multiplier, required this.perks});
  final String key, name;
  final int rank;
  final double minPoints, multiplier;
  final List<String> perks;

  factory Tier.fromJson(Map<String, dynamic> j) => Tier(
    key: _s(j['key']),
    name: _s(j['name']),
    rank: _i(j['rank']),
    minPoints: _d(j['minPoints']),
    multiplier: _dn(j['multiplier']) ?? 1,
    perks: _strs(j['perks']),
  );
}

class NextTier {
  const NextTier({required this.key, required this.name, required this.minPoints, required this.pointsToGo});
  final String key, name;
  final double minPoints, pointsToGo;
  factory NextTier.fromJson(Map<String, dynamic> j) =>
      NextTier(key: _s(j['key']), name: _s(j['name']), minPoints: _d(j['minPoints']), pointsToGo: _d(j['pointsToGo']));
}

class EarnRule {
  const EarnRule({
    required this.id,
    required this.name,
    this.assetClass,
    required this.symbols,
    required this.accountGroups,
    required this.accountType,
    required this.pointsPerLot,
  });
  final int id;
  final String name;
  final String? assetClass;
  final List<String> symbols, accountGroups;
  final String accountType;
  final double pointsPerLot;

  factory EarnRule.fromJson(Map<String, dynamic> j) => EarnRule(
    id: _i(j['id']),
    name: _s(j['name']),
    assetClass: _sn(j['assetClass']),
    symbols: _strs(j['symbols']),
    accountGroups: _strs(j['accountGroups']),
    accountType: _s(j['accountType']),
    pointsPerLot: _d(j['pointsPerLot']),
  );
}

class CatalogueItem {
  const CatalogueItem({
    required this.id,
    required this.name,
    required this.description,
    required this.kind,
    required this.costPoints,
    required this.value,
    this.minTier,
    this.stock,
    required this.active,
  });
  final int id;
  final String name, description;

  /// cashback | bonus_credit | fee_discount
  final String kind;
  final double costPoints, value;
  final String? minTier;
  final int? stock;
  final bool active;

  factory CatalogueItem.fromJson(Map<String, dynamic> j) => CatalogueItem(
    id: _i(j['id']),
    name: _s(j['name']),
    description: _s(j['description']),
    kind: _s(j['kind']),
    costPoints: _d(j['costPoints']),
    value: _d(j['value']),
    minTier: _sn(j['minTier']),
    stock: _in(j['stock']),
    active: j['active'] != false,
  );
}

class PointsTx {
  const PointsTx({required this.id, required this.kind, required this.points, required this.description, this.login, this.dealId, this.createdAt});
  final int id;

  /// earn | redeem | bonus | promo | expire | adjust | reversal
  final String kind;
  final double points;
  final String description;
  final int? login, dealId;
  final DateTime? createdAt;

  factory PointsTx.fromJson(Map<String, dynamic> j) => PointsTx(
    id: _i(j['id']),
    kind: _s(j['kind']),
    points: _d(j['points']),
    description: _s(j['description']),
    login: _in(j['login']),
    dealId: _in(j['dealId']),
    createdAt: _t(j['createdAt']),
  );
}

class RewardsPoints {
  const RewardsPoints({
    required this.balance,
    required this.lifetime,
    required this.earnedThisMonth,
    required this.lotsThisMonth,
    required this.earned12m,
    this.expiringPoints,
    this.expiringAt,
  });
  final double balance, lifetime, earnedThisMonth, lotsThisMonth, earned12m;
  final double? expiringPoints;
  final DateTime? expiringAt;
}

/// `GET growth/rewards`: points, tier, tiers, earn rules, catalogue, recent activity, the 30-day series.
class Rewards {
  const Rewards({
    required this.points,
    required this.tier,
    this.nextTier,
    required this.tiers,
    required this.rules,
    required this.pointValue,
    required this.minHoldSeconds,
    required this.pointsExpiryMonths,
    required this.catalogue,
    required this.recent,
    required this.series,
  });
  final RewardsPoints points;
  final Tier tier;
  final NextTier? nextTier;
  final List<Tier> tiers;
  final List<EarnRule> rules;
  final double pointValue;
  final int minHoldSeconds, pointsExpiryMonths;
  final List<CatalogueItem> catalogue;
  final List<PointsTx> recent;
  final List<({String day, double points})> series;

  factory Rewards.fromJson(Map<String, dynamic> j) {
    final p = _m(j['points']);
    final exp = _m(p['expiringSoon']);
    return Rewards(
      points: RewardsPoints(
        balance: _d(p['balance']),
        lifetime: _d(p['lifetime']),
        earnedThisMonth: _d(p['earnedThisMonth']),
        lotsThisMonth: _d(p['lotsThisMonth']),
        earned12m: _d(p['earned12m']),
        expiringPoints: exp.isEmpty ? null : _d(exp['points']),
        expiringAt: _t(exp['at']),
      ),
      tier: Tier.fromJson(_m(j['tier'])),
      nextTier: j['nextTier'] is Map ? NextTier.fromJson(_m(j['nextTier'])) : null,
      tiers: [for (final x in _ms(j['tiers'])) Tier.fromJson(x)],
      rules: [for (final x in _ms(j['rules'])) EarnRule.fromJson(x)],
      pointValue: _d(j['pointValue']),
      minHoldSeconds: _i(j['minHoldSeconds']),
      pointsExpiryMonths: _i(j['pointsExpiryMonths']),
      catalogue: [for (final x in _ms(j['catalogue'])) CatalogueItem.fromJson(x)],
      recent: [for (final x in _ms(j['recent'])) PointsTx.fromJson(x)],
      series: [for (final x in _ms(j['series'])) (day: _s(x['day']), points: _d(x['points']))],
    );
  }
}

class PointsPage {
  const PointsPage({required this.items, required this.total});
  final List<PointsTx> items;
  final int total;
  factory PointsPage.fromJson(Map<String, dynamic> j) {
    final items = [for (final x in _ms(j['items'])) PointsTx.fromJson(x)];
    return PointsPage(items: items, total: _in(j['total']) ?? items.length);
  }
}

class Redemption {
  const Redemption({
    required this.id,
    required this.itemName,
    required this.kind,
    required this.points,
    required this.value,
    required this.status,
    this.login,
    this.voucherCode,
    this.createdAt,
  });
  final int id;
  final String itemName, kind, status;
  final double points, value;
  final int? login;
  final String? voucherCode;
  final DateTime? createdAt;

  factory Redemption.fromJson(Map<String, dynamic> j) => Redemption(
    id: _i(j['id']),
    itemName: _s(j['itemName']),
    kind: _s(j['kind']),
    points: _d(j['points']),
    value: _d(j['value']),
    status: _s(j['status']),
    login: _in(j['login']),
    voucherCode: _sn(j['voucherCode']),
    createdAt: _t(j['createdAt']),
  );
}

class Voucher {
  const Voucher({required this.id, required this.code, required this.pct, required this.appliesTo, required this.status, this.expiresAt, this.usedAt});
  final int id;
  final String code, appliesTo, status;
  final double pct;
  final DateTime? expiresAt, usedAt;

  factory Voucher.fromJson(Map<String, dynamic> j) => Voucher(
    id: _i(j['id']),
    code: _s(j['code']),
    pct: _d(j['pct']),
    appliesTo: _s(j['appliesTo']),
    status: _s(j['status']),
    expiresAt: _t(j['expiresAt']),
    usedAt: _t(j['usedAt']),
  );
}

/* ------------------------------------------------------------------ cashback */

class CashbackProgramme {
  const CashbackProgramme({
    required this.id,
    required this.name,
    required this.description,
    required this.assetClasses,
    required this.symbols,
    required this.accountGroups,
    required this.usdPerLot,
    this.maxPerMonth,
    required this.optIn,
    required this.enrolled,
    this.endsAt,
    required this.lotsMonth,
    required this.earnedMonth,
  });
  final int id;
  final String name, description;
  final List<String> assetClasses, symbols, accountGroups;
  final double usdPerLot;
  final double? maxPerMonth;
  final bool optIn, enrolled;
  final DateTime? endsAt;
  final double lotsMonth, earnedMonth;

  factory CashbackProgramme.fromJson(Map<String, dynamic> j) => CashbackProgramme(
    id: _i(j['id']),
    name: _s(j['name']),
    description: _s(j['description']),
    assetClasses: _strs(j['assetClasses']),
    symbols: _strs(j['symbols']),
    accountGroups: _strs(j['accountGroups']),
    usdPerLot: _d(j['usdPerLot']),
    maxPerMonth: _dn(j['maxPerMonth']),
    optIn: _b(j['optIn']),
    enrolled: _b(j['enrolled']),
    endsAt: _t(j['endsAt']),
    lotsMonth: _d(j['lotsMonth']),
    earnedMonth: _d(j['earnedMonth']),
  );
}

class CashbackAccrual {
  const CashbackAccrual({
    required this.id,
    required this.programme,
    required this.dealId,
    required this.login,
    required this.symbol,
    required this.lots,
    required this.amount,
    required this.status,
    this.createdAt,
  });
  final int id, dealId, login;
  final String programme, symbol, status;
  final double lots, amount;
  final DateTime? createdAt;

  factory CashbackAccrual.fromJson(Map<String, dynamic> j) => CashbackAccrual(
    id: _i(j['id']),
    programme: _s(j['programme']),
    dealId: _i(j['dealId']),
    login: _i(j['login']),
    symbol: _s(j['symbol']),
    lots: _d(j['lots']),
    amount: _d(j['amount']),
    status: _s(j['status']),
    createdAt: _t(j['createdAt']),
  );
}

class CashbackPayout {
  const CashbackPayout({required this.id, required this.amount, required this.status, this.createdAt, this.paidAt});
  final int id;
  final double amount;
  final String status;
  final DateTime? createdAt, paidAt;
  factory CashbackPayout.fromJson(Map<String, dynamic> j) =>
      CashbackPayout(id: _i(j['id']), amount: _d(j['amount']), status: _s(j['status']), createdAt: _t(j['createdAt']), paidAt: _t(j['paidAt']));
}

/// `GET growth/cashback`.
class CashbackMe {
  const CashbackMe({
    required this.programmes,
    required this.accrued,
    required this.paid,
    required this.month,
    required this.lifetime,
    required this.accruals,
    required this.payouts,
    required this.series,
  });
  final List<CashbackProgramme> programmes;
  final double accrued, paid, month, lifetime;
  final List<CashbackAccrual> accruals;
  final List<CashbackPayout> payouts;
  final List<({String day, double amount})> series;

  factory CashbackMe.fromJson(Map<String, dynamic> j) {
    final tot = _m(j['totals']);
    return CashbackMe(
      programmes: [for (final x in _ms(j['programmes'])) CashbackProgramme.fromJson(x)],
      accrued: _d(tot['accrued']),
      paid: _d(tot['paid']),
      month: _d(tot['month']),
      lifetime: _d(tot['lifetime']),
      accruals: [for (final x in _ms(j['accruals'])) CashbackAccrual.fromJson(x)],
      payouts: [for (final x in _ms(j['payouts'])) CashbackPayout.fromJson(x)],
      series: [for (final x in _ms(j['series'])) (day: _s(x['day']), amount: _d(x['amount']))],
    );
  }
}

/* ------------------------------------------------------------------ promotions */

class Campaign {
  const Campaign({
    required this.id,
    required this.name,
    required this.description,
    required this.terms,
    required this.kind,
    required this.pct,
    required this.cap,
    required this.fixedAmount,
    required this.minDeposit,
    required this.releasePerLot,
    required this.expiryDays,
    required this.forfeitOnWithdrawal,
    required this.claimWindowDays,
    this.endsAt,
    required this.eligible,
    this.reason,
    required this.claimed,
  });
  final int id;
  final String name, description, terms;

  /// deposit | fixed
  final String kind;
  final double pct, cap, fixedAmount, minDeposit, releasePerLot;
  final int expiryDays, claimWindowDays;
  final bool forfeitOnWithdrawal, eligible, claimed;
  final DateTime? endsAt;
  final String? reason;

  bool get deposit => kind == 'deposit';

  factory Campaign.fromJson(Map<String, dynamic> j) => Campaign(
    id: _i(j['id']),
    name: _s(j['name']),
    description: _s(j['description']),
    terms: _s(j['terms']),
    kind: _s(j['kind']),
    pct: _d(j['pct']),
    cap: _d(j['cap']),
    fixedAmount: _d(j['fixedAmount']),
    minDeposit: _d(j['minDeposit']),
    releasePerLot: _d(j['releasePerLot']),
    expiryDays: _i(j['expiryDays']),
    forfeitOnWithdrawal: _b(j['forfeitOnWithdrawal']),
    claimWindowDays: _i(j['claimWindowDays']),
    endsAt: _t(j['endsAt']),
    eligible: _b(j['eligible']),
    reason: _sn(j['reason']),
    claimed: _b(j['claimed']),
  );
}

class Grant {
  const Grant({
    required this.id,
    required this.campaign,
    required this.status,
    required this.source,
    this.login,
    this.depositAmount,
    required this.amount,
    required this.released,
    required this.remaining,
    required this.lotsTraded,
    required this.lotsRequired,
    required this.releasePerLot,
    required this.progressPct,
    this.claimedAt,
    this.expiresAt,
    this.endedAt,
    this.endReason,
    this.claimDeadline,
  });
  final int id;
  final String campaign, status, source;
  final int? login;
  final double? depositAmount;
  final double amount, released, remaining, lotsTraded, lotsRequired, releasePerLot, progressPct;
  final DateTime? claimedAt, expiresAt, endedAt, claimDeadline;
  final String? endReason;

  factory Grant.fromJson(Map<String, dynamic> j) => Grant(
    id: _i(j['id']),
    campaign: _s(j['campaign']),
    status: _s(j['status']),
    source: _s(j['source']),
    login: _in(j['login']),
    depositAmount: _dn(j['depositAmount']),
    amount: _d(j['amount']),
    released: _d(j['released']),
    remaining: _d(j['remaining']),
    lotsTraded: _d(j['lotsTraded']),
    lotsRequired: _d(j['lotsRequired']),
    releasePerLot: _d(j['releasePerLot']),
    progressPct: _d(j['progressPct']),
    claimedAt: _t(j['claimedAt']),
    expiresAt: _t(j['expiresAt']),
    endedAt: _t(j['endedAt']),
    endReason: _sn(j['endReason']),
    claimDeadline: _t(j['claimDeadline']),
  );
}

class PromoUse {
  const PromoUse({required this.id, required this.code, required this.kind, required this.status, this.reason, this.createdAt});
  final int id;
  final String code, kind, status;
  final String? reason;
  final DateTime? createdAt;
  factory PromoUse.fromJson(Map<String, dynamic> j) =>
      PromoUse(id: _i(j['id']), code: _s(j['code']), kind: _s(j['kind']), status: _s(j['status']), reason: _sn(j['reason']), createdAt: _t(j['createdAt']));
}

/// `GET growth/promotions`.
class Promotions {
  const Promotions({required this.campaigns, required this.grants, required this.promoHistory});
  final List<Campaign> campaigns;
  final List<Grant> grants;
  final List<PromoUse> promoHistory;
  factory Promotions.fromJson(Map<String, dynamic> j) => Promotions(
    campaigns: [for (final x in _ms(j['campaigns'])) Campaign.fromJson(x)],
    grants: [for (final x in _ms(j['grants'])) Grant.fromJson(x)],
    promoHistory: [for (final x in _ms(j['promoHistory'])) PromoUse.fromJson(x)],
  );
}

/* ------------------------------------------------------------------ contests */

class Prize {
  const Prize({required this.rankFrom, required this.rankTo, required this.amount, required this.payout});
  final int rankFrom, rankTo;
  final double amount;

  /// wallet | credit
  final String payout;
  factory Prize.fromJson(Map<String, dynamic> j) =>
      Prize(rankFrom: _i(j['rankFrom']), rankTo: _i(j['rankTo']), amount: _d(j['amount']), payout: _s(j['payout']));

  /// "#1", "#2–5".
  String get band => rankFrom == rankTo ? '#$rankFrom' : '#$rankFrom–$rankTo';
}

class Contest {
  const Contest({
    required this.id,
    required this.name,
    required this.description,
    required this.kind,
    required this.instrument,
    this.minPremium,
    required this.status,
    required this.startsAt,
    required this.endsAt,
    required this.scoring,
    required this.minTrades,
    this.maxEntrants,
    required this.entrants,
    this.startingBalance,
    required this.accountGroups,
    required this.kycRequired,
    this.minEquity,
    required this.prizes,
    required this.prizePool,
    required this.rules,
    required this.minHoldSeconds,
    required this.maxSingleTradePct,
    required this.disqualifyOnBalanceChange,
  });
  final int id;
  final String name, description;

  /// demo | live
  final String kind;

  /// cfd | options (older services omit it: cfd)
  final String instrument;
  final double? minPremium;

  /// draft | scheduled | running | ended | finalized | paid | cancelled
  final String status;
  final DateTime startsAt, endsAt;

  /// return_pct | profit | lots | contracts
  final String scoring;
  final int minTrades;
  final int? maxEntrants;
  final int entrants;
  final double? startingBalance;
  final List<String> accountGroups;
  final bool kycRequired;
  final double? minEquity;
  final List<Prize> prizes;
  final double prizePool;
  final String rules;
  final double minHoldSeconds, maxSingleTradePct;
  final bool disqualifyOnBalanceChange;

  bool get live => kind == 'live';
  bool get options => instrument == 'options';
  bool get running => status == 'running';
  bool get upcoming => status == 'scheduled';
  bool get past => const ['ended', 'finalized', 'paid', 'cancelled'].contains(status);
  bool get canJoin => (running || upcoming) && (maxEntrants == null || entrants < maxEntrants!);

  /// Last rank that wins a prize.
  int get prizeZone => prizes.fold(0, (m, p) => p.rankTo > m ? p.rankTo : m);

  /// Prize for a rank from the bands (null outside the prize zone).
  double? prizeFor(int? rank) {
    if (rank == null || rank == 0) return null;
    for (final p in prizes) {
      if (rank >= p.rankFrom && rank <= p.rankTo) return p.amount;
    }
    return null;
  }

  /// The prize a standing wins or is on track for (web projectedPrize).
  double? projectedPrize(Standing s) {
    if (s.prize != null) return s.prize;
    if (!s.qualified || s.disqualified) return null;
    return prizeFor(s.rank);
  }

  factory Contest.fromJson(Map<String, dynamic> j) {
    final ac = _m(j['antiCheat']);
    return Contest(
      id: _i(j['id']),
      name: _s(j['name']),
      description: _s(j['description']),
      kind: _s(j['kind']),
      instrument: _sn(j['instrument']) ?? 'cfd',
      minPremium: _dn(j['minPremium']),
      status: _s(j['status']),
      startsAt: _t(j['startsAt']) ?? DateTime.now(),
      endsAt: _t(j['endsAt']) ?? DateTime.now(),
      scoring: _s(j['scoring']),
      minTrades: _i(j['minTrades']),
      maxEntrants: _in(j['maxEntrants']),
      entrants: _i(j['entrants']),
      startingBalance: _dn(j['startingBalance']),
      accountGroups: _strs(j['accountGroups']),
      kycRequired: _b(j['kycRequired']),
      minEquity: _dn(j['minEquity']),
      prizes: [for (final x in _ms(j['prizes'])) Prize.fromJson(x)],
      prizePool: _d(j['prizePool']),
      rules: _s(j['rules']),
      minHoldSeconds: _d(ac['minHoldSeconds']),
      maxSingleTradePct: _d(ac['maxSingleTradePct']),
      disqualifyOnBalanceChange: _b(ac['disqualifyOnBalanceChange']),
    );
  }
}

class Standing {
  const Standing({
    required this.entryId,
    required this.name,
    this.country,
    this.login,
    this.rank,
    required this.score,
    required this.returnPct,
    required this.profit,
    required this.lots,
    this.contracts,
    required this.trades,
    this.selfTrades,
    this.smallTrades,
    required this.qualified,
    required this.status,
    this.prize,
    this.prizeStatus,
    required this.me,
    this.updatedAt,
  });
  final int entryId;
  final String name;
  final String? country;
  final int? login, rank;
  final double score, returnPct, profit, lots;
  final double? contracts;
  final int trades;
  final int? selfTrades, smallTrades;
  final bool qualified;

  /// active | disqualified
  final String status;
  final double? prize;
  final String? prizeStatus;
  final bool me;
  final DateTime? updatedAt;

  bool get disqualified => status == 'disqualified';

  /// The name without emoji or symbols, for the avatar's initials.
  String get initialsName {
    final s = name.replaceAll(RegExp(r'[^\p{L}\s]', unicode: true), '').trim();
    return s.isEmpty ? '?' : s;
  }

  factory Standing.fromJson(Map<String, dynamic> j) => Standing(
    entryId: _i(j['entryId']),
    name: _s(j['name']),
    country: _sn(j['country']),
    login: _in(j['login']),
    rank: _in(j['rank']),
    score: _d(j['score']),
    returnPct: _d(j['returnPct']),
    profit: _d(j['profit']),
    lots: _d(j['lots']),
    contracts: _dn(j['contracts']),
    trades: _i(j['trades']),
    selfTrades: _in(j['selfTrades']),
    smallTrades: _in(j['smallTrades']),
    qualified: j['qualified'] != false,
    status: _s(j['status']),
    prize: _dn(j['prize']),
    prizeStatus: _sn(j['prizeStatus']),
    me: _b(j['me']),
    updatedAt: _t(j['updatedAt']),
  );
}

/// A contest of the list, with the client's own entry.
class ContestCard {
  const ContestCard(this.contest, this.myEntry);
  final Contest contest;
  final Standing? myEntry;
}

class ContestStats {
  const ContestStats({required this.entered, required this.prizesWon, required this.prizeFinishes, this.bestRank, required this.active});
  final int entered, prizeFinishes, active;
  final double prizesWon;
  final int? bestRank;
}

/// `GET growth/contests`.
class ContestsResp {
  const ContestsResp(this.items, this.stats);
  final List<ContestCard> items;
  final ContestStats stats;

  factory ContestsResp.fromJson(Map<String, dynamic> j) {
    final st = _m(j['stats']);
    return ContestsResp(
      [for (final x in _ms(j['items'])) ContestCard(Contest.fromJson(x), x['myEntry'] is Map ? Standing.fromJson(_m(x['myEntry'])) : null)],
      ContestStats(
        entered: _i(st['entered']),
        prizesWon: _d(st['prizesWon']),
        prizeFinishes: _i(st['prizeFinishes']),
        bestRank: _in(st['bestRank']),
        active: _i(st['active']),
      ),
    );
  }
}

/// `GET growth/contests/{id}`.
class ContestDetail {
  const ContestDetail({required this.contest, required this.leaderboard, this.myEntry, required this.entrants});
  final Contest contest;
  final List<Standing> leaderboard;
  final Standing? myEntry;
  final int entrants;

  factory ContestDetail.fromJson(Map<String, dynamic> j) => ContestDetail(
    contest: Contest.fromJson(_m(j['contest'])),
    leaderboard: [for (final x in _ms(j['leaderboard'])) Standing.fromJson(x)],
    myEntry: j['myEntry'] is Map ? Standing.fromJson(_m(j['myEntry'])) : null,
    entrants: _i(j['entrants']),
  );
}

/// Demo contest credentials, shown once after joining.
typedef ContestCredentials = ({int login, String password, String investorPassword});

ContestCredentials? credentialsOf(Map<String, dynamic> j) {
  final c = _m(j['credentials']);
  if (c.isEmpty) return null;
  return (login: _i(c['login']), password: _s(c['password']), investorPassword: _s(c['investorPassword']));
}

/* ------------------------------------------------------------------ banners */

class BannerView {
  const BannerView({required this.id, required this.title, required this.body, this.ctaLabel, this.ctaUrl, required this.tone, required this.dismissible});
  final int id;
  final String title, body, tone;
  final String? ctaLabel, ctaUrl;
  final bool dismissible;
  factory BannerView.fromJson(Map<String, dynamic> j) => BannerView(
    id: _i(j['id']),
    title: _s(j['title']),
    body: _s(j['body']),
    ctaLabel: _sn(j['ctaLabel']),
    ctaUrl: _sn(j['ctaUrl']),
    tone: _sn(j['tone']) ?? 'neutral',
    dismissible: _b(j['dismissible']),
  );
}

/* ------------------------------------------------------------------ providers (web useGrowth) */

/// `GET growth/rewards` (loyalty page, contests shortcuts).
final growthRewardsProvider = FutureProvider.autoDispose<Rewards>((ref) async {
  return Rewards.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/rewards'));
});

/// `GET growth/points?page=1&limit=100[&kind=]` (the history's kind filter: all | earn | redeem | bonus | promo | expire).
final pointsHistoryProvider = FutureProvider.autoDispose.family<PointsPage, String>((ref, kind) async {
  final q = <String, Object?>{'page': 1, 'limit': 100, if (kind != 'all') 'kind': kind};
  return PointsPage.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/points', query: q));
});

final redemptionsProvider = FutureProvider.autoDispose<List<Redemption>>((ref) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/redemptions');
  return [for (final x in _ms(j['items'])) Redemption.fromJson(x)];
});

final vouchersProvider = FutureProvider.autoDispose<List<Voucher>>((ref) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/vouchers');
  return [for (final x in _ms(j['items'])) Voucher.fromJson(x)];
});

/// `GET growth/cashback` (every 60 s).
final cashbackProvider = FutureProvider.autoDispose<CashbackMe>((ref) async {
  ref.pollEvery(const Duration(seconds: 60));
  return CashbackMe.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/cashback'));
});

/// `GET growth/promotions` (every 60 s).
final promotionsProvider = FutureProvider.autoDispose<Promotions>((ref) async {
  ref.pollEvery(const Duration(seconds: 60));
  return Promotions.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/promotions'));
});

/// `GET growth/contests` (every 60 s).
final contestsProvider = FutureProvider.autoDispose<ContestsResp>((ref) async {
  ref.pollEvery(const Duration(seconds: 60));
  return ContestsResp.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/contests'));
});

/// `GET growth/contests/{id}` (every 15 s: the live leaderboard).
final contestDetailProvider = FutureProvider.autoDispose.family<ContestDetail, String>((ref, id) async {
  ref.pollEvery(const Duration(seconds: 15));
  return ContestDetail.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/contests/${Uri.encodeComponent(id)}'));
});

/// `GET growth/banners?placement=` (targeted marketing banners; nothing when the service is unavailable).
final bannersProvider = FutureProvider.autoDispose.family<List<BannerView>, String>((ref, placement) async {
  try {
    final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/banners', query: {'placement': placement});
    return [for (final x in _ms(j['items'])) BannerView.fromJson(x)];
  } on ApiException {
    return const [];
  }
});

/// A growth write (`POST growth/<path>`), the body as JSON (always an object, like the web).
Future<Map<String, dynamic>> growthPost(WidgetRef ref, String path, [Map<String, dynamic> body = const {}]) async {
  final r = await ref.read(apiProvider).post<Object?>('growth/$path', body: body);
  return _m(r);
}

/* ------------------------------------------------------------------ errors (web growthApi messages) */

const Map<String, String> _friendly = {
  'insufficient_points': 'rewards.error.insufficientPoints',
  'out_of_stock': 'rewards.error.outOfStock',
  'already_joined': 'rewards.error.alreadyJoined',
  'already_claimed': 'rewards.error.alreadyClaimed',
  'contest_closed': 'rewards.error.contestClosed',
  'limit_reached': 'rewards.error.limitReached',
  'options_intro_required': 'rewards.error.optionsIntro',
};

/// The message of a failed growth call, as the web's growthApi shows it: the service unavailable, the options intro
/// in the reader's language, else the service's own message, else the known code's text.
String growthError(Object e, T t) {
  if (e is! ApiException) return t('common.errorRetry');
  if (e.isNetwork) return t('common.networkError');
  if (e.code == 'unavailable' || e.status >= 500) return t('rewards.error.unavailable');
  if (e.code == 'options_intro_required') return t(_friendly[e.code]!);
  if (e.isReadOnly || e.isRateLimited) return localizeError(e, t);
  final msg = e.data?['message'];
  if (msg is String && msg.isNotEmpty) return msg;
  final f = _friendly[e.code];
  return f != null ? t(f) : t('common.errorRetry');
}

/* ------------------------------------------------------------------ formatting (web api.ts helpers) */

/// The growth pages' number and date formats in the reader's language (Latin digits).
class GrowthFmt {
  GrowthFmt(this.t) : f = LocaleFormat(t.locale);
  final T t;
  final LocaleFormat f;

  /// "28 Sep 2026" (or "28 Sep").
  String date(DateTime? d, {bool year = true}) => d == null ? '—' : (year ? f.date(d) : f.dayMonth(d));

  /// "28 Sep, 14:03".
  String dateTime(DateTime? d) => d == null ? '—' : f.dateTime(d);

  /// "28 Sep" for a "YYYY-MM-DD" day key.
  String day(String key) {
    final p = key.split('-');
    if (p.length != 3) return key;
    final y = int.tryParse(p[0]), m = int.tryParse(p[1]), d = int.tryParse(p[2]);
    if (y == null || m == null || d == null) return key;
    return f.dayMonth(DateTime.utc(y, m, d, 9));
  }

  String points(num v) => f.number(v.round(), 0);
  String count(num v) => f.number(v, 0);

  String usd(num v, [int digits = 2]) => '${v < 0 ? '-' : ''}\$${f.number(v.abs(), digits)}';

  /// Whole amounts without decimals ($250), else 2 (web money0 / `v % 1 ? 2 : 0`).
  String usd0(num v) => usd(v, v % 1 == 0 ? 0 : 2);

  /// 12.5 -> "12.5%", 12 -> "12%".
  String pct(num v, {bool signed = false}) {
    final r = (v * 100).round() / 100;
    final n = r == r.roundToDouble() ? '${r.round()}' : _trim(r.toStringAsFixed(2));
    return '${signed && v > 0 ? '+' : ''}$n%';
  }

  String lots(num v) => f.number(v);

  String contracts(num v) => v == v.roundToDouble() ? f.number(v, 0) : _trim(f.number(v, 4));

  /// 1.5 -> "1.5×".
  String mult(num m) => '${m == m.roundToDouble() ? m.round() : _trim(m.toStringAsFixed(2))}×';

  /// A plain number as JavaScript prints it (40 -> "40", 12.5 -> "12.5").
  static String plain(num v) => v == v.roundToDouble() ? '${v.round()}' : _trim(v.toStringAsFixed(6));

  static String _trim(String s) => s.contains('.') ? s.replaceFirst(RegExp(r'0+$'), '').replaceFirst(RegExp(r'\.$'), '') : s;

  String scoring(String s) => switch (s) {
    'return_pct' => t('rewards.scoring.returnPct'),
    'profit' => t('rewards.scoring.profit'),
    'lots' => t('rewards.scoring.lots'),
    'contracts' => t('rewards.scoring.contracts'),
    _ => titleCase(s),
  };
}

String titleCase(String s) {
  final r = s.replaceAll('_', ' ');
  return r.isEmpty ? r : r[0].toUpperCase() + r.substring(1);
}

/// Groups that never trade options (copy-trading followers, PAMM, MAM, prop), same rule as the engine.
bool optionsSystemGroup(String code) {
  final g = code.trim().toLowerCase();
  return g.startsWith('prop') || g == 'copy' || g.startsWith('copy-') || g == 'pamm' || g.startsWith('pamm-') || g == 'mam' || g.startsWith('mam-');
}
