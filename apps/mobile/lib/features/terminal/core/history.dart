// History periods and totals (web components/toolbox/tabs.tsx HistoryTab): Today · Last 3 days · Last week ·
// Last month (default) · Last 3 months · All history; the closed trades of the period come from `trade/history`
// (paged) merged with the live deals of the open account, with the web's totals (trades, win rate, gross, PF).
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'models.dart';
import 'sessions.dart';

/// The web's periods: value and days back (tabs.tsx PERIODS). Labels: `toolbox.history.period.<value>`.
const kHistoryPeriods = <(String, int)>[('today', 1), ('3d', 3), ('week', 7), ('month', 30), ('3m', 90), ('all', 99999)];

/// Start of a period. "Today" starts at server midnight (GMT+3, the web's fixed offset); the others go back
/// whole days from now; "All history" has no start.
DateTime? historySince(String period, DateTime now) {
  final utc = now.toUtc();
  if (period == 'today') {
    final server = utc.add(const Duration(hours: 3));
    return DateTime.utc(server.year, server.month, server.day).subtract(const Duration(hours: 3));
  }
  if (period == 'all') return null;
  final days = kHistoryPeriods.firstWhere((p) => p.$1 == period, orElse: () => kHistoryPeriods[3]).$2;
  return utc.subtract(Duration(days: days));
}

/// The period's rows: the loaded range plus the live deals (deals closed since the load), newest first, deduped.
List<TClosed> mergeHistory(List<TClosed> loaded, List<TClosed> live, DateTime? since) {
  final seen = <String>{};
  final out = <TClosed>[];
  for (final h in [...live, ...loaded]) {
    if (since != null && h.closeTime.isBefore(since)) continue;
    if (seen.add(h.deal)) out.add(h);
  }
  out.sort((a, b) => b.closeTime.compareTo(a.closeTime));
  return out;
}

/// The web's History totals: trades, win rate, gross profit / loss, profit factor (gp / |gl|; infinite without a loss).
@immutable
class HistoryStats {
  const HistoryStats({required this.trades, required this.wins, required this.grossProfit, required this.grossLoss});

  factory HistoryStats.of(List<TClosed> rows) {
    var wins = 0;
    var gp = 0.0, gl = 0.0;
    for (final r in rows) {
      if (r.profit > 0) {
        wins++;
        gp += r.profit;
      } else if (r.profit < 0) {
        gl += r.profit;
      }
    }
    return HistoryStats(trades: rows.length, wins: wins, grossProfit: gp, grossLoss: gl);
  }

  final int trades, wins;
  final double grossProfit, grossLoss;

  double get net => grossProfit + grossLoss;
  double get winRate => trades == 0 ? 0 : wins / trades * 100;
  double get profitFactor => grossLoss != 0 ? grossProfit / grossLoss.abs() : double.infinity;

  /// "1.84", or "∞" without a losing trade (web).
  String get pfText => profitFactor.isFinite ? profitFactor.toStringAsFixed(2) : '∞';
}

/// The History tab's period (web default: Last month).
class HistoryPeriodController extends Notifier<String> {
  @override
  String build() => 'month';

  void set(String period) => state = period;
}

final historyPeriodProvider = NotifierProvider<HistoryPeriodController, String>(HistoryPeriodController.new);

/// Pages of `trade/history` read for one period (500 deals a page, at most 20 pages).
const _pageSize = 500;
const _maxPages = 20;

/// The open account's deals of one period from `trade/history` (paged, oldest pages included).
final historyRangeProvider = FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, period) async {
  final api = ref.watch(tradeApiProvider);
  if (api == null) return const [];
  final since = historySince(period, DateTime.now());
  final out = <Map<String, dynamic>>[];
  for (var page = 1; page <= _maxPages; page++) {
    final r = await api.get<Map<String, dynamic>>(
      'trade/history',
      query: {if (since != null) 'from': since.toIso8601String(), 'page': page, 'limit': _pageSize},
    );
    final deals = [
      for (final d in (r['deals'] is List ? r['deals'] as List : const <Object?>[]))
        if (d is Map) d.cast<String, dynamic>(),
    ];
    out.addAll(deals);
    final total = r['total'] is num ? (r['total'] as num).toInt() : 0;
    if (deals.length < _pageSize || out.length >= total) break;
  }
  return out;
});
