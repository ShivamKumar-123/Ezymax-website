// Dashboard › Markets (web apps/crm/app/(app)/markets/page.tsx, phone layout):
//   1 header: Markets, "{count} instruments · live quotes · server time GMT+3", Open terminal
//   2 Market heatmap: today's move, best to worst, 3 tiles a row (hollow dot: market closed); tap -> instrument sheet
//   3 the list card: filters (All · ★ n · asset classes), search, the table (★, instrument, bid, ask, daily change;
//     the 7-day line, spread and hours columns are hidden on phones like the web), empty states, "● Live" footnote
//   instrument sheet: components/markets/instrument-drawer.tsx (Sell / Buy / Trade -> Kalks Trader)
// Each row also swipes to Trade (the web's Trade link sits at the end of the row).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format/format.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'instrument_sheet.dart';
import 'instruments.dart';
import 'markets_feed.dart';

class MarketsScreen extends ConsumerStatefulWidget {
  const MarketsScreen({super.key});

  @override
  ConsumerState<MarketsScreen> createState() => _MarketsScreenState();
}

/// The list filter: all, favourites, or an asset class.
typedef _Tab = String;

class _MarketsScreenState extends ConsumerState<MarketsScreen> {
  _Tab _tab = 'all';
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final feed = ref.watch(marketsFeedProvider);
    final favs = ref.watch(marketFavouritesProvider);
    final qq = _q.trim().toLowerCase();
    final rows = kInstruments
        .where(
          (i) =>
              (_tab == 'all' || (_tab == 'fav' ? favs.contains(i.symbol) : i.assetClass.name == _tab)) &&
              (qq.isEmpty || i.symbol.toLowerCase().contains(qq) || i.name.toLowerCase().contains(qq)),
        )
        .toList();
    final sorted = [...kInstruments]..sort((a, b) => (feed[b.symbol]?.change ?? 0).compareTo(feed[a.symbol]?.change ?? 0));

    return KPageScroll(
      onRefresh: () async => ref.invalidate(marketsFeedProvider),
      children: [
        KPageHeader(title: t('news.markets.title'), subtitle: Text(t('news.markets.subtitle', {'count': kInstruments.length}))),
        const SizedBox(height: 14),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: KButton(label: t('news.markets.openTerminal'), icon: LucideIcons.candlestickChart, onPressed: () => context.push('/trader')),
        ),
        const SizedBox(height: 20),
        // 2. heatmap
        KCard(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KCardHeader(title: t('news.markets.heatmap.title'), subtitle: t('news.markets.heatmap.subtitle')),
              const SizedBox(height: 14),
              if (!feed.live)
                const SizedBox(
                  height: 160,
                  child: Center(child: KSkeleton(height: 120, width: double.infinity)),
                )
              else
                _Grid(
                  columns: 3,
                  children: [
                    for (final i in sorted) _HeatTile(inst: i, change: feed[i.symbol]?.change ?? 0, onTap: () => showInstrumentSheet(context, i.symbol)),
                  ],
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // 3. the list
        KCard(
          padding: const EdgeInsets.fromLTRB(0, 16, 0, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KChoiceChips<_Tab>(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                values: ['all', 'fav', for (final c in kAssetClasses) c.name],
                labels: [
                  t('common.all'),
                  '${favs.length}',
                  for (final c in kAssetClasses) t.dyn('news.assetClass.${c.name}', fallback: kAssetClassLabel[c]),
                ],
                icons: [null, LucideIcons.star],
                selected: _tab,
                onChanged: (v) => setState(() => _tab = v),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
                child: KSearchField(
                  placeholder: t('news.markets.searchPlaceholder'),
                  clearLabel: t('news.markets.clearSearch'),
                  onChanged: (v) => setState(() => _q = v),
                ),
              ),
              _HeaderRow(),
              if (!feed.live)
                Padding(padding: const EdgeInsets.all(16), child: KSkeleton.lines(6, height: 28, gap: 12))
              else if (rows.isEmpty)
                _tab == 'fav' && qq.isEmpty
                    ? KEmptyState(
                        compact: true,
                        art: KIllustrationName.emptyWatchlist,
                        title: t('market.empty.favouritesTitle'),
                        action: KButton(
                          label: t('common.viewAll'),
                          variant: KButtonVariant.surface,
                          size: KButtonSize.sm,
                          onPressed: () => setState(() => _tab = 'all'),
                        ),
                      )
                    : KEmptyState(compact: true, icon: LucideIcons.searchX, title: t('market.empty.noMatch'))
              else
                for (var n = 0; n < rows.length; n++) ...[
                  if (n > 0) const KDivider(indent: 16),
                  _Row(inst: rows[n], quote: feed[rows[n].symbol], fav: favs.contains(rows[n].symbol)),
                ],
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Text.rich(
                  TextSpan(
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                    children: [
                      WidgetSpan(
                        alignment: PlaceholderAlignment.middle,
                        child: Container(
                          width: 6,
                          height: 6,
                          margin: const EdgeInsetsDirectional.only(end: 6),
                          decoration: BoxDecoration(color: k.up, shape: BoxShape.circle),
                        ),
                      ),
                      TextSpan(text: '${t('common.live')} · ${t('news.markets.footnote')}'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Grid extends StatelessWidget {
  const _Grid({required this.columns, required this.children});
  final int columns;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var r = 0; r < children.length; r += columns) ...[
        if (r > 0) const SizedBox(height: 8),
        Row(
          children: [
            for (var c = r; c < r + columns; c++) ...[
              if (c > r) const SizedBox(width: 8),
              Expanded(child: c < children.length ? children[c] : const SizedBox.shrink()),
            ],
          ],
        ),
      ],
    ],
  );
}

class _HeatTile extends StatelessWidget {
  const _HeatTile({required this.inst, required this.change, required this.onTap});
  final Instrument inst;
  final double change;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final t = context.t;
    final a = (change.abs() / 3).clamp(0.0, 1.0);
    final tone = change >= 0 ? k.up : k.down;
    final open = isMarketOpen(inst);
    return KPressable(
      onTap: onTap,
      pressedScale: 0.97,
      semanticLabel: open ? t('news.markets.tile.open', {'symbol': inst.symbol}) : t('news.markets.tile.closed', {'symbol': inst.symbol}),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
        decoration: BoxDecoration(
          color: mixOklab(tone, k.surface2, (8 + a * 52) / 100),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: k.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Flexible(
                  child: Text(
                    inst.symbol,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.caption.copyWith(fontSize: 12.5, fontWeight: FontWeight.w700, color: k.fg),
                  ),
                ),
                const SizedBox(width: 5),
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: open ? k.up : null,
                    border: open ? null : Border.all(color: k.fg3),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              '${change >= 0 ? '+' : ''}${change.toStringAsFixed(2)}%',
              textDirection: TextDirection.ltr,
              style: context.text.caption.copyWith(fontSize: 12, fontFeatures: kTabular, color: a > 0.55 ? k.fg : tone),
            ),
          ],
        ),
      ),
    );
  }
}

const double _wPrice = 74, _wChange = 64, _wStar = 36;

class _HeaderRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final style = context.text.micro.copyWith(color: k.fg3, letterSpacing: 0.5, fontSize: 10.5);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12),
      padding: const EdgeInsetsDirectional.fromSTEB(4, 8, 8, 8),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: k.line),
      ),
      child: Row(
        children: [
          const SizedBox(width: _wStar),
          Expanded(child: Text(t('news.markets.col.instrument').toUpperCase(), style: style, maxLines: 1)),
          SizedBox(
            width: _wPrice,
            child: Text(t('news.markets.col.bid').toUpperCase(), style: style, textAlign: TextAlign.end),
          ),
          SizedBox(
            width: _wPrice,
            child: Text(t('news.markets.col.ask').toUpperCase(), style: style, textAlign: TextAlign.end),
          ),
          SizedBox(
            width: _wChange,
            child: Text(t('news.markets.col.dailyChange').toUpperCase(), style: style, textAlign: TextAlign.end, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );
  }
}

class _Row extends ConsumerWidget {
  const _Row({required this.inst, required this.quote, required this.fav});
  final Instrument inst;
  final MarketQuote? quote;
  final bool fav;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final q = quote;
    final priceColor = q == null ? k.fg : (q.dir == 1 ? k.up : (q.dir == -1 ? k.down : k.fg));
    Widget price(double? v) => SizedBox(
      width: _wPrice,
      child: Text(
        v == null ? '—' : Fmt.number(v, inst.digits),
        textAlign: TextAlign.end,
        textDirection: TextDirection.ltr,
        maxLines: 1,
        style: context.text.mono(12.5, weight: FontWeight.w600, color: priceColor),
      ),
    );
    return KSwipeable(
      background: k.cardBg,
      actions: [
        KSwipeAction(label: t('news.markets.trade'), icon: LucideIcons.candlestickChart, color: k.ember, onTap: () => openTrader(context, inst.symbol)),
      ],
      child: KPressable(
        onTap: () => showInstrumentSheet(context, inst.symbol),
        pressedScale: 1,
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 20, 8),
          child: Row(
            children: [
              KPressable(
                onTap: () => toggleFavourite(ref, t, inst.symbol),
                semanticLabel: t('news.markets.favourite'),
                minSize: 36,
                child: SizedBox(
                  width: _wStar,
                  child: Icon(LucideIcons.star, size: 16, color: fav ? k.gold : k.fg3),
                ),
              ),
              Expanded(child: SymbolCell(inst.symbol, size: 24)),
              price(q?.bid),
              price(q?.ask),
              SizedBox(
                width: _wChange,
                child: Align(alignment: AlignmentDirectional.centerEnd, child: _DeltaChip(q?.change ?? 0)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The web's `<Delta chip>`: a signed % on a soft green / red pill.
class _DeltaChip extends StatelessWidget {
  const _DeltaChip(this.value);
  final double value;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final up = value >= 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(color: up ? k.upSoft : k.downSoft, borderRadius: BorderRadius.circular(8)),
      child: Text(
        '${up ? '+' : ''}${value.toStringAsFixed(2)}%',
        textDirection: TextDirection.ltr,
        style: context.text.caption.copyWith(fontSize: 11, color: up ? k.up : k.down, fontWeight: FontWeight.w600, fontFeatures: kTabular),
      ),
    );
  }
}
