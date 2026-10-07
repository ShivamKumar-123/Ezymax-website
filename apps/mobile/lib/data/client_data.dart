// Shared Client Area data (the web pages' hooks, same paths and poll intervals). Screens watch these; pull-to-refresh
// invalidates them. Later screens add their own providers next to these (one file per family is fine).
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/api_providers.dart';
import '../core/lifecycle.dart';
import '../core/models/account.dart';
import '../core/models/wallet.dart';

/// `GET trading/accounts` (web useAccounts: every 10 s on the dashboard, 5 s on the Accounts page).
final accountsProvider = FutureProvider.autoDispose<List<EngineAccount>>((ref) async {
  ref.pollEvery(const Duration(seconds: 10));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('trading/accounts');
  return [for (final a in (j['accounts'] as List? ?? const [])) EngineAccount.fromJson((a as Map).cast<String, dynamic>())];
});

/// `GET wallet/overview` (every 30 s).
final walletOverviewProvider = FutureProvider.autoDispose<WalletOverview>((ref) async {
  ref.pollEvery(const Duration(seconds: 30));
  return WalletOverview.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('wallet/overview'));
});

/// `GET wallet/activity?limit=5` (every 30 s).
final walletActivityProvider = FutureProvider.autoDispose<List<WalletActivity>>((ref) async {
  ref.pollEvery(const Duration(seconds: 30));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('wallet/activity', query: {'limit': 5});
  return [for (final x in (j['items'] as List? ?? const [])) WalletActivity.fromJson((x as Map).cast<String, dynamic>())];
});

/// `GET wallet/config`: the deposit networks and limits.
final walletConfigProvider = FutureProvider.autoDispose<List<ChainConfig>>((ref) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('wallet/config');
  return [for (final c in (j['chains'] as List? ?? const [])) ChainConfig.fromJson((c as Map).cast<String, dynamic>())];
});

/// Loyalty points (`GET growth/rewards`): balance, value per point and tier.
class RewardsSummary {
  const RewardsSummary({required this.points, required this.pointValue, required this.tierName});
  final int points;
  final double pointValue;
  final String tierName;
}

final rewardsProvider = FutureProvider.autoDispose<RewardsSummary>((ref) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('growth/rewards');
  final points = (j['points'] is Map ? (j['points'] as Map)['balance'] : null) as num?;
  final tier = j['tier'] is Map ? '${(j['tier'] as Map)['name'] ?? ''}' : '';
  return RewardsSummary(points: points?.toInt() ?? 0, pointValue: (j['pointValue'] as num?)?.toDouble() ?? 0, tierName: tier);
});

/// One day of the live accounts' equity curve (reports service).
typedef CurvePoint = ({String day, double balance, double equity, double flow});

String _isoDay(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Daily equity / balance / net deposits of the live accounts over the last `days` days
/// (`GET reports/analytics?login=all&from&to`, web loadCurve).
final equityCurveProvider = FutureProvider.autoDispose.family<List<CurvePoint>, int>((ref, days) async {
  final to = DateTime.now().add(const Duration(days: 1));
  final from = DateTime.now().subtract(Duration(days: days - 1));
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('reports/analytics', query: {'login': 'all', 'from': _isoDay(from), 'to': _isoDay(to)});
  final pts = (j['curve'] is Map ? (j['curve'] as Map)['points'] : null) as List? ?? const [];
  double d(Object? v) => v is num ? v.toDouble() : 0;
  return [for (final p in pts.whereType<Map<String, dynamic>>()) (day: '${p['day']}', balance: d(p['balance']), equity: d(p['equity']), flow: d(p['flow']))];
});
