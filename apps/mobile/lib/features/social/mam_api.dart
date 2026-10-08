// MAM (multi-account manager) shapes and hooks: the port of apps/crm/components/social-live/mam-api.ts, fetched
// through the social BFF (`social/mam/…`, apps/crm/lib/mam-bff.ts) with the web's poll intervals.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/lifecycle.dart';
import '../../i18n/i18n.dart';
import 'social_api.dart';

class ManagerView {
  const ManagerView(this.j);
  final Map<String, dynamic> j;
  int get id => intOf(j['id']);
  int get masterId => intOf(j['masterId']);
  String? get nickname => strOrNull(j['nickname']);
  String get name => strOf(j['name']);
  String get description => strOf(j['description']);

  /// equity | balance | multiplier | percent
  String get method => strOf(j['method'] ?? 'equity');
  double get perfFeePct => numOf(j['perfFeePct']);
  double get mgmtFeePct => numOf(j['mgmtFeePct']);
  String get feePeriod => strOf(j['feePeriod'] ?? 'monthly');
  double get minEquity => numOf(j['minEquity']);

  /// active | frozen | closed
  String get status => strOf(j['status']);
  String? get freezeReason => strOrNull(j['freezeReason']);
  String? get createdAt => strOrNull(j['createdAt']);
  int get accounts => intOf(j['accounts']);
  double get aum => numOf(j['aum']);
  int? get login => intOrNull(j['login']);
  Map<String, dynamic>? get track => j['track'] is Map ? mapOf(j['track']) : null;
}

class LinkView {
  const LinkView(this.j);
  final Map<String, dynamic> j;
  int get id => intOf(j['id']);
  int get managerId => intOf(j['managerId']);
  Map<String, dynamic>? get manager => j['manager'] is Map ? mapOf(j['manager']) : null;
  String? get managerName => manager == null ? null : strOf(manager!['name']);
  String? get managerNickname => manager == null ? null : strOrNull(manager!['nickname']);
  String? get managerMethod => manager == null ? null : strOf(manager!['method']);

  /// Full login for the client; masked ("••1234") in the manager's view.
  String get login => strOf(j['login']);

  /// active | revoked | stopped
  String get status => strOf(j['status']);
  String? get stopReason => strOrNull(j['stopReason']);
  double get allocValue => numOf(j['allocValue']);
  double? get maxLot => numOrNull(j['maxLot']);
  double? get equityStop => numOrNull(j['equityStop']);
  double get perfFeePct => numOf(j['perfFeePct']);
  double get mgmtFeePct => numOf(j['mgmtFeePct']);
  double get hwm => numOf(j['hwm']);
  double get feesPaid => numOf(j['feesPaid']);
  double get feesPending => numOf(j['feesPending']);
  double get equity => numOf(j['equity']);
  double get mamResult => numOf(j['mamResult']);
  double get balance => numOf(j['balance']);
  String get feePeriod => strOf(j['feePeriod'] ?? 'monthly');
  String? get endedAt => strOrNull(j['endedAt']);
  String? get nextFeeAt => strOrNull(j['nextFeeAt']);
  int get mamPositions => intOf(j['mamPositions']);
  int get mamOrders => intOf(j['mamOrders']);
  String? get createdAt => strOrNull(j['createdAt']);
  String? get consentAt => strOrNull(j['consentAt']);
}

class ManagerMe {
  ManagerMe(Map<String, dynamic> j)
    : master = j['master'] is Map ? mapOf(j['master']) : null,
      settings = mapOf(j['settings']),
      manager = j['manager'] is Map ? ManagerView(mapOf(j['manager'])) : null,
      totals = mapOf(j['totals']),
      links = [for (final l in listOf(j['links'])) LinkView(l)],
      allocations = listOf(j['allocations']),
      fees = [for (final f in listOf(j['fees'])) FeeView(f)],
      termsText = strOf(mapOf(j['terms'])['text']);
  final Map<String, dynamic>? master;
  final Map<String, dynamic> settings;
  final ManagerView? manager;
  final Map<String, dynamic> totals;
  final List<LinkView> links;
  final List<Map<String, dynamic>> allocations;
  final List<FeeView> fees;
  final String termsText;
  double get feeMinPct => numOf(settings['feeMinPct']);
  double get feeMaxPct => numOf(settings['feeMaxPct'], 50);
  double get mgmtMaxPct => numOf(settings['mgmtMaxPct'], 2);
  double get platformCutPct => numOf(settings['platformCutPct']);
}

/// `GET mam/links` (10 s): the client's linked accounts and the accounts that could be linked.
final mamLinksProvider = FutureProvider.autoDispose<List<LinkView>>((ref) async {
  ref.pollEvery(const Duration(seconds: 10));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('social/mam/links');
  return [for (final l in listOf(j['items'])) LinkView(l)];
});

/// `GET mam/managers`: the MAM programmes.
final mamManagersProvider = FutureProvider.autoDispose<List<ManagerView>>((ref) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('social/mam/managers');
  return [for (final m in listOf(j['items'])) ManagerView(m)];
});

/// `GET mam/managers/{id}`: one programme with its terms and the client's accounts.
final mamManagerDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, int>(
  (ref, id) => ref.watch(apiProvider).get<Map<String, dynamic>>('social/mam/managers/$id'),
);

/// `GET mam/links/{id}` (5 s): MAM trades, log, fees and the consent.
final mamLinkDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, id) {
  ref.pollEvery(const Duration(seconds: 5));
  return ref.watch(apiProvider).get<Map<String, dynamic>>('social/mam/links/$id');
});

/// `GET mam/manager` (10 s): the manager's own programme dashboard.
final mamManagerMeProvider = FutureProvider.autoDispose<ManagerMe>((ref) async {
  ref.pollEvery(const Duration(seconds: 10));
  return ManagerMe(await ref.watch(apiProvider).get<Map<String, dynamic>>('social/mam/manager'));
});

/// `GET mam/manager/preview?symbol&volume`.
final mamPreviewProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, (String, double)>(
  (ref, k) => ref.watch(apiProvider).get<Map<String, dynamic>>('social/mam/manager/preview', query: {'symbol': k.$1, 'volume': numText(k.$2)}),
);

String methodLabel(T t, String m) => t.dyn('social.mam.method.$m', fallback: m);
String methodHint(T t, String m) => t.dyn('social.mam.methodHint.$m', fallback: '');

/// "1.5×" / "50%" / "—" for the proportional methods.
String valueText(String? method, num? v) {
  if (v == null) return '—';
  if (method == 'multiplier') return '${numText(v)}×';
  if (method == 'percent') return '${numText(v)}%';
  return '—';
}

String mamStopReason(T t, String? r) => switch (r) {
  'client' => t('social.mam.stopReason.client'),
  'equity_stop' => t('social.mam.stopReason.equityStop'),
  'admin' => t('social.mam.stopReason.admin'),
  _ => t('social.subStatus.stopped'),
};

String reasonText(T t, String? r) => r == null || r.isEmpty
    ? ''
    : switch (r) {
        'below_min_lot' => t('social.mam.reason.belowMinLot'),
        'no_equity' => t('social.mam.reason.noEquity'),
        'max_lot' => t('social.mam.reason.maxLot'),
        'symbol_max_lot' => t('social.mam.reason.symbolMaxLot'),
        _ => r.replaceAll('_', ' '),
      };

String lots(num? v) => v == null || !v.isFinite ? '—' : v.toStringAsFixed(2);

/// "20% · monthly" or "20% + 2%/y · monthly" (mam.tsx feesText).
String mamFeesText(T t, double perf, double mgmt, String period) {
  final p = periodLabel(t, period).toLowerCase();
  return mgmt > 0
      ? t('social.mam.feesTextMgmt', {'perf': numText(perf), 'mgmt': numText(mgmt), 'period': p})
      : t('social.mam.feesText', {'perf': numText(perf), 'period': p});
}
