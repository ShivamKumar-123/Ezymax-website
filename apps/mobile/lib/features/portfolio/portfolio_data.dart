// The Portfolio pages' data, one provider per web hook (same paths, same poll intervals):
//   portfolioAccountsProvider   GET trading/accounts                          5 s (LivePortfolio useAccounts(5000))
//   openPositionsProvider       GET trading/accounts/{login} per account with positions, 10 s (useOpenPositions)
//   historyPageProvider         GET trading/accounts/{login}/history?from&to&page&limit&instrument (HistoryPanel)
//   ledgerPageProvider          GET trading/accounts/{login}/ledger?from&to&page&limit (LedgerPanel)
//   analyticsProvider           GET reports/analytics?login=all|<login>&from&to (useAnalytics)
//   statementMonthsProvider     GET reports/accounts/{login}/months (Statements)
// The picker pages use the shared accountsProvider (web useAccounts(10000)). Files (CSV exports, statements) go
// through downloadAndShare: the web's download becomes the share sheet.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/files.dart';
import '../../core/lifecycle.dart';
import '../../core/models/account.dart';
import '../../core/models/trading.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import 'analytics_model.dart';
import 'portfolio_logic.dart';

List<EngineAccount> _accounts(Map<String, dynamic> j) => [
  for (final a in (j['accounts'] as List? ?? const []))
    if (a is Map) EngineAccount.fromJson(a.cast<String, dynamic>()),
];

/// `GET trading/accounts` every 5 s (the Portfolio overview).
final portfolioAccountsProvider = FutureProvider.autoDispose<List<EngineAccount>>((ref) async {
  ref.pollEvery(const Duration(seconds: 5));
  return _accounts(await ref.watch(apiProvider).get<Map<String, dynamic>>('trading/accounts'));
});

/// An open position with its account.
typedef PositionRow = ({EngineAccount account, EnginePosition position});

/// Open positions of every account that has some, refreshed every 10 s (web useOpenPositions). An account whose
/// detail fails is left out (Promise.allSettled).
final openPositionsProvider = FutureProvider.autoDispose<List<PositionRow>>((ref) async {
  final key = await ref.watch(
    portfolioAccountsProvider.selectAsync((all) => [for (final a in all.where((a) => !a.archived && a.positions > 0)) a.login].join(',')),
  );
  if (key.isEmpty) return const [];
  ref.pollEvery(const Duration(seconds: 10));
  final api = ref.watch(apiProvider);
  final details = await Future.wait([
    for (final l in key.split(','))
      api.get<Map<String, dynamic>>('trading/accounts/$l').then<AccountDetail?>(AccountDetail.fromJson).catchError((Object _) => null),
  ]);
  return [
    for (final d in details.whereType<AccountDetail>())
      for (final p in d.positions) (account: d.account, position: p),
  ];
});

/// A history request: the account, the range's query values, the page and the instrument filter.
typedef HistoryArgs = ({int login, String? from, String? to, int page, int limit, String instrument});

final historyPageProvider = FutureProvider.autoDispose.family<HistoryPage, HistoryArgs>((ref, a) async {
  final j = await ref
      .watch(apiProvider)
      .get<Map<String, dynamic>>(
        'trading/accounts/${a.login}/history',
        query: {'from': a.from, 'to': a.to, 'page': a.page, 'limit': a.limit, if (a.instrument != 'all') 'instrument': a.instrument},
      );
  return HistoryPage.fromJson(j);
});

typedef LedgerArgs = ({int login, String? from, String? to, int page, int limit});

final ledgerPageProvider = FutureProvider.autoDispose.family<LedgerPage, LedgerArgs>((ref, a) async {
  final j = await ref
      .watch(apiProvider)
      .get<Map<String, dynamic>>('trading/accounts/${a.login}/ledger', query: {'from': a.from, 'to': a.to, 'page': a.page, 'limit': a.limit});
  return LedgerPage.fromJson(j);
});

/// `login`: "all" (the live accounts) or one login.
typedef AnalyticsArgs = ({String login, AnPeriod period});

final analyticsProvider = FutureProvider.autoDispose.family<Analytics, AnalyticsArgs>((ref, a) async {
  final r = periodRange(a.period);
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('reports/analytics', query: {'login': a.login, 'from': r.from, 'to': r.to});
  return Analytics.fromJson(j);
});

final statementMonthsProvider = FutureProvider.autoDispose.family<List<MonthRow>, int>((ref, login) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('reports/accounts/$login/months');
  return [
    for (final m in (j['months'] as List? ?? const []))
      if (m is Map) MonthRow.fromJson(m.cast<String, dynamic>()),
  ];
});

/* ------------------------------------------------------------------ files */

typedef ShareFileFn = Future<bool> Function(DownloadedFile file, {required String fallbackName, String? subject});

/// How a downloaded file reaches the share sheet (tests swap it for a recorder).
@visibleForTesting
ShareFileFn portfolioShareFile = shareFile;

/// Downloads a file from the API and opens the share sheet with it (the web's fetch-then-download: a service error
/// becomes a message instead of a broken file). Toasts `ok` (or `fail` with the reason) like the web's toasts.
/// Resolves true when the file was handed to the share sheet.
Future<bool> downloadAndShare(
  Ref ref, {
  required String path,
  Map<String, Object?>? query,
  required String fallbackName,
  required String ok,
  required String fail,
  String? description,
}) async {
  final notes = ref.read(notificationsProvider.notifier);
  final t = ref.read(tProvider);
  try {
    final file = await ref.read(apiProvider).download(path, query: query);
    final shared = await portfolioShareFile(file, fallbackName: fallbackName, subject: description);
    if (!shared) {
      notes.toast(NotificationKind.error, fail, description: t('common.errorRetry'));
      return false;
    }
    notes.toast(NotificationKind.success, ok, description: description);
    return true;
  } on ApiException catch (e) {
    notes.toast(NotificationKind.error, fail, description: localizeError(e, t));
    return false;
  } catch (_) {
    notes.toast(NotificationKind.error, fail, description: t('common.errorRetry'));
    return false;
  }
}

/// [downloadAndShare] from a widget: `ref.read(downloaderProvider)(path: …)`.
final downloaderProvider = Provider<Downloader>(Downloader.new);

class Downloader {
  Downloader(this.ref);
  final Ref ref;

  Future<bool> call({
    required String path,
    Map<String, Object?>? query,
    required String fallbackName,
    required String ok,
    required String fail,
    String? description,
  }) => downloadAndShare(ref, path: path, query: query, fallbackName: fallbackName, ok: ok, fail: fail, description: description);
}
