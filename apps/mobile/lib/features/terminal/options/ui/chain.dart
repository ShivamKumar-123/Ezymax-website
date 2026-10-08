// The option chain on phones (web: components/options/chain.tsx, compact): one price per side fits calls and puts
// side by side around the strike (Simple: call price | strike | put price); more columns show one side at a time
// (at most 4). The strike closest to the forward is marked ATM, the in-the-money halves are shaded, and a line with
// today's price sits between the strikes. Tapping a half selects that option (the selection bar and the ticket follow);
// "Add leg" or a strategy in the ticket adds it as a leg. While the book is live, bid / ask are the book's best bid /
// offer with their sizes. "Columns": Simple / Standard / Pro presets or any columns one by one.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../core/format.dart';
import '../core/math.dart';
import '../core/models.dart';
import '../core/store.dart';
import 'bits.dart';

const List<int> _ranges = [6, 10, 20, 0];

const Map<String, double> _colW = {
  'bid': 78,
  'ask': 78,
  'last': 70,
  'mark': 74,
  'iv': 60,
  'delta': 62,
  'gamma': 66,
  'theta': 62,
  'vega': 58,
  'prob': 62,
  'be': 82,
  'oi': 60,
  'vol': 60,
};

/// The columns on screen: the preset's, without the book-only ones while there is no book (web useChainCols).
List<String> chainColsOf(OptState s) {
  final hasOi = s.chain?.rows.any((r) => r.call?.oi != null || r.put?.oi != null) ?? false;
  return [
    for (final c in s.prefs.cols)
      if (c == 'last' ? s.isBookLive : (c == 'oi' || c == 'vol' ? s.isBookLive || hasOi : true)) c,
  ];
}

/// One column set fits calls and puts side by side (the Both view is offered).
bool chainOneCol(OptState s) => chainColsOf(s).length <= 1;

({String label, String hint}) _head(T t, String c, {required bool book, required bool simple}) => switch (c) {
  'bid' => (label: t('trader.opt.col.sell'), hint: t('trader.opt.col.bidHint')),
  'ask' =>
    simple
        ? (label: t('trader.opt.col.priceSimple'), hint: t('trader.opt.col.priceHint'))
        : (label: t('trader.opt.col.buy'), hint: t('trader.opt.col.askHint')),
  'last' => (label: t('trader.opt.col.last'), hint: t('trader.opt.col.lastHint')),
  'mark' => (label: t('trader.opt.col.mark'), hint: book ? t('trader.opt.col.markBookHint') : t('trader.opt.col.markHint')),
  'iv' => (label: t('trader.opt.col.iv'), hint: t('trader.opt.col.ivHint')),
  'delta' => (label: 'Δ', hint: t('trader.opt.col.deltaHint')),
  'gamma' => (label: 'Γ', hint: t('trader.opt.col.gammaHint')),
  'theta' => (label: 'Θ', hint: t('trader.opt.col.thetaHint')),
  'vega' => (label: 'Vega', hint: t('trader.opt.col.vegaHint')),
  'prob' => (label: t('trader.opt.col.chance'), hint: t('trader.opt.col.probHint')),
  'be' => (label: t('trader.opt.col.be'), hint: t('trader.opt.col.beHint')),
  'oi' => (label: t('trader.opt.col.oi'), hint: t('trader.opt.col.oiHint')),
  _ => (label: t('trader.opt.col.vol'), hint: t('trader.opt.col.volHint')),
};

const double _rowH = 46;
const double _strikeW = 92;

class OptionChainView extends ConsumerStatefulWidget {
  const OptionChainView({super.key});

  @override
  ConsumerState<OptionChainView> createState() => _OptionChainViewState();
}

class _OptionChainViewState extends ConsumerState<OptionChainView> {
  final ScrollController _scroll = ScrollController();
  String? _centred;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _centre(String key, int index) {
    if (_centred == key) return;
    _centred = key;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      final pos = _scroll.position;
      final target = (index * _rowH - pos.viewportDimension / 2 + _rowH).clamp(0.0, pos.maxScrollExtent);
      _scroll.jumpTo(target);
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = ref.watch(optionsProvider);
    final chain = s.chainOnScreen ?? (s.chain?.underlying == s.u ? s.chain : null);
    if (chain == null) {
      return const OptSkeletonList(count: 10, height: 36);
    }
    final atmI = atmIndex(chain);
    final rows = visibleRows(chain, s.prefs.range, atmI);
    final atmStrike = chain.rows.isEmpty ? null : chain.rows[atmI].strike;
    final spot = chain.spot?.mid;
    final all = chainColsOf(s);
    final cols = all.length > 1 ? all.take(4).toList() : all;
    final simple = cols.length == 1 && cols.first == 'ask';
    final both = simple && s.prefs.view == 'both';
    final view = both ? 'both' : (s.prefs.view == 'puts' ? 'puts' : 'calls');
    final legs = s.ticket.legs;
    final legSide = <String, String>{
      if (legs.length > 1 || s.ticket.armed)
        for (final l in legs) l.series: l.side,
    };
    final spotIdx = spot == null ? -1 : rows.indexWhere((r) => r.strike > spot);
    final selIdx = rows.indexWhere((r) => r.call?.code == s.sel || r.put?.code == s.sel);
    final atmVisible = rows.indexWhere((r) => r.strike == atmStrike);
    _centre('${chain.underlying}|${chain.expiry}', selIdx >= 0 ? selIdx : (atmVisible < 0 ? rows.length ~/ 2 : atmVisible));
    final u = chain.underlying;

    Widget sideHead(String right, {required bool end}) {
      final call = right == 'call';
      return Row(
        mainAxisAlignment: end ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!end) ...[RightTag(right, size: 18), const SizedBox(width: 6)],
          Flexible(
            child: Column(
              crossAxisAlignment: end ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      (call ? t('trader.opt.calls') : t('trader.opt.puts')).toUpperCase(),
                      style: context.text.micro.copyWith(fontSize: 11, color: k.fg, letterSpacing: 0.8),
                    ),
                    const SizedBox(width: 2),
                    Explain(right, size: 11),
                  ],
                ),
                Text(
                  call ? t('trader.opt.chain.callsSub', iso({'u': u})) : t('trader.opt.chain.putsSub', iso({'u': u})),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.caption.copyWith(fontSize: 10.5, fontWeight: FontWeight.w400, color: call ? k.up : k.down),
                ),
              ],
            ),
          ),
          if (end) ...[const SizedBox(width: 6), RightTag(right, size: 18)],
        ],
      );
    }

    return LayoutBuilder(
      builder: (context, box) {
        final colW = both ? (box.maxWidth - _strikeW) / 2 : null;
        final natural = _strikeW + cols.fold<double>(0, (a, c) => a + (_colW[c] ?? 64));
        final width = both ? box.maxWidth : (natural < box.maxWidth ? box.maxWidth : natural);
        final extra = !both && natural < box.maxWidth ? (box.maxWidth - natural) / cols.length : 0.0;
        double wOf(String c) => colW ?? ((_colW[c] ?? 64) + extra);
        final colHead = context.text.micro.copyWith(fontSize: 10, color: k.fg3, letterSpacing: 0.5);
        Widget heads(List<String> list, String right) => Row(
          children: [
            for (final c in list)
              SizedBox(
                width: wOf(c),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    _head(t, c, book: s.isBookLive, simple: simple).label.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: simple ? (right == 'call' ? TextAlign.end : TextAlign.start) : TextAlign.end,
                    style: colHead,
                  ),
                ),
              ),
          ],
        );
        final strikeHead = Container(
          width: _strikeW,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border.symmetric(vertical: BorderSide(color: k.line)),
          ),
          child: Text(t('trader.opt.col.strike').toUpperCase(), style: colHead.copyWith(color: k.fg2)),
        );
        final table = SizedBox(
          width: width,
          child: Column(
            children: [
              Container(
                height: 42,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(color: k.surface),
                child: view == 'both'
                    ? Row(
                        children: [
                          Expanded(child: sideHead('call', end: true)),
                          const SizedBox(width: _strikeW),
                          Expanded(child: sideHead('put', end: false)),
                        ],
                      )
                    : sideHead(view == 'calls' ? 'call' : 'put', end: false),
              ),
              Container(
                height: 24,
                decoration: BoxDecoration(
                  color: k.surface,
                  border: Border(bottom: BorderSide(color: k.line)),
                ),
                child: Row(
                  children: view == 'both'
                      ? [heads(cols.reversed.toList(), 'call'), strikeHead, heads(cols, 'put')]
                      : [strikeHead, heads(cols, view == 'calls' ? 'call' : 'put')],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  controller: _scroll,
                  padding: EdgeInsets.zero,
                  itemCount: rows.length,
                  itemBuilder: (context, i) {
                    final r = rows[i];
                    final row = _ChainRow(
                      row: r,
                      cols: cols,
                      view: view,
                      digits: chain.digits,
                      itmCall: spot != null && r.strike < spot,
                      itmPut: spot != null && r.strike > spot,
                      atm: r.strike == atmStrike,
                      sel: s.sel,
                      legSide: legSide,
                      simple: simple,
                      wOf: wOf,
                    );
                    if (i == spotIdx && i > 0 && spot != null) {
                      return Column(
                        children: [
                          _SpotLine(label: t('trader.opt.chain.spotNow', iso({'u': u, 'price': px(spot, chain.digits)})), both: view == 'both'),
                          row,
                        ],
                      );
                    }
                    return row;
                  },
                ),
              ),
            ],
          ),
        );
        return Column(
          children: [
            if (chain.error != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                color: k.warnSoft,
                child: Text(t('trader.opt.noPrice'), style: context.text.caption.copyWith(color: k.warn)),
              ),
            const _ModeBanner(),
            Expanded(
              child: width > box.maxWidth ? SingleChildScrollView(scrollDirection: Axis.horizontal, child: table) : table,
            ),
            _Footer(pcr: s.isBookLive ? chain.pcr : null),
          ],
        );
      },
    );
  }
}

class _ChainRow extends ConsumerWidget {
  const _ChainRow({
    required this.row,
    required this.cols,
    required this.view,
    required this.digits,
    required this.itmCall,
    required this.itmPut,
    required this.atm,
    required this.sel,
    required this.legSide,
    required this.simple,
    required this.wOf,
  });
  final OptionChainRow row;
  final List<String> cols;
  final String view;
  final int digits;
  final bool itmCall, itmPut, atm, simple;
  final String? sel;
  final Map<String, String> legSide;
  final double Function(String c) wOf;

  void _pick(WidgetRef ref, String right) {
    if (row.of(right) == null) return;
    KHaptics.selection();
    ref.read(optionsProvider.notifier).select(row, right);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final selRight = sel != null && row.call?.code == sel ? 'call' : (sel != null && row.put?.code == sel ? 'put' : null);
    Widget legChip(String right) {
      final q = row.of(right);
      final side = q == null ? null : legSide[q.code];
      if (side == null) return const SizedBox.shrink();
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 2),
        padding: const EdgeInsets.symmetric(horizontal: 3),
        decoration: BoxDecoration(color: side == 'buy' ? k.upSoft : k.downSoft, borderRadius: BorderRadius.circular(4)),
        child: Text(
          side == 'buy' ? t('trader.opt.b') : t('trader.opt.s'),
          style: context.text.micro.copyWith(fontSize: 9, color: side == 'buy' ? k.up : k.down),
        ),
      );
    }

    Widget side(String right, List<String> list) {
      final q = row.of(right);
      final itm = right == 'call' ? itmCall : itmPut;
      final inner = right == 'call' ? list.last : list.first;
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => _pick(ref, right),
        child: Semantics(
          button: true,
          label: t(right == 'call' ? 'trader.opt.chain.selectCall' : 'trader.opt.chain.selectPut', {'strike': row.strikeLabel}),
          child: Container(
            color: itm ? k.gold.withValues(alpha: 0.07) : null,
            child: Row(
              children: [
                for (final c in list)
                  SizedBox(
                    width: wOf(c),
                    height: _rowH,
                    child: _Cell(q: q, col: c, right: right, digits: digits, selected: selRight == right, simple: simple, inner: c == inner),
                  ),
              ],
            ),
          ),
        ),
      );
    }

    final strike = GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _pick(ref, view == 'both' ? (selRight ?? 'call') : (view == 'calls' ? 'call' : 'put')),
      child: Container(
        width: _strikeW,
        height: _rowH,
        decoration: BoxDecoration(
          color: selRight != null ? k.emberSoft : k.surface2,
          border: Border.symmetric(vertical: BorderSide(color: k.line.withValues(alpha: 0.5))),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (view == 'both') legChip('call'),
                Text(
                  row.strikeLabel,
                  textDirection: TextDirection.ltr,
                  style: context.text.mono(13.5, weight: FontWeight.w600, color: atm ? k.ember : k.fg),
                ),
                legChip(view == 'both' ? 'put' : (view == 'calls' ? 'call' : 'put')),
              ],
            ),
            if (atm)
              Container(
                margin: const EdgeInsets.only(top: 3),
                padding: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(color: k.emberSoft, borderRadius: BorderRadius.circular(3)),
                child: Text(t('trader.opt.chain.atm').toUpperCase(), style: context.text.micro.copyWith(fontSize: 8.5, color: k.ember, letterSpacing: 0.6)),
              ),
          ],
        ),
      ),
    );
    return Container(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: k.line.withValues(alpha: 0.4))),
      ),
      child: Row(
        children: view == 'both' ? [side('call', cols.reversed.toList()), strike, side('put', cols)] : [strike, side(view == 'calls' ? 'call' : 'put', cols)],
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({
    required this.q,
    required this.col,
    required this.right,
    required this.digits,
    required this.selected,
    required this.simple,
    required this.inner,
  });
  final OptionQuote? q;
  final String col, right;
  final int digits;
  final bool selected, simple, inner;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final t = context.t;
    final q = this.q;
    final align = simple ? (right == 'call' ? Alignment.centerRight : Alignment.centerLeft) : Alignment.centerRight;
    Widget text(String s, {Color? color}) => Align(
      alignment: align,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Text(
          s,
          maxLines: 1,
          textDirection: TextDirection.ltr,
          style: context.text.mono(12.5, color: color ?? k.fg2),
        ),
      ),
    );
    if (q == null) return text('—', color: k.fg3.withValues(alpha: 0.6));
    final dim = q.state != 'open';
    Widget two(Widget top, String? sub, {Color? subColor}) => Align(
      alignment: Alignment.centerRight,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            top,
            if (sub != null)
              Text(
                sub,
                textDirection: TextDirection.ltr,
                style: context.text.mono(9.5, color: subColor ?? k.fg3),
              ),
          ],
        ),
      ),
    );
    switch (col) {
      case 'bid':
      case 'ask':
        final v = col == 'bid' ? q.bidUsd : q.askUsd;
        final size = col == 'bid' ? q.bidQty : q.askQty;
        if (simple && col == 'ask') {
          return Align(
            alignment: align,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Opacity(
                opacity: dim ? 0.6 : 1,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  height: 32,
                  constraints: const BoxConstraints(minWidth: 78),
                  padding: const EdgeInsets.symmetric(horizontal: 9),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: selected ? k.ember : k.surface2,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: selected ? k.ember : k.line),
                    boxShadow: selected
                        ? [BoxShadow(color: k.ember.withValues(alpha: 0.6), offset: const Offset(0, 6), blurRadius: 16, spreadRadius: -8)]
                        : null,
                  ),
                  child: v > 0
                      ? Flash(
                          value: v,
                          child: Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(
                                  text: r'$',
                                  style: context.text.mono(11.5, color: selected ? Colors.white.withValues(alpha: 0.8) : k.fg3),
                                ),
                                TextSpan(text: usd(v)),
                              ],
                            ),
                            textDirection: TextDirection.ltr,
                            style: context.text.mono(13.5, weight: FontWeight.w600, color: selected ? Colors.white : k.fg),
                          ),
                        )
                      : Text('—', style: context.text.mono(13, color: k.fg3)),
                ),
              ),
            ),
          );
        }
        final tone = col == 'bid' ? k.down : k.up;
        return Align(
          alignment: Alignment.centerRight,
          child: Padding(
            padding: const EdgeInsets.only(right: 6),
            child: Opacity(
              opacity: dim ? 0.6 : 1,
              child: Container(
                height: q.book ? 30 : 26,
                constraints: const BoxConstraints(minWidth: 62),
                padding: const EdgeInsets.symmetric(horizontal: 6),
                decoration: BoxDecoration(
                  color: (col == 'bid' ? k.downSoft : k.upSoft).withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: selected ? k.ember : tone.withValues(alpha: 0.15), width: selected ? 1.4 : 1),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Flash(
                      value: v,
                      child: Text(
                        v > 0 ? usd(v) : '—',
                        textDirection: TextDirection.ltr,
                        style: context.text.mono(12.5, color: tone),
                      ),
                    ),
                    if (q.book) Text(v > 0 && size != null && size > 0 ? '×${qty(size)}' : ' ', style: context.text.mono(9.5, color: k.fg3)),
                  ],
                ),
              ),
            ),
          ),
        );
      case 'last':
        final ch = lastChange(q.lastUsd, q.change);
        return two(
          q.lastUsd != null && q.lastUsd! > 0
              ? Flash(
                  value: q.lastUsd!,
                  child: Text(usd(q.lastUsd!), style: context.text.mono(12.5, color: k.fg2)),
                )
              : Text('—', style: context.text.mono(12.5, color: k.fg3)),
          ch ?? ' ',
          subColor: q.change == null ? k.fg3 : (q.change! >= 0 ? k.up : k.down),
        );
      case 'mark':
        return two(
          Flash(
            value: q.markUsd,
            child: Text(usd(q.markUsd), style: context.text.mono(12.5, color: k.fg)),
          ),
          q.book && q.theoUsd != null ? '${t('trader.opt.col.theoShort')} ${usd(q.theoUsd!)}' : '${pips(q.markPips)}p',
        );
      case 'iv':
        return text(pct(q.iv));
      case 'delta':
        return text(greek(q.delta));
      case 'gamma':
        return text(greek(q.gamma, 4), color: k.fg3);
      case 'theta':
        return text(usd(q.theta), color: q.theta < 0 ? k.down.withValues(alpha: 0.8) : k.fg3);
      case 'vega':
        return text(usd(q.vega), color: k.fg3);
      case 'prob':
        return text(pct(q.probItm, 0));
      case 'be':
        return text(px(q.breakeven, digits), color: k.fg3);
      case 'oi':
        return text(q.oi == null ? '—' : qty(q.oi), color: k.fg3);
      default:
        return text(q.volume == null ? '—' : qty(q.volume), color: k.fg3);
    }
  }
}

/// "EURUSD now 1.0845" between the strikes.
class _SpotLine extends StatelessWidget {
  const _SpotLine({required this.label, required this.both});
  final String label;
  final bool both;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return SizedBox(
      height: 20,
      child: Stack(
        alignment: both ? Alignment.center : Alignment.centerLeft,
        children: [
          Positioned.fill(
            child: Center(
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.transparent, k.ember.withValues(alpha: 0.7), k.ember.withValues(alpha: 0.7), Colors.transparent],
                    stops: const [0, 0.15, 0.85, 1],
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.only(left: both ? 0 : 12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 7),
              decoration: BoxDecoration(
                color: k.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: k.ember.withValues(alpha: 0.45)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(color: k.ember, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    label,
                    style: context.text.mono(10.5, weight: FontWeight.w600, color: k.ember),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// "Add leg" armed, or a strategy in the ticket: what the next tap does.
class _ModeBanner extends ConsumerWidget {
  const _ModeBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final adding = ref.watch(optionsProvider.select((s) => s.ticket.adding));
    final legs = ref.watch(optionsProvider.select((s) => s.ticket.legs.length));
    if (!adding && legs < 2) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 4, 4, 4),
      decoration: BoxDecoration(
        color: k.emberSoft.withValues(alpha: 0.5),
        border: Border(bottom: BorderSide(color: k.ember.withValues(alpha: 0.3))),
      ),
      child: Row(
        children: [
          Icon(LucideIcons.layers, size: 14, color: k.ember),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              adding ? t('trader.opt.chain.adding') : t('trader.opt.chain.strategy'),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400),
            ),
          ),
          KPressable(
            minSize: 32,
            onTap: () => adding ? ref.read(optionsProvider.notifier).setAdding(false) : ref.read(optionsProvider.notifier).clearTicket(),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                children: [
                  Icon(LucideIcons.x, size: 12, color: k.fg3),
                  const SizedBox(width: 3),
                  Text(adding ? t('common.cancel') : t('trader.opt.ticket.clear'), style: context.text.caption.copyWith(color: k.fg3)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Strikes range, the put / call ratio (book), the ITM legend.
class _Footer extends ConsumerWidget {
  const _Footer({this.pcr});
  final double? pcr;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final range = ref.watch(optionsProvider.select((s) => s.prefs.range));
    return Container(
      height: 38,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: k.surface,
        border: Border(top: BorderSide(color: k.line, width: 0.6)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 168,
            child: OptSeg<int>(
              height: 26,
              values: _ranges,
              labels: [for (final n in _ranges) n == 0 ? t('trader.opt.all') : '±$n'],
              selected: range,
              onChanged: (v) => ref.read(optionsProvider.notifier).setPrefs((p) => p.copyWith(range: v)),
            ),
          ),
          if (pcr != null) ...[
            const SizedBox(width: 10),
            Text(
              '${t('trader.opt.book.pcr')} ',
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
            Text(pcr!.toStringAsFixed(2), style: context.text.mono(11, color: k.fg2)),
          ],
          const Spacer(),
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: k.gold.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(3),
              border: Border.all(color: k.gold.withValues(alpha: 0.3)),
            ),
          ),
          const SizedBox(width: 5),
          Text(
            t('trader.opt.itm'),
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
          ),
          const SizedBox(width: 2),
          const Explain('itm', size: 11),
        ],
      ),
    );
  }
}

const List<({String id, String label, String hint})> _presets = [
  (id: 'simple', label: 'trader.opt.cols.simple', hint: 'trader.opt.cols.simpleHint'),
  (id: 'standard', label: 'trader.opt.cols.standard', hint: 'trader.opt.cols.standardHint'),
  (id: 'pro', label: 'trader.opt.cols.pro', hint: 'trader.opt.cols.proHint'),
];

const List<({String label, List<String> cols})> _groups = [
  (label: 'trader.opt.cols.groupPrices', cols: ['bid', 'ask', 'last', 'mark']),
  (label: 'trader.opt.cols.groupOdds', cols: ['prob', 'be']),
  (label: 'trader.opt.cols.groupGreeks', cols: ['iv', 'delta', 'gamma', 'theta', 'vega']),
  (label: 'trader.opt.cols.groupActivity', cols: ['oi', 'vol']),
];

/// "Columns": the preset in use; opens the presets and the column chips.
class ColumnsButton extends ConsumerWidget {
  const ColumnsButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final preset = ref.watch(optionsProvider.select((s) => s.prefs.colPreset));
    final label = preset == 'custom' ? t('trader.opt.cols.custom') : t(_presets.firstWhere((p) => p.id == preset, orElse: () => _presets.first).label);
    return KPressable(
      minSize: 36,
      semanticLabel: t('trader.opt.cols.title'),
      onTap: () => showKSheet<void>(context, title: t('trader.opt.cols.title'), builder: (_) => const _ColumnsSheet()),
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 9),
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: k.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.columns3, size: 14, color: k.fg3),
            const SizedBox(width: 5),
            Text(label, style: context.text.label.copyWith(fontSize: 12, color: k.fg2)),
          ],
        ),
      ),
    );
  }
}

class _ColumnsSheet extends ConsumerWidget {
  const _ColumnsSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final s = ref.watch(optionsProvider);
    final preset = s.prefs.colPreset;
    final cols = s.prefs.cols;
    final book = s.isBookLive;
    final ctl = ref.read(optionsProvider.notifier);
    void toggle(String c) {
      final has = cols.contains(c);
      final next = [
        for (final x in allChainCols)
          if (x == c ? !has : cols.contains(x)) x,
      ];
      if (next.isEmpty) return;
      String? same;
      for (final e in colPresets.entries) {
        if (e.value.length == next.length && e.value.every(next.contains)) same = e.key;
      }
      ctl.setPrefs((p) => p.copyWith(cols: next, colPreset: same ?? 'custom'));
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final p in _presets)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: KPressable(
                pressedScale: 0.99,
                onTap: () => ctl.setPrefs((x) => x.copyWith(colPreset: p.id, cols: colPresets[p.id])),
                child: Container(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  decoration: BoxDecoration(
                    color: preset == p.id ? k.emberSoft : k.surface2,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: preset == p.id ? k.ember.withValues(alpha: 0.5) : k.line),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 16,
                        height: 16,
                        margin: const EdgeInsets.only(top: 1),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: preset == p.id ? k.ember : Colors.transparent,
                          border: Border.all(color: preset == p.id ? k.ember : k.line),
                        ),
                        child: preset == p.id ? const Icon(LucideIcons.check, size: 10, color: Colors.white) : null,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(t(p.label), style: context.text.label.copyWith(fontWeight: FontWeight.w600)),
                            const SizedBox(height: 2),
                            Text(
                              t(p.hint),
                              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(height: 8),
          for (final g in _groups) ...[
            Padding(
              padding: const EdgeInsets.only(top: 6, bottom: 6),
              child: Text(t(g.label).toUpperCase(), style: context.text.micro.copyWith(color: k.fg3, letterSpacing: 0.8)),
            ),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final c in g.cols)
                  Opacity(
                    opacity: (c == 'last' || c == 'oi' || c == 'vol') && !book ? 0.5 : 1,
                    child: KPressable(
                      minSize: 36,
                      onTap: () => toggle(c),
                      child: Container(
                        height: 30,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: cols.contains(c) ? k.emberSoft : k.surface2,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: cols.contains(c) ? k.ember.withValues(alpha: 0.45) : k.line),
                        ),
                        child: Text(
                          _head(t, c, book: book, simple: false).label,
                          style: context.text.label.copyWith(fontSize: 12, color: cols.contains(c) ? k.fg : k.fg3),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
