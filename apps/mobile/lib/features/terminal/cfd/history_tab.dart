// History tab (web MHistory): the account's closed trades, newest first (the last 80 of the recent deals).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../core/market.dart';
import '../core/terminal_controller.dart';
import '../core/trade_math.dart';
import '../widgets/kit.dart';

class HistoryTab extends ConsumerWidget {
  const HistoryTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final rows = ref.watch(terminalProvider.select((s) => s.history.take(80).toList()));
    final synced = ref.watch(terminalProvider.select((s) => s.synced));
    final cent = ref.watch(terminalProvider.select((s) => s.account?.cent ?? false));
    final book = ref.watch(symbolBookProvider);
    if (!synced) {
      return ListView(
        children: [for (var i = 0; i < 6; i++) const Padding(padding: EdgeInsets.all(14), child: KSkeleton())],
      );
    }
    if (rows.isEmpty) {
      return Center(
        child: KEmptyState(icon: LucideIcons.history, title: t('trader.mobile.tab.history'), text: t('trader.mobile.guestHistory'), compact: true),
      );
    }
    return RefreshIndicator.adaptive(
      onRefresh: () => ref.read(terminalProvider.notifier).reload(),
      child: ListView.builder(
        itemCount: rows.length,
        itemBuilder: (context, i) {
          final h = rows[i];
          final digits = book[h.symbol]?.digits ?? 5;
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
                      ),
                      Text(
                        '${fmtServer(h.closeTime, seconds: false)} · ${fmtPrice(digits, h.openPrice)} → ${fmtPrice(digits, h.closePrice)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.mono(10.5, color: k.fg3),
                      ),
                    ],
                  ),
                ),
                PnlText(h.profit, cent: cent, size: 12.5),
              ],
            ),
          );
        },
      ),
    );
  }
}
