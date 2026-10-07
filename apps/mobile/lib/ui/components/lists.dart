import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../tokens.dart';
import '../typography.dart';
import 'haptics.dart';
import 'pressable.dart';
import 'surfaces.dart';

/// An iOS inset-grouped section: optional header and footer, rows in one rounded card with hairlines between them.
class KListSection extends StatelessWidget {
  const KListSection({super.key, required this.children, this.header, this.footer, this.margin = const EdgeInsets.only(bottom: 22)});

  final List<Widget> children;
  final String? header;
  final String? footer;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) rows.add(const KDivider(indent: 16));
      rows.add(children[i]);
    }
    return Padding(
      padding: margin,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (header != null)
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(16, 0, 16, 7),
              child: Text(
                header!.toUpperCase(),
                style: context.text.caption.copyWith(color: k.fg3, letterSpacing: 0.4, fontWeight: FontWeight.w600),
              ),
            ),
          Container(
            decoration: BoxDecoration(
              color: k.cardBg,
              borderRadius: BorderRadius.circular(k.rowRadius + 2),
              border: Border.all(color: k.cardBorder),
              boxShadow: k.shadowCard,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(k.rowRadius + 2),
              child: Column(mainAxisSize: MainAxisSize.min, children: rows),
            ),
          ),
          if (footer != null)
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(16, 7, 16, 0),
              child: Text(footer!, style: context.text.footnote.copyWith(color: k.fg3)),
            ),
        ],
      ),
    );
  }
}

/// A row of a grouped list: leading tile or icon, title (and subtitle), a value, a chevron or any trailing widget.
/// `swipeActions` reveal buttons on a leading swipe (iOS mail style).
class KListRow extends StatelessWidget {
  const KListRow({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.value,
    this.trailing,
    this.onTap,
    this.chevron,
    this.destructive = false,
    this.selected = false,
    this.swipeActions = const [],
    this.dense = false,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;

  /// Grey text before the chevron ("English", "Light").
  final String? value;
  final Widget? trailing;
  final VoidCallback? onTap;

  /// Defaults to shown when the row navigates (has onTap and no trailing widget).
  final bool? chevron;
  final bool destructive;
  final bool selected;
  final List<KSwipeAction> swipeActions;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final showChevron = chevron ?? (onTap != null && trailing == null);
    final titleColor = destructive ? k.down : (selected ? k.ember : k.fg);
    Widget row = Container(
      constraints: BoxConstraints(minHeight: dense ? 44 : (subtitle == null ? KSize.row : 60)),
      padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 12, 8),
      color: Colors.transparent,
      child: Row(
        children: [
          if (leading != null) ...[leading!, const SizedBox(width: 12)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.headline.copyWith(fontSize: 14.5, fontWeight: FontWeight.w500, color: titleColor),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.footnote.copyWith(color: k.fg3),
                  ),
                ],
              ],
            ),
          ),
          if (value != null) ...[
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                value!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.end,
                style: context.text.callout.copyWith(color: k.fg3),
              ),
            ),
          ],
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
          if (showChevron) ...[
            const SizedBox(width: 4),
            Icon(rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight, size: 18, color: k.fg3.withValues(alpha: 0.7)),
          ],
        ],
      ),
    );
    if (onTap != null) row = KPressable(onTap: onTap, pressedScale: 1, pressedOpacity: 0.55, child: row);
    if (swipeActions.isNotEmpty) row = KSwipeable(actions: swipeActions, child: row);
    return row;
  }
}

/// One swipe action button.
class KSwipeAction {
  const KSwipeAction({required this.label, required this.icon, required this.onTap, this.color, this.destructive = false});
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;
  final bool destructive;
}

/// Reveals action buttons when the row is swiped towards the start (iOS trailing swipe actions). Snaps open or
/// closed; tapping an action closes the row and runs it. RTL-aware.
class KSwipeable extends StatefulWidget {
  const KSwipeable({super.key, required this.child, required this.actions, this.actionWidth = 76, this.background});
  final Widget child;
  final List<KSwipeAction> actions;
  final double actionWidth;

  /// The row's fill while it is swiped open (default: the surface colour).
  final Color? background;

  @override
  State<KSwipeable> createState() => _KSwipeableState();
}

class _KSwipeableState extends State<KSwipeable> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 240));
  double get _max => widget.actionWidth * widget.actions.length;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _drag(DragUpdateDetails d, bool rtl) {
    final dx = rtl ? d.primaryDelta! : -d.primaryDelta!;
    _c.value = (_c.value + dx / _max).clamp(0.0, 1.0);
  }

  void _end(DragEndDetails d, bool rtl) {
    final v = d.primaryVelocity ?? 0;
    final open = (rtl ? v > 300 : v < -300) || (v.abs() <= 300 && _c.value > 0.45);
    if (open && _c.value < 1) KHaptics.selection();
    _c.animateTo(open ? 1 : 0, curve: Curves.easeOutCubic);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.actions.isEmpty) return widget.child;
    final k = context.k;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return GestureDetector(
      onHorizontalDragUpdate: (d) => _drag(d, rtl),
      onHorizontalDragEnd: (d) => _end(d, rtl),
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, child) {
          final shift = _c.value * _max;
          return Stack(
            children: [
              Positioned.fill(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
                  children: [
                    for (final a in widget.actions)
                      SizedBox(
                        width: widget.actionWidth * _c.value,
                        child: ClipRect(
                          child: KPressable(
                            pressedScale: 1,
                            minSize: 0,
                            onTap: () {
                              _c.animateTo(0, curve: Curves.easeOutCubic);
                              a.onTap();
                            },
                            child: Container(
                              color: a.color ?? (a.destructive ? k.down : k.fg3),
                              alignment: Alignment.center,
                              child: OverflowBox(
                                maxWidth: widget.actionWidth,
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(a.icon, size: 18, color: Colors.white),
                                    const SizedBox(height: 3),
                                    Text(
                                      a.label,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: context.text.micro.copyWith(color: Colors.white, fontSize: 11),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Transform.translate(
                offset: Offset(rtl ? shift : -shift, 0),
                // opaque only while open, so a closed row shows the material it sits on
                child: ColoredBox(color: _c.value > 0 ? (widget.background ?? k.surface) : Colors.transparent, child: child),
              ),
            ],
          );
        },
        child: widget.child,
      ),
    );
  }
}
