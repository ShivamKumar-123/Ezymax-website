// The selected option with its sell and buy prices (web: mobile.tsx SelectionBar), under the chart and the chain:
// Sell / Buy open the ticket with that side chosen; a strategy in the ticket shows "Strategy · n legs — Review".
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../core/format.dart';
import '../core/pricer.dart';
import '../core/store.dart';
import 'bits.dart';

class SelectionBar extends ConsumerWidget {
  const SelectionBar({super.key, required this.onTrade});
  final VoidCallback onTrade;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final legs = ref.watch(optionsProvider.select((s) => s.ticket.legs));
    final sel = ref.watch(optionsProvider.select((s) => s.sel));
    final deco = BoxDecoration(
      color: k.surface,
      border: Border(top: BorderSide(color: k.line, width: 0.6)),
    );
    if (legs.length > 1) {
      return Container(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
        decoration: deco,
        child: KPressable(
          onTap: onTrade,
          child: Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: k.ember,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [BoxShadow(color: k.ember.withValues(alpha: 0.6), offset: const Offset(0, 10), blurRadius: 24, spreadRadius: -12)],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    t('trader.opt.ticket.strategy', {'count': legs.length}),
                    style: context.text.label.copyWith(fontWeight: FontWeight.w600, color: Colors.white),
                  ),
                ),
                Text(
                  t('trader.opt.ticket.review'),
                  style: context.text.label.copyWith(fontWeight: FontWeight.w600, color: Colors.white),
                ),
              ],
            ),
          ),
        ),
      );
    }
    final one = legs.length == 1 ? legs.first : null;
    final code = one?.series;
    final p = parseSeriesBase(code ?? sel ?? '');
    if (one == null || p == null) return const SizedBox.shrink();
    final q = ref.watch(optionsProvider.select((s) => s.quoteOf(code)));
    final cutMs = ref.watch(optionsProvider.select((s) => s.chain?.expiry == one.expiry && s.chain?.underlying == one.u ? s.chain!.cutMs : null));
    Widget side(String s) {
      final buy = s == 'buy';
      final v = q == null ? 0.0 : (buy ? q.askUsd : q.bidUsd);
      return Expanded(
        child: Opacity(
          opacity: q == null ? 0.5 : 1,
          child: KPressable(
            minSize: 48,
            semanticLabel: buy ? t('trader.opt.clickBuy') : t('trader.opt.clickSell'),
            onTap: q == null
                ? null
                : () {
                    KHaptics.selection();
                    ref.read(optionsProvider.notifier).arm(s);
                    onTrade();
                  },
            child: Container(
              height: 48,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(color: buy ? k.up : k.down, borderRadius: BorderRadius.circular(12)),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: buy ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: [
                  Text(
                    (buy ? t('common.buy') : t('common.sell')).toUpperCase(),
                    style: context.text.micro.copyWith(fontSize: 10, color: Colors.white.withValues(alpha: 0.9), letterSpacing: 1),
                  ),
                  Flash(
                    value: v,
                    child: Text(
                      v > 0 ? money(v) : '—',
                      textDirection: TextDirection.ltr,
                      style: context.text.mono(15, weight: FontWeight.w600, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
      decoration: deco,
      child: Column(
        children: [
          KPressable(
            minSize: 30,
            pressedScale: 1,
            onTap: onTrade,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(2, 0, 2, 6),
              child: Row(
                children: [
                  OptAvatar(p.underlying),
                  const SizedBox(width: 8),
                  Text(p.underlying, style: context.text.label.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(width: 6),
                  RightChip(p.right),
                  const SizedBox(width: 6),
                  Text(
                    p.strikeLabel,
                    textDirection: TextDirection.ltr,
                    style: context.text.mono(13, weight: FontWeight.w600),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      cutMs != null ? cutWhen(cutMs, t.locale) : expiryLabel(p.date, t.locale),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.end,
                      style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400),
                    ),
                  ),
                  const SizedBox(width: 2),
                  Icon(LucideIcons.chevronRight, size: 14, color: k.fg3),
                ],
              ),
            ),
          ),
          Row(children: [side('sell'), const SizedBox(width: 8), side('buy')]),
        ],
      ),
    );
  }
}
