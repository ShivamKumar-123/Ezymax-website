// Watchlist tab (web MWatch): asset-class chips with counts (and ★ favourites), a search, and the markets with
// their live bid / ask. Browsing shows the core markets (and the favourites); a search looks through every market the
// account may trade (live accounts: core + live-enabled catalogue; demo: everything), first 60 matches. Only rows on
// screen stream live; a delayed price shows a clock and its trade buttons stay off. Tap: the chart; swipe or hold:
// favourite / new order.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../core/market.dart';
import '../core/models.dart';
import '../core/terminal_controller.dart';
import '../core/workspace.dart';
import '../terminal_screen.dart';
import '../widgets/kit.dart';
import 'order_sheet.dart';

bool inSegment(SymbolSpec s, String seg, List<String> favourites) =>
    seg == 'all' || (seg == 'favourites' ? favourites.contains(s.symbol) : s.assetClass == seg);

String segmentLabel(T t, String s) => s == 'all' ? t('common.all') : t.dyn('market.segment.$s', fallback: s);

/// The segment chips with counts (web SegmentChips size md): empty classes are left out; All and ★ always show.
class SegmentChips extends StatelessWidget {
  const SegmentChips({super.key, required this.instruments, required this.value, required this.favourites, required this.onChanged});
  final List<SymbolSpec> instruments;
  final String value;
  final List<String> favourites;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final counts = {for (final s in kSegments) s: instruments.where((i) => inSegment(i, s, favourites)).length};
    final shown = kSegments.where((s) => s == 'favourites' || s == 'all' || (counts[s] ?? 0) > 0 || s == value).toList();
    final current = shown.contains(value) ? value : 'all';
    return SizedBox(
      height: 32,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final s in shown)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 5),
              child: KPressable(
                minSize: 32,
                pressedScale: 0.97,
                semanticLabel: t('market.segment.title', {'label': segmentLabel(t, s), 'count': counts[s] ?? 0}),
                onTap: () {
                  KHaptics.selection();
                  onChanged(s);
                },
                child: Container(
                  height: 30,
                  padding: const EdgeInsets.symmetric(horizontal: 11),
                  decoration: BoxDecoration(
                    color: s == current ? k.emberSoft : Colors.transparent,
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(color: s == current ? k.ember.withValues(alpha: 0.45) : k.line),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (s == 'favourites')
                        Icon(LucideIcons.star, size: 13, color: s == current ? k.ember : k.fg2)
                      else
                        Text(segmentLabel(t, s), style: context.text.label.copyWith(fontSize: 12.5, color: s == current ? k.ember : k.fg2)),
                      const SizedBox(width: 5),
                      Text('${counts[s] ?? 0}', style: context.text.mono(11, color: s == current ? k.ember.withValues(alpha: 0.8) : k.fg3)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class WatchlistTab extends ConsumerStatefulWidget {
  const WatchlistTab({super.key});

  @override
  ConsumerState<WatchlistTab> createState() => _WatchlistTabState();
}

class _WatchlistTabState extends ConsumerState<WatchlistTab> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final book = ref.watch(symbolBookProvider);
    final ws = ref.watch(workspaceProvider);
    final live = ref.watch(terminalProvider.select((s) => s.account?.live ?? true));
    final visible = book.visible(live: live);
    final core = book.core;
    final seg = ws.segment;
    final q = _q.trim().toLowerCase();
    final List<SymbolSpec> list;
    if (q.isNotEmpty) {
      list = visible
          .where((i) => inSegment(i, seg, ws.favourites))
          .where((i) => i.symbol.toLowerCase().contains(q) || i.name.toLowerCase().contains(q))
          .take(60)
          .toList();
    } else if (seg == 'favourites') {
      list = [
        for (final f in ws.favourites)
          if (book.isVisible(f, live: live)) book[f]!,
      ];
    } else {
      list = core.where((i) => inSegment(i, seg, ws.favourites)).toList();
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 6),
          child: Column(
            children: [
              SegmentChips(
                instruments: core,
                value: seg,
                favourites: ws.favourites,
                onChanged: (s) => ref.read(workspaceProvider.notifier).update((w) => w.copyWith(segment: s)),
              ),
              const SizedBox(height: 6),
              Container(
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  color: k.surface2,
                  borderRadius: BorderRadius.circular(9),
                  border: Border.all(color: k.line),
                ),
                child: Row(
                  children: [
                    Icon(LucideIcons.search, size: 15, color: k.fg3),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        onChanged: (v) => setState(() => _q = v),
                        style: context.text.callout.copyWith(fontSize: 13),
                        cursorColor: k.ember,
                        textInputAction: TextInputAction.search,
                        decoration: InputDecoration(
                          isCollapsed: true,
                          border: InputBorder.none,
                          hintText: t('trader.searchSymbols'),
                          hintStyle: context.text.callout.copyWith(fontSize: 13, color: k.fg3),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: book.all.isEmpty
              ? ListView(children: [for (var i = 0; i < 8; i++) const _RowSkeleton()])
              : list.isEmpty
              ? TEmptyLine(seg == 'favourites' && q.isEmpty ? t('trader.mobile.noFavourites') : t('trader.mobile.noSymbols'))
              : ListView.builder(
                  itemCount: list.length,
                  itemExtent: 52,
                  itemBuilder: (context, i) => WatchRow(spec: list[i], active: list[i].symbol == ws.symbol, favourite: ws.favourites.contains(list[i].symbol)),
                ),
        ),
      ],
    );
  }
}

class _RowSkeleton extends StatelessWidget {
  const _RowSkeleton();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    child: Row(
      children: [
        KSkeleton(width: 22, height: 22, circle: true),
        SizedBox(width: 10),
        Expanded(child: KSkeleton(height: 12)),
        SizedBox(width: 40),
        KSkeleton(width: 150, height: 24),
      ],
    ),
  );
}

/// One market (web MWatchRow): avatar, symbol, change % · name, bid (red box) and ask (green box).
class WatchRow extends ConsumerWidget {
  const WatchRow({super.key, required this.spec, required this.active, required this.favourite});
  final SymbolSpec spec;
  final bool active;
  final bool favourite;

  void _open(WidgetRef ref) {
    ref.read(workspaceProvider.notifier).update((w) => w.copyWith(symbol: spec.symbol));
    ref.read(cfdTabProvider.notifier).set('chart');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final readOnly = ref.watch(terminalProvider.select((s) => s.readOnly));
    return KSwipeable(
      background: k.bg,
      actions: [
        KSwipeAction(
          label: t('market.segment.favourites'),
          icon: favourite ? Icons.star_rounded : Icons.star_outline_rounded,
          color: k.gold,
          onTap: () => ref.read(workspaceProvider.notifier).toggleFavourite(spec.symbol),
        ),
      ],
      child: KPressable(
        pressedScale: 1,
        pressedOpacity: 0.7,
        onTap: () => _open(ref),
        onLongPress: () => unawaited(
          showKActionSheet<void>(
            context,
            title: '${spec.symbol} · ${spec.name}',
            actions: [
              KAction(label: t('trader.mobile.tab.chart'), icon: LucideIcons.candlestickChart, onTap: () => _open(ref)),
              if (!readOnly)
                KAction(
                  label: t('chart.menu.newOrder'),
                  icon: LucideIcons.shoppingCart,
                  onTap: () => unawaited(showOrderSheet(context, symbol: spec.symbol)),
                ),
              KAction(
                label: t('market.segment.favourites'),
                icon: favourite ? LucideIcons.starOff : LucideIcons.star,
                onTap: () => ref.read(workspaceProvider.notifier).toggleFavourite(spec.symbol),
              ),
            ],
          ),
        ),
        child: Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: active ? k.ember.withValues(alpha: 0.07) : Colors.transparent,
            border: Border(bottom: BorderSide(color: k.line, width: 0.6)),
          ),
          child: QuoteBuilder(
            symbol: spec.symbol,
            builder: (context, q) {
              final ch = q?.change ?? 0;
              final delayed = q?.delayed ?? false;
              Widget box(double v, bool ask) => Container(
                constraints: const BoxConstraints(minWidth: 80),
                height: 30,
                padding: const EdgeInsets.symmetric(horizontal: 6),
                alignment: AlignmentDirectional.centerEnd,
                decoration: BoxDecoration(color: delayed ? k.surface3 : (ask ? k.upSoft : k.downSoft), borderRadius: BorderRadius.circular(6)),
                child: PriceText(v, digits: spec.digits, size: 12, dir: q?.dir ?? 0, color: delayed ? k.fg3 : null),
              );
              return Row(
                children: [
                  SizedBox(
                    width: 32,
                    child: Align(alignment: AlignmentDirectional.centerStart, child: SymbolAvatar(spec.symbol)),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Row(
                          children: [
                            Text(spec.symbol, style: context.text.label.copyWith(fontSize: 13, color: k.fg)),
                            if (favourite) ...[const SizedBox(width: 4), Icon(Icons.star_rounded, size: 12, color: k.gold)],
                            if (delayed) ...[
                              const SizedBox(width: 5),
                              Icon(LucideIcons.clock, size: 11, color: k.warn),
                              const SizedBox(width: 2),
                              Text(t('desk.side.delayed'), style: context.text.micro.copyWith(color: k.warn, fontSize: 9.5)),
                            ],
                          ],
                        ),
                        const SizedBox(height: 1),
                        Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: '${ch >= 0 ? '+' : ''}${ch.toStringAsFixed(2)}%',
                                style: context.text.mono(10.5, color: ch >= 0 ? k.up : k.down),
                              ),
                              TextSpan(
                                text: ' · ${spec.name}',
                                style: context.text.footnote.copyWith(fontSize: 10.5, color: k.fg3),
                              ),
                            ],
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  box(q?.bid ?? 0, false),
                  const SizedBox(width: 4),
                  box(q?.ask ?? 0, true),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
