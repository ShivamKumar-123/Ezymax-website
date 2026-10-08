// The Book view of the Chart tab while the broker's order book is live (web: components/options/depth.tsx BookPane,
// compact): the selected option's top of book (best bid / offer with sizes, spread, last trade, mark, theo, open
// interest, volume), the depth ladder (bids | asks with sizes and the running total, the trader's own resting orders
// marked) and the trade tape. Tapping a level fills the ticket with a limit order at that price: an offer → Buy, a bid
// → Sell. Depth and trades stream from the options service (or are polled while it reconnects).
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../../core/trade_math.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/pricer.dart';
import '../core/store.dart';
import 'bits.dart';
import 'book_ticket.dart';
import 'nav.dart';

class BookPane extends ConsumerWidget {
  const BookPane({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final sel = ref.watch(optionsProvider.select((s) => s.sel));
    if (sel == null) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: Column(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: k.line),
                  ),
                  child: Icon(LucideIcons.bookOpenText, size: 16, color: k.fg3),
                ),
                const SizedBox(height: 10),
                Text(
                  t('trader.opt.depth.emptyTitle'),
                  textAlign: TextAlign.center,
                  style: context.text.label.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  t('trader.opt.depth.emptyText'),
                  textAlign: TextAlign.center,
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
                const SizedBox(height: 12),
                OptSmallButton(label: t('trader.opt.chainTitle'), icon: LucideIcons.table2, filled: true, onTap: () => ref.optTab('chain')),
              ],
            ),
          ),
        ),
      );
    }
    final head = context.text.micro.copyWith(fontSize: 10.5, color: k.fg3, letterSpacing: 0.8);
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        _TopOfBook(code: sel),
        Container(
          height: 28,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: k.line)),
          ),
          child: Row(
            children: [
              Text(t('trader.opt.depth.title').toUpperCase(), style: head),
              const Spacer(),
              Icon(LucideIcons.mousePointerClick, size: 12, color: k.ember),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  t('trader.opt.depth.hint'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ),
            ],
          ),
        ),
        _Ladder(code: sel),
        Container(
          height: 28,
          alignment: AlignmentDirectional.centerStart,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            border: Border.symmetric(horizontal: BorderSide(color: k.line)),
          ),
          child: Text(t('trader.opt.tape.title').toUpperCase(), style: head),
        ),
        _Tape(code: sel),
      ],
    );
  }
}

class _TopOfBook extends ConsumerWidget {
  const _TopOfBook({required this.code});
  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final s = ref.watch(optionsProvider);
    final q = s.quoteOf(code);
    final p = parseSeriesBase(code);
    if (p == null) return const SizedBox.shrink();
    final u = seriesUnits(s, code);
    final spreadTicks = q != null && q.bid > 0 && q.ask > 0 && u.tick > 0 ? ((q.ask - q.bid) / u.tick).round() : null;
    Widget item(String label, Widget child, {String? hint}) {
      final w = Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(label.toUpperCase(), style: context.text.micro.copyWith(fontSize: 9.5, color: k.fg3, letterSpacing: 0.5)),
          const SizedBox(width: 4),
          DefaultTextStyle.merge(
            style: context.text.mono(11.5, color: k.fg),
            child: child,
          ),
        ],
      );
      return hint == null ? w : Tooltip(message: hint, child: w);
    }

    final small = context.text.mono(10, color: k.fg3);
    final ch = q == null ? null : lastChange(q.lastUsd, q.change);
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.6),
        border: Border(bottom: BorderSide(color: k.line)),
      ),
      child: Wrap(
        spacing: 14,
        runSpacing: 6,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              RightTag(p.right),
              const SizedBox(width: 6),
              Text('${p.underlying} ${p.strikeLabel}', style: context.text.mono(12.5, weight: FontWeight.w600)),
              const SizedBox(width: 6),
              Text(
                expiryLabel(p.date, t.locale),
                style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400),
              ),
              if (q != null) ...[const SizedBox(width: 6), StateBadge(q.state)],
            ],
          ),
          item(
            t('trader.opt.col.bid'),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: q != null && q.bid > 0 ? usd(q.bidUsd) : '—',
                    style: TextStyle(color: k.down),
                  ),
                  if (q?.bidQty != null && q!.bidQty! > 0) TextSpan(text: ' ×${qty(q.bidQty)}', style: small),
                ],
              ),
            ),
            hint: t('trader.opt.col.bidHint'),
          ),
          item(
            t('trader.opt.col.ask'),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: q != null && q.ask > 0 ? usd(q.askUsd) : '—',
                    style: TextStyle(color: k.up),
                  ),
                  if (q?.askQty != null && q!.askQty! > 0) TextSpan(text: ' ×${qty(q.askQty)}', style: small),
                ],
              ),
            ),
            hint: t('trader.opt.col.askHint'),
          ),
          if (spreadTicks != null)
            item(
              t('trader.opt.depth.spread'),
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: usd(q!.askUsd - q.bidUsd)),
                    TextSpan(text: ' · ${t('trader.opt.depth.ticks', {'count': spreadTicks})}', style: small),
                  ],
                ),
              ),
            ),
          item(
            t('trader.opt.col.last'),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: q?.lastUsd != null && q!.lastUsd! > 0 ? usd(q.lastUsd!) : '—'),
                  if (ch != null)
                    TextSpan(
                      text: ' $ch',
                      style: small.copyWith(color: (q?.change ?? 0) >= 0 ? k.up : k.down),
                    ),
                ],
              ),
            ),
            hint: t('trader.opt.col.lastHint'),
          ),
          item(t('trader.opt.col.mark'), Text(q != null ? usd(q.markUsd) : '—'), hint: t('trader.opt.col.markBookHint')),
          item(
            t('trader.opt.col.theo'),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: q?.theoUsd != null ? usd(q!.theoUsd!) : '—'),
                  if (q?.theoIv != null && q!.theoIv! > 0) TextSpan(text: ' ${pct(q.theoIv)}', style: small),
                ],
              ),
            ),
            hint: t('trader.opt.col.theoHint'),
          ),
          item(t('trader.opt.col.oi'), Text(qty(q?.oi)), hint: t('trader.opt.col.oiHint')),
          item(t('trader.opt.col.vol'), Text(qty(q?.volume)), hint: t('trader.opt.col.volHint')),
        ],
      ),
    );
  }
}

class _Ladder extends ConsumerWidget {
  const _Ladder({required this.code});
  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final s = ref.watch(optionsProvider);
    final depth = s.depth[code];
    final units = seriesUnits(s, code);
    final orders = ref.watch(bookOrdersProvider).open;
    // own working orders per price (in ticks) and side
    final mineBids = <int, double>{}, mineAsks = <int, double>{};
    if (units.tick > 0) {
      for (final o in orders) {
        if (o.series != code || o.price == null || o.trigger != null || o.left <= 0) continue;
        final m = o.side == 'buy' ? mineBids : mineAsks;
        final key = (o.price! / units.tick).round();
        m[key] = (m[key] ?? 0) + o.left;
      }
    }
    List<({DepthLevel l, double cum, double mine})> withCum(List<DepthLevel> levels, Map<int, double> mine) {
      var cum = 0.0;
      return [
        for (final l in levels)
          () {
            cum += l.qty;
            return (l: l, cum: cum, mine: units.tick > 0 ? (mine[(l.price / units.tick).round()] ?? 0.0) : 0.0);
          }(),
      ];
    }

    final bids = withCum(depth?.bids ?? const [], mineBids);
    final asks = withCum(depth?.asks ?? const [], mineAsks);
    final maxCum = math.max(1.0, math.max(bids.isEmpty ? 0.0 : bids.last.cum, asks.isEmpty ? 0.0 : asks.last.cum));
    final rows = math.max(5, math.max(bids.length, asks.length));
    final head = context.text.micro.copyWith(fontSize: 9.5, color: k.fg3, letterSpacing: 0.5);
    Widget side(bool isBid) {
      final list = isBid ? bids : asks;
      return Expanded(
        child: Column(
          children: [
            Container(
              height: 24,
              padding: const EdgeInsets.symmetric(horizontal: 6),
              color: k.surface2,
              child: Row(
                children: isBid
                    ? [
                        Expanded(
                          child: Text(t('trader.opt.depth.size').toUpperCase(), textAlign: TextAlign.end, style: head),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 64,
                          child: Text(
                            t('trader.opt.col.bid').toUpperCase(),
                            textAlign: TextAlign.end,
                            style: head.copyWith(color: k.down),
                          ),
                        ),
                      ]
                    : [
                        SizedBox(
                          width: 64,
                          child: Text(t('trader.opt.col.ask').toUpperCase(), style: head.copyWith(color: k.up)),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: Text(t('trader.opt.depth.size').toUpperCase(), style: head)),
                      ],
              ),
            ),
            for (var i = 0; i < rows; i++)
              if (i < list.length)
                _LevelRow(
                  isBid: isBid,
                  priceUsd: list[i].l.price * units.k,
                  size: list[i].l.qty,
                  mine: list[i].mine,
                  fill: list[i].cum / maxCum,
                  top: i == 0,
                  onTap: () => ref.read(optionsProvider.notifier).prefillLimit(code, isBid ? 'sell' : 'buy', list[i].l.price * units.k),
                )
              else
                SizedBox(
                  height: 26,
                  child: Center(
                    child: Text(
                      i == 0 ? t(isBid ? 'trader.opt.depth.noBids' : 'trader.opt.depth.noAsks') : ' ',
                      style: context.text.caption.copyWith(fontSize: 11, color: k.fg3.withValues(alpha: 0.6), fontWeight: FontWeight.w400),
                    ),
                  ),
                ),
          ],
        ),
      );
    }

    return Column(
      children: [
        if (depth == null)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Text(
              t('trader.opt.depth.loading'),
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
          ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            side(true),
            Container(width: 1, height: 24 + rows * 26.0, color: k.line),
            side(false),
          ],
        ),
      ],
    );
  }
}

class _LevelRow extends StatelessWidget {
  const _LevelRow({
    required this.isBid,
    required this.priceUsd,
    required this.size,
    required this.mine,
    required this.fill,
    required this.top,
    required this.onTap,
  });
  final bool isBid, top;
  final double priceUsd, size, mine, fill;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final you = mine > 0
        ? Tooltip(
            message: t('trader.opt.depth.mineHint', {'count': mine}),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(color: k.emberSoft, borderRadius: BorderRadius.circular(3)),
              child: Text('${t('trader.opt.depth.you')} ${qty(mine)}', style: context.text.micro.copyWith(fontSize: 9, color: k.ember)),
            ),
          )
        : null;
    final price = SizedBox(
      width: 64,
      child: Text(
        usd(priceUsd),
        textAlign: isBid ? TextAlign.end : TextAlign.start,
        style: context.text.mono(top ? 12 : 11.5, weight: FontWeight.w600, color: isBid ? k.down : k.up),
      ),
    );
    final sizeText = Flash(
      value: size,
      child: Text(qty(size), style: context.text.mono(11.5, color: k.fg2)),
    );
    return Semantics(
      button: onTap != null,
      label: t(isBid ? 'trader.opt.depth.clickSell' : 'trader.opt.depth.clickBuy', {'price': usd(priceUsd)}),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap == null
            ? null
            : () {
                KHaptics.selection();
                onTap!();
              },
        child: SizedBox(
          height: 26,
          child: Stack(
            children: [
              Positioned.fill(
                child: FractionallySizedBox(
                  alignment: isBid ? Alignment.centerRight : Alignment.centerLeft,
                  widthFactor: fill.clamp(0, 1).toDouble(),
                  child: ColoredBox(color: isBid ? k.upSoft : k.downSoft),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: Row(
                  children: isBid
                      ? [
                          Expanded(
                            child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [?you, sizeText]),
                          ),
                          const SizedBox(width: 8),
                          price,
                        ]
                      : [
                          price,
                          const SizedBox(width: 8),
                          Expanded(child: Row(children: [sizeText, ?you])),
                        ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tape extends ConsumerWidget {
  const _Tape({required this.code});
  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final s = ref.watch(optionsProvider);
    final trades = (s.tape[code] ?? const <TapeTrade>[]).take(30).toList();
    final units = seriesUnits(s, code);
    final head = context.text.micro.copyWith(fontSize: 9.5, color: k.fg3, letterSpacing: 0.5);
    if (trades.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Text(
          t('trader.opt.tape.empty'),
          textAlign: TextAlign.center,
          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
        ),
      );
    }
    return Column(
      children: [
        Container(
          height: 24,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          color: k.surface2,
          child: Row(
            children: [
              Expanded(child: Text(t('trader.opt.tape.time').toUpperCase(), style: head)),
              Expanded(
                child: Text(t('trader.opt.col.price').toUpperCase(), textAlign: TextAlign.end, style: head),
              ),
              Expanded(
                child: Text(t('trader.opt.depth.size').toUpperCase(), textAlign: TextAlign.end, style: head),
              ),
              Expanded(
                child: Tooltip(
                  message: t('trader.opt.tape.sideHint'),
                  child: Text(t('trader.opt.tape.side').toUpperCase(), textAlign: TextAlign.end, style: head),
                ),
              ),
            ],
          ),
        ),
        for (final x in trades)
          SizedBox(
            height: 24,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Text(fmtServer(DateTime.fromMillisecondsSinceEpoch(x.t, isUtc: true)).split(' ').last, style: context.text.mono(11, color: k.fg3)),
                  ),
                  Expanded(
                    child: Text(
                      usd(x.price * units.k),
                      textAlign: TextAlign.end,
                      style: context.text.mono(11.5, color: x.side == 'buy' ? k.up : k.down),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      qty(x.qty),
                      textAlign: TextAlign.end,
                      style: context.text.mono(11.5, color: k.fg2),
                    ),
                  ),
                  Expanded(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          (x.side == 'buy' ? t('common.buy') : t('common.sell')).toUpperCase(),
                          style: context.text.micro.copyWith(fontSize: 10, color: x.side == 'buy' ? k.up : k.down),
                        ),
                        if (x.kind != null && x.kind != 'book') ...[
                          const SizedBox(width: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 3),
                            decoration: BoxDecoration(color: k.surface3, borderRadius: BorderRadius.circular(3)),
                            child: Text(
                              t.dyn('trader.opt.tape.kind.${x.kind}', fallback: x.kind!),
                              style: context.text.caption.copyWith(fontSize: 9, color: k.fg3),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
