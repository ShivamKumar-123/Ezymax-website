// Trade tab (web MTrade): the account grid (balance, equity, free margin, margin, level, P&L), the depth-of-market
// ladder of the chart's market (one-click), open positions (swipe to close, tap: the position sheet), pending orders
// (tap: modify, ×: cancel) and Close all behind a confirm.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../core/market.dart';
import '../core/models.dart';
import '../core/terminal_controller.dart';
import '../core/trade_actions.dart';
import '../core/trade_math.dart';
import '../core/workspace.dart';
import '../widgets/kit.dart';
import 'dom_ladder.dart';
import 'position_sheet.dart';

class TradeTab extends ConsumerStatefulWidget {
  const TradeTab({super.key});

  @override
  ConsumerState<TradeTab> createState() => _TradeTabState();
}

class _TradeTabState extends ConsumerState<TradeTab> {
  bool _depth = false;

  Future<void> _closeAll() async {
    final t = context.t;
    final st = ref.read(terminalProvider);
    final cent = st.account?.cent ?? false;
    final ok = await showKAlert<bool>(
      context,
      title: t('toolbox.bulk.closeAll'),
      message: '${t('trader.mobile.positions', {'count': st.positions.length})} · ${accMoney(cent, st.metrics.floating, signed: true)} ${accCcy(cent)}',
      actions: [
        KAction(label: t('common.cancel'), value: false),
        KAction(label: t('trader.mobile.closeAll'), value: true, destructive: true, primary: true),
      ],
    );
    if (ok == true) unawaited(ref.read(tradeActionsProvider).bulkClose('all'));
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final st = ref.watch(terminalProvider);
    final a = st.account;
    final symbol = ref.watch(workspaceProvider.select((w) => w.symbol));
    if (a == null) return const SizedBox.shrink();
    final m = st.metrics;
    final ms = marginState(m.level, a);
    final cells = [
      (t('common.balance'), accMoney(a.cent, m.balance), null),
      (t('common.equity'), accMoney(a.cent, m.equity), null),
      (t('trader.mobile.freeMargin'), accMoney(a.cent, m.free), m.free < 0 ? k.down : null),
      (t('trader.mobile.margin'), accMoney(a.cent, m.margin), null),
      (
        t('trader.mobile.level'),
        m.level.isFinite ? '${m.level.toStringAsFixed(0)}%' : '—',
        ms == 'low' ? k.warn : (ms == 'call' || ms == 'stopout' ? k.down : null),
      ),
      (t('trader.status.pnl'), accMoney(a.cent, m.floating, signed: true), m.floating >= 0 ? k.up : k.down),
    ];
    return RefreshIndicator.adaptive(
      onRefresh: () => ref.read(terminalProvider.notifier).reload(),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          Container(
            color: k.line,
            child: GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 0.6,
              crossAxisSpacing: 0.6,
              childAspectRatio: 2.4,
              padding: const EdgeInsets.only(bottom: 0.6),
              children: [
                for (final c in cells)
                  Container(
                    color: k.surface,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          c.$1.toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: context.text.micro.copyWith(color: k.fg3, fontSize: 9.5, letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          c.$2,
                          maxLines: 1,
                          style: context.text.mono(12.5, weight: FontWeight.w600, color: c.$3 ?? k.fg),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          // depth of market with one-click trading (D97), the same ladder as the desktop panel
          Container(
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
            ),
            child: Column(
              children: [
                KPressable(
                  pressedScale: 1,
                  onTap: () => setState(() => _depth = !_depth),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        Text(
                          '${t('order.panel.tabDepth').toUpperCase()} · ',
                          style: context.text.micro.copyWith(color: k.fg3, letterSpacing: 0.8, fontSize: 10.5),
                        ),
                        Text(symbol, style: context.text.caption.copyWith(color: k.fg2)),
                        const Spacer(),
                        AnimatedRotation(
                          turns: _depth ? 0.5 : 0,
                          duration: const Duration(milliseconds: 200),
                          child: Icon(LucideIcons.chevronDown, size: 16, color: k.fg3),
                        ),
                      ],
                    ),
                  ),
                ),
                if (_depth) SizedBox(height: 560, child: DomLadder(symbol: symbol)),
              ],
            ),
          ),
          TSectionLabel(
            t('trader.mobile.positions', {'count': st.positions.length}),
            trailing: !st.readOnly && st.positions.isNotEmpty
                ? KPressable(
                    minSize: 30,
                    onTap: _closeAll,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: k.line),
                      ),
                      child: Text(t('trader.mobile.closeAll'), style: context.text.caption.copyWith(color: k.down)),
                    ),
                  )
                : null,
          ),
          for (final p in st.positions) PositionRow(position: p, key: ValueKey('p${p.ticket}')),
          if (st.positions.isEmpty) TEmptyLine(t('trader.mobile.noPositions')),
          TSectionLabel(t('trader.mobile.pendingOrders', {'count': st.orders.length})),
          for (final o in st.orders) PendingRow(order: o, key: ValueKey('o${o.ticket}')),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

/// One open position (web MPosition): symbol, side, volume, open → current, P&L, ×. Swipe: close; tap: the sheet.
class PositionRow extends ConsumerWidget {
  const PositionRow({super.key, required this.position});
  final TPosition position;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final p = position;
    final readOnly = ref.watch(terminalProvider.select((s) => s.readOnly));
    final cent = ref.watch(terminalProvider.select((s) => s.account?.cent ?? false));
    final profit = ref.watch(terminalProvider.select((s) => s.profitOf(p)));
    final digits = ref.watch(symbolBookProvider.select((b) => b[p.symbol]?.digits ?? 5));
    final row = KPressable(
      pressedScale: 1,
      pressedOpacity: 0.7,
      onTap: readOnly ? null : () => unawaited(showPositionSheet(context, p.ticket)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 30,
              child: Align(alignment: AlignmentDirectional.centerStart, child: SymbolAvatar(p.symbol, size: 20)),
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
                          text: '${p.symbol} ',
                          style: context.text.label.copyWith(color: k.fg, fontSize: 12.5),
                        ),
                        TextSpan(
                          text: t.dyn('trader.side.${p.side}', fallback: p.side),
                          style: context.text.label.copyWith(color: p.buy ? k.up : k.down, fontSize: 12.5),
                        ),
                        TextSpan(
                          text: ' ${fmtVol(p.volume)}',
                          style: context.text.mono(12.5, color: k.fg2),
                        ),
                      ],
                    ),
                  ),
                  QuoteBuilder(
                    symbol: p.symbol,
                    throttle: const Duration(milliseconds: 500),
                    builder: (context, q) => Text(
                      '${fmtPrice(digits, p.openPrice)} → ${q == null ? '—' : fmtPrice(digits, p.buy ? q.bid : q.ask)}',
                      style: context.text.mono(10.5, color: k.fg3),
                    ),
                  ),
                ],
              ),
            ),
            PnlText(profit, cent: cent, arrow: true),
            if (!readOnly) ...[
              const SizedBox(width: 6),
              KPressable(
                minSize: 36,
                semanticLabel: t('trader.mobile.closePosition'),
                onTap: () => unawaited(ref.read(tradeActionsProvider).closePosition(p.ticket)),
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(color: k.line),
                  ),
                  child: Icon(LucideIcons.x, size: 14, color: k.fg3),
                ),
              ),
            ],
          ],
        ),
      ),
    );
    if (readOnly) return row;
    return KSwipeable(
      background: k.bg,
      actions: [
        KSwipeAction(
          label: t('desk.pos.close'),
          icon: LucideIcons.x,
          destructive: true,
          onTap: () => unawaited(ref.read(tradeActionsProvider).closePosition(p.ticket)),
        ),
      ],
      child: row,
    );
  }
}

/// One pending order (web MTrade pendings): symbol, label, volume at price · expiry, ×.
class PendingRow extends ConsumerWidget {
  const PendingRow({super.key, required this.order});
  final TOrder order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final o = order;
    final readOnly = ref.watch(terminalProvider.select((s) => s.readOnly));
    final digits = ref.watch(symbolBookProvider.select((b) => b[o.symbol]?.digits ?? 5));
    final expiry = o.expiry == 'Date' ? (o.expiryDate ?? '') : (o.expiry == 'Today' ? t('order.expiry.today') : t('order.expiry.gtc'));
    return KPressable(
      pressedScale: 1,
      pressedOpacity: 0.7,
      onTap: readOnly ? null : () => unawaited(showPendingSheet(context, o.ticket)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 28,
              child: Align(alignment: AlignmentDirectional.centerStart, child: SymbolAvatar(o.symbol, size: 18)),
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
                          text: '${o.symbol} ',
                          style: context.text.label.copyWith(color: k.fg, fontSize: 12.5),
                        ),
                        TextSpan(
                          text: t(o.labelKey),
                          style: context.text.label.copyWith(color: o.buy ? k.up : k.down, fontSize: 12.5),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${t('trader.mobile.volumeAt', {'volume': fmtVol(o.volume), 'price': fmtPrice(digits, o.price)})} · $expiry',
                    style: context.text.mono(10.5, color: k.fg3),
                  ),
                ],
              ),
            ),
            if (!readOnly)
              KPressable(
                minSize: 36,
                semanticLabel: t('trader.mobile.cancelOrder'),
                onTap: () => unawaited(ref.read(tradeActionsProvider).cancelOrder(o.ticket)),
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(color: k.line),
                  ),
                  child: Icon(LucideIcons.x, size: 14, color: k.fg3),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
