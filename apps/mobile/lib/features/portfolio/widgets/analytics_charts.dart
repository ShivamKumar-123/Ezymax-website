// The Analytics page's charts (port of apps/crm/components/portfolio/charts.tsx): equity vs balance, drawdown,
// P&L by symbol, weekday columns, the weekday x hour heatmap and the money-flow waterfall. Painted directly (no
// chart package); touch shows the web's hover read-outs. Time axes stay left to right in RTL, as on the web's SVGs.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart' show DateFormat;

import '../../../core/format/format.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';

/// "24 Sep 26" for a server day (YYYY-MM-DD) (web fmtDate).
String chartDay(String day, String locale) {
  final d = DateTime.tryParse('${day}T00:00:00Z');
  if (d == null) return day;
  return latinDigits(DateFormat('d MMM yy', intlLocale(locale)).format(d));
}

/// "$12,480" (web formatMoney(v, "USD", 0)).
String usd0(num v) => Fmt.money(v, decimals: 0);

/// "+$1.2K" / "-$300" (web PnlBars / Waterfall labels).
String signedCompact(num v, {bool sign = true}) => '${sign ? (v >= 0 ? '+' : '-') : ''}\$${Fmt.compact(v.abs())}';

class _Tip extends StatelessWidget {
  const _Tip({required this.lines});
  final List<Widget> lines;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: k.surface3.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: k.line),
        boxShadow: k.shadowPop,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: lines),
    );
  }
}

int? _indexAt(double dx, double width, int n) {
  if (n < 2 || width <= 0) return null;
  return ((dx / width) * (n - 1)).round().clamp(0, n - 1);
}

/* ------------------------------------------------------------------ equity vs balance */

/// Equity (gold, filled) and balance (dashed) per server day, a compact USD axis on the end side.
class EquityCurvesChart extends StatefulWidget {
  const EquityCurvesChart({
    super.key,
    required this.days,
    required this.equity,
    required this.balance,
    required this.equityLabel,
    required this.balanceLabel,
    this.height = 220,
  });
  final List<String> days;
  final List<double> equity, balance;
  final String equityLabel, balanceLabel;
  final double height;

  @override
  State<EquityCurvesChart> createState() => _EquityCurvesChartState();
}

class _EquityCurvesChartState extends State<EquityCurvesChart> {
  int? _hover;
  static const double _axis = 46;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final locale = context.t.locale;
    final n = widget.days.length;
    final h = _hover;
    final labelStyle = context.text.mono(10, color: k.fg3);
    return Directionality(
      textDirection: TextDirection.ltr,
      child: LayoutBuilder(
        builder: (context, c) {
          final plotW = c.maxWidth - _axis;
          void at(Offset p) {
            final i = _indexAt(p.dx, plotW, n);
            if (i != null && i != _hover) {
              KHaptics.selection();
              setState(() => _hover = i);
            }
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onHorizontalDragStart: (d) => at(d.localPosition),
                onHorizontalDragUpdate: (d) => at(d.localPosition),
                onHorizontalDragEnd: (_) => setState(() => _hover = null),
                onTapDown: (d) => at(d.localPosition),
                onTapUp: (_) => setState(() => _hover = null),
                child: SizedBox(
                  height: widget.height,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Positioned.fill(
                        child: CustomPaint(
                          painter: _CurvesPainter(
                            equity: widget.equity,
                            balance: widget.balance,
                            eqColor: k.gold,
                            balColor: k.fg2,
                            grid: k.line,
                            axis: _axis,
                            labelStyle: labelStyle,
                            hover: h,
                            dot: k.bg,
                          ),
                        ),
                      ),
                      if (h != null && h < n)
                        Positioned(
                          top: 0,
                          left: h / (n - 1) > 0.55 ? null : math.min(plotW - 10, h / (n - 1) * plotW + 10),
                          right: h / (n - 1) > 0.55 ? _axis + (1 - h / (n - 1)) * plotW + 10 : null,
                          child: _Tip(
                            lines: [
                              Text(chartDay(widget.days[h], locale), style: context.text.mono(10.5, color: k.fg3)),
                              const SizedBox(height: 3),
                              for (final (label, color, v) in [(widget.equityLabel, k.gold, widget.equity[h]), (widget.balanceLabel, k.fg2, widget.balance[h])])
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(width: 10, height: 2, color: color),
                                    const SizedBox(width: 5),
                                    Text(label, style: context.text.caption.copyWith(color: k.fg2)),
                                    const SizedBox(width: 12),
                                    Text(
                                      usd0(v),
                                      style: context.text.caption.copyWith(color: k.fg, fontFeatures: kTabular),
                                    ),
                                  ],
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.only(right: _axis),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    for (final f in const [0.0, 0.5, 1.0]) Text(chartDay(widget.days[((n - 1) * f).round()], locale), style: labelStyle),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CurvesPainter extends CustomPainter {
  _CurvesPainter({
    required this.equity,
    required this.balance,
    required this.eqColor,
    required this.balColor,
    required this.grid,
    required this.axis,
    required this.labelStyle,
    required this.hover,
    required this.dot,
  });
  final List<double> equity, balance;
  final Color eqColor, balColor, grid, dot;
  final double axis;
  final TextStyle labelStyle;
  final int? hover;

  @override
  void paint(Canvas canvas, Size size) {
    final all = [...equity, ...balance];
    final lo0 = all.reduce(math.min), hi0 = all.reduce(math.max);
    final pad = (hi0 - lo0) * 0.08 + (hi0 == lo0 ? 1 : 0);
    final lo = lo0 - pad, hi = hi0 + pad;
    final w = size.width - axis, h = size.height;
    final n = equity.length;
    double x(int i) => i / (n - 1) * w;
    double y(double v) => h - (v - lo) / (hi - lo) * h;
    final gp = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (var i = 0; i <= 4; i++) {
      final v = lo + (hi - lo) * i / 4;
      final gy = y(v);
      canvas.drawLine(Offset(0, gy), Offset(w, gy), gp);
      final tp = TextPainter(
        text: TextSpan(text: Fmt.compact(v), style: labelStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(size.width - tp.width, (gy - tp.height / 2).clamp(0, h - tp.height)));
    }
    Path line(List<double> v) {
      final p = Path()..moveTo(0, y(v[0]));
      for (var i = 1; i < v.length; i++) {
        p.lineTo(x(i), y(v[i]));
      }
      return p;
    }

    final eq = line(equity);
    canvas.drawPath(
      Path.from(eq)
        ..lineTo(w, h)
        ..lineTo(0, h)
        ..close(),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [eqColor.withValues(alpha: 0.22), eqColor.withValues(alpha: 0)],
        ).createShader(Rect.fromLTWH(0, 0, w, h)),
    );
    final bal = line(balance);
    final dash = Paint()
      ..color = balColor
      ..strokeWidth = 1.4
      ..style = PaintingStyle.stroke;
    for (final m in bal.computeMetrics()) {
      for (double d = 0; d < m.length; d += 9) {
        canvas.drawPath(m.extractPath(d, math.min(d + 5, m.length)), dash);
      }
    }
    canvas.drawPath(
      eq,
      Paint()
        ..color = eqColor
        ..strokeWidth = 2
        ..style = PaintingStyle.stroke
        ..strokeJoin = StrokeJoin.round,
    );
    final hv = hover;
    if (hv != null && hv < n) {
      final hx = x(hv);
      final hp = Paint()
        ..color = balColor
        ..strokeWidth = 1;
      for (double d = 0; d < h; d += 8) {
        canvas.drawLine(Offset(hx, d), Offset(hx, math.min(d + 4, h)), hp);
      }
      for (final (v, c) in [(equity[hv], eqColor), (balance[hv], balColor)]) {
        canvas.drawCircle(Offset(hx, y(v)), 4, Paint()..color = dot);
        canvas.drawCircle(
          Offset(hx, y(v)),
          4,
          Paint()
            ..color = c
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_CurvesPainter old) => old.equity != equity || old.balance != balance || old.hover != hover || old.eqColor != eqColor;
}

/* ------------------------------------------------------------------ drawdown */

/// Drawdown from the peak (red area hanging from 0); marks the worst day unless a day is touched.
class DrawdownChart extends StatefulWidget {
  const DrawdownChart({super.key, required this.days, required this.values, required this.worstLabel, this.height = 130});
  final List<String> days;
  final List<double> values;
  final String worstLabel;
  final double height;

  @override
  State<DrawdownChart> createState() => _DrawdownChartState();
}

class _DrawdownChartState extends State<DrawdownChart> {
  int? _hover;
  static const double _axis = 42;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final locale = context.t.locale;
    final v = widget.values;
    final n = v.length;
    var worst = 0;
    for (var i = 1; i < n; i++) {
      if (v[i] < v[worst]) worst = i;
    }
    final at = _hover ?? worst;
    final labelStyle = context.text.mono(10, color: k.fg3);
    return Directionality(
      textDirection: TextDirection.ltr,
      child: LayoutBuilder(
        builder: (context, c) {
          final plotW = c.maxWidth - _axis;
          void touch(Offset p) {
            final i = _indexAt(p.dx, plotW, n);
            if (i != null && i != _hover) {
              KHaptics.selection();
              setState(() => _hover = i);
            }
          }

          final min = math.min(v.reduce(math.min), -1.0) * 1.1;
          final frac = at / (n - 1);
          final tipTop = math.min(0.52, v[at] / min) * widget.height;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onHorizontalDragStart: (d) => touch(d.localPosition),
                onHorizontalDragUpdate: (d) => touch(d.localPosition),
                onHorizontalDragEnd: (_) => setState(() => _hover = null),
                onTapDown: (d) => touch(d.localPosition),
                onTapUp: (_) => setState(() => _hover = null),
                child: SizedBox(
                  height: widget.height,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Positioned.fill(
                        child: CustomPaint(
                          painter: _DrawdownPainter(
                            values: v,
                            min: min,
                            color: k.down,
                            grid: k.line,
                            guide: _hover == null ? k.down : k.fg2,
                            at: at,
                            axis: _axis,
                            labelStyle: labelStyle,
                          ),
                        ),
                      ),
                      Positioned(
                        top: tipTop,
                        left: frac > 0.6 ? null : frac * plotW + 8,
                        right: frac > 0.6 ? _axis + (1 - frac) * plotW + 8 : null,
                        child: _Tip(
                          lines: [
                            Text(_hover == null ? widget.worstLabel : chartDay(widget.days[at], locale), style: context.text.mono(10.5, color: k.fg3)),
                            Text(
                              '${v[at].toStringAsFixed(2)}%',
                              style: context.text.caption.copyWith(color: k.down, fontWeight: FontWeight.w700, fontFeatures: kTabular),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.only(right: _axis),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    for (final f in const [0.0, 0.5, 1.0]) Text(chartDay(widget.days[((n - 1) * f).round()], locale), style: labelStyle),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _DrawdownPainter extends CustomPainter {
  _DrawdownPainter({
    required this.values,
    required this.min,
    required this.color,
    required this.grid,
    required this.guide,
    required this.at,
    required this.axis,
    required this.labelStyle,
  });
  final List<double> values;
  final double min, axis;
  final Color color, grid, guide;
  final int at;
  final TextStyle labelStyle;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width - axis, h = size.height;
    final n = values.length;
    double x(int i) => i / (n - 1) * w;
    double y(double v) => v / min * h;
    final gp = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (final tv in [0.0, min / 2, min]) {
      final gy = y(tv);
      canvas.drawLine(Offset(0, gy), Offset(w, gy), gp);
      final tp = TextPainter(
        text: TextSpan(text: '${tv.toStringAsFixed(1)}%', style: labelStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(size.width - tp.width, (gy - tp.height / 2).clamp(0, h - tp.height)));
    }
    final line = Path()..moveTo(0, y(values[0]));
    for (var i = 1; i < n; i++) {
      line.lineTo(x(i), y(values[i]));
    }
    canvas.drawPath(
      Path.from(line)
        ..lineTo(w, 0)
        ..lineTo(0, 0)
        ..close(),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [color.withValues(alpha: 0.05), color.withValues(alpha: 0.45)],
        ).createShader(Rect.fromLTWH(0, 0, w, h)),
    );
    canvas.drawPath(
      line,
      Paint()
        ..color = color
        ..strokeWidth = 1.6
        ..style = PaintingStyle.stroke,
    );
    final gx = x(at);
    final p = Paint()
      ..color = guide.withValues(alpha: 0.6)
      ..strokeWidth = 1;
    for (double d = 0; d < h; d += 7) {
      canvas.drawLine(Offset(gx, d), Offset(gx, math.min(d + 3, h)), p);
    }
  }

  @override
  bool shouldRepaint(_DrawdownPainter old) => old.values != values || old.at != at || old.color != color;
}

/* ------------------------------------------------------------------ P&L by symbol */

/// One row of [PnlBars].
typedef PnlRow = ({String key, Widget label, double value, String? sub});

/// Horizontal P&L bars around a centre line (web PnlBars): label, bar, signed value with a note.
class PnlBars extends StatelessWidget {
  const PnlBars({super.key, required this.rows});
  final List<PnlRow> rows;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final max = rows.fold<double>(1, (m, r) => math.max(m, r.value.abs()));
    return Column(
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          Row(
            children: [
              SizedBox(width: 118, child: rows[i].label),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 18,
                  child: Directionality(
                    textDirection: TextDirection.ltr,
                    child: LayoutBuilder(
                      builder: (context, c) {
                        final r = rows[i];
                        final half = c.maxWidth / 2;
                        final w = r.value.abs() / max * half;
                        final up = r.value >= 0;
                        return Stack(
                          children: [
                            Positioned(
                              left: half - 0.5,
                              top: 0,
                              bottom: 0,
                              child: Container(width: 1, color: k.line),
                            ),
                            Positioned(
                              left: up ? half : half - w,
                              top: 2,
                              bottom: 2,
                              child: Container(
                                width: w,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(7),
                                  gradient: LinearGradient(
                                    begin: up ? Alignment.centerLeft : Alignment.centerRight,
                                    end: up ? Alignment.centerRight : Alignment.centerLeft,
                                    colors: up ? [k.up.withValues(alpha: 0.4), k.up] : [k.down.withValues(alpha: 0.4), k.down],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 74,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${rows[i].value >= 0 ? '+' : '-'}${usd0(rows[i].value.abs())}',
                      textDirection: TextDirection.ltr,
                      style: context.text.caption.copyWith(fontSize: 12.5, color: rows[i].value >= 0 ? k.up : k.down, fontFeatures: kTabular),
                    ),
                    if (rows[i].sub != null)
                      Text(
                        rows[i].sub!,
                        maxLines: 1,
                        style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/* ------------------------------------------------------------------ weekday columns */

/// Vertical +/- columns with a label under each (web ColumnBars); touch shows the value and its note.
class ColumnBars extends StatefulWidget {
  const ColumnBars({super.key, required this.data, this.height = 200});
  final List<({String label, double value, String? sub})> data;
  final double height;

  @override
  State<ColumnBars> createState() => _ColumnBarsState();
}

class _ColumnBarsState extends State<ColumnBars> {
  int? _hover;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final data = widget.data;
    final max = data.fold<double>(0, (m, d) => math.max(m, d.value));
    final min = data.fold<double>(0, (m, d) => math.min(m, d.value));
    final span = (max - min) == 0 ? 1.0 : max - min;
    final zero = max / span;
    const top = 22.0;
    final plotH = widget.height - top - 22;
    return SizedBox(
      height: widget.height,
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Column(
          children: [
            const SizedBox(height: top),
            SizedBox(
              height: plotH,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    left: 0,
                    right: 0,
                    top: zero * plotH,
                    child: Container(height: 1, color: k.line),
                  ),
                  Row(
                    children: [
                      for (var i = 0; i < data.length; i++)
                        Expanded(
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTapDown: (_) => setState(() => _hover = i),
                            onTapUp: (_) => setState(() => _hover = null),
                            onTapCancel: () => setState(() => _hover = null),
                            child: Stack(
                              clipBehavior: Clip.none,
                              alignment: Alignment.topCenter,
                              children: [
                                Builder(
                                  builder: (context) {
                                    final v = data[i].value;
                                    final hgt = math.max(v.abs() / span * plotH, 1.5);
                                    final up = v >= 0;
                                    return Positioned(
                                      top: up ? zero * plotH - hgt : zero * plotH,
                                      width: 22,
                                      height: hgt,
                                      child: Container(
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(5),
                                          gradient: LinearGradient(
                                            begin: up ? Alignment.topCenter : Alignment.bottomCenter,
                                            end: up ? Alignment.bottomCenter : Alignment.topCenter,
                                            colors: up ? [k.up, k.up.withValues(alpha: 0.35)] : [k.down, k.down.withValues(alpha: 0.35)],
                                          ),
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                  if (_hover != null)
                    Positioned(
                      top: -top,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                          decoration: BoxDecoration(
                            color: k.surface3,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: k.line),
                          ),
                          child: Text(
                            '${data[_hover!].label} · ${usd0(data[_hover!].value)}${data[_hover!].sub != null ? ' · ${data[_hover!].sub}' : ''}',
                            style: context.text.caption.copyWith(color: k.fg, fontFeatures: kTabular),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                for (var i = 0; i < data.length; i++)
                  Expanded(
                    child: Text(
                      data[i].label,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.caption.copyWith(color: _hover == i ? k.fg : k.fg3, fontWeight: FontWeight.w400),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------------ weekday x hour heatmap */

/// A weekday row of the heatmap: its label and 24 hour cells (P&L, trades).
typedef HeatRow = ({String day, List<({double pnl, int trades})> cells});

/// Weekday x hour P&L heatmap (web HourHeatmap): green for profit, red for loss, grey without trades; touch a cell
/// to read it.
class HourHeatmap extends StatefulWidget {
  const HourHeatmap({super.key, required this.rows});
  final List<HeatRow> rows;

  @override
  State<HourHeatmap> createState() => _HourHeatmapState();
}

class _HourHeatmapState extends State<HourHeatmap> {
  ({int d, int h})? _hover;
  static const double _label = 32, _gap = 2;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final rows = widget.rows;
    var max = 1.0;
    for (final r in rows) {
      for (final c in r.cells) {
        max = math.max(max, c.pnl.abs());
      }
    }
    final hv = _hover;
    final cell = hv == null ? null : rows[hv.d].cells[hv.h];
    final hourStyle = context.text.mono(9, color: k.fg3);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Directionality(
          textDirection: TextDirection.ltr,
          child: LayoutBuilder(
            builder: (context, c) {
              final size = (c.maxWidth - _label - _gap * 24) / 24;
              void touch(Offset p) {
                final h = ((p.dx - _label) / (size + _gap)).floor();
                final d = ((p.dy - 14) / (size + _gap)).floor();
                if (h < 0 || h > 23 || d < 0 || d >= rows.length) return;
                if (hv?.d != d || hv?.h != h) {
                  KHaptics.selection();
                  setState(() => _hover = (d: d, h: h));
                }
              }

              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTapDown: (d) => touch(d.localPosition),
                onPanStart: (d) => touch(d.localPosition),
                onPanUpdate: (d) => touch(d.localPosition),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      height: 14,
                      child: Row(
                        children: [
                          const SizedBox(width: _label),
                          for (var h = 0; h < 24; h++)
                            SizedBox(
                              width: size + _gap,
                              child: h % 3 == 0 ? Text(h.toString().padLeft(2, '0'), style: hourStyle, softWrap: false, overflow: TextOverflow.visible) : null,
                            ),
                        ],
                      ),
                    ),
                    for (var d = 0; d < rows.length; d++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: _gap),
                        child: Row(
                          children: [
                            SizedBox(
                              width: _label,
                              child: Text(
                                rows[d].day,
                                maxLines: 1,
                                style: context.text.micro.copyWith(color: k.fg3, fontWeight: FontWeight.w500),
                              ),
                            ),
                            for (var h = 0; h < 24; h++) ...[
                              Container(
                                width: size,
                                height: size,
                                decoration: BoxDecoration(
                                  color: _cellColor(k, rows[d].cells[h], max),
                                  borderRadius: BorderRadius.circular(size * 0.22),
                                  border: Border.all(
                                    color: hv?.d == d && hv?.h == h ? k.fg.withValues(alpha: 0.7) : k.line.withValues(alpha: 0.6),
                                    width: hv?.d == d && hv?.h == h ? 1.6 : 0.6,
                                  ),
                                ),
                              ),
                              const SizedBox(width: _gap),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 10),
        if (hv != null && cell != null)
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '${rows[hv.d].day} ${hv.h.toString().padLeft(2, '0')}:00–${(hv.h + 1).toString().padLeft(2, '0')}:00',
                  style: TextStyle(color: k.fg2),
                ),
                TextSpan(text: ' · ${t('portfolio.trades', {'count': cell.trades})} · '),
                TextSpan(
                  text: '${cell.pnl >= 0 ? '+' : '-'}${Fmt.money(cell.pnl.abs())}',
                  style: TextStyle(color: cell.pnl >= 0 ? k.up : k.down),
                ),
              ],
            ),
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
          )
        else
          Text(
            t('portfolio.chart.hoverHint'),
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
          ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Text(
              t('common.loss'),
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
            const SizedBox(width: 8),
            Container(
              width: 90,
              height: 8,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(4),
                gradient: LinearGradient(colors: [k.down, k.surface3, k.up]),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              t('common.profit'),
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
          ],
        ),
      ],
    );
  }

  Color _cellColor(KTokens k, ({double pnl, int trades}) c, double max) {
    if (c.trades == 0) return k.surface2;
    final a = math.min(1.0, c.pnl.abs() / max);
    return Color.lerp(k.surface2, c.pnl >= 0 ? k.up : k.down, 0.12 + a * 0.78)!;
  }
}

/* ------------------------------------------------------------------ money-flow waterfall */

/// One step of [Waterfall]; a `total` step shows the running total.
typedef FlowStep = ({String label, double value, bool total});

/// Deposits -> P&L -> charges -> withdrawals as floating bars, the net total in gold (web Waterfall).
class Waterfall extends StatelessWidget {
  const Waterfall({super.key, required this.steps, this.height = 240});
  final List<FlowStep> steps;
  final double height;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    var run = 0.0;
    final bars = <({FlowStep s, double from, double to})>[];
    for (final s in steps) {
      if (s.total) {
        bars.add((s: s, from: 0, to: run));
      } else {
        final from = run;
        run += s.value;
        bars.add((s: s, from: from, to: run));
      }
    }
    final max = bars.fold<double>(1, (m, b) => math.max(m, math.max(b.from, b.to)));
    const top = 20.0, bottom = 34.0;
    final plotH = height - top - bottom;
    return SizedBox(
      height: height,
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Column(
          children: [
            SizedBox(
              height: top + plotH,
              child: Row(
                children: [
                  for (final b in bars)
                    Expanded(
                      child: LayoutBuilder(
                        builder: (context, c) {
                          final lo = math.max(0.0, math.min(b.from, b.to)), hi = math.max(0.0, math.max(b.from, b.to));
                          final up = b.s.total || b.to >= b.from;
                          final barH = math.max((hi - lo) / max * plotH, 1.0);
                          final color = b.s.total ? k.gold : (up ? k.up : k.down);
                          final bw = math.min(c.maxWidth - 6, 40.0);
                          return Stack(
                            clipBehavior: Clip.none,
                            alignment: Alignment.bottomCenter,
                            children: [
                              Positioned(
                                bottom: lo / max * plotH,
                                width: bw,
                                height: barH,
                                child: Container(
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: color.withValues(alpha: 0.35)),
                                    gradient: LinearGradient(
                                      begin: up ? Alignment.topCenter : Alignment.bottomCenter,
                                      end: up ? Alignment.bottomCenter : Alignment.topCenter,
                                      colors: [color, color.withValues(alpha: 0.4)],
                                    ),
                                  ),
                                ),
                              ),
                              Positioned(
                                bottom: hi / max * plotH + 3,
                                left: -6,
                                right: -6,
                                child: Text(
                                  b.s.total ? '\$${Fmt.compact(b.to.abs())}' : signedCompact(b.s.value),
                                  textAlign: TextAlign.center,
                                  maxLines: 1,
                                  style: context.text.micro.copyWith(fontSize: 9.5, color: color, fontFeatures: kTabular),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            SizedBox(
              height: bottom - 4,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final b in bars)
                    Expanded(
                      child: Text(
                        b.s.label,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.micro.copyWith(fontSize: 9.5, color: k.fg3, fontWeight: FontWeight.w500, height: 1.15),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
