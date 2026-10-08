// Partner (IB) data: the web's components/partner/live/api.ts. The app calls /api/mobile/partner/<path> = the web's
// /api/partner/<path> (app/api/partner/[[...path]]/route.ts -> services/ib /v1/ib/me/*). Money is USD.
//   GET   partner                       dashboard (member, level + progress, earnings, funnel, series, recent, programme, linkBase)
//   GET   partner/programme             levels, rate card, tiers, CPA, rules, payout schedule
//   GET   partner/campaigns             campaign links with click -> sign-up -> FTD funnel (+ linkBase)
//   POST  partner/campaigns             {name, slug?, utmSource?, utmMedium?, utmCampaign?}
//   PATCH partner/campaigns/{id}        {active}
//   GET   partner/clients               network clients (+ visibility, tiers, linkBase)
//   GET   partner/clients/{id}/trades   a client's closed trades (full visibility only)
//   GET   partner/network               tree nodes (flat, with parentId)
//   GET   partner/commissions?status&kind&page&limit
//   GET   partner/payouts
//   PUT   partner/settings              {rebatePct, splitPct}
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' show DateFormat, NumberFormat;

import '../../core/api/api_providers.dart';
import '../../core/config/app_config.dart';
import '../../core/format/format.dart';
import '../../core/lifecycle.dart';
import '../../core/models/trading.dart' show parseSeries;
import '../../i18n/i18n.dart';

/* ------------------------------------------------------------------ parsing */

double _d(Object? v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;
double? _dn(Object? v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
int _i(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;
int? _in(Object? v) => v == null ? null : (v is num ? v.toInt() : int.tryParse('$v'));
String _s(Object? v, [String fallback = '']) => v == null ? fallback : '$v';
String? _sn(Object? v) => v == null || '$v'.isEmpty ? null : '$v';
Map<String, dynamic> _m(Object? v) => v is Map ? v.cast<String, dynamic>() : const {};
List<Map<String, dynamic>> _ms(Object? v) => v is List
    ? [
        for (final x in v)
          if (x is Map) x.cast<String, dynamic>(),
      ]
    : const [];
List<String> _ss(Object? v) => v is List ? [for (final x in v) '$x'] : const [];

/* ------------------------------------------------------------------ shapes */

class PLevel {
  const PLevel({
    required this.key,
    required this.name,
    required this.rank,
    required this.icon,
    required this.perks,
    required this.minActiveClients,
    required this.minMonthlyLots,
    required this.cpaAmount,
    required this.rates,
    this.optionsRate,
  });
  final String key, name, icon;
  final int rank;
  final List<String> perks;
  final int minActiveClients;
  final double minMonthlyLots, cpaAmount;

  /// USD per standard lot, per symbol group key.
  final Map<String, double> rates;

  /// Kalks FX Options: USD per option contract.
  final double? optionsRate;

  static PLevel fromJson(Map<String, dynamic> j) => PLevel(
    key: _s(j['key']),
    name: _s(j['name']),
    rank: _i(j['rank']),
    icon: _s(j['icon'], 'coin'),
    perks: _ss(j['perks']),
    minActiveClients: _i(j['minActiveClients']),
    minMonthlyLots: _d(j['minMonthlyLots']),
    cpaAmount: _d(j['cpaAmount']),
    rates: {for (final e in _m(j['rates']).entries) e.key: _d(e.value)},
    optionsRate: _dn(j['optionsRate']),
  );
  static PLevel? maybe(Object? j) => j is Map ? fromJson(j.cast<String, dynamic>()) : null;
}

class PSymbolGroup {
  const PSymbolGroup({required this.key, required this.name, this.assetClass, required this.symbols});
  final String key, name;
  final String? assetClass;
  final List<String> symbols;
  static PSymbolGroup fromJson(Map<String, dynamic> j) =>
      PSymbolGroup(key: _s(j['key']), name: _s(j['name']), assetClass: _sn(j['assetClass']), symbols: _ss(j['symbols']));
}

class PProgramme {
  const PProgramme({
    required this.levels,
    required this.symbolGroups,
    required this.tiers,
    required this.cpaEnabled,
    required this.cpaMinFirstDeposit,
    required this.cpaRequireFirstTrade,
    required this.cpaHoldDays,
    required this.minTradeSeconds,
    required this.schedule,
    required this.minAmount,
    required this.nextClose,
    required this.maxRebatePct,
    required this.maxSplitPct,
    required this.clientVisibility,
    required this.excludedGroups,
  });
  final List<PLevel> levels;
  final List<PSymbolGroup> symbolGroups;
  final List<({int tier, double pct})> tiers;
  final bool cpaEnabled, cpaRequireFirstTrade;
  final double cpaMinFirstDeposit;
  final int cpaHoldDays, minTradeSeconds;
  final String schedule;
  final double minAmount;
  final String nextClose;
  final double maxRebatePct, maxSplitPct;
  final String clientVisibility;
  final List<String> excludedGroups;

  double? tierPct(int tier) {
    for (final t in tiers) {
      if (t.tier == tier) return t.pct;
    }
    return null;
  }

  static PProgramme fromJson(Map<String, dynamic> j) {
    final cpa = _m(j['cpa']);
    final payout = _m(j['payout']);
    return PProgramme(
      levels: [for (final l in _ms(j['levels'])) PLevel.fromJson(l)],
      symbolGroups: [for (final g in _ms(j['symbolGroups'])) PSymbolGroup.fromJson(g)],
      tiers: [for (final t in _ms(j['tiers'])) (tier: _i(t['tier']), pct: _d(t['pct']))],
      cpaEnabled: cpa['enabled'] == true,
      cpaMinFirstDeposit: _d(cpa['minFirstDeposit']),
      cpaRequireFirstTrade: cpa['requireFirstTrade'] == true,
      cpaHoldDays: _i(cpa['holdDays']),
      minTradeSeconds: _i(j['minTradeSeconds']),
      schedule: _s(payout['schedule'], 'weekly'),
      minAmount: _d(payout['minAmount']),
      nextClose: _s(payout['nextClose']),
      maxRebatePct: _d(j['maxRebatePct']),
      maxSplitPct: _d(j['maxSplitPct']),
      clientVisibility: _s(j['clientVisibility'], 'masked'),
      excludedGroups: _ss(j['excludedGroups']),
    );
  }
}

class PCommission {
  const PCommission({
    required this.id,
    required this.kind,
    required this.status,
    required this.amount,
    required this.tier,
    required this.rate,
    required this.sharePct,
    required this.lots,
    required this.contracts,
    this.symbol,
    this.symbolGroup,
    this.dealId,
    this.source,
    this.levelKey,
    required this.clientId,
    required this.clientName,
    this.clientCountry,
    required this.createdAt,
    required this.availableAt,
    this.batchId,
    this.note,
  });
  final int id;
  final String kind, status;
  final double amount;
  final int tier;
  final double rate, sharePct, lots, contracts;
  final String? symbol, symbolGroup, source, levelKey, note;
  final int? dealId, batchId;
  final int clientId;
  final String clientName;
  final String? clientCountry;
  final String createdAt, availableAt;

  static PCommission fromJson(Map<String, dynamic> j) {
    final c = _m(j['client']);
    return PCommission(
      id: _i(j['id']),
      kind: _s(j['kind']),
      status: _s(j['status']),
      amount: _d(j['amount']),
      tier: _i(j['tier']),
      rate: _d(j['rate']),
      sharePct: _d(j['sharePct']),
      lots: _d(j['lots']),
      contracts: _d(j['contracts']),
      symbol: _sn(j['symbol']),
      symbolGroup: _sn(j['symbolGroup']),
      dealId: _in(j['dealId']),
      source: _sn(j['source']),
      levelKey: _sn(j['levelKey']),
      clientId: _i(c['id']),
      clientName: _s(c['name']),
      clientCountry: _sn(c['country']),
      createdAt: _s(j['createdAt']),
      availableAt: _s(j['availableAt']),
      batchId: _in(j['batchId']),
      note: _sn(j['note']),
    );
  }
}

class PTopClient {
  const PTopClient({required this.id, required this.name, required this.country, required this.lotsMonth});
  final int id;
  final String name, country;
  final double lotsMonth;
}

class PDashboard {
  const PDashboard({
    required this.code,
    required this.name,
    this.level,
    required this.joinedAt,
    required this.rebatePct,
    required this.splitPct,
    required this.status,
    required this.month,
    required this.monthEnds,
    required this.activeClients,
    required this.monthlyLots,
    required this.prevMonthLots,
    this.next,
    required this.levels,
    required this.pending,
    required this.approved,
    required this.paid,
    required this.lifetime,
    required this.cpaEarned,
    required this.cpaCount,
    required this.cpaWaiting,
    required this.referrals,
    required this.referralsThisMonth,
    required this.clicks,
    required this.signups,
    required this.ftds,
    required this.series,
    required this.weekly,
    required this.topClients,
    required this.recent,
    required this.programme,
    required this.linkBase,
  });
  // member
  final String code, name;
  final PLevel? level;
  final String joinedAt;
  final double rebatePct, splitPct;
  final String status;
  // progress
  final String month, monthEnds;
  final int activeClients;
  final double monthlyLots, prevMonthLots;
  final PLevel? next;
  final List<PLevel> levels;
  // earnings
  final double pending, approved, paid, lifetime, cpaEarned;
  final int cpaCount, cpaWaiting;
  // counts, funnel
  final int referrals, referralsThisMonth, clicks, signups, ftds;

  /// Days with accruals only (last 180 days); `cumulative` includes everything before.
  final List<({String date, double amount, double cumulative})> series;

  /// Weeks with accruals only (last 12 weeks, Monday UTC starts).
  final List<({String week, double amount})> weekly;
  final List<PTopClient> topClients;
  final List<PCommission> recent;
  final PProgramme programme;

  /// Public origin of the Client Area: the referral link is `$linkBase/r/$code`.
  final String linkBase;

  PDashboard copyWithRates(double rebate, double split) => PDashboard(
    code: code,
    name: name,
    level: level,
    joinedAt: joinedAt,
    rebatePct: rebate,
    splitPct: split,
    status: status,
    month: month,
    monthEnds: monthEnds,
    activeClients: activeClients,
    monthlyLots: monthlyLots,
    prevMonthLots: prevMonthLots,
    next: next,
    levels: levels,
    pending: pending,
    approved: approved,
    paid: paid,
    lifetime: lifetime,
    cpaEarned: cpaEarned,
    cpaCount: cpaCount,
    cpaWaiting: cpaWaiting,
    referrals: referrals,
    referralsThisMonth: referralsThisMonth,
    clicks: clicks,
    signups: signups,
    ftds: ftds,
    series: series,
    weekly: weekly,
    topClients: topClients,
    recent: recent,
    programme: programme,
    linkBase: linkBase,
  );

  static PDashboard fromJson(Map<String, dynamic> j, String fallbackBase) {
    final m = _m(j['member']);
    final p = _m(j['progress']);
    final e = _m(j['earnings']);
    final c = _m(j['counts']);
    final f = _m(j['funnel']);
    return PDashboard(
      code: _s(m['code']),
      name: _s(m['name']),
      level: PLevel.maybe(m['level']),
      joinedAt: _s(m['joinedAt']),
      rebatePct: _d(m['rebatePct']),
      splitPct: _d(m['splitPct']),
      status: _s(m['status'], 'active'),
      month: _s(p['month']),
      monthEnds: _s(p['monthEnds']),
      activeClients: _i(p['activeClients']),
      monthlyLots: _d(p['monthlyLots']),
      prevMonthLots: _d(p['prevMonthLots']),
      next: PLevel.maybe(p['next']),
      levels: [for (final l in _ms(p['levels'])) PLevel.fromJson(l)],
      pending: _d(e['pending']),
      approved: _d(e['approved']),
      paid: _d(e['paid']),
      lifetime: _d(e['lifetime']),
      cpaEarned: _d(e['cpaEarned']),
      cpaCount: _i(e['cpaCount']),
      cpaWaiting: _i(e['cpaWaiting']),
      referrals: _i(c['referrals']),
      referralsThisMonth: _i(c['referralsThisMonth']),
      clicks: _i(f['clicks']),
      signups: _i(f['signups']),
      ftds: _i(f['ftds']),
      series: [for (final s in _ms(j['series'])) (date: _s(s['date']), amount: _d(s['amount']), cumulative: _d(s['cumulative']))],
      weekly: [for (final w in _ms(j['weekly'])) (week: _s(w['week']), amount: _d(w['amount']))],
      topClients: [
        for (final t in _ms(j['topClients'])) PTopClient(id: _i(t['id']), name: _s(t['name']), country: _s(t['country']), lotsMonth: _d(t['lotsMonth'])),
      ],
      recent: [for (final r in _ms(j['recent'])) PCommission.fromJson(r)],
      programme: PProgramme.fromJson(_m(j['programme'])),
      linkBase: _baseOr(j['linkBase'], fallbackBase),
    );
  }
}

String _baseOr(Object? v, String fallback) {
  final s = _s(v).trim();
  return (s.isEmpty ? fallback : s).replaceAll(RegExp(r'/+$'), '');
}

class PCampaign {
  const PCampaign({
    this.id,
    required this.slug,
    required this.name,
    required this.landing,
    this.utmSource,
    this.utmMedium,
    this.utmCampaign,
    required this.active,
    this.createdAt,
    required this.clicks,
    required this.uniqueClicks,
    required this.signups,
    required this.ftds,
    required this.deposits,
    required this.lots,
    required this.trend,
  });

  /// null = the default link (/r/CODE).
  final int? id;
  final String slug, name, landing;
  final String? utmSource, utmMedium, utmCampaign, createdAt;
  final bool active;
  final int clicks, uniqueClicks, signups, ftds;
  final double deposits, lots;

  /// Clicks per day, last 30 days (oldest first).
  final List<double> trend;

  String get key => id == null ? 'default' : '$id';

  PCampaign withActive(bool v) => PCampaign(
    id: id,
    slug: slug,
    name: name,
    landing: landing,
    utmSource: utmSource,
    utmMedium: utmMedium,
    utmCampaign: utmCampaign,
    active: v,
    createdAt: createdAt,
    clicks: clicks,
    uniqueClicks: uniqueClicks,
    signups: signups,
    ftds: ftds,
    deposits: deposits,
    lots: lots,
    trend: trend,
  );

  static PCampaign fromJson(Map<String, dynamic> j) => PCampaign(
    id: _in(j['id']),
    slug: _s(j['slug']),
    name: _s(j['name']),
    landing: _s(j['landing'], '/register'),
    utmSource: _sn(j['utmSource']),
    utmMedium: _sn(j['utmMedium']),
    utmCampaign: _sn(j['utmCampaign']),
    active: j['active'] != false,
    createdAt: _sn(j['createdAt']),
    clicks: _i(j['clicks']),
    uniqueClicks: _i(j['uniqueClicks']),
    signups: _i(j['signups']),
    ftds: _i(j['ftds']),
    deposits: _d(j['deposits']),
    lots: _d(j['lots']),
    trend: j['trend'] is List ? [for (final v in j['trend'] as List) _d(v)] : const [],
  );
}

class PCampaigns {
  const PCampaigns({required this.code, required this.items, required this.linkBase});
  final String code;
  final List<PCampaign> items;
  final String linkBase;
}

/// active | funded | registered
class PClient {
  const PClient({
    required this.id,
    required this.tier,
    required this.name,
    this.email,
    required this.country,
    required this.joinedAt,
    required this.kycStatus,
    required this.level,
    this.parentId,
    this.campaign,
    required this.referrals,
    this.firstDepositAt,
    this.firstDepositAmount,
    this.firstTradeAt,
    this.lastTradeAt,
    required this.lotsMonth,
    required this.lotsTotal,
    required this.earned,
    required this.status,
  });
  final int id, tier;
  final String name;
  final String? email;
  final String country, joinedAt, kycStatus, level;
  final int? parentId;
  final String? campaign;
  final int referrals;
  final String? firstDepositAt;
  final double? firstDepositAmount;
  final String? firstTradeAt, lastTradeAt;
  final double lotsMonth, lotsTotal, earned;
  final String status;

  static PClient fromJson(Map<String, dynamic> j) => PClient(
    id: _i(j['id']),
    tier: _i(j['tier']),
    name: _s(j['name']),
    email: _sn(j['email']),
    country: _s(j['country']),
    joinedAt: _s(j['joinedAt']),
    kycStatus: _s(j['kycStatus'], 'unverified'),
    level: _s(j['level']),
    parentId: _in(j['parentId']),
    campaign: _sn(j['campaign']),
    referrals: _i(j['referrals']),
    firstDepositAt: _sn(j['firstDepositAt']),
    firstDepositAmount: _dn(j['firstDepositAmount']),
    firstTradeAt: _sn(j['firstTradeAt']),
    lastTradeAt: _sn(j['lastTradeAt']),
    lotsMonth: _d(j['lotsMonth']),
    lotsTotal: _d(j['lotsTotal']),
    earned: _d(j['earned']),
    status: _s(j['status'], 'registered'),
  );
}

class PClients {
  const PClients({required this.items, required this.visibility, required this.tiers, required this.linkBase});
  final List<PClient> items;
  final String visibility;
  final int tiers;
  final String linkBase;
  bool get full => visibility == 'full';
}

class PTrade {
  const PTrade({
    required this.dealId,
    required this.source,
    this.login,
    required this.symbol,
    required this.side,
    required this.volume,
    required this.lots,
    this.instrument,
    required this.contracts,
    required this.openTime,
    required this.closeTime,
    required this.qualified,
    this.reason,
    required this.reversed,
    required this.earned,
  });
  final int dealId;
  final String source;
  final int? login;
  final String symbol, side;
  final double volume, lots, contracts, earned;
  final String? instrument, reason;
  final String openTime, closeTime;
  final bool qualified, reversed;

  static PTrade fromJson(Map<String, dynamic> j) => PTrade(
    dealId: _i(j['dealId']),
    source: _s(j['source'], 'engine'),
    login: _in(j['login']),
    symbol: _s(j['symbol']),
    side: _s(j['side']),
    volume: _d(j['volume']),
    lots: _d(j['lots']),
    instrument: _sn(j['instrument']),
    contracts: _d(j['contracts']),
    openTime: _s(j['openTime']),
    closeTime: _s(j['closeTime']),
    qualified: j['qualified'] == true,
    reason: _sn(j['reason']),
    reversed: j['reversed'] == true,
    earned: _d(j['earned']),
  );
}

class PNode {
  const PNode({
    required this.id,
    this.parentId,
    required this.tier,
    required this.name,
    required this.country,
    required this.level,
    required this.joinedAt,
    required this.lotsMonth,
    required this.earnedMonth,
  });
  final int id;
  final int? parentId;
  final int tier;
  final String name, country, level, joinedAt;
  final double lotsMonth, earnedMonth;

  static PNode fromJson(Map<String, dynamic> j) => PNode(
    id: _i(j['id']),
    parentId: _in(j['parentId']),
    tier: _i(j['tier']),
    name: _s(j['name']),
    country: _s(j['country']),
    level: _s(j['level']),
    joinedAt: _s(j['joinedAt']),
    lotsMonth: _d(j['lotsMonth']),
    earnedMonth: _d(j['earnedMonth']),
  );
}

class PNetwork {
  const PNetwork({required this.rootId, required this.rootName, required this.rootLevel, required this.rootCode, required this.nodes, required this.tiers});
  final int rootId;
  final String rootName, rootLevel, rootCode;
  final List<PNode> nodes;
  final int tiers;
}

class PCommissions {
  const PCommissions({required this.items, required this.page, required this.limit, required this.total, required this.totals});
  final List<PCommission> items;
  final int page, limit, total;
  final Map<String, double> totals;
}

class PPayout {
  const PPayout({
    required this.id,
    required this.batchId,
    required this.amount,
    required this.lines,
    required this.status,
    required this.createdAt,
    this.paidAt,
    this.periodStart,
    required this.periodEnd,
    required this.schedule,
    required this.destination,
  });
  final int id, batchId, lines;
  final double amount;
  final String status, createdAt, periodEnd, schedule, destination;
  final String? paidAt, periodStart;

  static PPayout fromJson(Map<String, dynamic> j) => PPayout(
    id: _i(j['id']),
    batchId: _i(j['batchId']),
    amount: _d(j['amount']),
    lines: _i(j['lines']),
    status: _s(j['status']),
    createdAt: _s(j['createdAt']),
    paidAt: _sn(j['paidAt']),
    periodStart: _sn(j['periodStart']),
    periodEnd: _s(j['periodEnd']),
    schedule: _s(j['schedule'], 'weekly'),
    destination: _s(j['destination']),
  );
}

class PPayouts {
  const PPayouts({required this.items, required this.unbatched, required this.schedule, required this.minAmount, required this.nextClose});
  final List<PPayout> items;
  final double unbatched;
  final String schedule;
  final double minAmount;
  final String nextClose;
}

/* ------------------------------------------------------------------ providers (web usePartner) */

/// The Client Area's public origin from the config (the web's NEXT_PUBLIC_APP_URL), when an answer has no linkBase.
final _appUrlProvider = Provider.autoDispose<String>((ref) => ref.watch(configProvider.select((c) => c.appUrl)));

Map<String, dynamic> _json(Object? v) => v is Map ? v.cast<String, dynamic>() : const {};

/// GET partner (web usePartner("", 60_000)).
final partnerDashboardProvider = FutureProvider.autoDispose<PDashboard>((ref) async {
  ref.pollEvery(const Duration(seconds: 60));
  final base = ref.read(_appUrlProvider);
  final j = await ref.watch(apiProvider).get<Object?>('partner');
  return PDashboard.fromJson(_json(j), base);
});

/// GET partner/programme.
final partnerProgrammeProvider = FutureProvider.autoDispose<PProgramme>((ref) async {
  final j = await ref.watch(apiProvider).get<Object?>('partner/programme');
  return PProgramme.fromJson(_json(j));
});

/// GET partner/campaigns.
final partnerCampaignsProvider = FutureProvider.autoDispose<PCampaigns>((ref) async {
  final base = ref.read(_appUrlProvider);
  final j = _json(await ref.watch(apiProvider).get<Object?>('partner/campaigns'));
  return PCampaigns(code: _s(j['code']), items: [for (final c in _ms(j['items'])) PCampaign.fromJson(c)], linkBase: _baseOr(j['linkBase'], base));
});

/// GET partner/clients.
final partnerClientsProvider = FutureProvider.autoDispose<PClients>((ref) async {
  final base = ref.read(_appUrlProvider);
  final j = _json(await ref.watch(apiProvider).get<Object?>('partner/clients'));
  return PClients(
    items: [for (final c in _ms(j['items'])) PClient.fromJson(c)],
    visibility: _s(j['visibility'], 'masked'),
    tiers: _in(j['tiers']) ?? 3,
    linkBase: _baseOr(j['linkBase'], base),
  );
});

/// GET partner/clients/{id}/trades.
final partnerClientTradesProvider = FutureProvider.autoDispose.family<List<PTrade>, int>((ref, id) async {
  final j = _json(await ref.watch(apiProvider).get<Object?>('partner/clients/$id/trades'));
  return [for (final x in _ms(j['items'])) PTrade.fromJson(x)];
});

/// GET partner/network.
final partnerNetworkProvider = FutureProvider.autoDispose<PNetwork>((ref) async {
  final j = _json(await ref.watch(apiProvider).get<Object?>('partner/network'));
  final root = _m(j['root']);
  return PNetwork(
    rootId: _i(root['id']),
    rootName: _s(root['name']),
    rootLevel: _s(root['level']),
    rootCode: _s(root['code']),
    nodes: [for (final n in _ms(j['nodes'])) PNode.fromJson(n)],
    tiers: _in(j['tiers']) ?? 3,
  );
});

/// The ledger's query (web LedgerCard: page, limit 25, status, kind).
typedef CommissionsQuery = ({int page, String status, String kind});

const int kLedgerLimit = 25;

/// GET partner/commissions?page&limit&status&kind.
final partnerCommissionsProvider = FutureProvider.autoDispose.family<PCommissions, CommissionsQuery>((ref, q) async {
  final j = _json(
    await ref
        .watch(apiProvider)
        .get<Object?>(
          'partner/commissions',
          query: {'page': '${q.page}', 'limit': '$kLedgerLimit', if (q.status != 'all') 'status': q.status, if (q.kind != 'all') 'kind': q.kind},
        ),
  );
  return PCommissions(
    items: [for (final x in _ms(j['items'])) PCommission.fromJson(x)],
    page: _in(j['page']) ?? q.page,
    limit: _in(j['limit']) ?? kLedgerLimit,
    total: _i(j['total']),
    totals: {for (final e in _m(j['totals']).entries) e.key: _d(e.value)},
  );
});

/// GET partner/payouts (web usePartner("payouts", 60_000)).
final partnerPayoutsProvider = FutureProvider.autoDispose<PPayouts>((ref) async {
  ref.pollEvery(const Duration(seconds: 60));
  final j = _json(await ref.watch(apiProvider).get<Object?>('partner/payouts'));
  return PPayouts(
    items: [for (final x in _ms(j['items'])) PPayout.fromJson(x)],
    unbatched: _d(j['unbatched']),
    schedule: _s(j['schedule'], 'weekly'),
    minAmount: _d(j['minAmount']),
    nextClose: _s(j['nextClose']),
  );
});

/* ------------------------------------------------------------------ writes */

/// PUT partner/settings {rebatePct, splitPct} -> the saved values.
Future<({double rebate, double split})> savePartnerSettings(ApiClient api, double rebate, double split) async {
  final j = _json(await api.put<Object?>('partner/settings', body: {'rebatePct': rebate, 'splitPct': split}));
  return (rebate: _dn(j['rebatePct']) ?? rebate, split: _dn(j['splitPct']) ?? split);
}

/// POST partner/campaigns -> {id, slug, name}.
Future<({int id, String slug, String name})> createCampaign(
  ApiClient api, {
  required String name,
  String? slug,
  String? utmSource,
  String? utmMedium,
  String? utmCampaign,
}) async {
  final j = _json(
    await api.post<Object?>(
      'partner/campaigns',
      body: {
        'name': name,
        if (slug != null && slug.isNotEmpty) 'slug': slug,
        if (utmSource != null && utmSource.isNotEmpty) 'utmSource': utmSource,
        if (utmMedium != null && utmMedium.isNotEmpty) 'utmMedium': utmMedium,
        if (utmCampaign != null && utmCampaign.isNotEmpty) 'utmCampaign': utmCampaign,
      },
    ),
  );
  return (id: _i(j['id']), slug: _s(j['slug']), name: _s(j['name'], name));
}

/// PATCH partner/campaigns/{id} {active}.
Future<void> setCampaignActive(ApiClient api, int id, bool active) => api.patch<Object?>('partner/campaigns/$id', body: {'active': active});

/// The message of a failed partner call (web partnerApi: "unavailable" and 5xx read as the partner service being down).
String partnerError(Object? e, T t) {
  if (e is ApiException) {
    if (e.code == 'unavailable' || e.status >= 500) return t('partner.error.unavailable');
    return localizeError(e, t);
  }
  return t('partner.error.generic');
}

/* ------------------------------------------------------------------ links */

String referralLink(String base, String code) => '$base/r/$code';
String campaignLink(String base, String code, String slug) => slug.isEmpty ? '$base/r/$code' : '$base/r/$code/$slug';
String shortUrl(String u) => u.replaceFirst(RegExp(r'^https?://'), '');

/// The web's slugPreview: what the server makes of the name when no ending is given.
String slugPreview(String name) {
  var s = name.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-+|-+$'), '');
  if (s.length > 40) s = s.substring(0, 40);
  return s.replaceAll(RegExp(r'-+$'), '');
}

/* ------------------------------------------------------------------ formatting (api.ts) */

/// The partner pages' dates (local time; English keeps the web's hand-built formats).
class PartnerFmt {
  PartnerFmt(this.t) : _tag = intlLocale(t.locale);
  final T t;
  final String _tag;
  static const _mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  static const _wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  bool get _en => t.locale == 'en';
  String _intl(String pattern, DateTime d) => latinDigits(DateFormat(pattern, _tag).format(d));
  static DateTime? _local(String? iso) => iso == null || iso.isEmpty ? null : DateTime.tryParse(iso)?.toLocal();
  static String _two(int n) => n.toString().padLeft(2, '0');

  /// "28 Sep 2026".
  String date(String? iso, {bool withYear = true}) {
    final d = _local(iso);
    if (d == null) return '—';
    if (!_en) return _intl(withYear ? 'dd MMM y' : 'dd MMM', d);
    return '${_two(d.day)} ${_mon[d.month - 1]}${withYear ? ' ${d.year}' : ''}';
  }

  /// "28 Sep, 14:03".
  String dateTime(String? iso) => _local(iso) == null ? '—' : '${date(iso, withYear: false)}, ${time(iso)}';

  /// "14:03".
  String time(String? iso) {
    final d = _local(iso);
    if (d == null) return '—';
    return '${_two(d.hour)}:${_two(d.minute)}';
  }

  /// "5 Oct" / "5 Oct 2026" for a UTC midnight.
  String utcDay(DateTime utc, {bool withYear = false}) {
    final d = utc.toUtc();
    if (!_en) return _intl(withYear ? 'd MMM y' : 'd MMM', d);
    return '${d.day} ${_mon[d.month - 1]}${withYear ? ' ${d.year}' : ''}';
  }

  /// "Mon 5 Oct".
  String day(String? iso) {
    final d = _local(iso);
    if (d == null) return '—';
    if (!_en) return _intl('EEE d MMM', d);
    return '${_wd[d.weekday - 1]} ${d.day} ${_mon[d.month - 1]}';
  }

  /// "Mar 2024".
  String month(String? iso) {
    final d = _local(iso);
    if (d == null) return '—';
    if (!_en) return _intl('MMM y', d);
    return '${_mon[d.month - 1]} ${d.year}';
  }

  /// Month name of a "YYYY-MM" key, e.g. "Sep" (offset -1: the month before).
  String monthName(String key, [int offset = 0]) {
    final p = key.split('-');
    final y = p.isNotEmpty ? int.tryParse(p[0]) : null;
    final m = p.length > 1 ? int.tryParse(p[1]) : null;
    if (y == null || m == null || y == 0 || m == 0) return '';
    final i = ((m - 1 + offset) % 12 + 12) % 12;
    if (!_en) return _intl('MMM', DateTime(2000, i + 1, 15));
    return _mon[i];
  }

  /// "5m ago" (web relTime).
  String rel(String? iso, [DateTime? now]) {
    final at = _local(iso);
    if (at == null) return '—';
    final m = ((now ?? DateTime.now()).difference(at).inMilliseconds / 60000).round();
    if (m < 1) return t('partner.time.justNow');
    if (m < 60) return t('partner.time.minutesAgo', {'n': m});
    final h = (m / 60).round();
    if (h < 24) return t('partner.time.hoursAgo', {'n': h});
    final d = (h / 24).round();
    if (d < 45) return t('partner.time.daysAgo', {'n': d});
    return t('partner.time.monthsAgo', {'n': (d / 30).round()});
  }

  /// Lots with fixed decimals in the reader's language.
  String lots(num v, [int digits = 2]) => LocaleFormat(t.locale).number(v, digits);

  /// Up to `max` decimals (web toLocaleString maximumFractionDigits).
  String figure(num v, [int max = 1]) {
    final f = NumberFormat.decimalPattern(_tag)
      ..minimumFractionDigits = 0
      ..maximumFractionDigits = max;
    return latinDigits(f.format(v));
  }
}

/// 12.5 -> "12.5%", 12 -> "12%".
String fmtPct(num v) => '${v == v.roundToDouble() ? v.round() : double.parse(v.toStringAsFixed(2))}%';

/// "$5" / "$13.50".
String fmtRate(num v) => '\$${v % 1 != 0 ? v.toStringAsFixed(2) : v.toStringAsFixed(0)}';

/// Whole dollars ("$1,250"): web formatMoney(v, "USD", 0).
String money0(num v) => Fmt.money(v, decimals: 0);

String scheduleLabel(T t, String s) => t.dyn('partner.schedule.$s', fallback: const {'daily': 'Daily', 'weekly': 'Weekly', 'monthly': 'Monthly'}[s] ?? s);

String kindLabel(T t, String k) => t.dyn(
  'partner.kind.$k',
  fallback:
      const {'lot': 'Lot commission', 'split': 'Sub-IB split', 'rebate': 'Rebate', 'cpa': 'CPA bonus', 'clawback': 'Clawback', 'adjustment': 'Adjustment'}[k] ??
      k.replaceAll('_', ' '),
);

/// An option series code (`EURUSD-20261009-1.1650-C`).
bool isOptionSeries(String? s) => s != null && RegExp(r'^[^-]+-\d{8}-[\d.]+-[CPcp]$').hasMatch(s);

/// A commission line or deal on an option (paid per contract).
bool isOptionLine({String? symbolGroup, double contracts = 0, String? instrument, String? symbol}) =>
    instrument == 'option' || symbolGroup == 'options' || contracts > 0 || isOptionSeries(symbol);

/// "Options · 3 contracts" ("Options" when the line carries no count).
String optionsLabel(T t, num? contracts) {
  final n = (contracts ?? 0).abs();
  if (n == 0) return t('partner.line.optionsDeal');
  final f = NumberFormat.decimalPattern(intlLocale(t.locale))..maximumFractionDigits = 2;
  return t('partner.line.options', {'count': n, 'n': latinDigits(f.format(n))});
}

/// Readable name of an engine symbol: "EURUSD 1.1000 Call · 2 Oct" for an option series, the symbol otherwise.
String symbolLabel(T t, String symbol) {
  final o = parseSeries(symbol);
  if (o == null) return symbol;
  final d = DateTime.tryParse('${o.expiry}T00:00:00Z');
  var date = o.expiry;
  if (d != null) {
    final sameYear = d.year == DateTime.now().toUtc().year;
    date = latinDigits(DateFormat(sameYear ? 'd MMM' : 'd MMM y', intlLocale(t.locale)).format(d));
  }
  return t('accounts.opt.label', {
    'underlying': o.underlying,
    'strike': o.strikeLabel,
    'right': t(o.right == 'call' ? 'accounts.opt.call' : 'accounts.opt.put'),
    'date': date,
  });
}

/// The one-line description of a ledger entry (web commissionLine).
String commissionLine(T t, PartnerFmt f, PCommission e) {
  if (e.kind == 'cpa') return t('partner.line.cpa');
  final option = isOptionLine(symbolGroup: e.symbolGroup, contracts: e.contracts, symbol: e.symbol);
  String lot(double v) => t('partner.line.lot', {'lots': f.lots(v)});
  final sym = e.symbol == null ? null : symbolLabel(t, e.symbol!);
  if (e.kind == 'lot') return '${sym ?? t('partner.line.trade')} · ${option ? optionsLabel(t, e.contracts) : lot(e.lots)} · L${e.tier}';
  if (e.kind == 'split') return '${kindLabel(t, 'split')}${sym != null ? ' · $sym' : ''} · L${e.tier}';
  if (e.kind == 'rebate') {
    return '${kindLabel(t, 'rebate')}${sym != null ? ' · $sym' : ''}${option ? ' · ${optionsLabel(t, e.contracts)}' : (e.lots != 0 ? ' · ${lot(e.lots)}' : '')}';
  }
  return e.note != null ? '${kindLabel(t, e.kind)} · ${e.note}' : kindLabel(t, e.kind);
}
