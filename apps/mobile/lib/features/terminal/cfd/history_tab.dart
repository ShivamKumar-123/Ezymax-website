// History tab (web MHistory + the toolbox History's periods and totals, components/toolbox/tabs.tsx): the period chips
// (Today · Last 3 days · Last week · Last month · Last 3 months · All history; Last month by default), the totals of
// the period (trades, win rate, gross profit / loss, profit factor) and the account's closed trades, newest first.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../core/history.dart';
import '../core/market.dart';
import '../core/models.dart';
import '../core/terminal_controller.dart';
import '../core/trade_math.dart';
import '../widgets/kit.dart';

/// Rows drawn at most (web: the first 300 of the period).
const _maxRows = 300;

class HistoryTab extends ConsumerWidget {
  const HistoryTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final period = ref.watch(historyPeriodProvider);
    final live = ref.watch(terminalProvider.select((s) => s.history));
    final synced = ref.watch(terminalProvider.select((s) => s.synced));
    final cent = ref.watch(terminalProvider.select((s) => s.account?.cent ?? false));
    final range = ref.watch(historyRangeProvider(period));
    final since = historySince(period, DateTime.now());
    final loaded = range.value == null ? const <TClosed>[] : mapHistory(range.value!.where((d) => !isOptionEntry(d)).toList(), cent: cent);
    final rows = mergeHistory(loaded, live, since);
    final stats = HistoryStats.of(rows);
    final loading = !synced || (range.isLoading && !range.hasValue && rows.isEmpty);

    Future<void> refresh() async {
      ref.invalidate(historyRangeProvider(period));
      await ref.read(terminalProvider.notifier).reload();
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: PeriodChips(value: period, onChanged: (p) => ref.read(historyPeriodProvider.notifier).set(p)),
        ),
        _Totals(stats: stats, cent: cent),
        Expanded(
          child: loading
              ? ListView(
                  children: [for (var i = 0; i < 6; i++) const Padding(padding: EdgeInsets.all(14), child: KSkeleton())],
                )
              : rows.isEmpty
              ? RefreshIndicator.adaptive(
                  onRefresh: refresh,
                  child: LayoutBuilder(
                    builder: (context, c) => SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      child: SizedBox(
                        height: c.maxHeight,
                        child: Center(
                          child: KEmptyState(icon: LucideIcons.history, title: t('trader.mobile.tab.history'), text: t('toolbox.history.empty'), compact: true),
                        ),
                      ),
                    ),
                  ),
                )
              : RefreshIndicator.adaptive(
                  onRefresh: refresh,
                  child: ListView.builder(
                    itemCount: rows.length.clamp(0, _maxRows),
                    itemBuilder: (context, i) => _Row(h: rows[i], cent: cent),
                  ),
                ),
        ),
      ],
    );
  }
}

/// The web's period radio group as a row of compact chips (scrolls sideways when the labels are long).
class PeriodChips extends StatelessWidget {
  const PeriodChips({super.key, required this.value, required this.onChanged});
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return SizedBox(
      height: 32,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final (p, _) in kHistoryPeriods)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 5),
              child: Semantics(
                selected: p == value,
                button: true,
                child: KPressable(
                  key: ValueKey('history-period-$p'),
                  minSize: 32,
                  pressedScale: 0.97,
                  onTap: () {
                    if (p == value) return;
                    KHaptics.selection();
                    onChanged(p);
                  },
                  child: Container(
                    height: 30,
                    padding: const EdgeInsets.symmetric(horizontal: 11),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: p == value ? k.emberSoft : Colors.transparent,
                      borderRadius: BorderRadius.circular(15),
                      border: Border.all(color: p == value ? k.ember.withValues(alpha: 0.45) : k.line),
                    ),
                    child: Text(t('toolbox.history.period.$p'), style: context.text.label.copyWith(fontSize: 12.5, color: p == value ? k.ember : k.fg2)),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Trades · Win rate · Gross (profit / loss) · PF, like the web toolbar's totals.
class _Totals extends StatelessWidget {
  const _Totals({required this.stats, required this.cent});
  final HistoryStats stats;
  final bool cent;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final label = context.text.mono(11, color: k.fg3);
    final v = context.text.mono(11, color: k.fg, weight: FontWeight.w600);
    Widget item(String name, Widget value) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(name, style: label),
        const SizedBox(width: 4),
        value,
      ],
    );
    return Container(
      key: const ValueKey('history-totals'),
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
      ),
      child: Wrap(
        spacing: 12,
        runSpacing: 4,
        children: [
          item(t('toolbox.history.trades'), Text('${stats.trades}', style: v)),
          item(t('toolbox.history.winRate'), Text('${stats.winRate.toStringAsFixed(1)}%', textDirection: TextDirection.ltr, style: v)),
          item(
            t('toolbox.history.gross'),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: accMoney(cent, stats.grossProfit),
                    style: v.copyWith(color: k.up),
                  ),
                  TextSpan(text: ' / ', style: label),
                  TextSpan(
                    text: accMoney(cent, stats.grossLoss),
                    style: v.copyWith(color: k.down),
                  ),
                ],
              ),
              textDirection: TextDirection.ltr,
            ),
          ),
          item(t('toolbox.history.pf'), Text(stats.pfText, style: v)),
        ],
      ),
    );
  }
}

class _Row extends ConsumerWidget {
  const _Row({required this.h, required this.cent});
  final TClosed h;
  final bool cent;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final digits = ref.watch(symbolBookProvider.select((b) => b[h.symbol]?.digits ?? 5));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 28,
            child: Align(alignment: AlignmentDirectional.centerStart, child: SymbolAvatar(h.symbol, size: 18)),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: '${h.symbol} ',
                        style: context.text.label.copyWith(color: k.fg, fontSize: 12.5),
                      ),
                      TextSpan(
                        text: t.dyn('trader.side.${h.side}', fallback: h.side),
                        style: context.text.label.copyWith(color: h.side == 'buy' ? k.up : k.down, fontSize: 12.5),
                      ),
                      TextSpan(
                        text: ' ${fmtVol(h.volume)}',
                        style: context.text.mono(12.5, color: k.fg2),
                      ),
                    ],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${fmtServer(h.closeTime, seconds: false)} · ${fmtPrice(digits, h.openPrice)} → ${fmtPrice(digits, h.closePrice)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textDirection: TextDirection.ltr,
                  style: context.text.mono(10.5, color: k.fg3),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          PnlText(h.profit, cent: cent, size: 12.5),
        ],
      ),
    );
  }
}
