// Positions › Open (web: components/options/positions-tab.tsx OptionPositionsList, phone variant) and Positions ›
// Orders (mobile.tsx MOrders): open options as easy cards. Each card says what it is ("EURUSD Call 1.1275 · Bought ×2"),
// whether it is winning or losing (P&L in money and % of the premium), what was paid and what it is worth now, the
// expiry with its countdown, and in plain words what happens at expiry. Close is one tap (the button shows what you get
// or pay); Close part, Show on the chart and the details are next to it. Strategies are one card with their legs, closed
// all together. Working option orders follow; while the book is live its working orders have their own view.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../../core/market.dart';
import '../../core/terminal_controller.dart';
import '../../core/trade_math.dart';
import '../../widgets/kit.dart';
import '../core/data.dart';
import '../core/format.dart';
import '../core/math.dart';
import '../core/models.dart';
import '../core/pricer.dart';
import '../core/store.dart';
import 'actions.dart';
import 'bits.dart';
import 'nav.dart';

/// The live numbers of one position (quote of its series, the engine's streamed values, USD per quote currency).
PosLive _live(WidgetRef ref, OptPosition p) {
  final q = ref.watch(optionsProvider.select((s) => s.quoteOf(p.option.series)));
  final lp = ref.watch(terminalProvider.select((s) => s.live?.positions[p.ticket]));
  final feed = ref.read(marketFeedProvider);
  return derivePosition(p, q, lp, usdPerQuoteOf(p.option.underlying, feed.quote));
}

/// Spot of an underlying: the chain on screen, else the CFD feed.
double? _spot(WidgetRef ref, String u) {
  final chainSpot = ref.watch(optionsProvider.select((s) => s.chain != null && s.chain!.underlying == u ? s.chain!.spot?.mid : null));
  if (chainSpot != null) return chainSpot;
  final q = ref.read(marketFeedProvider).quote(u);
  return q != null && q.bid > 0 ? q.mid : null;
}

int _cutOf(OptPosition p) {
  final ms = msOf(p.option.expiryAt.isEmpty ? null : p.option.expiryAt);
  return ms > 0 ? ms : (p.option.expiry.isEmpty ? 0 : nyCut(p.option.expiry));
}

String _strike(OptionInfo o) => strikeOf(o.series, o.strike, digitsOf(o.underlying));

class OptionPositionsList extends ConsumerWidget {
  const OptionPositionsList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final book = ref.watch(optBookProvider);
    final readOnly = ref.watch(terminalProvider.select((s) => s.readOnly));
    if (book.positions.isEmpty && book.orders.isEmpty) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 340),
            child: Column(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: k.surface2,
                    border: Border.all(color: k.line),
                  ),
                  child: Icon(LucideIcons.layers, size: 20, color: k.fg3),
                ),
                const SizedBox(height: 12),
                Text(
                  book.loaded ? t('trader.opt.pos.emptyTitle') : t('trader.opt.pos.loading'),
                  textAlign: TextAlign.center,
                  style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  t('trader.opt.pos.emptyText'),
                  textAlign: TextAlign.center,
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, height: 1.5),
                ),
                const SizedBox(height: 14),
                KButton(
                  label: t('trader.opt.guide.start'),
                  size: KButtonSize.sm,
                  onPressed: () {
                    ref.read(optionsProvider.notifier).setPrefs((p) => p.copyWith(panel: 'simple'));
                    ref.optTab('trade');
                  },
                ),
              ],
            ),
          ),
        ),
      );
    }
    final g = groupPositions(book.positions);
    return ListView(
      padding: const EdgeInsets.all(8),
      children: [
        for (final e in g.combos.entries)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _StrategyCard(id: e.key, legs: e.value, readOnly: readOnly),
          ),
        for (final p in g.singles)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _PositionCard(p: p, readOnly: readOnly),
          ),
        if (book.orders.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(2, 4, 2, 6),
            child: Text(
              t('trader.opt.pos.workingOrders', {'count': book.orders.length}).toUpperCase(),
              style: context.text.micro.copyWith(fontSize: 10.5, color: k.fg3, letterSpacing: 0.8),
            ),
          ),
          for (final o in book.orders)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: _OrderRow(o: o, readOnly: readOnly),
            ),
        ],
      ],
    );
  }
}

class _ResultChip extends StatelessWidget {
  const _ResultChip(this.v);
  final double v;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final tone = v > 0.004 ? 1 : (v < -0.004 ? -1 : 0);
    final (Color bg, Color fg) = tone > 0 ? (k.upSoft, k.up) : (tone < 0 ? (k.downSoft, k.down) : (k.surface3, k.fg3));
    return Container(
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(9)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
          ),
          const SizedBox(width: 4),
          Text(
            tone > 0 ? t('trader.opt.pos.winning') : (tone < 0 ? t('trader.opt.pos.losing') : t('trader.opt.pos.even')),
            style: context.text.caption.copyWith(fontSize: 10, fontWeight: FontWeight.w600, color: fg),
          ),
        ],
      ),
    );
  }
}

/// The P&L in USD, green / red.
class _Pnl extends StatelessWidget {
  const _Pnl(this.v, {this.size = 16});
  final double v;
  final double size;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Text(
      moneySigned(v),
      textDirection: TextDirection.ltr,
      style: context.text.mono(size, weight: FontWeight.w600, color: v > 0.004 ? k.up : (v < -0.004 ? k.down : k.fg2)),
    );
  }
}

/// Expiry with its countdown; after the cut: "settling".
class _ExpiryLine extends StatelessWidget {
  const _ExpiryLine(this.cutMs);
  final int cutMs;

  @override
  Widget build(BuildContext context) {
    if (cutMs <= 0) return const SizedBox.shrink();
    final t = context.t;
    final k = context.k;
    return NowBuilder(
      builder: (context, now) {
        final left = cutMs - now;
        return Row(
          children: [
            Icon(LucideIcons.calendarClock, size: 12, color: k.fg3),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                cutWhen(cutMs, t.locale),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400),
              ),
            ),
            const SizedBox(width: 6),
            if (left > 0)
              Text(
                countdown(cutMs, now),
                textDirection: TextDirection.ltr,
                style: context.text.mono(11, color: left < 3600000 ? k.warn : k.fg2),
              )
            else
              Text(t('trader.opt.pos.settling'), style: context.text.caption.copyWith(fontSize: 11, color: k.warn)),
          ],
        );
      },
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail(this.k, this.v);
  final String k, v;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        k.toUpperCase(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: context.text.micro.copyWith(fontSize: 9.5, color: context.k.fg3, letterSpacing: 0.5),
      ),
      Text(
        v,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        textDirection: TextDirection.ltr,
        style: context.text.mono(11.5, color: context.k.fg2),
      ),
    ],
  );
}

/// The Close button: "Close · You get $12.40" / "Close · You pay $3.10".
class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.v, required this.side, required this.busy, required this.onTap});
  final PosLive v;
  final String side;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final amt = v.closeNow;
    return OptSmallButton(
      label: busy ? t('trader.opt.ticket.sending') : t('trader.opt.pos.close'),
      busy: busy,
      onTap: onTap,
      trailing: !busy && amt != null
          ? Flexible(
              child: Text(
                ' · ${side == 'buy' ? t('trader.opt.pos.closeGet', iso({'amount': money(math.max(0, amt))})) : t('trader.opt.pos.closePay', iso({'amount': money(amt.abs())}))}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.caption.copyWith(fontSize: 11, color: k.fg3),
              ),
            )
          : null,
    );
  }
}

/// Close part: how many contracts (sheet).
Future<double?> _askPart(BuildContext context, OptPosition p) {
  final t = context.t;
  var n = '${math.max(1, (p.contracts / 2).floor())}';
  return showKSheet<double>(
    context,
    title: t('trader.opt.pos.partialTitle', {'ticket': p.ticket}),
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, set) {
        final v = math.min(p.contracts, math.max(1, (double.tryParse(n) ?? 1).round())).toDouble();
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TStepper(
                height: 40,
                value: n,
                step: 1,
                min: 1,
                max: p.contracts,
                decimals: 0,
                semanticLabel: t('trader.opt.ticket.contracts'),
                onChanged: (x) => set(() => n = x),
              ),
              const SizedBox(height: 6),
              Text(
                t('trader.opt.pos.ofContracts', {'count': p.contracts}),
                style: ctx.text.caption.copyWith(color: ctx.k.fg3, fontWeight: FontWeight.w400),
              ),
              const SizedBox(height: 14),
              KButton(label: t('trader.opt.pos.closeN', {'count': v}), size: KButtonSize.lg, expand: true, onPressed: () => Navigator.of(ctx).pop(v)),
            ],
          ),
        );
      },
    ),
  );
}

class _PositionCard extends ConsumerStatefulWidget {
  const _PositionCard({required this.p, required this.readOnly});
  final OptPosition p;
  final bool readOnly;

  @override
  ConsumerState<_PositionCard> createState() => _PositionCardState();
}

class _PositionCardState extends ConsumerState<_PositionCard> {
  bool _open = false;
  bool _busy = false;

  Future<void> _close(PosLive v, {double? n}) async {
    setState(() => _busy = true);
    await closeOptionPosition(ref, context.t, widget.p, v, n: n);
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final p = widget.p;
    final v = _live(ref, p);
    final spot = _spot(ref, p.option.underlying);
    final bookLive = ref.watch(optionsProvider.select((s) => s.isBookLive));
    final u = p.option.underlying;
    final digits = digitsOf(u);
    final strike = _strike(p.option);
    final long = p.buy;
    final pctOf = v.basis > 0 ? v.profit / v.basis : null;
    final be = breakevenOf(p.option.right, p.option.strike, p.openPrice);
    final what = p.option.right == 'call'
        ? (long ? t('trader.opt.pos.exp.longCall', iso({'u': u, 'strike': strike})) : t('trader.opt.pos.exp.shortCall', iso({'u': u, 'strike': strike})))
        : (long ? t('trader.opt.pos.exp.longPut', iso({'u': u, 'strike': strike})) : t('trader.opt.pos.exp.shortPut', iso({'u': u, 'strike': strike})));
    String? nowText;
    Color? nowTone;
    if (spot != null && v.usdU > 0) {
      final cash = expiryCash([(right: p.option.right, strike: p.option.strike, side: p.side, contracts: p.contracts)], spot, v.usdU);
      nowText = cash > 0.004
          ? t('trader.opt.pos.exp.nowGet', iso({'amount': money(cash)}))
          : (cash < -0.004
                ? t('trader.opt.pos.exp.nowPay', iso({'amount': money(-cash)}))
                : (long ? t('trader.opt.pos.exp.nowZero') : t('trader.opt.pos.exp.nowKeep')));
      nowTone = cash > 0.004 ? k.up : (cash < -0.004 ? k.down : k.fg2);
    }
    final body = context.text.caption.copyWith(fontSize: 11.5, fontWeight: FontWeight.w400, height: 1.4);
    return OptCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                OptAvatar(u, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(u, style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w600)),
                          RightChip(p.option.right),
                          Text(
                            strike,
                            textDirection: TextDirection.ltr,
                            style: context.text.mono(13, weight: FontWeight.w600),
                          ),
                          SideChip(side: p.side, n: p.contracts),
                          if (p.option.barrier != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              decoration: BoxDecoration(color: k.warnSoft, borderRadius: BorderRadius.circular(4)),
                              child: Text(t('trader.opt.pos.barrier'), style: context.text.caption.copyWith(fontSize: 9.5, color: k.warn)),
                            ),
                          if (bookLive && (p.option.barrier != null || p.venue == 'house')) const EzymexQuotedTag(),
                        ],
                      ),
                      const SizedBox(height: 4),
                      _ExpiryLine(_cutOf(p)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    _Pnl(v.profit),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (pctOf != null) ...[
                          Text(
                            pctSigned(pctOf),
                            textDirection: TextDirection.ltr,
                            style: context.text.mono(11, color: v.profit > 0 ? k.up : (v.profit < 0 ? k.down : k.fg3)),
                          ),
                          const SizedBox(width: 6),
                        ],
                        _ResultChip(v.profit),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Flexible(
                      child: Text(
                        long
                            ? t('trader.opt.pos.valueLong', iso({'paid': money(v.basis), 'now': v.markUsd != null ? money(v.markUsd! * p.contracts) : '—'}))
                            : t('trader.opt.pos.valueShort', iso({'paid': money(v.basis), 'now': v.markUsd != null ? money(v.markUsd! * p.contracts) : '—'})),
                        style: body.copyWith(color: k.fg2),
                      ),
                    ),
                    const SizedBox(width: 2),
                    const Explain('mark', size: 11),
                  ],
                ),
                const SizedBox(height: 2),
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: what),
                      if (nowText != null)
                        TextSpan(
                          text: ' $nowText',
                          style: TextStyle(color: nowTone),
                        ),
                    ],
                  ),
                  style: body.copyWith(color: k.fg3),
                ),
                if (p.option.barrier != null) ...[const SizedBox(height: 4), _BarrierLine(p: p, usdU: v.usdU)],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: Row(
              children: [
                if (!widget.readOnly) ...[
                  Flexible(
                    child: _CloseButton(v: v, side: p.side, busy: _busy, onTap: () => unawaited(_close(v))),
                  ),
                  const SizedBox(width: 6),
                  KIconButton(
                    icon: LucideIcons.scissors,
                    size: 32,
                    filled: true,
                    semanticLabel: t('trader.opt.pos.partial'),
                    onPressed: p.contracts <= 1 || _busy
                        ? null
                        : () async {
                            final n = await _askPart(context, p);
                            if (n != null && mounted) await _close(v, n: n);
                          },
                  ),
                  const SizedBox(width: 6),
                ],
                KIconButton(
                  icon: LucideIcons.crosshair,
                  size: 32,
                  filled: true,
                  semanticLabel: t('trader.opt.pos.showOnChart'),
                  onPressed: () {
                    final ctl = ref.read(optionsProvider.notifier);
                    if (!ctl.showSeries(p.option.series)) ctl.selectUnderlying(u);
                    ctl.focus(p.ticket);
                    ref.optChartView('chart');
                    ref.optTab('chart');
                  },
                ),
                const Spacer(),
                KPressable(
                  minSize: 32,
                  onTap: () => setState(() => _open = !_open),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Row(
                      children: [
                        Text(t('trader.opt.plain.details'), style: context.text.caption.copyWith(color: k.fg3)),
                        const SizedBox(width: 3),
                        AnimatedRotation(
                          turns: _open ? 0.5 : 0,
                          duration: const Duration(milliseconds: 160),
                          child: Icon(LucideIcons.chevronDown, size: 14, color: k.fg3),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (_open)
            Container(
              margin: const EdgeInsets.fromLTRB(12, 0, 12, 10),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: k.surface2.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(9)),
              child: LayoutBuilder(
                builder: (context, c) {
                  final w = (c.maxWidth - 24) / 3;
                  final items = [
                    _Detail(t('toolbox.col.ticket'), '#${p.ticket}'),
                    _Detail(t('toolbox.col.openTime'), fmtServer(DateTime.tryParse(p.openTime) ?? DateTime.now(), seconds: false)),
                    _Detail(t('trader.opt.col.be'), px(be, digits)),
                    _Detail(t('trader.opt.pos.d.openEach'), money(v.openUsd)),
                    _Detail(t('trader.opt.pos.d.nowEach'), v.markUsd != null ? money(v.markUsd!) : '—'),
                    _Detail(t('trader.opt.preview.commission'), money(p.commission)),
                    _Detail('Δ', greek(v.delta)),
                    _Detail('Θ', usdSigned(v.theta)),
                    _Detail('Vega', usd(v.vega)),
                    _Detail('Γ', greek(v.gamma, 4)),
                    if (v.q != null) _Detail(t('trader.opt.col.iv'), pct(v.q!.iv)),
                    _Detail(t('trader.opt.pos.d.where'), p.venue == 'book' ? t('trader.opt.pos.d.book') : t('trader.opt.pos.d.house')),
                  ];
                  return Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [for (final x in items) SizedBox(width: w, child: x)],
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _BarrierLine extends StatelessWidget {
  const _BarrierLine({required this.p, required this.usdU});
  final OptPosition p;
  final double usdU;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final b = p.option.barrier!;
    final kind = (b.kind ?? '').toUpperCase();
    final isIn = kind == 'UI' || kind == 'DI' || kind.contains('IN');
    final lv = b.level != null ? px(b.level, digitsOf(p.option.underlying)) : '—';
    final rebate = b.rebate != null && b.rebate! > 0 && usdU > 0 ? money(b.rebate! * usdU * p.contracts) : null;
    final u = p.option.underlying;
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
      decoration: BoxDecoration(color: k.warnSoft, borderRadius: BorderRadius.circular(7)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(LucideIcons.zap, size: 12, color: k.warn),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              [
                isIn
                    ? (b.knockedIn ? t('trader.opt.pos.barrier.knockedIn') : t('trader.opt.pos.barrier.in', iso({'u': u, 'level': lv})))
                    : t('trader.opt.pos.barrier.out', iso({'u': u, 'level': lv})),
                if (rebate != null && !b.knockedIn) t('trader.opt.pos.barrier.rebate', iso({'amount': rebate})),
              ].join(' '),
              style: context.text.caption.copyWith(fontSize: 11, color: k.fg2, fontWeight: FontWeight.w400),
            ),
          ),
        ],
      ),
    );
  }
}

class _StrategyCard extends ConsumerStatefulWidget {
  const _StrategyCard({required this.id, required this.legs, required this.readOnly});
  final String id;
  final List<OptPosition> legs;
  final bool readOnly;

  @override
  ConsumerState<_StrategyCard> createState() => _StrategyCardState();
}

class _StrategyCardState extends ConsumerState<_StrategyCard> {
  bool _confirm = false;
  bool _busy = false;
  Timer? _t;

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final legs = widget.legs;
    final lives = [for (final l in legs) _live(ref, l)];
    final total = lives.fold<double>(0, (a, v) => a + v.profit);
    final delta = lives.fold<double>(0, (a, v) => a + v.delta);
    final theta = lives.fold<double>(0, (a, v) => a + v.theta);
    final tpl = detectTemplate([for (final l in legs) (right: l.option.right, side: l.side, strike: l.option.strike, contracts: l.contracts)]);
    final name = tpl != null ? t.dyn('trader.opt.tpl.$tpl.name', fallback: tpl) : t('trader.opt.pos.strategy');
    final u = legs.first.option.underlying;
    final spot = _spot(ref, u);
    final usdU = lives.first.usdU;
    final cash = spot != null
        ? expiryCash([for (final l in legs) (right: l.option.right, strike: l.option.strike, side: l.side, contracts: l.contracts)], spot, usdU)
        : null;
    final net = legs.fold<double>(0, (s, l) => s + (l.buy ? 1 : -1) * l.openPrice * usdU * l.contracts);
    return OptCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(color: k.emberSoft, shape: BoxShape.circle),
                  child: Icon(LucideIcons.layers, size: 12, color: k.ember),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(name, style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w600)),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              OptAvatar(u, size: 13),
                              const SizedBox(width: 4),
                              Text(u, style: context.text.caption.copyWith(color: k.fg2)),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5),
                            decoration: BoxDecoration(color: k.surface3, borderRadius: BorderRadius.circular(5)),
                            child: Text(
                              t('trader.opt.ticket.strategy', {'count': legs.length}),
                              style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      _ExpiryLine(_cutOf(legs.first)),
                    ],
                  ),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [_Pnl(total), const SizedBox(height: 4), _ResultChip(total)]),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: net >= 0
                        ? t('trader.opt.pos.comboPaid', iso({'amount': money(net)}))
                        : t('trader.opt.pos.comboReceived', iso({'amount': money(-net)})),
                  ),
                  if (cash != null)
                    TextSpan(
                      text:
                          ' ${cash > 0.004 ? t('trader.opt.pos.exp.nowGet', iso({'amount': money(cash)})) : (cash < -0.004 ? t('trader.opt.pos.exp.nowPay', iso({'amount': money(-cash)})) : t('trader.opt.pos.exp.comboZero'))}',
                      style: TextStyle(color: cash > 0.004 ? k.up : (cash < -0.004 ? k.down : k.fg2)),
                    ),
                ],
              ),
              style: context.text.caption.copyWith(fontSize: 11.5, color: k.fg3, fontWeight: FontWeight.w400, height: 1.4),
            ),
          ),
          Container(
            margin: const EdgeInsets.fromLTRB(8, 8, 8, 0),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: k.line.withValues(alpha: 0.6))),
            ),
            child: Column(
              children: [for (var i = 0; i < legs.length; i++) _LegLine(p: legs[i], v: lives[i], readOnly: widget.readOnly)],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
            child: Row(
              children: [
                if (!widget.readOnly)
                  OptSmallButton(
                    label: _confirm ? t('trader.opt.pos.confirmClose') : t('trader.opt.pos.closeStrategy'),
                    filled: _confirm,
                    tone: _confirm ? k.down : null,
                    busy: _busy,
                    onTap: () async {
                      if (!_confirm) {
                        setState(() => _confirm = true);
                        _t?.cancel();
                        _t = Timer(const Duration(milliseconds: 3500), () {
                          if (mounted) setState(() => _confirm = false);
                        });
                        return;
                      }
                      _t?.cancel();
                      setState(() {
                        _confirm = false;
                        _busy = true;
                      });
                      await closeOptionCombo(ref, t, widget.id, legs, usdU);
                      if (mounted) setState(() => _busy = false);
                    },
                  ),
                const Spacer(),
                Text(
                  'Δ ${greek(delta, 2)} · Θ ${usdSigned(theta)}',
                  textDirection: TextDirection.ltr,
                  style: context.text.mono(10.5, color: k.fg3),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LegLine extends ConsumerStatefulWidget {
  const _LegLine({required this.p, required this.v, required this.readOnly});
  final OptPosition p;
  final PosLive v;
  final bool readOnly;

  @override
  ConsumerState<_LegLine> createState() => _LegLineState();
}

class _LegLineState extends ConsumerState<_LegLine> {
  bool _busy = false;

  Future<void> _close({double? n}) async {
    setState(() => _busy = true);
    await closeOptionPosition(ref, context.t, widget.p, widget.v, n: n);
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final p = widget.p, v = widget.v;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SideChip(side: p.side, n: p.contracts),
              const SizedBox(width: 6),
              RightChip(p.option.right),
              const SizedBox(width: 6),
              Text(
                _strike(p.option),
                textDirection: TextDirection.ltr,
                style: context.text.mono(12, weight: FontWeight.w600),
              ),
              const Spacer(),
              _Pnl(v.profit, size: 12),
              if (!widget.readOnly) ...[
                const SizedBox(width: 4),
                KIconButton(
                  icon: LucideIcons.scissors,
                  size: 28,
                  semanticLabel: t('trader.opt.pos.partial'),
                  onPressed: p.contracts <= 1 || _busy
                      ? null
                      : () async {
                          final n = await _askPart(context, p);
                          if (n != null && mounted) await _close(n: n);
                        },
                ),
                OptSmallButton(label: t('trader.opt.pos.close'), busy: _busy, onTap: () => unawaited(_close())),
              ],
            ],
          ),
          const SizedBox(height: 2),
          Text(
            '${money(v.openUsd)} → ${v.markUsd != null ? money(v.markUsd!) : '—'} · ${expiryLabel(p.option.expiry, t.locale, withWeekday: false)}',
            textDirection: TextDirection.ltr,
            style: context.text.mono(10.5, color: k.fg3),
          ),
        ],
      ),
    );
  }
}

class _OrderRow extends ConsumerWidget {
  const _OrderRow({required this.o, required this.readOnly});
  final OptOrder o;
  final bool readOnly;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final q = ref.watch(optionsProvider.select((s) => s.quoteOf(o.option.series)));
    final usdU = usdUnitOfPosition(o.option, q, usdPerQuoteOf(o.option.underlying, ref.read(marketFeedProvider).quote));
    final u = o.option.underlying;
    final what = orderWhat(t, side: o.side, n: o.contracts, u: u, strikeLabel: _strike(o.option), right: o.option.right, expiry: o.option.expiry);
    final trig = o.trigger;
    final detail = trig != null
        ? t('trader.opt.pos.triggerOrder', {
            'u': trig.symbol,
            'op': trig.op == 'below' ? t('trader.opt.ticket.below') : t('trader.opt.ticket.above'),
            'price': trig.price,
          })
        : t('trader.opt.pos.limitOrder', {'price': o.price != null ? usd(o.price! * usdU) : '—'});
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
      decoration: BoxDecoration(
        color: k.surface.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: k.line),
      ),
      child: Row(
        children: [
          OptAvatar(u),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  what,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.caption.copyWith(color: k.fg),
                ),
                Text(
                  '$detail · ${t('trader.opt.pos.placed', {'at': fmtServer(DateTime.tryParse(o.placedAt) ?? DateTime.now(), seconds: false)})}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.caption.copyWith(fontSize: 11, color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ],
            ),
          ),
          if (!readOnly) OptSmallButton(label: t('trader.opt.pos.cancel'), onTap: () => unawaited(cancelHouseOrder(ref, t, o))),
        ],
      ),
    );
  }
}

/// Working book orders as cards: price, size, filled, status, cancel.
class BookOrdersList extends ConsumerWidget {
  const BookOrdersList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final v = ref.watch(bookOrdersProvider);
    if (v.open.isEmpty) return TEmptyLine(v.loaded ? t('trader.opt.ord.emptyOpen') : t('trader.opt.ord.loading'));
    return ListView(
      padding: const EdgeInsets.all(8),
      children: [
        for (final o in v.open)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: _BookOrderCard(o: o),
          ),
      ],
    );
  }
}

class _BookOrderCard extends ConsumerStatefulWidget {
  const _BookOrderCard({required this.o});
  final BookOrder o;

  @override
  ConsumerState<_BookOrderCard> createState() => _BookOrderCardState();
}

class _BookOrderCardState extends ConsumerState<_BookOrderCard> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final o = widget.o;
    final readOnly = ref.watch(terminalProvider.select((s) => s.readOnly));
    final s = ref.watch(optionsProvider);
    final q = s.quoteOf(o.series);
    final p = parseSeriesBase(o.series);
    var usdK = usdPerUnitOfQuote(q);
    if (!(usdK > 0) && p != null && s.chain?.underlying == p.underlying) usdK = usdPerUnitOf(s.chain);
    if (!(usdK > 0) && p != null && optionSpecs[p.underlying]?.quoteCcy == 'USD') usdK = optionSpecs[p.underlying]!.contractSize;
    final small = context.text.caption.copyWith(fontSize: 11.5, color: k.fg3, fontWeight: FontWeight.w400);
    return OptCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (p != null) ...[OptAvatar(p.underlying, size: 18), const SizedBox(width: 8)],
              Text(p?.underlying ?? o.series, style: context.text.label.copyWith(fontWeight: FontWeight.w600)),
              if (p != null) ...[
                const SizedBox(width: 6),
                RightChip(p.right),
                const SizedBox(width: 6),
                Text(
                  p.strikeLabel,
                  textDirection: TextDirection.ltr,
                  style: context.text.mono(12.5, weight: FontWeight.w600),
                ),
              ],
              const Spacer(),
              OrderStatusChip(o.trigger != null && o.status == 'working' ? 'pending' : o.status),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Wrap(
                  spacing: 10,
                  runSpacing: 2,
                  children: [
                    Text(
                      o.side == 'buy' ? t('common.buy') : t('common.sell'),
                      style: small.copyWith(fontWeight: FontWeight.w600, color: o.side == 'buy' ? k.up : k.down),
                    ),
                    Text(
                      t.dyn('trader.opt.ord.type.${o.type}', fallback: o.type.replaceAll('_', ' ')),
                      style: small.copyWith(color: k.fg2),
                    ),
                    Text(
                      '${o.price != null && usdK > 0 ? usd(o.price! * usdK) : '—'} × ${qty(o.qty)}',
                      textDirection: TextDirection.ltr,
                      style: context.text.mono(11.5, color: k.fg3),
                    ),
                    Text(t('trader.opt.ord.filledOf', {'n': qty(o.filled), 'total': qty(o.qty)}), style: small),
                    if (p != null) Text(expiryLabel(p.date, t.locale, withWeekday: false), style: small),
                  ],
                ),
              ),
              if (!readOnly)
                OptSmallButton(
                  label: t('trader.opt.pos.cancel'),
                  busy: _busy,
                  onTap: () async {
                    setState(() => _busy = true);
                    await cancelBookOrder(ref, t, o);
                    if (mounted) setState(() => _busy = false);
                  },
                ),
            ],
          ),
        ],
      ),
    );
  }
}
