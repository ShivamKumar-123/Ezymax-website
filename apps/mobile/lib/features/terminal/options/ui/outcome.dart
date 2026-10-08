// "What happens" (web: components/options/outcome.tsx) and the preview's numbers (preview.tsx PreviewSummary): what
// you pay or receive, where you make money at expiry and when that is, the most you can lose and make, a small payoff
// picture, and when selling a clear warning that the risk isn't limited to the premium. Numbers come from the engine's
// preview when there is one (commission included like the engine), else from the legs' fill prices. "Details" folds
// the preview for experienced traders: premium (pips), commission, max profit / loss, breakevens, margin before →
// after, free margin and cash after, Greeks; rejection reasons always show.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../../core/terminal_controller.dart';
import '../../core/trade_math.dart';
import '../core/format.dart';
import '../core/math.dart';
import '../core/models.dart';
import '../core/preview_loop.dart';
import '../core/store.dart';
import 'bits.dart';

/* ---------------- mini payoff ---------------- */

/// A small picture of the P&L at expiry across prices: green above zero, red below, today's price as a dot.
class MiniPayoff extends StatelessWidget {
  const MiniPayoff({super.key, required this.legs, required this.usdPerUnit, required this.spot, required this.breakevens, this.height = 52});
  final List<PayLeg> legs;
  final double usdPerUnit, spot;
  final List<double> breakevens;
  final double height;

  @override
  Widget build(BuildContext context) => Semantics(
    label: context.t('trader.opt.payoff.aria'),
    child: SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(painter: _MiniPayoffPainter(legs, usdPerUnit, spot, breakevens, context.k)),
    ),
  );
}

class _MiniPayoffPainter extends CustomPainter {
  _MiniPayoffPainter(this.legs, this.usd, this.spot, this.bes, this.k);
  final List<PayLeg> legs;
  final double usd, spot;
  final List<double> bes;
  final KTokens k;

  @override
  void paint(Canvas canvas, Size size) {
    if (legs.isEmpty || !(spot > 0) || !(usd > 0)) return;
    final ks = [...legs.map((l) => l.strike), ...bes];
    final span = math.max(ks.map((x) => (x - spot).abs() * 1.6).fold<double>(0, math.max), spot * 0.006);
    final lo = math.max(spot * 0.2, spot - span), hi = spot + span;
    final xs = [for (var i = 0; i <= 48; i++) lo + (hi - lo) * i / 48, ...ks.where((x) => x > lo && x < hi)]..sort();
    final ys = [for (final x in xs) payoffAt(legs, x, usd)];
    var ymin = math.min(0.0, ys.reduce(math.min)), ymax = math.max(0.0, ys.reduce(math.max));
    final pad = math.max(1e-9, (ymax - ymin) * 0.14);
    ymin -= pad;
    ymax += pad;
    double x(double v) => (v - lo) / (hi - lo) * size.width;
    double y(double v) => (1 - (v - ymin) / (ymax - ymin)) * size.height;
    final y0 = y(0);
    final line = Path();
    for (var i = 0; i < xs.length; i++) {
      i == 0 ? line.moveTo(x(xs[i]), y(ys[i])) : line.lineTo(x(xs[i]), y(ys[i]));
    }
    final area = Path.from(line)
      ..lineTo(size.width, y0)
      ..lineTo(0, y0)
      ..close();
    final upRect = Rect.fromLTRB(0, 0, size.width, y0.clamp(0, size.height));
    final dnRect = Rect.fromLTRB(0, y0.clamp(0, size.height), size.width, size.height);
    canvas.save();
    canvas.clipRect(upRect);
    canvas.drawPath(area, Paint()..color = k.up.withValues(alpha: 0.18));
    canvas.drawPath(
      line,
      Paint()
        ..color = k.up
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.75
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.restore();
    canvas.save();
    canvas.clipRect(dnRect);
    canvas.drawPath(area, Paint()..color = k.down.withValues(alpha: 0.16));
    canvas.drawPath(
      line,
      Paint()
        ..color = k.down
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.75
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.restore();
    _dash(canvas, Offset(0, y0), Offset(size.width, y0), Paint()..color = k.fg3.withValues(alpha: 0.5), 2, 3);
    final sx = x(spot);
    _dash(canvas, Offset(sx, 0), Offset(sx, size.height), Paint()..color = k.ember.withValues(alpha: 0.55), 1.5, 2.5);
    canvas.drawCircle(Offset(sx, y(payoffAt(legs, spot, usd))), 3, Paint()..color = k.ember);
  }

  @override
  bool shouldRepaint(_MiniPayoffPainter old) => true;
}

/// A dashed straight line.
void _dash(Canvas c, Offset a, Offset b, Paint p, double on, double off) {
  final d = (b - a).distance;
  if (d <= 0) return;
  final dir = (b - a) / d;
  var s = 0.0;
  p.strokeWidth = p.strokeWidth == 0 ? 1 : p.strokeWidth;
  while (s < d) {
    final e = math.min(d, s + on);
    c.drawLine(a + dir * s, a + dir * e, p);
    s = e + off;
  }
}

void dashLine(Canvas c, Offset a, Offset b, Paint p, {double on = 3, double off = 3}) => _dash(c, a, b, p, on, off);

/* ---------------- sentences ---------------- */

/// The plain sentences of a set of legs (win / lose / gain), shared by the outcome card and the position cards.
({String win, String lose, String gain, String shape, String received}) plainLines(T t, String u, List<PayLeg> legs, PlainNumbers n, int digits) {
  String p(double v) => px(v, digits);
  final shape = shapeOf(legs);
  final z = n.zone;
  final be = n.breakevens.isEmpty ? null : n.breakevens.first;
  final received = money(math.max(0, n.net.abs() - n.commission));
  String win;
  if (shape == 'short_call' && be != null) {
    win = t('trader.opt.plain.keep.call', iso({'amount': received, 'u': u, 'strike': strikeLabelOf(u, legs.first.strike)}));
  } else if (shape == 'short_put' && be != null) {
    win = t('trader.opt.plain.keep.put', iso({'amount': received, 'u': u, 'strike': strikeLabelOf(u, legs.first.strike)}));
  } else {
    win = switch (z.kind) {
      'above' => t('trader.opt.plain.win.above', iso({'u': u, 'price': p(z.at)})),
      'below' => t('trader.opt.plain.win.below', iso({'u': u, 'price': p(z.at)})),
      'between' => t('trader.opt.plain.win.between', iso({'u': u, 'lo': p(z.lo), 'hi': p(z.hi)})),
      'outside' => t('trader.opt.plain.win.outside', iso({'u': u, 'lo': p(z.lo), 'hi': p(z.hi)})),
      'always' => t('trader.opt.plain.win.always'),
      'never' => t('trader.opt.plain.win.never'),
      _ => t('trader.opt.plain.win.list', iso({'list': z.list.map(p).join(' · ')})),
    };
  }
  String lose;
  if (shape == 'short_call' && be != null) {
    lose = t('trader.opt.plain.lose.shortCall', iso({'price': p(be), 'u': u}));
  } else if (shape == 'short_put' && be != null && n.maxLoss != null) {
    lose = t('trader.opt.plain.lose.shortPut', iso({'price': p(be), 'amount': money(n.maxLoss!)}));
  } else if (n.maxLoss == null) {
    lose = t('trader.opt.plain.lose.noLimit', iso({'u': u}));
  } else if ((shape == 'long_call' || shape == 'long_put') && n.net > 0) {
    lose = t('trader.opt.plain.lose.paid', iso({'amount': money(n.maxLoss!)}));
  } else {
    lose = t('trader.opt.plain.lose.max', iso({'amount': money(math.max(0, n.maxLoss!))}));
  }
  final gain = n.maxProfit == null
      ? t('trader.opt.plain.gain.noLimit', iso({'u': u}))
      : t('trader.opt.plain.gain.max', iso({'amount': money(math.max(0, n.maxProfit!))}));
  return (win: win, lose: lose, gain: gain, shape: shape, received: received);
}

/* ---------------- card ---------------- */

class OutcomeCard extends ConsumerWidget {
  const OutcomeCard({
    super.key,
    required this.u,
    required this.legs,
    required this.usdPerUnit,
    required this.digits,
    required this.cutMs,
    required this.spot,
    this.preview,
    this.commission = 0,
    this.margin,
    this.loading = false,
  });
  final String u;
  final List<PayLeg> legs;
  final double usdPerUnit;
  final int digits;
  final int? cutMs;
  final double? spot;
  final OptPreview? preview;
  final double commission;
  final double? margin;
  final bool loading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    if (legs.isEmpty || !(usdPerUnit > 0)) return const SizedBox.shrink();
    final cent = ref.watch(terminalProvider.select((s) => s.account?.cent ?? false));
    final refPx = spot ?? legs.first.strike;
    final n = plainNumbers(legs, usdPerUnit, refPx, engine: preview, commissionEstimate: commission);
    final lines = plainLines(t, u, legs, n, digits);
    final debit = n.net >= 0;
    final total = n.net.abs() + (debit ? n.commission : -n.commission);
    final sellMargin = margin != null && margin! > 0.005 ? margin : null;
    Widget fig(String label, String value, {Color? tone, Widget? help}) => Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Flexible(
                  child: Text(
                    label.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.micro.copyWith(fontSize: 9.5, color: k.fg3, letterSpacing: 0.4),
                  ),
                ),
                ?help,
              ],
            ),
            const SizedBox(height: 1),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textDirection: TextDirection.ltr,
              style: context.text.mono(12, weight: FontWeight.w600, color: tone ?? k.fg),
            ),
          ],
        ),
      ),
    );
    Widget line(IconData icon, Color iconColor, String text, {Color? color}) => Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(icon, size: 14, color: iconColor),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: context.text.footnote.copyWith(color: color ?? k.fg2, height: 1.35)),
          ),
        ],
      ),
    );
    final divider = Container(height: 0.8, color: k.line.withValues(alpha: 0.7));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedOpacity(
          duration: const Duration(milliseconds: 150),
          opacity: loading ? 0.75 : 1,
          child: OptCard(
            color: k.surface2.withValues(alpha: 0.5),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  debit ? t('trader.opt.preview.youPay') : t('trader.opt.preview.youReceive'),
                                  style: context.text.caption.copyWith(color: k.fg3, fontSize: 11),
                                ),
                                const SizedBox(width: 2),
                                const Explain('premium', size: 12),
                              ],
                            ),
                            Text(
                              money(math.max(0, total)),
                              textDirection: TextDirection.ltr,
                              style: context.text.mono(22, weight: FontWeight.w600, color: debit ? k.fg : k.up),
                            ),
                            Text(
                              [
                                if (n.commission > 0) t('trader.opt.plain.inclFee', iso({'amount': money(n.commission)})),
                                if (cent) t('trader.opt.plain.inUsc', iso({'amount': accMoney(true, math.max(0, total))})),
                              ].join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400),
                            ),
                          ],
                        ),
                      ),
                      if (spot != null)
                        SizedBox(
                          width: 150,
                          child: MiniPayoff(legs: legs, usdPerUnit: usdPerUnit, spot: spot!, breakevens: n.breakevens),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                divider,
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 9, 12, 4),
                  child: Column(
                    children: [
                      line(LucideIcons.circleCheck, k.up, lines.win, color: k.fg),
                      line(LucideIcons.trendingDown, k.down, lines.lose),
                      if (lines.shape != 'short_call' && lines.shape != 'short_put') line(LucideIcons.trendingUp, k.up, lines.gain),
                    ],
                  ),
                ),
                divider,
                Row(
                  children: [
                    fig(
                      t('trader.opt.col.be'),
                      n.breakevens.isEmpty ? '—' : n.breakevens.map((b) => px(b, digits)).join(' · '),
                      help: const Explain('breakeven', size: 11),
                    ),
                    Container(width: 0.8, height: 34, color: k.line.withValues(alpha: 0.7)),
                    fig(t('trader.opt.preview.maxLoss'), n.maxLoss == null ? t('trader.opt.unlimited') : money(math.max(0, n.maxLoss!)), tone: k.down),
                    Container(width: 0.8, height: 34, color: k.line.withValues(alpha: 0.7)),
                    fig(t('trader.opt.preview.maxProfit'), n.maxProfit == null ? t('trader.opt.unlimited') : money(math.max(0, n.maxProfit!)), tone: k.up),
                  ],
                ),
                if (cutMs != null && cutMs! > 0) ...[
                  divider,
                  Container(
                    color: k.surface.withValues(alpha: 0.4),
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(top: 1),
                          child: Icon(LucideIcons.calendarClock, size: 14, color: k.fg3),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: NowBuilder(
                            builder: (context, now) => Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(
                                    text: t('trader.opt.plain.expires', iso({'when': cutWhen(cutMs, t.locale)})),
                                    style: TextStyle(color: k.fg, fontWeight: FontWeight.w500),
                                  ),
                                  if (cutMs! > now)
                                    TextSpan(
                                      text: ' · ${t('trader.opt.plain.in', iso({'left': countdown(cutMs!, now)}))}',
                                      style: TextStyle(color: k.fg3),
                                    ),
                                  TextSpan(
                                    text: '\n${t('trader.opt.plain.auto')}',
                                    style: TextStyle(color: k.fg3),
                                  ),
                                ],
                              ),
                              style: context.text.caption.copyWith(fontWeight: FontWeight.w400, color: k.fg2, height: 1.4),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (n.selling) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
            decoration: BoxDecoration(
              color: k.warnSoft,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: k.warn.withValues(alpha: 0.35)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(LucideIcons.shieldAlert, size: 16, color: k.warn),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              t('trader.opt.plain.sell.title'),
                              style: context.text.caption.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                            ),
                          ),
                          const SizedBox(width: 3),
                          const Explain('selling', size: 12),
                        ],
                      ),
                      Text(
                        t('trader.opt.plain.sell.text', iso({'amount': lines.received, 'u': u})),
                        style: context.text.caption.copyWith(fontWeight: FontWeight.w400, color: k.fg2, height: 1.4),
                      ),
                      if (sellMargin != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            children: [
                              Icon(LucideIcons.triangleAlert, size: 12, color: k.warn),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  t('trader.opt.plain.sell.margin', iso({'amount': money(sellMargin)})),
                                  style: context.text.caption.copyWith(fontWeight: FontWeight.w400, color: k.fg2),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// Skeleton of the card while the first numbers load.
class OutcomeSkeleton extends StatelessWidget {
  const OutcomeSkeleton({super.key});

  @override
  Widget build(BuildContext context) => OptCard(
    color: context.k.surface2.withValues(alpha: 0.4),
    padding: const EdgeInsets.all(12),
    child: const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: 64, height: 12, child: KSkeleton(radius: 4)),
        SizedBox(height: 8),
        SizedBox(width: 112, height: 24, child: KSkeleton(radius: 4)),
        SizedBox(height: 8),
        SizedBox(height: 12, child: KSkeleton(radius: 4)),
        SizedBox(height: 6),
        FractionallySizedBox(widthFactor: 0.8, child: SizedBox(height: 12, child: KSkeleton(radius: 4))),
      ],
    ),
  );
}

/* ---------------- preview summary ---------------- */

/// The preview's numbers behind "Details" (collapsible) or open (the strategy builder).
class PreviewSummary extends ConsumerStatefulWidget {
  const PreviewSummary({super.key, required this.state, required this.digits, this.pipsOf, this.showGreeks = true, this.collapsible = false});
  final PreviewState state;
  final int digits;
  final double? Function(double usdAmount)? pipsOf;
  final bool showGreeks, collapsible;

  @override
  ConsumerState<PreviewSummary> createState() => _PreviewSummaryState();
}

class _PreviewSummaryState extends ConsumerState<PreviewSummary> {
  late bool _open = !widget.collapsible;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final p = widget.state.preview;
    final err = widget.state.error;
    if (p == null && err == null) return const SizedBox.shrink();
    if (p == null) return ErrorNote(code: err!.code, message: err.message);
    final cent = ref.watch(terminalProvider.select((s) => s.account?.cent ?? false));
    final live = ref.watch(terminalProvider.select((s) => s.account?.live ?? false));
    final tradingSoon = ref.watch(optionsProvider.select((s) => s.tradingSoon));
    final debit = p.netPremium >= 0;
    final premiumPips = widget.pipsOf?.call(p.netPremium.abs());
    final unlimited = t('trader.opt.unlimited');
    Widget row(String key, String value, {Color? tone, String? sub, bool strong = false}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              key,
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                value,
                textDirection: TextDirection.ltr,
                style: context.text.mono(11, weight: strong ? FontWeight.w600 : FontWeight.w500, color: tone ?? (strong ? k.fg : k.fg2)),
              ),
              if (sub != null) Text(sub, style: context.text.mono(9.5, color: k.fg3)),
            ],
          ),
        ],
      ),
    );
    final estimateTag = p.estimate
        ? Tooltip(
            message: t('trader.opt.preview.estimateHint'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(color: k.surface3, borderRadius: BorderRadius.circular(4)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.info, size: 10, color: k.fg3),
                  const SizedBox(width: 3),
                  Text(t('trader.opt.preview.estimate'), style: context.text.caption.copyWith(fontSize: 9.5, color: k.fg3)),
                ],
              ),
            ),
          )
        : null;
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        row(
          debit ? t('trader.opt.preview.youPay') : t('trader.opt.preview.youReceive'),
          '${usd(p.netPremium.abs())} USD',
          sub: premiumPips == null ? null : '${pips(premiumPips)} ${t('trader.opt.pips')}',
          strong: true,
        ),
        row(t('trader.opt.preview.commission'), usd(p.commission)),
        row(t('trader.opt.preview.maxProfit'), p.maxProfit == null ? unlimited : usd(p.maxProfit!), tone: k.up),
        row(t('trader.opt.preview.maxLoss'), p.maxLoss == null ? unlimited : usd(p.maxLoss!), tone: k.down),
        row(
          t('trader.opt.preview.breakeven', {'count': p.breakevens.length}),
          p.breakevens.isEmpty ? '—' : p.breakevens.map((b) => px(b, widget.digits)).join(' · '),
        ),
        Container(height: 0.8, margin: const EdgeInsets.symmetric(vertical: 4), color: k.line.withValues(alpha: 0.7)),
        row(
          t('trader.opt.preview.margin'),
          '${accMoney(cent, p.marginBefore)} → ${accMoney(cent, p.marginAfter)}',
          tone: p.marginAfter > p.marginBefore ? k.warn : null,
        ),
        row(t('trader.opt.preview.freeMarginAfter'), accMoney(cent, p.freeMarginAfter), tone: p.freeMarginAfter < 0 ? k.down : null),
        row(t('trader.opt.preview.cashAfter'), accMoney(cent, p.cashAfter), tone: p.cashAfter < 0 ? k.down : null),
        if (widget.showGreeks) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              for (final g in [
                ('Δ', greek(p.greeks['delta'], 2), 'trader.opt.col.deltaHint'),
                ('Γ', greek(p.greeks['gamma']), 'trader.opt.col.gammaHint'),
                ('Θ', p.greeks['theta'] == null ? '—' : usdSigned(p.greeks['theta']!), 'trader.opt.col.thetaHint'),
                ('Vega', p.greeks['vega'] == null ? '—' : usd(p.greeks['vega']!), 'trader.opt.col.vegaHint'),
              ])
                Expanded(
                  child: Tooltip(
                    message: t(g.$3),
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      decoration: BoxDecoration(color: k.surface.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(6)),
                      child: Column(
                        children: [
                          Text(g.$1.toUpperCase(), style: context.text.micro.copyWith(fontSize: 9, color: k.fg3)),
                          Text(g.$2, style: context.text.mono(10.5)),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
    final reasons = p.reasons.where((r) => r.code.isNotEmpty).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedOpacity(
          duration: const Duration(milliseconds: 150),
          opacity: widget.state.loading ? 0.8 : 1,
          child: Container(
            decoration: BoxDecoration(
              color: k.surface2.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: k.line),
            ),
            child: widget.collapsible
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      KPressable(
                        minSize: 34,
                        pressedScale: 1,
                        onTap: () => setState(() => _open = !_open),
                        child: SizedBox(
                          height: 34,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            child: Row(
                              children: [
                                AnimatedRotation(
                                  turns: _open ? 0.25 : 0,
                                  duration: const Duration(milliseconds: 160),
                                  child: Icon(LucideIcons.chevronRight, size: 14, color: k.fg3),
                                ),
                                const SizedBox(width: 6),
                                Text(t('trader.opt.plain.details'), style: context.text.label.copyWith(fontSize: 12, color: k.fg2)),
                                const SizedBox(width: 6),
                                ?estimateTag,
                                const SizedBox(width: 6),
                                if (!_open)
                                  Expanded(
                                    child: Text(
                                      t('trader.opt.plain.detailsHint'),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      textAlign: TextAlign.end,
                                      style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      if (_open)
                        Container(
                          padding: const EdgeInsets.fromLTRB(10, 6, 10, 8),
                          decoration: BoxDecoration(
                            border: Border(top: BorderSide(color: k.line.withValues(alpha: 0.7))),
                          ),
                          child: body,
                        ),
                    ],
                  )
                : Padding(
                    padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                t('trader.opt.preview.title').toUpperCase(),
                                style: context.text.micro.copyWith(fontSize: 10, color: k.fg3, letterSpacing: 0.8),
                              ),
                            ),
                            ?estimateTag,
                          ],
                        ),
                        const SizedBox(height: 2),
                        body,
                      ],
                    ),
                  ),
          ),
        ),
        for (final r in reasons)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: ErrorNote(code: r.code, message: r.message),
          ),
        if (p.estimate && live && tradingSoon)
          Container(
            margin: const EdgeInsets.only(top: 6),
            padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
            decoration: BoxDecoration(
              color: k.emberSoft.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: k.ember.withValues(alpha: 0.25)),
            ),
            child: Text(
              t('trader.opt.tradingSoon'),
              style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400),
            ),
          ),
      ],
    );
  }
}
