// "Statistics" (web components/dashboard/home/statistic-card.tsx + trend-chart.tsx): Equity | P&L, Weekly · Monthly ·
// Last year, the change chip, and the period's smooth ember line over the previous period (dashed), with a touch
// crosshair and value bubble. The series comes from the reports service's daily curve of the live accounts.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart' show DateFormat;

import '../../../core/format/format.dart';
import '../../../data/client_data.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';

enum StatMode { equity, pnl }

enum StatRange { week, month, year }

const Map<StatRange, int> kRangeDays = {StatRange.week: 7, StatRange.month: 30, StatRange.year: 365};

/// A point of the chart: day (local noon) and value.
typedef TrendPoint = ({DateTime t, double v});

String _isoDay(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// This period and the one before it (web toSeries): P&L is cumulative from the start of each period, net of deposits
/// and withdrawals; the last year keeps one point a week (and the last one).
({List<TrendPoint> points, List<double>? compare}) toSeries(List<CurvePoint> curve, int n, StatMode mode, StatRange range, {DateTime? now}) {
  final cut = (now ?? DateTime.now()).subtract(Duration(days: n - 1));
  final from = _isoDay(cut);
  final cur = curve.where((p) => p.day.compareTo(from) >= 0).toList();
  final before = curve.where((p) => p.day.compareTo(from) < 0).toList();
  final prev = before.length > n ? before.sublist(before.length - n) : before;
  List<double> val(List<CurvePoint> xs) {
    if (mode == StatMode.equity) return [for (final p in xs) p.equity];
    var acc = 0.0;
    return [
      for (var i = 0; i < xs.length; i++)
        if (i == 0) 0 else (acc += xs[i].equity - xs[i - 1].equity - xs[i].flow),
    ];
  }

  final step = range == StatRange.year ? 7 : 1;
  bool keep(int i, int len) => i % step == 0 || i == len - 1;
  final cv = val(cur);
  final points = <TrendPoint>[
    for (var i = 0; i < cur.length; i++)
      if (keep(i, cur.length)) (t: DateTime.tryParse('${cur[i].day}T12:00:00') ?? DateTime.now(), v: cv[i]),
  ];
  List<double>? compare;
  if (prev.length > 1) {
    final pv = val(prev);
    compare = [
      for (var i = 0; i < pv.length; i++)
        if (keep(i, pv.length)) pv[i],
    ];
  }
  return (points: points, compare: compare);
}

/// "$12.5k" axis labels (web compactMoney).
String compactMoney(double v) {
  final a = v.abs();
  final s = v < 0 ? '-' : '';
  if (a >= 1e6) return '$s\$${(a / 1e6).toStringAsFixed(a >= 1e7 ? 0 : 1)}M';
  if (a >= 1e4) return '$s\$${(a / 1e3).toStringAsFixed(0)}k';
  if (a >= 1e3) return '$s\$${(a / 1e3).toStringAsFixed(1)}k';
  return '$s\$${a.toStringAsFixed(0)}';
}

/// Round axis ticks around min..max (web niceTicks).
List<double> niceTicks(double min, double max, [int count = 4]) {
  if (min == max) {
    final p = min.abs() * 0.05 == 0 ? 1.0 : min.abs() * 0.05;
    min -= p;
    max += p;
  }
  final span = max - min;
  final raw = span / count;
  final pow = math.pow(10, (math.log(raw) / math.ln10).floor()).toDouble();
  final step = [1, 2, 2.5, 5, 10].map((s) => s * pow).firstWhere((s) => span / s <= count, orElse: () => 10 * pow);
  final lo = (min / step).floor() * step;
  final hi = (max / step).ceil() * step;
  return [for (var v = lo; v <= hi + step / 2; v += step) double.parse(v.toStringAsFixed(10))];
}

class StatisticCard extends StatelessWidget {
  const StatisticCard({
    super.key,
    required this.mode,
    required this.onMode,
    required this.range,
    required this.onRange,
    required this.points,
    this.compare,
    this.loading = false,
  });

  final StatMode mode;
  final ValueChanged<StatMode> onMode;
  final StatRange range;
  final ValueChanged<StatRange> onRange;

  /// Null while loading.
  final List<TrendPoint>? points;
  final List<double>? compare;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final pts = points ?? const <TrendPoint>[];
    final has = pts.length > 1;
    final first = has ? pts.first.v : 0.0;
    final last = has ? pts.last.v : 0.0;
    final change = mode == StatMode.equity ? last - first : last;
    final pct = mode == StatMode.equity && first != 0 ? change / first.abs() * 100 : null;
    final tag = intlLocale(t.locale);
    String fmtT(DateTime d) => latinDigits(range == StatRange.year ? DateFormat.MMM(tag).format(d) : DateFormat.MMMd(tag).format(d));
    const ranges = [StatRange.week, StatRange.month, StatRange.year];
    return KCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Row(
              children: [
                Expanded(child: Text(t('dashboard.home.statistics'), style: context.text.title1)),
                SizedBox(
                  width: 168,
                  child: KSegmented<StatMode>(
                    values: const [StatMode.equity, StatMode.pnl],
                    labels: [t('common.equity'), t('dashboard.home.pnl')],
                    selected: mode,
                    onChanged: onMode,
                    height: 34,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          KSubNav(
            labels: [t('dashboard.home.weekly'), t('dashboard.home.monthly'), t('dashboard.home.lastYear')],
            current: ranges.indexOf(range),
            onSelect: (i) => onRange(ranges[i]),
          ),
          if (has)
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(20, 8, 20, 0),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: KChangeChip(
                  '${change >= 0 ? '+' : '-'}${Fmt.money(change.abs())}${pct != null ? ' (${pct >= 0 ? '+' : ''}${pct.toStringAsFixed(2)}%)' : ''}',
                  up: change >= 0,
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 4, 12, 12),
            child: loading && !has
                ? const Padding(padding: EdgeInsets.symmetric(horizontal: 8, vertical: 8), child: KSkeleton(height: 220, radius: 18))
                : has
                ? TrendChart(points: pts, compare: compare, height: 236, formatValue: Fmt.money, formatAxis: compactMoney, formatTime: fmtT)
                : SizedBox(
                    height: 220,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          t('dashboard.home.noHistory'),
                          textAlign: TextAlign.center,
                          style: context.text.callout.copyWith(color: k.fg3),
                        ),
                      ),
                    ),
                  ),
          ),
          if (has && compare != null && compare!.length > 1)
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 20, 16),
              child: Wrap(
                spacing: 16,
                runSpacing: 6,
                children: [
                  _Legend(
                    swatch: Container(
                      width: 16,
                      height: 3,
                      decoration: BoxDecoration(color: k.ember, borderRadius: BorderRadius.circular(2)),
                    ),
                    label: t('dashboard.home.thisPeriod'),
                  ),
                  _Legend(
                    swatch: CustomPaint(size: const Size(16, 2), painter: _DashPainter(k.fg3.withValues(alpha: 0.7))),
                    label: t('dashboard.home.previousPeriod'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.swatch, required this.label});
  final Widget swatch;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      swatch,
      const SizedBox(width: 6),
      Text(
        label,
        style: context.text.caption.copyWith(color: context.k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
      ),
    ],
  );
}

class _DashPainter extends CustomPainter {
  _DashPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = size.height;
    for (var x = 0.0; x < size.width; x += 6) {
      canvas.drawLine(Offset(x, size.height / 2), Offset(math.min(x + 3, size.width), size.height / 2), p);
    }
  }

  @override
  bool shouldRepaint(_DashPainter old) => old.color != color;
}

/// The smooth trend line with axis, previous-period line and a touch read-out (web TrendChart). Always LTR.
class TrendChart extends StatefulWidget {
  const TrendChart({super.key, required this.points, required this.formatValue, required this.formatTime, this.compare, this.height = 260, this.formatAxis});

  final List<TrendPoint> points;
  final List<double>? compare;
  final double height;
  final String Function(num v) formatValue;
  final String Function(double v)? formatAxis;
  final String Function(DateTime t) formatTime;

  @override
  State<TrendChart> createState() => _TrendChartState();
}

class _TrendChartState extends State<TrendChart> with SingleTickerProviderStateMixin {
  int? _hover;
  late final AnimationController _draw = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..forward();

  @override
  void didUpdateWidget(TrendChart old) {
    super.didUpdateWidget(old);
    if (old.points.length != widget.points.length || old.points.lastOrNull?.v != widget.points.lastOrNull?.v) _draw.forward(from: 0);
  }

  @override
  void dispose() {
    _draw.dispose();
    super.dispose();
  }

  void _touch(Offset p, double width) {
    final n = widget.points.length;
    if (n == 0) return;
    final g = _ChartGeometry(width: width, height: widget.height, points: widget.points, compare: widget.compare);
    final i = ((p.dx - g.axisW) / g.plotW * (n - 1)).round().clamp(0, n - 1);
    if (i != _hover) {
      KHaptics.selection();
      setState(() => _hover = i);
    }
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Directionality(
      textDirection: TextDirection.ltr,
      child: LayoutBuilder(
        builder: (context, c) {
          final w = c.maxWidth;
          final g = _ChartGeometry(width: w, height: widget.height, points: widget.points, compare: widget.compare);
          final hp = _hover == null ? null : widget.points[_hover!];
          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onHorizontalDragStart: (d) => _touch(d.localPosition, w),
            onHorizontalDragUpdate: (d) => _touch(d.localPosition, w),
            onHorizontalDragEnd: (_) => setState(() => _hover = null),
            onTapDown: (d) => _touch(d.localPosition, w),
            onTapUp: (_) => Future<void>.delayed(const Duration(milliseconds: 1600), () {
              if (mounted) setState(() => _hover = null);
            }),
            child: SizedBox(
              height: widget.height,
              width: w,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(
                    child: AnimatedBuilder(
                      animation: _draw,
                      builder: (context, _) => CustomPaint(
                        painter: _TrendPainter(
                          g: g,
                          progress: Curves.easeOutCubic.transform(_draw.value),
                          hover: _hover,
                          ember: k.ember,
                          line: k.line,
                          fg2: k.fg2,
                          fg3: k.fg3,
                          surface: k.surface,
                          axisStyle: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11, fontFeatures: kTabular),
                          labelStyle: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11),
                          hoverLabelStyle: context.text.caption.copyWith(color: k.fg, fontWeight: FontWeight.w600, fontSize: 11),
                          formatAxis: widget.formatAxis ?? (v) => widget.formatValue(v),
                          formatTime: widget.formatTime,
                        ),
                      ),
                    ),
                  ),
                  if (hp != null)
                    Positioned(
                      left: (g.x(_hover!) - 44).clamp(g.axisW, math.max(g.axisW, w - 92)),
                      top: math.max(0, g.y(hp.v) - 50),
                      child: IgnorePointer(
                        child: Container(
                          width: 88,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                          decoration: BoxDecoration(color: k.ink, borderRadius: BorderRadius.circular(10), boxShadow: k.shadowPop),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  widget.formatValue(hp.v),
                                  style: context.text.caption.copyWith(color: k.inkFg, fontWeight: FontWeight.w700, fontSize: 12, fontFeatures: kTabular),
                                ),
                              ),
                              Text(
                                widget.formatTime(hp.t),
                                style: context.text.micro.copyWith(color: k.inkFg.withValues(alpha: 0.7), fontWeight: FontWeight.w500, fontSize: 10),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ChartGeometry {
  _ChartGeometry({required this.width, required this.height, required List<TrendPoint> points, List<double>? compare})
    : n = points.length,
      times = [for (final p in points) p.t],
      values = [for (final p in points) p.v],
      cmp = compare != null && compare.length > 1 ? (compare.length > points.length ? compare.sublist(compare.length - points.length) : compare) : null {
    final all = [...values, ...?cmp];
    ticks = all.isEmpty ? const [0, 1] : niceTicks(all.reduce(math.min), all.reduce(math.max));
    lo = ticks.first;
    hi = ticks.last;
  }

  final double width, height;
  final int n;
  final List<DateTime> times;
  final List<double> values;
  final List<double>? cmp;
  late final List<double> ticks;
  late final double lo, hi;
  final double axisW = 52, padT = 30, padB = 26;
  double get plotW => math.max(10, width - axisW - 8);
  double get plotH => height - padT - padB;
  double x(num i, [int? len]) {
    final l = len ?? n;
    return axisW + (l <= 1 ? plotW / 2 : i / (l - 1) * plotW);
  }

  double y(double v) => padT + plotH - (v - lo) / ((hi - lo) == 0 ? 1 : hi - lo) * plotH;
}

/// Monotone cubic path (Fritsch–Carlson): smooth, never overshooting (web smoothPath).
Path smoothPath(List<Offset> pts) {
  final path = Path();
  final n = pts.length;
  if (n == 0) return path;
  path.moveTo(pts[0].dx, pts[0].dy);
  if (n == 1) return path;
  final dx = <double>[], m = <double>[];
  for (var i = 0; i < n - 1; i++) {
    dx.add(pts[i + 1].dx - pts[i].dx);
    m.add((pts[i + 1].dy - pts[i].dy) / (dx[i] == 0 ? 1 : dx[i]));
  }
  final tan = <double>[m[0]];
  for (var i = 1; i < n - 1; i++) {
    tan.add(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  }
  tan.add(m[n - 2]);
  for (var i = 0; i < n - 1; i++) {
    if (m[i] == 0) {
      tan[i] = 0;
      tan[i + 1] = 0;
      continue;
    }
    final a = tan[i] / m[i], b = tan[i + 1] / m[i];
    final s = a * a + b * b;
    if (s > 9) {
      final k = 3 / math.sqrt(s);
      tan[i] = k * a * m[i];
      tan[i + 1] = k * b * m[i];
    }
  }
  for (var i = 0; i < n - 1; i++) {
    final p0 = pts[i], p1 = pts[i + 1];
    final h = dx[i] / 3;
    path.cubicTo(p0.dx + h, p0.dy + tan[i] * h, p1.dx - h, p1.dy - tan[i + 1] * h, p1.dx, p1.dy);
  }
  return path;
}

class _TrendPainter extends CustomPainter {
  _TrendPainter({
    required this.g,
    required this.progress,
    required this.hover,
    required this.ember,
    required this.line,
    required this.fg2,
    required this.fg3,
    required this.surface,
    required this.axisStyle,
    required this.labelStyle,
    required this.hoverLabelStyle,
    required this.formatAxis,
    required this.formatTime,
  });

  final _ChartGeometry g;
  final double progress;
  final int? hover;
  final Color ember, line, fg2, fg3, surface;
  final TextStyle axisStyle, labelStyle, hoverLabelStyle;
  final String Function(double v) formatAxis;
  final String Function(DateTime t) formatTime;

  void _text(Canvas c, String s, TextStyle st, Offset at, {TextAlign align = TextAlign.left}) {
    final tp = TextPainter(
      text: TextSpan(text: s, style: st),
      textDirection: TextDirection.ltr,
    )..layout();
    final dx = switch (align) {
      TextAlign.right => at.dx - tp.width,
      TextAlign.center => at.dx - tp.width / 2,
      _ => at.dx,
    };
    tp.paint(c, Offset(dx, at.dy - tp.height / 2));
  }

  void _dashed(Canvas c, Offset a, Offset b, Paint p, double on, double off) {
    final len = (b - a).distance;
    final dir = (b - a) / len;
    for (var d = 0.0; d < len; d += on + off) {
      c.drawLine(a + dir * d, a + dir * math.min(d + on, len), p);
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    // grid + axis
    final grid = Paint()
      ..color = line
      ..strokeWidth = 1;
    for (final v in g.ticks) {
      _dashed(canvas, Offset(g.axisW, g.y(v)), Offset(g.axisW + g.plotW, g.y(v)), grid, 3, 5);
      _text(canvas, formatAxis(v), axisStyle, Offset(g.axisW - 10, g.y(v)), align: TextAlign.right);
    }
    // date labels: about one per 78 px, at most 7
    final n = g.n;
    final nx = math.max(2, math.min(7, math.min(n, (g.plotW / 78).floor() + 1)));
    final xs = n <= 1 ? {0} : {for (var k = 0; k < nx; k++) (k / (nx - 1) * (n - 1)).round()};
    for (final i in xs) {
      _text(
        canvas,
        formatTime(g.times[i]),
        hover == i ? hoverLabelStyle : labelStyle,
        Offset(g.x(i), g.height - 8),
        align: i == 0 ? TextAlign.left : (i == n - 1 ? TextAlign.right : TextAlign.center),
      );
    }
    // previous period, dashed
    final cmp = g.cmp;
    if (cmp != null) {
      final prev = [for (var i = 0; i < cmp.length; i++) Offset(g.x(i + (n - cmp.length)), g.y(cmp[i]))];
      final p = Paint()
        ..color = fg3.withValues(alpha: 0.55)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..strokeCap = StrokeCap.round;
      for (final metric in smoothPath(prev).computeMetrics()) {
        for (var d = 0.0; d < metric.length; d += 9) {
          canvas.drawPath(metric.extractPath(d, math.min(d + 4, metric.length)), p);
        }
      }
    }
    // the period: area + line, drawn in
    final main = [for (var i = 0; i < n; i++) Offset(g.x(i), g.y(g.values[i]))];
    final path = smoothPath(main);
    final clipW = g.axisW + g.plotW * progress + 4;
    canvas.save();
    canvas.clipRect(Rect.fromLTWH(0, 0, clipW, size.height));
    if (main.length > 1) {
      final area = Path.from(path)
        ..lineTo(main.last.dx, g.padT + g.plotH)
        ..lineTo(main.first.dx, g.padT + g.plotH)
        ..close();
      canvas.drawPath(
        area,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [ember.withValues(alpha: 0.16), ember.withValues(alpha: 0)],
          ).createShader(Rect.fromLTWH(0, g.padT, size.width, g.plotH)),
      );
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = ember
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.6
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.restore();
    // crosshair
    final h = hover;
    if (h != null && h < n) {
      final x = g.x(h), y = g.y(g.values[h]);
      _dashed(
        canvas,
        Offset(x, g.padT - 6),
        Offset(x, g.padT + g.plotH),
        Paint()
          ..color = fg2.withValues(alpha: 0.6)
          ..strokeWidth = 1,
        3,
        4,
      );
      canvas.drawCircle(Offset(x, y), 9, Paint()..color = ember.withValues(alpha: 0.22));
      canvas.drawCircle(Offset(x, y), 5, Paint()..color = ember);
      canvas.drawCircle(
        Offset(x, y),
        5,
        Paint()
          ..color = surface
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }
  }

  @override
  bool shouldRepaint(_TrendPainter old) => true;
}
