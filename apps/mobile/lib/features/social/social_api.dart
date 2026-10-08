// Copy trading and PAMM on live data: the port of apps/crm/components/social-live/api.ts (contract shapes, the
// social BFF paths, the formatting helpers and the error texts). Every path is `social/<route>` on the mobile API
// (= the web's /api/social/<route>, apps/crm/app/api/social/[...path]/route.ts), with the web's poll intervals.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_providers.dart';
import '../../core/format/format.dart';
import '../../core/lifecycle.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';

/* ------------------------------------------------------------------ JSON helpers */

double numOf(Object? v, [double fallback = 0]) => v is num ? v.toDouble() : (v is String ? double.tryParse(v) ?? fallback : fallback);
double? numOrNull(Object? v) => v is num ? v.toDouble() : (v is String ? double.tryParse(v) : null);
int intOf(Object? v) => v is num ? v.toInt() : (int.tryParse('${v ?? ''}') ?? 0);
int? intOrNull(Object? v) => v is num ? v.toInt() : (v is String ? int.tryParse(v) : null);
String strOf(Object? v) => v == null ? '' : '$v';
String? strOrNull(Object? v) => v == null ? null : '$v';
bool? boolOrNull(Object? v) => v is bool ? v : null;
Map<String, dynamic> mapOf(Object? v) => v is Map ? v.cast<String, dynamic>() : const <String, dynamic>{};
List<Map<String, dynamic>> listOf(Object? v) => v is List
    ? [
        for (final x in v)
          if (x is Map) x.cast<String, dynamic>(),
      ]
    : const [];
List<double> numsOf(Object? v) => v is List ? [for (final x in v) numOf(x)] : const [];
List<String> strsOf(Object? v) => v is List ? [for (final x in v) '$x'] : const [];

/* ------------------------------------------------------------------ shapes */

class MasterStats {
  const MasterStats(this.j);
  final Map<String, dynamic> j;
  double get return1m => numOf(j['return1m']);
  double get return3m => numOf(j['return3m']);
  double get return1y => numOf(j['return1y']);
  double get returnAll => numOf(j['returnAll']);
  double get maxDd => numOf(j['maxDd']);
  double get currentDd => numOf(j['currentDd']);
  double get volatility => numOf(j['volatility']);
  int get riskScore => intOf(j['riskScore']);
  double get equity => numOf(j['equity']);
  double get aum => numOf(j['aum']);
  int get followers => intOf(j['followers']);
  int get investors => intOf(j['investors']);
  int get trades => intOf(j['trades']);
  double get winRate => numOf(j['winRate']);
  List<double> get spark => numsOf(j['spark']);
}

class MasterFundCard {
  const MasterFundCard(this.j);
  final Map<String, dynamic> j;
  int get id => intOf(j['id']);
  String get name => strOf(j['name']);
  double get nav => numOf(j['nav']);
  String get period => strOf(j['period']);
  double get perfFeePct => numOf(j['perfFeePct']);
  int get lockInDays => intOf(j['lockInDays']);
  double get minInvestment => numOf(j['minInvestment']);
  String get status => strOf(j['status']);
}

class MasterView {
  const MasterView(this.j);
  final Map<String, dynamic> j;
  int get id => intOf(j['id']);
  String get nickname => strOf(j['nickname']);
  String get strategy => strOf(j['strategy']);
  String get description => strOf(j['description']);

  /// copy | pamm | both
  String get program => strOf(j['program'] ?? 'copy');
  double get perfFeePct => numOf(j['perfFeePct']);
  String get feePeriod => strOf(j['feePeriod'] ?? 'monthly');
  double get minAllocation => numOf(j['minAllocation']);

  /// pending | approved | rejected | suspended
  String get status => strOf(j['status']);
  bool get hidden => j['hidden'] == true;
  bool get frozen => j['frozen'] == true;
  String? get since => strOrNull(j['since']);
  int get ageDays => intOf(j['ageDays']);
  MasterStats get stats => MasterStats(mapOf(j['stats']));
  MasterFundCard? get fund => j['fund'] is Map ? MasterFundCard(mapOf(j['fund'])) : null;
  bool get house => j['house'] == true;
  bool? get acceptingNew => boolOrNull(j['acceptingNew']);
  bool get inviteOnly => j['inviteOnly'] == true;
  int? get maxFollowers => intOrNull(j['maxFollowers']);
  double? get minAllocationEffective => numOrNull(j['minAllocationEffective']);
  bool? get acceptNew => boolOrNull(j['acceptNew']);
  String? get inviteCode => strOrNull(j['inviteCode']);
  int? get login => intOrNull(j['login']);
  String? get reviewNote => strOrNull(j['reviewNote']);
  String? get createdAt => strOrNull(j['createdAt']);

  /// The same master with another minimum (the profile's terms carry the effective one).
  MasterView withMinAllocation(double v) => MasterView({...j, 'minAllocation': v});
}

class Leaderboard {
  Leaderboard(Map<String, dynamic> j) : items = [for (final m in listOf(j['items'])) MasterView(m)], totals = j['totals'] is Map ? mapOf(j['totals']) : null;
  final List<MasterView> items;
  final Map<String, dynamic>? totals;
}

class ProfileTrade {
  const ProfileTrade(this.j);
  final Map<String, dynamic> j;
  int get id => intOf(j['id']);
  String get symbol => strOf(j['symbol']);
  String get side => strOf(j['side']);
  double get volume => numOf(j['volume']);
  double get openPrice => numOf(j['openPrice']);
  double get closePrice => numOf(j['closePrice']);
  String? get openTime => strOrNull(j['openTime']);
  String? get closeTime => strOrNull(j['closeTime']);
  double get profit => numOf(j['profit']);
}

class MasterProfile {
  MasterProfile(Map<String, dynamic> j)
    : master = MasterView(mapOf(j['master'])),
      equity = [for (final p in listOf(j['equity'])) (day: strOf(p['day']), index: numOf(p['index']))],
      monthly = [for (final m in listOf(j['monthly'])) (month: strOf(m['month']), returnPct: numOf(m['returnPct']))],
      trades = [for (final t in listOf(j['trades'])) ProfileTrade(t)],
      symbols = [for (final s in listOf(j['symbols'])) (symbol: strOf(s['symbol']), trades: intOf(s['trades']), share: numOf(s['share']))],
      tradeDelayMinutes = intOf(j['tradeDelayMinutes']),
      terms = mapOf(j['terms']);
  final MasterView master;
  final List<({String day, double index})> equity;
  final List<({String month, double returnPct})> monthly;
  final List<ProfileTrade> trades;
  final List<({String symbol, int trades, double share})> symbols;
  final int tradeDelayMinutes;
  final Map<String, dynamic> terms;
  double get termsFee => numOf(terms['perfFeePct']);
  String get termsPeriod => strOf(terms['feePeriod'] ?? 'monthly');
  bool get termsHwm => terms['hwm'] == true;
  double get termsMinAllocation => numOf(terms['minAllocation']);
}

class RiskPreview {
  const RiskPreview(this.j);
  final Map<String, dynamic> j;
  Map<String, dynamic> get worstCase => mapOf(j['worstCase']);
  Map<String, dynamic> get master => mapOf(j['master']);
  List<Map<String, dynamic>> get example => listOf(j['example']);
}

class Sizing {
  const Sizing(this.mode, this.value);
  final String mode;
  final double value;
  static Sizing of(Object? v) {
    final j = mapOf(v);
    return Sizing(strOf(j['mode'] ?? 'equity'), numOf(j['value'], 1));
  }
}

class SubscriptionView {
  const SubscriptionView(this.j);
  final Map<String, dynamic> j;
  int get id => intOf(j['id']);
  int get masterId => intOf(j['masterId']);
  Map<String, dynamic> get master => mapOf(j['master']);
  String get masterName => strOf(master['nickname']);
  String get masterStrategy => strOf(master['strategy']);
  int get masterRisk => intOf(master['riskScore']);
  bool get masterFrozen => master['frozen'] == true;
  bool get masterHouse => master['house'] == true;
  int get login => intOf(j['login']);

  /// active | paused | stopped
  String get status => strOf(j['status']);
  String? get stopReason => strOrNull(j['stopReason']);
  Sizing get sizing => Sizing.of(j['sizing']);
  double? get maxLot => numOrNull(j['maxLot']);
  double? get equityStop => numOrNull(j['equityStop']);
  double? get maxDdPct => numOrNull(j['maxDdPct']);
  List<String> get excludedSymbols => strsOf(j['excludedSymbols']);
  double get perfFeePct => numOf(j['perfFeePct']);
  String get feePeriod => strOf(j['feePeriod'] ?? 'monthly');
  double get allocation => numOf(j['allocation']);
  double get netDeposits => numOf(j['netDeposits']);
  double get hwm => numOf(j['hwm']);
  double get peakEquity => numOf(j['peakEquity']);
  double get feesPaid => numOf(j['feesPaid']);
  double get feesPending => numOf(j['feesPending']);
  double? get balanceOrNull => numOrNull(j['balance']);
  double get balance => numOf(j['balance']);
  double get equity => numOf(j['equity']);
  double get profit => numOf(j['profit']);
  double get returnPct => numOf(j['returnPct']);
  int get positions => intOf(j['positions']);
  int get orders => intOf(j['orders']);
  String? get createdAt => strOrNull(j['createdAt']);
  String? get stoppedAt => strOrNull(j['stoppedAt']);
  String? get nextFeeAt => strOrNull(j['nextFeeAt']);
  double? get withdrawable => numOrNull(j['withdrawable']);
  double? get autoSlPips => numOrNull(j['autoSlPips']);
  String? get pauseReason => strOrNull(j['pauseReason']);
  String? get attention => strOrNull(j['attention']);
  Map<String, dynamic>? get pendingTerms => j['pendingTerms'] is Map ? mapOf(j['pendingTerms']) : null;

  /// Free margin that can go back to the wallet now (sub-funds.tsx withdrawableOf).
  double get withdrawableNow {
    final v = withdrawable ?? balanceOrNull ?? 0;
    return v < 0 ? 0 : v;
  }
}

class FeeView {
  const FeeView(this.j);
  final Map<String, dynamic> j;
  int get id => intOf(j['id']);
  String get source => strOf(j['source']);
  int? get subscriptionId => intOrNull(j['subscriptionId']);
  int? get fundId => intOrNull(j['fundId']);
  String get login => strOf(j['login']);
  double get amount => numOf(j['amount']);
  double get platformCut => numOf(j['platformCut']);
  double get masterAmount => numOf(j['masterAmount']);
  double? get perfAmount => numOrNull(j['perfAmount']);
  double? get mgmtAmount => numOrNull(j['mgmtAmount']);
  String? get periodStart => strOrNull(j['periodStart']);
  String? get periodEnd => strOrNull(j['periodEnd']);
  double get hwmBefore => numOf(j['hwmBefore']);
  double get hwmAfter => numOf(j['hwmAfter']);
  String get status => strOf(j['status']);
}

class FundView {
  const FundView(this.j);
  final Map<String, dynamic> j;
  int get id => intOf(j['id']);
  int get masterId => intOf(j['masterId']);
  String get masterName => strOf(mapOf(j['master'])['nickname']);
  String get name => strOf(j['name']);

  /// active | frozen | closed
  String get status => strOf(j['status']);
  String get period => strOf(j['period'] ?? 'weekly');
  double get perfFeePct => numOf(j['perfFeePct']);
  int get lockInDays => intOf(j['lockInDays']);
  double get minInvestment => numOf(j['minInvestment']);
  double get maxDdPct => numOf(j['maxDdPct']);
  double get minOwnPct => numOf(j['minOwnPct']);
  double get nav => numOf(j['nav']);
  double get equity => numOf(j['equity']);
  double get aum => numOf(j['aum']);

  /// A count, or (on the master dashboard) the list of investors.
  int get investorCount => j['investors'] is List ? (j['investors'] as List).length : intOf(j['investors']);
  List<Map<String, dynamic>> get investorList => listOf(j['investors']);
  int get pendingCount => j['pending'] is List ? listOf(j['pending']).where((r) => r['status'] == 'pending').length : intOf(j['pending']);
  double get masterSharePct => numOf(j['masterSharePct']);
  double get navPeak => numOf(j['navPeak']);
  double get drawdownPct => numOf(j['drawdownPct']);
  double get returnAll => numOf(j['returnAll']);
  double get return1m => numOf(j['return1m']);
  String? get lastRolloverAt => strOrNull(j['lastRolloverAt']);
  String? get nextRolloverAt => strOrNull(j['nextRolloverAt']);
  String? get createdAt => strOrNull(j['createdAt']);
  int? get login => intOrNull(j['login']);
}

class FundDetail {
  FundDetail(Map<String, dynamic> j)
    : fund = FundView(mapOf(j['fund'])),
      navHistory = [for (final p in listOf(j['navHistory'])) (at: strOf(p['at']), nav: numOf(p['nav']))],
      rollovers = listOf(j['rollovers']);
  final FundView fund;
  final List<({String at, double nav})> navHistory;
  final List<Map<String, dynamic>> rollovers;
}

class RequestView {
  const RequestView(this.j);
  final Map<String, dynamic> j;
  int get id => intOf(j['id']);
  int get fundId => intOf(j['fundId']);

  /// invest | redeem
  String get kind => strOf(j['kind']);
  double? get amount => numOrNull(j['amount']);
  double? get units => numOrNull(j['units']);
  bool get all => j['all'] == true;

  /// pending | done | rejected | cancelled
  String get status => strOf(j['status']);
  String? get reason => strOrNull(j['reason']);
  String get createdAt => strOf(j['createdAt']);
  double? get nav => numOrNull(j['nav']);
  double? get unitsDelta => numOrNull(j['unitsDelta']);
  double? get amountOut => numOrNull(j['amountOut']);
}

class InvestmentView {
  const InvestmentView(this.j);
  final Map<String, dynamic> j;
  int get fundId => intOf(j['fundId']);
  FundView get fund => FundView(mapOf(j['fund']));
  double get units => numOf(j['units']);
  double get nav => numOf(j['nav']);
  double get value => numOf(j['value']);
  double get netInvested => numOf(j['netInvested']);
  double get pnl => numOf(j['pnl']);
  double get pnlPct => numOf(j['pnlPct']);
  double get hwmNav => numOf(j['hwmNav']);
  double? get stopLossPct => numOrNull(j['stopLossPct']);
  String? get lockedUntil => strOrNull(j['lockedUntil']);
  double get feesPaid => numOf(j['feesPaid']);
  List<RequestView> get pending => [for (final r in listOf(j['pending'])) RequestView(r)];
  bool get locked {
    final d = DateTime.tryParse(lockedUntil ?? '');
    return d != null && d.isAfter(DateTime.now());
  }
}

class SubscriptionDetail {
  SubscriptionDetail(Map<String, dynamic> j)
    : subscription = SubscriptionView(mapOf(j['subscription'])),
      positions = listOf(j['positions']),
      orders = listOf(j['orders']),
      log = listOf(j['log']),
      fees = [for (final f in listOf(j['fees'])) FeeView(f)],
      execution = j['execution'] is Map ? mapOf(j['execution']) : null,
      announcements = listOf(j['announcements']);
  final SubscriptionView subscription;
  final List<Map<String, dynamic>> positions, orders, log;
  final List<FeeView> fees;
  final Map<String, dynamic>? execution;
  final List<Map<String, dynamic>> announcements;
}

class MasterMe {
  MasterMe(Map<String, dynamic> j)
    : master = j['master'] is Map ? MasterView(mapOf(j['master'])) : null,
      settings = mapOf(j['settings']),
      candidates = listOf(j['candidates']);
  final MasterView? master;
  final Map<String, dynamic> settings;
  final List<Map<String, dynamic>> candidates;
  double get feeMinPct => numOf(settings['feeMinPct']);
  double get feeMaxPct => numOf(settings['feeMaxPct'], 50);
  int get minTrackDays => intOf(settings['minTrackDays']);
  double get minOwnCapitalPct => numOf(settings['minOwnCapitalPct']);
  double get minMasterEquity => numOf(settings['minMasterEquity']);
  double get platformCutPct => numOf(settings['platformCutPct']);
  double get minAllocation => numOf(settings['minAllocation']);
}

class MasterDashboard {
  MasterDashboard(Map<String, dynamic> j)
    : master = MasterView(mapOf(j['master'])),
      followers = listOf(j['followers']),
      funds = [for (final f in listOf(j['funds'])) FundView(f)],
      fees = [for (final f in listOf(j['fees'])) FeeView(f)],
      totals = mapOf(j['totals']),
      announcements = listOf(j['announcements']);
  final MasterView master;
  final List<Map<String, dynamic>> followers;
  final List<FundView> funds;
  final List<FeeView> fees;
  final Map<String, dynamic> totals;
  final List<Map<String, dynamic>> announcements;
}

/* ------------------------------------------------------------------ providers (web useSocial hooks) */

Future<Map<String, dynamic>> _get(Ref ref, String path, [Map<String, Object?>? query]) =>
    ref.watch(apiProvider).get<Map<String, dynamic>>('social/$path', query: query);

/// `GET leaderboard?…` (30 s); the key is the web's query string.
final leaderboardProvider = FutureProvider.autoDispose.family<Leaderboard, String>((ref, qs) async {
  ref.pollEvery(const Duration(seconds: 30));
  return Leaderboard(await _get(ref, 'leaderboard', Uri.splitQueryString(qs)));
});

/// `GET masters/{id}?invite` (60 s).
final masterProfileProvider = FutureProvider.autoDispose.family<MasterProfile, (int, String?)>((ref, k) async {
  ref.pollEvery(const Duration(seconds: 60));
  return MasterProfile(await _get(ref, 'masters/${k.$1}', {if (k.$2 != null) 'invite': k.$2}));
});

/// `GET masters/{id}` once (the compare sheet's columns).
final masterOnceProvider = FutureProvider.autoDispose.family<MasterProfile, int>((ref, id) async => MasterProfile(await _get(ref, 'masters/$id')));

/// `GET masters/{id}/preview?…` (A9 risk preview); the key is the full path with its query.
final riskPreviewProvider = FutureProvider.autoDispose.family<RiskPreview, String>((ref, path) async {
  final u = Uri.parse(path);
  return RiskPreview(await _get(ref, u.path, u.queryParameters));
});

/// `GET symbols` (the follower's symbol exclusions).
final socialSymbolsProvider = FutureProvider.autoDispose<List<String>>((ref) async {
  final j = await _get(ref, 'symbols');
  return [for (final s in listOf(j['symbols'])) strOf(s['symbol'])];
});

/// `GET subscriptions` (5 s).
final subscriptionsProvider = FutureProvider.autoDispose<List<SubscriptionView>>((ref) async {
  ref.pollEvery(const Duration(seconds: 5));
  final j = await _get(ref, 'subscriptions');
  return [for (final s in listOf(j['items'])) SubscriptionView(s)];
});

/// `GET subscriptions/{id}` (5 s, the detail drawer).
final subscriptionDetailProvider = FutureProvider.autoDispose.family<SubscriptionDetail, int>((ref, id) async {
  ref.pollEvery(const Duration(seconds: 5));
  return SubscriptionDetail(await _get(ref, 'subscriptions/$id'));
});

/// `GET subscriptions/{id}/execution` (15 s).
final executionProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, id) async {
  ref.pollEvery(const Duration(seconds: 15));
  return _get(ref, 'subscriptions/$id/execution');
});

/// `GET funds` (30 s).
final fundsProvider = FutureProvider.autoDispose<List<FundView>>((ref) async {
  ref.pollEvery(const Duration(seconds: 30));
  final j = await _get(ref, 'funds');
  return [for (final f in listOf(j['items'])) FundView(f)];
});

/// `GET funds/{id}` (30 s).
final fundDetailProvider = FutureProvider.autoDispose.family<FundDetail, int>((ref, id) async {
  ref.pollEvery(const Duration(seconds: 30));
  return FundDetail(await _get(ref, 'funds/$id'));
});

/// `GET funds/{id}/statement`.
final fundStatementProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, id) => _get(ref, 'funds/$id/statement'));

/// `GET investments` (10 s): holdings and requests.
final investmentsProvider = FutureProvider.autoDispose<({List<InvestmentView> items, List<RequestView> requests})>((ref) async {
  ref.pollEvery(const Duration(seconds: 10));
  final j = await _get(ref, 'investments');
  return (items: [for (final i in listOf(j['items'])) InvestmentView(i)], requests: [for (final r in listOf(j['requests'])) RequestView(r)]);
});

/// `GET master/me`.
final masterMeProvider = FutureProvider.autoDispose<MasterMe>((ref) async => MasterMe(await _get(ref, 'master/me')));

/// `GET master/dashboard` (15 s).
final masterDashboardProvider = FutureProvider.autoDispose<MasterDashboard>((ref) async {
  ref.pollEvery(const Duration(seconds: 15));
  return MasterDashboard(await _get(ref, 'master/dashboard'));
});

/// Writes: POST (or PATCH) `social/<path>`.
Future<Map<String, dynamic>> socialPost(WidgetRef ref, String path, [Map<String, Object?> body = const {}]) =>
    ref.read(apiProvider).post<Map<String, dynamic>>('social/$path', body: body);
Future<Map<String, dynamic>> socialPatch(WidgetRef ref, String path, Map<String, Object?> body) =>
    ref.read(apiProvider).patch<Map<String, dynamic>>('social/$path', body: body);

/* ------------------------------------------------------------------ errors (api.ts FRIENDLY / LOCAL_FIRST) */

const Set<String> _socialCodes = {
  'unavailable',
  'not_master',
  'master_status',
  'requirements',
  'fee_out_of_range',
  'own_subscription',
  'min_allocation',
  'wallet_unavailable',
  'wallet_rejected',
  'fund_frozen',
  'min_investment',
  'locked',
  'insufficient_units',
  'request_done',
  'pamm_account',
  'stopped',
  'insufficient_funds',
  'equity_stop',
  'restricted',
  'no_pending_terms',
  'terms_pending',
  'not_accepting',
  'followers_full',
  'invite_required',
  'too_many',
};
const Set<String> _localFirst = {
  'stopped',
  'equity_stop',
  'restricted',
  'no_pending_terms',
  'terms_pending',
  'not_accepting',
  'followers_full',
  'invite_required',
  'too_many',
};

/// The text of a failed social request in the reader's language (the engine's own message for validation errors).
String socialError(Object? e, T t) {
  if (e is! ApiException) return t('social.error.generic');
  if (e.isNetwork) return t('common.networkError');
  if (_localFirst.contains(e.code)) return t('social.error.${e.code}');
  if (e.code == 'unavailable') return t('social.error.unavailable');
  if (e.status == 404 && e.code == 'not_found' && e.message.isEmpty) return t('social.error.notFound');
  if (_socialCodes.contains(e.code)) return e.message.isNotEmpty ? e.message : t('social.error.${e.code}');
  return localizeError(e, t);
}

/* ------------------------------------------------------------------ formatting (api.ts) */

double _safe(num? v) => v == null || !v.isFinite ? 0 : v.toDouble();

/// "+12.34%" / "-3.10%" / "0.00%".
String pct(num? v, [int decimals = 2, bool signed = true]) {
  final n = _safe(v);
  final s = n.abs().toStringAsFixed(decimals);
  return '${signed
      ? (n > 0
            ? '+'
            : n < 0
            ? '-'
            : '')
      : n < 0
      ? '-'
      : ''}$s%';
}

/// "$1,234.56"; signed adds "+" / "-".
String usd(num? v, [int decimals = 2, bool signed = false]) {
  final n = _safe(v);
  return '${signed
      ? (n > 0
            ? '+'
            : n < 0
            ? '-'
            : '')
      : n < 0
      ? '-'
      : ''}\$${Fmt.number(n.abs(), decimals)}';
}

String compactUsd(num? v) {
  final n = _safe(v);
  if (n.abs() >= 1e9) return '\$${(n / 1e9).toStringAsFixed(2)}B';
  if (n.abs() >= 1e6) return '\$${(n / 1e6).toStringAsFixed(2)}M';
  if (n.abs() >= 1e4) return '\$${(n / 1e3).toStringAsFixed(1)}K';
  return usd(n, 0);
}

String nav4(num? v) => _safe(v).toStringAsFixed(4);
String units4(num? v) => Fmt.number(_safe(v), 4);

/// "-12.3%" for a drawdown above zero, else "0.0%".
String ddText(num v) => v > 0 ? '-${v.toStringAsFixed(1)}%' : '0.0%';

String formatAge(T t, num? days) {
  final d = _safe(days).floor().clamp(0, 1 << 30);
  if (d < 30) return t('social.age.days', {'d': d});
  final y = d ~/ 365;
  final mo = ((d % 365) / 30.4).floor();
  return y > 0 ? t('social.age.yearsMonths', {'y': y, 'mo': mo}) : t('social.age.months', {'mo': mo});
}

String periodLabel(T t, String p) => t.dyn('social.period.$p', fallback: p);

String sizingLabel(T t, String mode) => switch (mode) {
  'fixed_lot' => t('social.sizing.fixedLot'),
  'multiplier' => t('social.sizing.multiplier'),
  'allocation' => t('social.sizing.allocation'),
  _ => t('social.sizing.equity'),
};

String sizingText(T t, Sizing? s) {
  if (s == null) return '—';
  return switch (s.mode) {
    'fixed_lot' => t('social.sizing.fixedLotValue', {'lot': s.value.toStringAsFixed(2)}),
    'multiplier' => t('social.sizing.multiplierValue', {'value': numText(s.value)}),
    'allocation' => t('social.sizing.allocationValue', {'amount': usd(s.value, 0)}),
    _ => t('social.sizing.equity'),
  };
}

/// A plain number as JavaScript prints it (1 -> "1", 1.5 -> "1.5").
String numText(num v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();

String riskLabel(T t, num r) => r <= 3 ? t('social.risk.low') : (r <= 6 ? t('social.risk.medium') : t('social.risk.high'));
KChipTone riskTone(num r) => r <= 3 ? KChipTone.up : (r <= 6 ? KChipTone.warn : KChipTone.down);

/// "12" / "1.5" pips, or "—".
String pips1(num? v) => v == null || !v.isFinite ? '—' : numText((v * 10).round() / 10);

/// Copy delay: "850 ms" / "1.4 s".
String delayText(num? ms) {
  if (ms == null || !ms.isFinite) return '—';
  return ms < 1000 ? '${ms.round()} ms' : '${(ms / 1000).toStringAsFixed(ms < 10000 ? 1 : 0)} s';
}

/// Amount with at most 2 decimals, above zero (the funds endpoints reject anything else).
bool validAmount(double? v) => v != null && v > 0 && ((v * 100).round() - v * 100).abs() < 1e-6;

/// Private copy-link code: letters and digits.
final RegExp inviteRe = RegExp(r'^[A-Za-z0-9]{4,32}$');

/// Price digits when no instrument spec is at hand (trading/api.ts priceDigits / fmtPrice).
String fmtPrice(num? v) {
  if (v == null || !v.isFinite) return '—';
  final d = v >= 1000 ? 2 : (v >= 50 ? 3 : 5);
  return Fmt.number(v, d);
}

/// The wallet's amount format (wallet-live fmt): at least 2 decimals.
String fmtUsdt(num v) => Fmt.number(v);

DateTime? parseIso(String? iso) => iso == null || iso.isEmpty ? null : DateTime.tryParse(iso);

/// trading/api.ts serverTime: "08 Oct 2026, 14:30" in server time ("—" when missing).
String serverTime(T t, String? iso, {bool withYear = true}) {
  final d = parseIso(iso);
  if (d == null) return '—';
  final f = LocaleFormat(t.locale);
  return withYear ? '${f.date(d)}, ${f.time(d)}' : f.dateTime(d);
}

/// trading/api.ts fmtDate: "08 Oct 2026".
String fmtDate(T t, String? iso) {
  final d = parseIso(iso);
  return d == null ? '—' : LocaleFormat(t.locale).date(d);
}

/// The short month name in the reader's language (0 = January).
String monthName(T t, int mo) => latinDigits(DateFormat.MMM(intlLocale(t.locale)).format(DateTime.utc(2000, mo + 1, 15)));

/// Up / down / neutral colour of a figure (api.ts toneOf).
Color toneColor(BuildContext context, num? v) {
  final k = context.k;
  final n = _safe(v);
  return n > 0 ? k.up : (n < 0 ? k.down : k.fg2);
}

/// Parses an amount the client typed ("1,000.5" -> 1000.5); null when empty or not a number.
double? parseAmount(String raw) {
  final s = raw.trim().replaceAll(',', '');
  if (s.isEmpty) return null;
  final v = double.tryParse(s);
  return v != null && v.isFinite ? v : null;
}

/// A number as the input's starting text (100 -> "100", 0.1 -> "0.1").
String inputText(num? v) => v == null ? '' : numText(v);
