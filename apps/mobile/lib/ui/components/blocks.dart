// Page building blocks shared by the module screens (Markets, Copy & PAMM, Partner, Prop, Rewards, Academy,
// Developer, …), on top of the core components:
//   KAsync / KLoadError        an AsyncValue as skeleton -> data, or the web's "couldn't load" card with Try again
//   KCardHeader                the web's CardHeader (title, subtitle, action) inside a KCard
//   KChoiceChips               a scrolling row of filter pills (the web's Segmented / filter tabs that overflow)
//   KSearchField               the compact search pill (h-9) with a clear button
//   KKeyValues                 label / value rows (the web's <dl> detail lists)
//   KStatGrid                  KStat tiles in a grid (2 columns on phones)
//   KNotice                    a soft tinted callout (info / warn / risk notes)
//   KProgressBar, KSlider      thin progress bar; iOS slider in the brand colour
//   KSparkline, KLineChart, KBarChart, KDonut   the small charts of the web pages (no chart package)
//   KCountdown                 "2d 04:12:33" ticking down to a time
//   KQrCode                    a QR code on a white tile (web qrcode.react)
//   KSheetContent              a sheet body: scrolling content with a footer (the sheet's one primary action)
//   showKPicker                choose one value in a sheet (selects on the web)
//   kCopy / kShare             copy with the "Copied" banner; the system share sheet
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_error.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../illustrations.g.dart';
import '../tokens.dart';
import '../typography.dart';
import 'buttons.dart';
import 'data.dart';
import 'haptics.dart';
import 'lists.dart';
import 'pressable.dart';
import 'sheets.dart';
import 'skeleton.dart';
import 'surfaces.dart';

/* ------------------------------------------------------------------ async */

/// An AsyncValue as the web pages show their hooks: `loading` (default: a skeleton card) until the first answer,
/// then the data (kept on screen while it refreshes), or [KLoadError] with Try again when the first load failed.
class KAsync<V> extends StatelessWidget {
  const KAsync({super.key, required this.value, required this.builder, this.loading, this.onRetry, this.skeletonHeight = 160, this.error});

  final AsyncValue<V> value;
  final Widget Function(V data) builder;
  final Widget? loading;
  final VoidCallback? onRetry;
  final double skeletonHeight;

  /// A custom error view (default: [KLoadError]).
  final Widget Function(Object error)? error;

  @override
  Widget build(BuildContext context) {
    if (value.hasValue) return builder(value.requireValue);
    if (value.hasError) return error?.call(value.error!) ?? KLoadError(error: value.error, onRetry: onRetry);
    return loading ?? KSkeletonCard(height: skeletonHeight);
  }
}

/// A card-shaped loading placeholder.
class KSkeletonCard extends StatelessWidget {
  const KSkeletonCard({super.key, this.height = 160, this.lines = 3});
  final double height;
  final int lines;

  @override
  Widget build(BuildContext context) => KCard(
    child: SizedBox(
      height: height - 32,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [const KSkeleton(width: 140, height: 16), const SizedBox(height: 16), KSkeleton.lines(lines)],
      ),
    ),
  );
}

/// The message of a failed request in the reader's language.
String errorText(Object? error, T t) => error is ApiException ? localizeError(error, t) : t('common.errorRetry');

/// "Couldn't load" card (web error states): the connection illustration, the reason and Try again.
class KLoadError extends StatelessWidget {
  const KLoadError({super.key, this.error, this.onRetry, this.card = true});
  final Object? error;
  final VoidCallback? onRetry;
  final bool card;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final body = KEmptyState(
      compact: true,
      art: KIllustrationName.connectionLost,
      title: t('common.error'),
      text: errorText(error, t),
      action: onRetry == null
          ? null
          : KButton(label: t('common.retry'), icon: LucideIcons.rotateCw, variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: onRetry),
    );
    return card ? KCard(child: body) : body;
  }
}

/* ------------------------------------------------------------------ headers, filters, search */

/// The web's CardHeader: title, optional subtitle, an action at the end.
class KCardHeader extends StatelessWidget {
  const KCardHeader({super.key, required this.title, this.subtitle, this.action, this.icon, this.tone = KTone.accent});
  final String title;
  final String? subtitle;
  final Widget? action;
  final IconData? icon;
  final KTone tone;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (icon != null) ...[KIconTile(icon: icon!, tone: tone, size: 36), const SizedBox(width: 12)],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: context.text.title2),
              if (subtitle != null && subtitle!.isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(subtitle!, style: context.text.footnote.copyWith(color: k.fg3)),
              ],
            ],
          ),
        ),
        if (action != null) ...[const SizedBox(width: 10), action!],
      ],
    );
  }
}

/// A scrolling row of pills, one selected (the web's Segmented filters and tab rows that overflow on phones).
class KChoiceChips<V> extends StatelessWidget {
  const KChoiceChips({
    super.key,
    required this.values,
    required this.labels,
    required this.selected,
    required this.onChanged,
    this.icons,
    this.padding = EdgeInsets.zero,
  });

  final List<V> values;
  final List<String> labels;
  final V selected;
  final ValueChanged<V> onChanged;
  final List<IconData?>? icons;

  /// Space at the row's ends (use the page gutter to let the row bleed to the screen edge).
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: padding,
        itemCount: values.length,
        separatorBuilder: (_, _) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          final on = values[i] == selected;
          final icon = icons == null || i >= icons!.length ? null : icons![i];
          return KPressable(
            pressedScale: 0.96,
            onTap: () {
              if (on) return;
              KHaptics.selection();
              onChanged(values[i]);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              height: 34,
              padding: const EdgeInsets.symmetric(horizontal: 13),
              decoration: BoxDecoration(
                color: on ? k.ember : k.surface.withValues(alpha: 0.82),
                borderRadius: BorderRadius.circular(17),
                border: Border.all(color: on ? k.ember : k.line),
                boxShadow: on ? [BoxShadow(color: k.ember.withValues(alpha: 0.4), offset: const Offset(0, 6), blurRadius: 14, spreadRadius: -8)] : null,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[Icon(icon, size: 14, color: on ? k.onEmber : k.fg2), const SizedBox(width: 5)],
                  Text(
                    labels[i],
                    style: context.text.label.copyWith(fontWeight: FontWeight.w600, fontSize: 13, color: on ? k.onEmber : k.fg2),
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

/// The compact search pill (web: h-9 rounded-full, search icon, clear button).
class KSearchField extends StatefulWidget {
  const KSearchField({super.key, required this.onChanged, this.placeholder, this.initial = '', this.clearLabel, this.autofocus = false});
  final ValueChanged<String> onChanged;
  final String? placeholder;
  final String initial;
  final String? clearLabel;
  final bool autofocus;

  @override
  State<KSearchField> createState() => _KSearchFieldState();
}

class _KSearchFieldState extends State<KSearchField> {
  late final TextEditingController _c = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: k.line),
      ),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 13, end: 4),
            child: Icon(LucideIcons.search, size: 15, color: k.fg3),
          ),
          Expanded(
            child: TextField(
              controller: _c,
              autofocus: widget.autofocus,
              onChanged: (v) {
                setState(() {});
                widget.onChanged(v);
              },
              textInputAction: TextInputAction.search,
              autocorrect: false,
              style: context.text.callout.copyWith(fontSize: 14),
              cursorColor: k.ember,
              decoration: InputDecoration(
                isCollapsed: true,
                border: InputBorder.none,
                hintText: widget.placeholder ?? context.t('common.searchPlaceholder'),
                hintStyle: context.text.callout.copyWith(fontSize: 14, color: k.fg3),
                contentPadding: const EdgeInsets.symmetric(horizontal: 6, vertical: 11),
              ),
            ),
          ),
          if (_c.text.isNotEmpty)
            KPressable(
              semanticLabel: widget.clearLabel ?? context.t('common.reset'),
              minSize: 40,
              onTap: () {
                _c.clear();
                setState(() {});
                widget.onChanged('');
              },
              child: Icon(LucideIcons.x, size: 15, color: k.fg3),
            ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ details */

/// One label / value line of [KKeyValues].
class KKV {
  const KKV(this.label, this.value, {this.valueWidget, this.mono = false, this.tone});
  final String label;
  final String? value;
  final Widget? valueWidget;

  /// Figures, codes, addresses (Geist Mono, left to right).
  final bool mono;
  final Color? tone;
}

/// Label / value rows with hairlines (the web's definition lists in sheets and cards).
class KKeyValues extends StatelessWidget {
  const KKeyValues(this.rows, {super.key, this.dense = false});
  final List<KKV> rows;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final children = <Widget>[];
    for (var i = 0; i < rows.length; i++) {
      final r = rows[i];
      if (i > 0) children.add(const KDivider());
      final valueStyle = (r.mono ? context.text.mono(13, weight: FontWeight.w600) : context.text.callout.copyWith(fontWeight: FontWeight.w600)).copyWith(
        color: r.tone ?? k.fg,
        fontFeatures: kTabular,
      );
      children.add(
        Padding(
          padding: EdgeInsets.symmetric(vertical: dense ? 8 : 11),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(r.label, style: context.text.callout.copyWith(color: k.fg3)),
              ),
              const SizedBox(width: 12),
              Flexible(
                child: Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: r.valueWidget ?? Text(r.value ?? '—', textAlign: TextAlign.end, textDirection: r.mono ? TextDirection.ltr : null, style: valueStyle),
                ),
              ),
            ],
          ),
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: children);
  }
}

/// KStat tiles in a grid (2 columns on phones), e.g. a master's or a challenge's figures.
class KStatGrid extends StatelessWidget {
  const KStatGrid({super.key, required this.items, this.columns = 2, this.spacing = 14});
  final List<(String label, Widget value)> items;
  final int columns;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < items.length; i += columns) {
      if (i > 0) rows.add(SizedBox(height: spacing));
      rows.add(
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var j = 0; j < columns; j++) ...[
              if (j > 0) SizedBox(width: spacing),
              Expanded(
                child: i + j < items.length ? KStat(label: items[i + j].$1, value: items[i + j].$2) : const SizedBox.shrink(),
              ),
            ],
          ],
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows);
  }
}

/// A soft tinted callout with an icon (web info / warning / risk notes).
class KNotice extends StatelessWidget {
  const KNotice({super.key, required this.text, this.title, this.tone = KChipTone.info, this.icon, this.action});
  final String text;
  final String? title;
  final KChipTone tone;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = context.k.chip(tone);
    final k = context.k;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon ??
                switch (tone) {
                  KChipTone.warn || KChipTone.down => LucideIcons.triangleAlert,
                  KChipTone.up => LucideIcons.circleCheck,
                  _ => LucideIcons.info,
                },
            size: 17,
            color: fg,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) ...[
                  Text(
                    title!,
                    style: context.text.label.copyWith(fontWeight: FontWeight.w700, color: k.fg),
                  ),
                  const SizedBox(height: 2),
                ],
                Text(text, style: context.text.footnote.copyWith(color: k.fg2, height: 1.45)),
                if (action != null) ...[const SizedBox(height: 8), action!],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ progress, slider */

/// A thin rounded progress bar (0..1).
class KProgressBar extends StatelessWidget {
  const KProgressBar({super.key, required this.value, this.color, this.height = 6, this.track});
  final double value;
  final Color? color;
  final double height;
  final Color? track;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final v = value.isFinite ? value.clamp(0.0, 1.0) : 0.0;
    return ClipRRect(
      borderRadius: BorderRadius.circular(height / 2),
      child: SizedBox(
        height: height,
        child: Stack(
          children: [
            Positioned.fill(child: ColoredBox(color: track ?? k.surface3)),
            FractionallySizedBox(
              widthFactor: v,
              alignment: AlignmentDirectional.centerStart,
              child: Container(
                decoration: BoxDecoration(color: color ?? k.ember, borderRadius: BorderRadius.circular(height / 2)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// An iOS slider in the brand colour (web range inputs: rebate / split sliders, risk settings).
class KSlider extends StatelessWidget {
  const KSlider({super.key, required this.value, required this.onChanged, this.min = 0, this.max = 100, this.divisions, this.onChangeEnd});
  final double value;
  final ValueChanged<double>? onChanged;
  final ValueChanged<double>? onChangeEnd;
  final double min, max;
  final int? divisions;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return SizedBox(
      height: 44,
      child: CupertinoSlider(
        value: value.clamp(min, max),
        min: min,
        max: max,
        divisions: divisions,
        activeColor: k.ember,
        onChanged: onChanged == null
            ? null
            : (v) {
                if (divisions != null) KHaptics.selection();
                onChanged!(v);
              },
        onChangeEnd: onChangeEnd,
      ),
    );
  }
}

/* ------------------------------------------------------------------ charts */

/// A tiny trend line (web Sparkline): green when it ends higher, red when lower.
class KSparkline extends StatelessWidget {
  const KSparkline(this.data, {super.key, this.width = 96, this.height = 28, this.color, this.fill = true});
  final List<double> data;
  final double width, height;
  final Color? color;
  final bool fill;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final c = color ?? (data.length > 1 && data.last < data.first ? k.down : k.up);
    return SizedBox(
      width: width,
      height: height,
      child: data.length < 2 ? null : CustomPaint(painter: _LinePainter(data, c, fill: fill, stroke: 1.6)),
    );
  }
}

/// A horizontal guide line on [KLineChart] (targets, loss limits, the zero line).
class KChartGuide {
  const KChartGuide(this.value, {this.color, this.label});
  final double value;
  final Color? color;
  final String? label;
}

/// An area line chart (equity curves, growth, earnings): optional guides, the first / last labels under it and a
/// touch read-out (`format` formats the value under the finger).
class KLineChart extends StatefulWidget {
  const KLineChart({
    super.key,
    required this.values,
    this.labels,
    this.height = 160,
    this.color,
    this.guides = const [],
    this.format,
    this.fill = true,
    this.includeZero = false,
  });
  final List<double> values;

  /// One label per value (dates); the first and last are shown under the chart.
  final List<String>? labels;
  final double height;
  final Color? color;
  final List<KChartGuide> guides;
  final String Function(double v)? format;
  final bool fill;
  final bool includeZero;

  @override
  State<KLineChart> createState() => _KLineChartState();
}

class _KLineChartState extends State<KLineChart> {
  int? _touch;

  void _at(Offset p, double w) {
    final n = widget.values.length;
    if (n < 2) return;
    final i = ((p.dx / w) * (n - 1)).round().clamp(0, n - 1);
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final idx = rtl ? n - 1 - i : i;
    if (idx != _touch) {
      KHaptics.selection();
      setState(() => _touch = idx);
    }
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final v = widget.values;
    final c = widget.color ?? (v.length > 1 && v.last < v.first ? k.down : k.up);
    final labels = widget.labels;
    final touch = _touch;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.format != null)
          SizedBox(
            height: 20,
            child: touch == null || touch >= v.length
                ? null
                : Text(
                    '${labels != null && touch < labels.length ? '${labels[touch]} · ' : ''}${widget.format!(v[touch])}',
                    style: context.text.caption.copyWith(color: k.fg2, fontFeatures: kTabular),
                  ),
          ),
        LayoutBuilder(
          builder: (context, cons) => GestureDetector(
            behavior: HitTestBehavior.opaque,
            onHorizontalDragStart: (d) => _at(d.localPosition, cons.maxWidth),
            onHorizontalDragUpdate: (d) => _at(d.localPosition, cons.maxWidth),
            onHorizontalDragEnd: (_) => setState(() => _touch = null),
            onTapDown: (d) => _at(d.localPosition, cons.maxWidth),
            onTapUp: (_) => setState(() => _touch = null),
            child: SizedBox(
              height: widget.height,
              width: cons.maxWidth,
              child: v.length < 2
                  ? Center(
                      child: Text(context.t('common.noData'), style: context.text.footnote.copyWith(color: k.fg3)),
                    )
                  : Directionality(
                      textDirection: TextDirection.ltr,
                      child: CustomPaint(
                        painter: _LinePainter(
                          v,
                          c,
                          fill: widget.fill,
                          guides: widget.guides,
                          guideColor: k.fg3,
                          includeZero: widget.includeZero,
                          touch: touch,
                          dotFill: k.surface,
                        ),
                      ),
                    ),
            ),
          ),
        ),
        if (labels != null && labels.length > 1) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              Text(labels.first, style: context.text.caption.copyWith(color: k.fg3)),
              const Spacer(),
              Text(labels.last, style: context.text.caption.copyWith(color: k.fg3)),
            ],
          ),
        ],
      ],
    );
  }
}

class _LinePainter extends CustomPainter {
  _LinePainter(
    this.data,
    this.color, {
    this.fill = true,
    this.stroke = 2,
    this.guides = const [],
    this.guideColor,
    this.includeZero = false,
    this.touch,
    this.dotFill,
  });
  final List<double> data;
  final Color color;
  final bool fill;
  final double stroke;
  final List<KChartGuide> guides;
  final Color? guideColor;
  final bool includeZero;
  final int? touch;
  final Color? dotFill;

  @override
  void paint(Canvas canvas, Size size) {
    var lo = data.reduce(math.min), hi = data.reduce(math.max);
    for (final g in guides) {
      lo = math.min(lo, g.value);
      hi = math.max(hi, g.value);
    }
    if (includeZero) {
      lo = math.min(lo, 0);
      hi = math.max(hi, 0);
    }
    if (hi - lo < 1e-12) {
      hi += 1;
      lo -= 1;
    }
    final pad = stroke + 2;
    double y(double v) => pad + (1 - (v - lo) / (hi - lo)) * (size.height - 2 * pad);
    double x(int i) => i / (data.length - 1) * size.width;
    final path = Path()..moveTo(x(0), y(data[0]));
    for (var i = 1; i < data.length; i++) {
      path.lineTo(x(i), y(data[i]));
    }
    for (final g in guides) {
      final gp = Paint()
        ..color = (g.color ?? guideColor ?? color).withValues(alpha: 0.7)
        ..strokeWidth = 1;
      final gy = y(g.value);
      for (double gx = 0; gx < size.width; gx += 7) {
        canvas.drawLine(Offset(gx, gy), Offset(math.min(gx + 4, size.width), gy), gp);
      }
    }
    if (fill) {
      final area = Path.from(path)
        ..lineTo(size.width, size.height)
        ..lineTo(0, size.height)
        ..close();
      canvas.drawPath(
        area,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [color.withValues(alpha: 0.22), color.withValues(alpha: 0)],
          ).createShader(Offset.zero & size),
      );
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round,
    );
    final ti = touch;
    if (ti != null && ti >= 0 && ti < data.length) {
      final p = Offset(x(ti), y(data[ti]));
      canvas.drawLine(
        Offset(p.dx, 0),
        Offset(p.dx, size.height),
        Paint()
          ..color = color.withValues(alpha: 0.35)
          ..strokeWidth = 1,
      );
      canvas.drawCircle(p, 4.5, Paint()..color = dotFill ?? Colors.white);
      canvas.drawCircle(
        p,
        4.5,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
    }
  }

  @override
  bool shouldRepaint(_LinePainter old) => old.data != data || old.color != color || old.touch != touch || old.guides != guides;
}

/// Column bars (monthly returns, daily P&L, earnings): green above zero, red below; labels under the first and last.
class KBarChart extends StatelessWidget {
  const KBarChart({super.key, required this.values, this.labels, this.height = 140, this.color, this.negativeColor, this.highlightLast = false});
  final List<double> values;
  final List<String>? labels;
  final double height;

  /// One colour for every bar (default: up / down by sign).
  final Color? color;
  final Color? negativeColor;
  final bool highlightLast;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final labels = this.labels;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: height,
          child: values.isEmpty
              ? Center(
                  child: Text(context.t('common.noData'), style: context.text.footnote.copyWith(color: k.fg3)),
                )
              : CustomPaint(
                  painter: _BarPainter(
                    values,
                    color ?? k.up,
                    negativeColor ?? (color ?? k.down),
                    k.line,
                    highlightLast,
                    Directionality.of(context) == TextDirection.rtl,
                  ),
                ),
        ),
        if (labels != null && labels.isNotEmpty) ...[
          const SizedBox(height: 6),
          Row(
            children: [
              Text(labels.first, style: context.text.caption.copyWith(color: k.fg3)),
              const Spacer(),
              if (labels.length > 1) Text(labels.last, style: context.text.caption.copyWith(color: k.fg3)),
            ],
          ),
        ],
      ],
    );
  }
}

class _BarPainter extends CustomPainter {
  _BarPainter(this.values, this.pos, this.neg, this.axis, this.highlightLast, this.rtl);
  final List<double> values;
  final Color pos, neg, axis;
  final bool highlightLast, rtl;

  @override
  void paint(Canvas canvas, Size size) {
    final hi = math.max(0.0, values.reduce(math.max));
    final lo = math.min(0.0, values.reduce(math.min));
    final span = (hi - lo) < 1e-12 ? 1.0 : hi - lo;
    final zero = size.height * hi / span;
    final n = values.length;
    final slot = size.width / n;
    final w = math.max(2.0, math.min(18.0, slot * 0.62));
    canvas.drawLine(
      Offset(0, zero),
      Offset(size.width, zero),
      Paint()
        ..color = axis
        ..strokeWidth = 1,
    );
    for (var i = 0; i < n; i++) {
      final v = values[i];
      final h = (v.abs() / span) * size.height;
      final cx = (rtl ? n - 1 - i : i) * slot + slot / 2;
      final rect = v >= 0 ? Rect.fromLTWH(cx - w / 2, zero - h, w, h) : Rect.fromLTWH(cx - w / 2, zero, w, h);
      final faded = highlightLast && i != n - 1;
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, Radius.circular(math.min(4, w / 2))),
        Paint()..color = (v >= 0 ? pos : neg).withValues(alpha: faded ? 0.45 : 0.9),
      );
    }
  }

  @override
  bool shouldRepaint(_BarPainter old) => old.values != values || old.pos != pos;
}

/// A donut of parts (allocations, tiers, split): `segments` as (value, colour); `center` sits in the hole.
class KDonut extends StatelessWidget {
  const KDonut({super.key, required this.segments, this.size = 120, this.thickness = 14, this.center});
  final List<(double value, Color color)> segments;
  final double size, thickness;
  final Widget? center;

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: size,
    child: CustomPaint(
      painter: _DonutPainter(segments, thickness, context.k.surface3),
      child: center == null ? null : Center(child: center),
    ),
  );
}

class _DonutPainter extends CustomPainter {
  _DonutPainter(this.segments, this.thickness, this.track);
  final List<(double, Color)> segments;
  final double thickness;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(thickness / 2, thickness / 2, size.width - thickness, size.height - thickness);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = thickness
      ..color = track;
    canvas.drawArc(rect, 0, math.pi * 2, false, base);
    final total = segments.fold<double>(0, (s, e) => s + math.max(0, e.$1));
    if (total <= 0) return;
    var start = -math.pi / 2;
    for (final (v, c) in segments) {
      if (v <= 0) continue;
      final sweep = v / total * math.pi * 2;
      canvas.drawArc(
        rect,
        start,
        math.max(0.0001, sweep - (segments.length > 1 ? 0.04 : 0)),
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = thickness
          ..strokeCap = StrokeCap.butt
          ..color = c,
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) => true;
}

/* ------------------------------------------------------------------ time, codes */

/// Ticks down to `until`: "2d 04:12:33" (or "04:12:33" under a day); `ended` when it passed.
class KCountdown extends StatefulWidget {
  const KCountdown({super.key, required this.until, this.style, this.ended});
  final DateTime until;
  final TextStyle? style;
  final String? ended;

  /// "2d 04:12:33".
  static String format(Duration d) {
    if (d.isNegative) d = Duration.zero;
    String two(int n) => n.toString().padLeft(2, '0');
    final days = d.inDays;
    final hms = '${two(d.inHours % 24)}:${two(d.inMinutes % 60)}:${two(d.inSeconds % 60)}';
    return days > 0 ? '${days}d $hms' : hms;
  }

  @override
  State<KCountdown> createState() => _KCountdownState();
}

class _KCountdownState extends State<KCountdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final left = widget.until.difference(DateTime.now());
    final text = left.isNegative && widget.ended != null ? widget.ended! : KCountdown.format(left);
    return Text(
      text,
      textDirection: TextDirection.ltr,
      style: (widget.style ?? context.text.figure).copyWith(fontFeatures: kTabular),
    );
  }
}

/// A QR code on a white rounded tile (scannable in dark mode too).
class KQrCode extends StatelessWidget {
  const KQrCode(this.data, {super.key, this.size = 180, this.dark = false});
  final String data;
  final double size;

  /// White modules on near-black (web QR_COLORS.dark).
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final fg = dark ? Colors.white : const Color(0xFF0B0B0E);
    final bg = dark ? const Color(0xFF111114) : Colors.white;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.k.line),
      ),
      child: QrImageView(
        data: data,
        size: size,
        padding: EdgeInsets.zero,
        backgroundColor: bg,
        errorCorrectionLevel: QrErrorCorrectLevel.M,
        eyeStyle: QrEyeStyle(eyeShape: QrEyeShape.square, color: fg),
        dataModuleStyle: QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: fg),
      ),
    );
  }
}

/* ------------------------------------------------------------------ sheets, pickers */

/// A sheet body: the content scrolls, the footer (the sheet's primary action) stays at the bottom.
class KSheetContent extends StatelessWidget {
  const KSheetContent({super.key, required this.children, this.footer, this.padding = const EdgeInsets.fromLTRB(20, 4, 20, 16)});
  final List<Widget> children;
  final Widget? footer;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Flexible(
        child: SingleChildScrollView(
          padding: padding,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: children),
        ),
      ),
      if (footer != null)
        Container(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: context.k.line, width: 0.6)),
          ),
          child: footer,
        ),
    ],
  );
}

/// One choice of [showKPicker].
class KPickOption<V> {
  const KPickOption(this.value, this.label, {this.subtitle, this.leading, this.enabled = true});
  final V value;
  final String label;
  final String? subtitle;
  final Widget? leading;
  final bool enabled;
}

/// Choose one value in a sheet (the web's <select>): returns the chosen value, or null when closed.
Future<V?> showKPicker<V>(BuildContext context, {required String title, required List<KPickOption<V>> options, V? selected}) => showKSheet<V>(
  context,
  title: title,
  builder: (ctx) => SingleChildScrollView(
    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
    child: KListSection(
      margin: EdgeInsets.zero,
      children: [
        for (final o in options)
          KListRow(
            title: o.label,
            subtitle: o.subtitle,
            leading: o.leading,
            selected: o.value == selected,
            trailing: o.value == selected ? Icon(LucideIcons.check, size: 18, color: ctx.k.ember) : null,
            chevron: false,
            onTap: o.enabled ? () => Navigator.of(ctx).pop(o.value) : null,
          ),
      ],
    ),
  ),
);

/// A form field that opens [showKPicker] (looks like KTextField: label above, value, chevron).
class KPickerField extends StatelessWidget {
  const KPickerField({super.key, this.label, required this.value, required this.onTap, this.placeholder, this.leading, this.error});
  final String? label;
  final String? value;
  final String? placeholder;
  final VoidCallback? onTap;
  final Widget? leading;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final hasError = error != null && error!.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(label!, style: context.text.label.copyWith(color: k.fg2)),
          ),
        KPressable(
          onTap: onTap,
          pressedScale: 1,
          child: Container(
            height: KSize.field,
            padding: const EdgeInsetsDirectional.only(start: 13, end: 10),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: hasError ? k.down.withValues(alpha: 0.6) : k.line),
            ),
            child: Row(
              children: [
                if (leading != null) ...[leading!, const SizedBox(width: 10)],
                Expanded(
                  child: Text(
                    value ?? placeholder ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.body.copyWith(fontSize: 14.5, color: value == null ? k.fg3 : k.fg),
                  ),
                ),
                Icon(LucideIcons.chevronsUpDown, size: 16, color: k.fg3),
              ],
            ),
          ),
        ),
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(error!, style: context.text.footnote.copyWith(color: k.down)),
          ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ copy, share */

/// Copies `text` and confirms with the "Copied" banner (web copy buttons + toast).
Future<void> kCopy(BuildContext context, String text, {String? message}) async {
  await Clipboard.setData(ClipboardData(text: text));
  KHaptics.success();
  if (!context.mounted) return;
  ProviderScope.containerOf(
    context,
    listen: false,
  ).read(notificationsProvider.notifier).toast(NotificationKind.success, message ?? context.t('common.copiedToClipboard'), keep: false);
}

/// The system share sheet with `text` (and an optional subject); falls back to copying where sharing is missing.
Future<void> kShare(BuildContext context, String text, {String? subject}) async {
  try {
    await SharePlus.instance.share(ShareParams(text: text, subject: subject));
  } catch (_) {
    if (context.mounted) await kCopy(context, text);
  }
}
