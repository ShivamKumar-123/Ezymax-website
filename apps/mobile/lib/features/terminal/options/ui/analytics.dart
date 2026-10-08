// The Analytics view of the Chart tab (web: components/options/analytics.tsx MarketView, analytics-charts.tsx,
// analytics-data.tsx): the volatility smile of the expiry on screen (model curve, the bid / ask IV band, marks, ATM,
// today's price, the 25-delta pillars), the term structure of ATM vol across the open expiries (tap a point to show
// that expiry), open interest and volume by strike with max pain, and the put / call ratios (while the order book
// reports them). Compact native painters in the terminal's tokens; a finger on a chart shows that strike's numbers.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../i18n/i18n.dart';
import '../../../../ui/ui.dart';
import '../core/data.dart';
import '../core/format.dart';
import '../core/math.dart';
import '../core/models.dart';
import '../core/store.dart';
import 'bits.dart';
import 'outcome.dart' show dashLine;

/// "+0.40%" vol points of a vol difference.
String volPts(double? v, [int d = 2]) => v == null || !v.isFinite ? '—' : '${v > 0 ? '+' : (v < 0 ? '−' : '')}${(v.abs() * 100).toStringAsFixed(d)}%';

/// Nice round ticks between lo and hi.
List<double> niceTicks(double lo, double hi, [int n = 4]) {
  final span = hi - lo;
  if (!(span > 0)) return [lo];
  final raw = span / n;
  final mag = math.pow(10, (math.log(raw) / math.ln10).floor()).toDouble();
  final step = [1, 2, 2.5, 5, 10].map((m) => m * mag).firstWhere((s) => s >= raw, orElse: () => 10 * mag);
  final out = <double>[];
  for (var v = (lo / step).ceil() * step; v <= hi + 1e-12; v += step) {
    out.add(double.parse(v.toStringAsFixed(10)));
  }
  return out;
}

class AnalyticsPane extends ConsumerStatefulWidget {
  const AnalyticsPane({super.key});

  @override
  ConsumerState<AnalyticsPane> createState() => _AnalyticsPaneState();
}

class _AnalyticsPaneState extends ConsumerState<AnalyticsPane> {
  String _metric = 'oi';

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final s = ref.watch(optionsProvider);
    final chain = s.chainOnScreen;
    if (chain == null) {
      return Center(
        child: Text(t('trader.opt.an.loading'), style: context.text.caption.copyWith(color: k.fg3)),
      );
    }
    final smileV = ref.watch(optSmileProvider((chain.underlying, chain.expiry)));
    final fromChain = chainSmile(chain);
    var smile = smileV.value;
    if (smile != null && smile.points.isEmpty && fromChain != null) {
      smile = SmileData(
        u: fromChain.u,
        expiry: fromChain.expiry,
        atmVol: fromChain.atmVol ?? smile.atmVol,
        points: fromChain.points,
        pillars: smile.pillars,
        term: smile.term,
      );
    }
    if (smile == null && !smileV.isLoading) smile = fromChain;
    final term = ref.watch(optTermProvider((s.u, s.expiries.map((e) => e.date).join(','))));
    final oi = OiData.of(chain);
    final atm = smile?.atmVol;
    final skew = smile != null ? skewOf(smile.pillars, atm) : (rr25: null, bf25: null);
    final rv = s.underlyingOf()?.realizedVol;
    final mp = oi.available ? maxPain([for (final r in oi.rows) (strike: r.strike, callOi: r.callOi, putOi: r.putOi)]) : null;
    final spot = chain.spot?.mid;
    const h = 190.0;
    return ListView(
      padding: const EdgeInsets.all(8),
      children: [
        _Card(
          title: t('trader.opt.an.smile.title'),
          hint: t('trader.opt.an.smile.hint'),
          stats: [
            _Stat(t('trader.opt.atmIv'), pct(atm, 2), hint: t('trader.opt.atmIvHint')),
            if (skew.rr25 != null) _Stat(t('trader.opt.an.smile.rr'), volPts(skew.rr25), hint: t('trader.opt.an.smile.rrHint')),
            if (skew.bf25 != null) _Stat(t('trader.opt.an.smile.bf'), volPts(skew.bf25), hint: t('trader.opt.an.smile.bfHint')),
          ],
          child: smileV.isLoading && smile == null ? _Placeholder(h, t('trader.opt.an.loading')) : _SmileChart(smile: smile, chain: chain, height: h),
        ),
        const SizedBox(height: 8),
        _Card(
          title: t('trader.opt.an.term.title'),
          hint: t('trader.opt.an.term.hint'),
          stats: [if (rv != null) _Stat(t('trader.opt.rv'), pct(rv), hint: t('trader.opt.rvHint'))],
          child: term.isLoading && (term.value ?? const []).isEmpty && (smile?.term.length ?? 0) < 2
              ? _Placeholder(h, t('trader.opt.an.loading'))
              : _TermChart(
                  points: term.value ?? const [],
                  surface: smile?.term ?? const [],
                  rv: rv,
                  selected: s.expiry,
                  height: h,
                  onPick: (d) {
                    if (d != s.expiry) ref.read(optionsProvider.notifier).selectExpiry(d);
                  },
                ),
        ),
        const SizedBox(height: 8),
        if (oi.available) ...[
          _Card(
            title: t('trader.opt.an.oi.title'),
            hint: t('trader.opt.an.oi.hint'),
            trailing: SizedBox(
              width: 150,
              child: OptSeg<String>(
                height: 24,
                values: const ['oi', 'volume'],
                labels: [t('trader.opt.an.oi.oi'), t('trader.opt.an.oi.volume')],
                selected: _metric,
                onChanged: (v) => setState(() => _metric = v),
              ),
            ),
            child: _OiChart(oi: oi, metric: _metric, spot: spot, maxPain: mp, digits: chain.digits, height: h),
          ),
          const SizedBox(height: 8),
          _Card(
            title: t('trader.opt.an.pcr.title'),
            hint: t('trader.opt.an.pcr.hint'),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Column(
                children: [
                  _PcrRow(label: t('trader.opt.an.pcr.oi'), calls: oi.callOi, puts: oi.putOi),
                  Container(height: 0.8, color: k.line.withValues(alpha: 0.6)),
                  _PcrRow(label: t('trader.opt.an.pcr.volume'), calls: oi.callVol, puts: oi.putVol),
                  Container(height: 0.8, color: k.line.withValues(alpha: 0.6)),
                  Tooltip(
                    message: t('trader.opt.an.oi.maxPainHint'),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              t('trader.opt.an.oi.maxPain'),
                              style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400),
                            ),
                          ),
                          Text(
                            mp == null ? '—' : strikeText(mp, chain.digits),
                            style: context.text.mono(12.5, weight: FontWeight.w600, color: k.gold),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ] else
          _Card(
            title: '${t('trader.opt.an.oi.title')} · ${t('trader.opt.an.pcr.title')}',
            child: Padding(
              padding: const EdgeInsets.fromLTRB(6, 10, 6, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: k.infoSoft,
                      border: Border.all(color: k.info.withValues(alpha: 0.3)),
                    ),
                    child: Icon(LucideIcons.bookOpenText, size: 16, color: k.info),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t('trader.opt.an.oi.none', {'u': s.u}), style: context.text.caption.copyWith(fontSize: 12.5, color: k.fg)),
                        const SizedBox(height: 2),
                        Text(
                          t('trader.opt.an.oi.noneSub'),
                          style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, height: 1.45),
                        ),
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

class _Stat {
  const _Stat(this.label, this.value, {this.hint});
  final String label, value;
  final String? hint;
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.child, this.hint, this.stats = const [], this.trailing});
  final String title;
  final String? hint;
  final List<_Stat> stats;
  final Widget? trailing;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      decoration: BoxDecoration(
        color: k.surface.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            constraints: const BoxConstraints(minHeight: 32),
            padding: const EdgeInsets.fromLTRB(10, 4, 8, 4),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: k.line.withValues(alpha: 0.7))),
            ),
            child: Wrap(
              spacing: 12,
              runSpacing: 2,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title.toUpperCase(), style: context.text.micro.copyWith(fontSize: 11, color: k.fg2, letterSpacing: 0.7)),
                    if (hint != null) ...[
                      const SizedBox(width: 4),
                      Tooltip(
                        message: hint!,
                        triggerMode: TooltipTriggerMode.tap,
                        child: Icon(LucideIcons.info, size: 12, color: k.fg3),
                      ),
                    ],
                  ],
                ),
                for (final s in stats)
                  Tooltip(
                    message: s.hint ?? s.label,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(s.label.toUpperCase(), style: context.text.micro.copyWith(fontSize: 9.5, color: k.fg3, letterSpacing: 0.5)),
                        const SizedBox(width: 4),
                        Text(s.value, textDirection: TextDirection.ltr, style: context.text.mono(11.5)),
                      ],
                    ),
                  ),
                ?trailing,
              ],
            ),
          ),
          Padding(padding: const EdgeInsets.all(6), child: child),
        ],
      ),
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder(this.height, this.text);
  final double height;
  final String text;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: height,
    child: Center(
      child: Text(
        text,
        style: context.text.caption.copyWith(color: context.k.fg3, fontWeight: FontWeight.w400),
      ),
    ),
  );
}

/// A small tooltip box of a chart.
class _Tip extends StatelessWidget {
  const _Tip({required this.lines, this.title});
  final Widget? title;
  final List<(String, String)> lines;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      width: 168,
      padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: k.lineTop),
        boxShadow: k.shadowPop,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          ?title,
          for (final l in lines)
            Row(
              children: [
                Expanded(
                  child: Text(
                    l.$1,
                    style: context.text.caption.copyWith(fontSize: 10.5, color: k.fg3, fontWeight: FontWeight.w400),
                  ),
                ),
                Text(l.$2, textDirection: TextDirection.ltr, style: context.text.mono(10.5)),
              ],
            ),
        ],
      ),
    );
  }
}

/// The legend chip of a chart line.
Widget _legend(BuildContext context, Color color, String label, {bool dot = false, bool band = false, bool dashed = false}) {
  final k = context.k;
  return Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      if (dot)
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        )
      else if (band)
        Container(width: 12, height: 7, color: color.withValues(alpha: 0.25))
      else
        SizedBox(
          width: 12,
          height: 2,
          child: dashed ? CustomPaint(painter: _DashPainter(color)) : ColoredBox(color: color),
        ),
      const SizedBox(width: 4),
      Text(
        label,
        style: context.text.caption.copyWith(fontSize: 10, color: k.fg3, fontWeight: FontWeight.w400),
      ),
    ],
  );
}

class _DashPainter extends CustomPainter {
  _DashPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) => dashLine(
    canvas,
    Offset(0, size.height / 2),
    Offset(size.width, size.height / 2),
    Paint()
      ..color = color
      ..strokeWidth = 1.5,
    off: 2,
  );

  @override
  bool shouldRepaint(_DashPainter old) => old.color != color;
}

/* ---------------- smile ---------------- */

typedef _SmileRow = ({double strike, String label, String right, double? model, double? bid, double? ask, double? mark});

double? _pos(double? v) => v != null && v.isFinite && v > 0 ? v : null;

({double? bid, double? ask, double? mark}) _ivBand(OptionQuote? q) => q == null
    ? (bid: null, ask: null, mark: null)
    : (q.book ? (bid: _pos(q.bidIv), ask: _pos(q.askIv), mark: _pos(q.markIv)) : (bid: _pos(q.ivBid), ask: _pos(q.ivAsk), mark: null));

double? _interp(List<({double strike, double vol})> pts, double k) {
  if (pts.isEmpty) return null;
  if (k <= pts.first.strike) return (k - pts.first.strike).abs() < 1e-9 ? pts.first.vol : null;
  for (var i = 1; i < pts.length; i++) {
    final a = pts[i - 1], b = pts[i];
    if (k <= b.strike + 1e-12) return a.vol + (b.vol - a.vol) * (k - a.strike) / ((b.strike - a.strike) == 0 ? 1 : (b.strike - a.strike));
  }
  return (k - pts.last.strike).abs() < 1e-9 ? pts.last.vol : null;
}

class _SmileChart extends StatefulWidget {
  const _SmileChart({required this.smile, required this.chain, required this.height});
  final SmileData? smile;
  final OptionChain chain;
  final double height;

  @override
  State<_SmileChart> createState() => _SmileChartState();
}

class _SmileChartState extends State<_SmileChart> {
  int? _hover;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final chain = widget.chain;
    final ref = chain.atmStrike ?? chain.spot?.mid;
    final model = widget.smile != null && widget.smile!.expiry == chain.expiry ? widget.smile!.points : const <({double strike, double vol})>[];
    final rows = <_SmileRow>[
      for (final r in chain.rows)
        () {
          final usePut = ref != null && r.strike < ref;
          final q = (usePut ? r.put : r.call) ?? (usePut ? r.call : r.put);
          final b = _ivBand(q);
          return (
            strike: r.strike,
            label: r.strikeLabel,
            right: identical(q, r.put) ? 'put' : 'call',
            model: _interp(model, r.strike),
            bid: b.bid,
            ask: b.ask,
            mark: b.mark,
          );
        }(),
    ];
    final vols = <double>[
      for (final r in rows) ...[?r.model, ?r.bid, ?r.ask, ?r.mark],
      for (final p in model) p.vol,
    ];
    final strikes = {...rows.map((r) => r.strike), ...model.map((p) => p.strike)}.toList()..sort();
    if (strikes.length < 2 || vols.isEmpty) return _Placeholder(widget.height, t('trader.opt.an.smile.empty'));
    final pillars = (widget.smile?.expiry == chain.expiry ? widget.smile!.pillars : const <SmilePillar>[])
        .where((p) => ((p.callDelta - 0.25).abs() < 0.02 || (p.callDelta - 0.75).abs() < 0.02) && p.strike.isFinite)
        .toList();
    final hr = _hover == null || _hover! >= rows.length ? null : rows[_hover!];
    return LayoutBuilder(
      builder: (context, c) {
        final painter = _SmilePainter(
          rows: rows,
          model: model,
          strikes: strikes,
          vols: vols,
          pillars: pillars,
          atmK: chain.atmStrike,
          spot: chain.spot?.mid,
          hover: _hover,
          k: k,
          text: context.text,
          atmLabel: t('trader.opt.an.smile.atm').toUpperCase(),
        );
        void pick(double x) {
          final kx = painter.strikeAt(x, c.maxWidth);
          var best = -1;
          for (var i = 0; i < rows.length; i++) {
            final r = rows[i];
            if (r.model == null && r.bid == null && r.ask == null && r.mark == null) continue;
            if (best < 0 || (r.strike - kx).abs() < (rows[best].strike - kx).abs()) best = i;
          }
          setState(() => _hover = best < 0 ? null : best);
        }

        return Stack(
          children: [
            GestureDetector(
              onPanStart: (d) => pick(d.localPosition.dx),
              onPanUpdate: (d) => pick(d.localPosition.dx),
              onPanEnd: (_) => setState(() => _hover = null),
              onTapDown: (d) => pick(d.localPosition.dx),
              onTapUp: (_) => setState(() => _hover = null),
              child: Semantics(
                label: t('trader.opt.an.smile.aria'),
                child: CustomPaint(size: Size(c.maxWidth, widget.height), painter: painter),
              ),
            ),
            Positioned(
              left: 6,
              top: 2,
              child: Wrap(
                spacing: 10,
                children: [
                  if (model.length > 1) _legend(context, k.gold, t('trader.opt.an.smile.model')),
                  if (rows.any((r) => r.bid != null && r.ask != null)) _legend(context, k.gold, t('trader.opt.an.smile.band'), band: true),
                  if (rows.any((r) => r.mark != null)) _legend(context, k.fg2, t('trader.opt.an.smile.mark'), dot: true),
                  if (chain.spot != null) _legend(context, k.ember, t('trader.opt.an.smile.spot')),
                ],
              ),
            ),
            if (hr != null)
              Positioned(
                top: 20,
                left: (painter.xOf(hr.strike, c.maxWidth) + 10 + 168 > c.maxWidth)
                    ? painter.xOf(hr.strike, c.maxWidth) - 178
                    : painter.xOf(hr.strike, c.maxWidth) + 10,
                child: _Tip(
                  title: Row(
                    children: [
                      RightTag(hr.right, size: 14),
                      const SizedBox(width: 6),
                      Text(hr.label, style: context.text.mono(11, weight: FontWeight.w600)),
                    ],
                  ),
                  lines: [
                    if (hr.model != null) (t('trader.opt.an.smile.model'), pct(hr.model, 2)),
                    if (hr.bid != null || hr.ask != null) (t('trader.opt.an.smile.band'), '${pct(hr.bid, 2)} / ${pct(hr.ask, 2)}'),
                    if (hr.mark != null) (t('trader.opt.an.smile.mark'), pct(hr.mark, 2)),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

class _SmilePainter extends CustomPainter {
  _SmilePainter({
    required this.rows,
    required this.model,
    required this.strikes,
    required this.vols,
    required this.pillars,
    required this.atmK,
    required this.spot,
    required this.hover,
    required this.k,
    required this.text,
    required this.atmLabel,
  }) {
    final step = (strikes.last - strikes.first) / (strikes.length - 1);
    lo = strikes.first - step * 0.5;
    hi = strikes.last + step * 0.5;
    final a = vols.reduce(math.min), b = vols.reduce(math.max);
    final span = math.max(0.004, b - a);
    ymin = math.max(0, a - span * 0.14);
    ymax = b + span * 0.2;
  }
  final List<_SmileRow> rows;
  final List<({double strike, double vol})> model;
  final List<double> strikes, vols;
  final List<SmilePillar> pillars;
  final double? atmK, spot;
  final int? hover;
  final KTokens k;
  final KText text;
  final String atmLabel;
  late final double lo, hi, ymin, ymax;
  static const double _l = 8, _r = 50, _t = 30, _b = 22;

  double xOf(double strike, double w) => _l + (strike - lo) / (hi - lo) * (w - _l - _r);
  double strikeAt(double x, double w) => lo + (x - _l) / (w - _l - _r) * (hi - lo);

  void _label(Canvas c, String s, Offset at, {Color? color, TextAlign align = TextAlign.left, double size = 9.5}) {
    final tp = TextPainter(
      text: TextSpan(
        text: s,
        style: text.mono(size, color: color ?? k.fg3),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final dx = align == TextAlign.center ? tp.width / 2 : (align == TextAlign.right ? tp.width : 0.0);
    tp.paint(c, at - Offset(dx, tp.height / 2));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final ih = size.height - _t - _b;
    double x(double v) => xOf(v, size.width);
    double y(double v) => _t + (1 - (v - ymin) / (ymax - ymin)) * ih;
    final grid = Paint()
      ..color = k.line.withValues(alpha: 0.6)
      ..strokeWidth = 1;
    final ticksY = niceTicks(ymin, ymax).where((v) => v > ymin && v < ymax).toList();
    for (final v in ticksY) {
      canvas.drawLine(Offset(_l, y(v)), Offset(size.width - _r, y(v)), grid);
    }
    // bid / ask band in contiguous pieces
    var seg = <_SmileRow>[];
    void flush() {
      if (seg.length > 1) {
        final p = Path()..moveTo(x(seg.first.strike), y(seg.first.ask!));
        for (final r in seg.skip(1)) {
          p.lineTo(x(r.strike), y(r.ask!));
        }
        for (final r in seg.reversed) {
          p.lineTo(x(r.strike), y(r.bid!));
        }
        p.close();
        canvas.drawPath(p, Paint()..color = k.gold.withValues(alpha: 0.16));
      }
      seg = [];
    }

    for (final r in rows) {
      if (r.bid != null && r.ask != null && r.ask! >= r.bid!) {
        seg.add(r);
      } else {
        flush();
      }
    }
    flush();
    if (atmK != null && atmK! > lo && atmK! < hi) {
      dashLine(canvas, Offset(x(atmK!), _t), Offset(x(atmK!), _t + ih), Paint()..color = k.fg3.withValues(alpha: 0.7));
      _label(canvas, atmLabel, Offset(x(atmK!), _t - 8), align: TextAlign.center);
    }
    if (spot != null && spot! > lo && spot! < hi) {
      canvas.drawLine(
        Offset(x(spot!), _t),
        Offset(x(spot!), _t + ih),
        Paint()
          ..color = k.ember.withValues(alpha: 0.75)
          ..strokeWidth = 1,
      );
    }
    final pts = model.where((p) => p.strike >= lo && p.strike <= hi).toList();
    if (pts.length > 1) {
      final p = Path()..moveTo(x(pts.first.strike), y(pts.first.vol));
      for (final q in pts.skip(1)) {
        p.lineTo(x(q.strike), y(q.vol));
      }
      canvas.drawPath(
        p,
        Paint()
          ..color = k.gold
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeJoin = StrokeJoin.round,
      );
    }
    for (final r in rows.where((r) => r.mark != null)) {
      canvas.drawCircle(Offset(x(r.strike), y(r.mark!)), 2.6, Paint()..color = k.fg2);
    }
    for (final p in pillars) {
      if (!(p.strike > lo && p.strike < hi)) continue;
      final put = p.callDelta > 0.5;
      final o = Offset(x(p.strike), y(p.vol));
      canvas.drawCircle(o, 3.2, Paint()..color = k.surface);
      canvas.drawCircle(
        o,
        3.2,
        Paint()
          ..color = k.gold
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
      _label(canvas, '25Δ ${put ? 'P' : 'C'}', o + Offset(put ? -5 : 5, -9), align: put ? TextAlign.right : TextAlign.left, size: 9);
    }
    for (final v in ticksY) {
      _label(canvas, pct(v, v < 0.1 && ymax - ymin < 0.02 ? 2 : 1), Offset(size.width - _r + 6, y(v)));
    }
    final nX = math.max(2, math.min(5, ((size.width - _l - _r) / 90).floor()));
    for (var i = 0; i < nX; i++) {
      final r = rows[(i * (rows.length - 1) / (nX - 1)).round()];
      _label(canvas, r.label, Offset(x(r.strike), size.height - 8), align: i == 0 ? TextAlign.left : (i == nX - 1 ? TextAlign.right : TextAlign.center));
    }
    final h = hover;
    if (h != null && h < rows.length) {
      final r = rows[h];
      dashLine(canvas, Offset(x(r.strike), _t), Offset(x(r.strike), _t + ih), Paint()..color = k.fg3, on: 2, off: 2);
      if (r.model != null) canvas.drawCircle(Offset(x(r.strike), y(r.model!)), 4, Paint()..color = k.gold);
    }
  }

  @override
  bool shouldRepaint(_SmilePainter old) => true;
}

/* ---------------- term structure ---------------- */

const List<({String tenor, double days, double atm})> _genericTenors = [
  (tenor: '1D', days: 1, atm: 0),
  (tenor: '1W', days: 7, atm: 0),
  (tenor: '2W', days: 14, atm: 0),
  (tenor: '1M', days: 30, atm: 0),
  (tenor: '2M', days: 61, atm: 0),
  (tenor: '3M', days: 91, atm: 0),
  (tenor: '6M', days: 182, atm: 0),
  (tenor: '1Y', days: 365, atm: 0),
];

class _TermChart extends StatefulWidget {
  const _TermChart({required this.points, required this.surface, required this.rv, required this.selected, required this.height, required this.onPick});
  final List<TermPoint> points;
  final List<({String tenor, double days, double atm})> surface;
  final double? rv;
  final String? selected;
  final double height;
  final ValueChanged<String> onPick;

  @override
  State<_TermChart> createState() => _TermChartState();
}

class _TermChartState extends State<_TermChart> {
  int? _hover;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final points = widget.points;
    final maxListed = points.isEmpty ? 0.0 : points.map((p) => p.days).reduce(math.max);
    final cap = maxListed > 0 ? math.max(maxListed * 1.6, 8) : double.infinity;
    final surf = widget.surface.where((p) => p.days <= cap).toList();
    if (points.isEmpty && surf.length < 2) return _Placeholder(widget.height, t('trader.opt.an.term.empty'));
    final maxDays = [maxListed, ...surf.map((p) => p.days), 1.0].reduce(math.max) * 1.06;
    final vols = [...points.map((p) => p.atm), ...surf.map((p) => p.atm), ?widget.rv];
    var ymin = vols.reduce(math.min), ymax = vols.reduce(math.max);
    final span = math.max(0.006, ymax - ymin);
    ymin = math.max(0, ymin - span * 0.18);
    ymax = ymax + span * 0.22;
    const l = 10.0, r = 50.0;
    return LayoutBuilder(
      builder: (context, c) {
        double x(double d) => l + math.sqrt(math.max(0, d)) / math.sqrt(maxDays) * (c.maxWidth - l - r);
        int? nearest(double px) {
          if (points.isEmpty) return null;
          var best = 0;
          for (var i = 1; i < points.length; i++) {
            if ((x(points[i].days) - px).abs() < (x(points[best].days) - px).abs()) best = i;
          }
          return best;
        }

        final hp = _hover == null || _hover! >= points.length ? null : points[_hover!];
        return Stack(
          children: [
            GestureDetector(
              onTapUp: (d) {
                final i = nearest(d.localPosition.dx);
                if (i != null) widget.onPick(points[i].date);
              },
              onPanStart: (d) => setState(() => _hover = nearest(d.localPosition.dx)),
              onPanUpdate: (d) => setState(() => _hover = nearest(d.localPosition.dx)),
              onPanEnd: (_) => setState(() => _hover = null),
              child: Semantics(
                label: t('trader.opt.an.term.aria'),
                child: CustomPaint(
                  size: Size(c.maxWidth, widget.height),
                  painter: _TermPainter(
                    points: points,
                    surf: surf,
                    rv: widget.rv,
                    selected: widget.selected,
                    hover: _hover,
                    maxDays: maxDays,
                    ymin: ymin,
                    ymax: ymax,
                    k: k,
                    text: context.text,
                  ),
                ),
              ),
            ),
            Positioned(
              left: 6,
              top: 2,
              child: Wrap(
                spacing: 10,
                children: [
                  if (points.isNotEmpty) _legend(context, k.gold, t('trader.opt.an.term.listed')),
                  if (surf.length >= 2) _legend(context, k.fg3, t('trader.opt.an.term.surface'), dashed: true),
                  if (widget.rv != null) _legend(context, k.info, t('trader.opt.rv'), dashed: true),
                ],
              ),
            ),
            if (hp != null)
              Positioned(
                top: 20,
                left: (x(hp.days) + 178 > c.maxWidth) ? x(hp.days) - 178 : x(hp.days) + 10,
                child: _Tip(
                  title: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: expiryLabel(hp.date, t.locale)),
                        if (hp.date == widget.selected)
                          TextSpan(
                            text: '  ${t('trader.opt.an.term.onScreen')}',
                            style: TextStyle(color: k.ember, fontSize: 9.5),
                          ),
                      ],
                    ),
                    style: context.text.caption.copyWith(color: k.fg),
                  ),
                  lines: [
                    (t('trader.opt.atmIv'), pct(hp.atm, 2)),
                    (t('trader.opt.an.term.cutIn'), countdown(msOf(hp.cutAt))),
                    if (widget.rv != null) (t('trader.opt.rv'), pct(widget.rv, 2)),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

class _TermPainter extends CustomPainter {
  _TermPainter({
    required this.points,
    required this.surf,
    required this.rv,
    required this.selected,
    required this.hover,
    required this.maxDays,
    required this.ymin,
    required this.ymax,
    required this.k,
    required this.text,
  });
  final List<TermPoint> points;
  final List<({String tenor, double days, double atm})> surf;
  final double? rv;
  final String? selected;
  final int? hover;
  final double maxDays, ymin, ymax;
  final KTokens k;
  final KText text;
  static const double _l = 10, _r = 50, _t = 26, _b = 22;

  void _label(Canvas c, String s, Offset at, {TextAlign align = TextAlign.left}) {
    final tp = TextPainter(
      text: TextSpan(
        text: s,
        style: text.mono(9.5, color: k.fg3),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final dx = align == TextAlign.center ? tp.width / 2 : (align == TextAlign.right ? tp.width : 0.0);
    tp.paint(c, at - Offset(dx, tp.height / 2));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final iw = size.width - _l - _r, ih = size.height - _t - _b;
    double x(double d) => _l + math.sqrt(math.max(0, d)) / math.sqrt(maxDays) * iw;
    double y(double v) => _t + (1 - (v - ymin) / (ymax - ymin)) * ih;
    final ticksY = niceTicks(ymin, ymax).where((v) => v > ymin && v < ymax).toList();
    for (final v in ticksY) {
      canvas.drawLine(Offset(_l, y(v)), Offset(_l + iw, y(v)), Paint()..color = k.line.withValues(alpha: 0.6));
    }
    if (rv != null && rv! > ymin && rv! < ymax) {
      dashLine(
        canvas,
        Offset(_l, y(rv!)),
        Offset(_l + iw, y(rv!)),
        Paint()
          ..color = k.info.withValues(alpha: 0.8)
          ..strokeWidth = 1.5,
        on: 1.5,
      );
    }
    if (surf.length >= 2) {
      for (var i = 1; i < surf.length; i++) {
        dashLine(
          canvas,
          Offset(x(surf[i - 1].days), y(surf[i - 1].atm)),
          Offset(x(surf[i].days), y(surf[i].atm)),
          Paint()
            ..color = k.fg3
            ..strokeWidth = 1.5,
          on: 4,
          off: 4,
        );
      }
      for (final p in surf) {
        canvas.drawCircle(Offset(x(p.days), y(p.atm)), 2.5, Paint()..color = k.surface);
        canvas.drawCircle(
          Offset(x(p.days), y(p.atm)),
          2.5,
          Paint()
            ..color = k.fg3
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.25,
        );
      }
    }
    if (points.length > 1) {
      final p = Path()..moveTo(x(points.first.days), y(points.first.atm));
      for (final q in points.skip(1)) {
        p.lineTo(x(q.days), y(q.atm));
      }
      canvas.drawPath(
        p,
        Paint()
          ..color = k.gold
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeJoin = StrokeJoin.round,
      );
    }
    for (var i = 0; i < points.length; i++) {
      final p = points[i];
      final on = p.date == selected;
      final o = Offset(x(p.days), y(p.atm));
      canvas.drawCircle(o, (on ? 5 : (hover == i ? 4.5 : 3.5)) + 2, Paint()..color = k.surface);
      canvas.drawCircle(o, on ? 5 : (hover == i ? 4.5 : 3.5), Paint()..color = on ? k.ember : k.gold);
    }
    for (final v in ticksY) {
      _label(canvas, pct(v), Offset(_l + iw + 6, y(v)));
    }
    final tenors = (surf.length >= 2 ? surf : _genericTenors).where((p) => p.days <= maxDays).toList();
    double? lastX;
    for (final p in tenors) {
      final px = x(p.days);
      if (lastX != null && px - lastX <= 26) continue;
      lastX = px;
      _label(canvas, p.tenor, Offset(px, size.height - 8), align: TextAlign.center);
    }
  }

  @override
  bool shouldRepaint(_TermPainter old) => true;
}

/* ---------------- open interest ---------------- */

class _OiChart extends StatefulWidget {
  const _OiChart({required this.oi, required this.metric, required this.spot, required this.maxPain, required this.digits, required this.height});
  final OiData oi;
  final String metric;
  final double? spot, maxPain;
  final int digits;
  final double height;

  @override
  State<_OiChart> createState() => _OiChartState();
}

class _OiChartState extends State<_OiChart> {
  int? _hover;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final oi = widget.metric == 'oi';
    final rows = widget.oi.rows;
    double callOf(int i) => oi ? rows[i].callOi : rows[i].callVol;
    double putOf(int i) => oi ? rows[i].putOi : rows[i].putVol;
    final maxV = rows.isEmpty ? 0.0 : [for (var i = 0; i < rows.length; i++) math.max(callOf(i), putOf(i))].reduce(math.max);
    if (rows.isEmpty || maxV <= 0) return _Placeholder(widget.height, oi ? t('trader.opt.an.oi.emptyOi') : t('trader.opt.an.oi.emptyVolume'));
    final hr = _hover;
    return Column(
      children: [
        LayoutBuilder(
          builder: (context, c) {
            final w = c.maxWidth;
            int at(double px) => ((px - 8) / (w - 16) * rows.length).floor().clamp(0, rows.length - 1);
            return Stack(
              children: [
                GestureDetector(
                  onPanStart: (d) => setState(() => _hover = at(d.localPosition.dx)),
                  onPanUpdate: (d) => setState(() => _hover = at(d.localPosition.dx)),
                  onPanEnd: (_) => setState(() => _hover = null),
                  onTapDown: (d) => setState(() => _hover = at(d.localPosition.dx)),
                  onTapUp: (_) => setState(() => _hover = null),
                  child: Semantics(
                    label: t('trader.opt.an.oi.aria'),
                    child: CustomPaint(
                      size: Size(w, widget.height),
                      painter: _OiPainter(
                        rows: rows,
                        callOf: callOf,
                        putOf: putOf,
                        maxV: maxV,
                        spot: widget.spot,
                        maxPain: widget.maxPain,
                        hover: _hover,
                        k: k,
                        text: context.text,
                        maxPainLabel: t('trader.opt.an.oi.maxPain'),
                      ),
                    ),
                  ),
                ),
                if (hr != null)
                  Positioned(
                    top: 6,
                    left: ((8 + (hr + 0.5) * (w - 16) / rows.length) + 178 > w)
                        ? (8 + (hr + 0.5) * (w - 16) / rows.length) - 178
                        : 8 + (hr + 0.5) * (w - 16) / rows.length + 10,
                    child: _Tip(
                      title: Text(rows[hr].label, style: context.text.mono(11, weight: FontWeight.w600)),
                      lines: [
                        ('${t('trader.opt.calls')} ${t('trader.opt.an.oi.oiShort')}', qty(rows[hr].callOi)),
                        ('${t('trader.opt.calls')} ${t('trader.opt.an.oi.volShort')}', qty(rows[hr].callVol)),
                        ('${t('trader.opt.puts')} ${t('trader.opt.an.oi.oiShort')}', qty(rows[hr].putOi)),
                        ('${t('trader.opt.puts')} ${t('trader.opt.an.oi.volShort')}', qty(rows[hr].putVol)),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
        const SizedBox(height: 4),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _legend(context, k.up, t('trader.opt.calls'), band: true),
            const SizedBox(width: 12),
            _legend(context, k.down, t('trader.opt.puts'), band: true),
          ],
        ),
      ],
    );
  }
}

class _OiPainter extends CustomPainter {
  _OiPainter({
    required this.rows,
    required this.callOf,
    required this.putOf,
    required this.maxV,
    required this.spot,
    required this.maxPain,
    required this.hover,
    required this.k,
    required this.text,
    required this.maxPainLabel,
  });
  final List<({double strike, String label, double callOi, double putOi, double callVol, double putVol})> rows;
  final double Function(int i) callOf, putOf;
  final double maxV;
  final double? spot, maxPain;
  final int? hover;
  final KTokens k;
  final KText text;
  final String maxPainLabel;

  @override
  void paint(Canvas canvas, Size size) {
    const l = 8.0, r = 8.0, t = 14.0, b = 20.0;
    final iw = size.width - l - r, ih = size.height - t - b;
    final mid = t + ih / 2;
    final bw = iw / rows.length;
    canvas.drawLine(Offset(l, mid), Offset(l + iw, mid), Paint()..color = k.line);
    for (var i = 0; i < rows.length; i++) {
      final x0 = l + i * bw + bw * 0.15;
      final w = math.max(1.0, bw * 0.7);
      final ch = callOf(i) / maxV * (ih / 2 - 2);
      final ph = putOf(i) / maxV * (ih / 2 - 2);
      final hl = hover == i;
      canvas.drawRect(Rect.fromLTWH(x0, mid - ch, w, ch), Paint()..color = k.up.withValues(alpha: hl ? 1 : 0.75));
      canvas.drawRect(Rect.fromLTWH(x0, mid, w, ph), Paint()..color = k.down.withValues(alpha: hl ? 1 : 0.75));
    }
    double xOfStrike(double s) {
      // between the bars of the neighbouring strikes
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].strike >= s) {
          if (i == 0) return l + bw / 2;
          final a = rows[i - 1].strike, bb = rows[i].strike;
          final f = (s - a) / (bb - a == 0 ? 1 : bb - a);
          return l + (i - 1 + 0.5 + f) * bw;
        }
      }
      return l + iw - bw / 2;
    }

    if (spot != null) {
      final x = xOfStrike(spot!);
      canvas.drawLine(
        Offset(x, t),
        Offset(x, t + ih),
        Paint()
          ..color = k.ember.withValues(alpha: 0.75)
          ..strokeWidth = 1,
      );
    }
    if (maxPain != null) {
      final x = xOfStrike(maxPain!);
      dashLine(
        canvas,
        Offset(x, t),
        Offset(x, t + ih),
        Paint()
          ..color = k.gold
          ..strokeWidth = 1.2,
      );
      final tp = TextPainter(
        text: TextSpan(
          text: maxPainLabel,
          style: text.caption.copyWith(fontSize: 9, color: k.gold),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset((x - tp.width / 2).clamp(0, size.width - tp.width), 0));
    }
    final nX = math.max(2, math.min(5, (iw / 90).floor()));
    for (var j = 0; j < nX; j++) {
      final i = (j * (rows.length - 1) / (nX - 1)).round();
      final tp = TextPainter(
        text: TextSpan(
          text: rows[i].label,
          style: text.mono(9.5, color: k.fg3),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final cx = l + (i + 0.5) * bw;
      final dx = j == 0 ? 0.0 : (j == nX - 1 ? tp.width : tp.width / 2);
      tp.paint(canvas, Offset((cx - dx).clamp(0, size.width - tp.width), size.height - 14));
    }
  }

  @override
  bool shouldRepaint(_OiPainter old) => true;
}

class _PcrRow extends StatelessWidget {
  const _PcrRow({required this.label, required this.calls, required this.puts});
  final String label;
  final double calls, puts;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final ratio = putCallRatio(puts, calls);
    final total = calls + puts;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400),
                ),
              ),
              Text(ratio == null ? '—' : ratio.toStringAsFixed(2), style: context.text.mono(12.5, weight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: SizedBox(
              height: 6,
              child: total <= 0
                  ? ColoredBox(color: k.surface3)
                  : Row(
                      children: [
                        Expanded(
                          flex: math.max(1, (calls / total * 1000).round()),
                          child: ColoredBox(color: k.up),
                        ),
                        Expanded(
                          flex: math.max(1, (puts / total * 1000).round()),
                          child: ColoredBox(color: k.down),
                        ),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 3),
          Row(
            children: [
              Text('${t('trader.opt.calls')} ${qty(calls)}', style: context.text.mono(10, color: k.fg3)),
              const Spacer(),
              Text('${t('trader.opt.puts')} ${qty(puts)}', style: context.text.mono(10, color: k.fg3)),
            ],
          ),
        ],
      ),
    );
  }
}
