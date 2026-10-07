import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';
import 'pressable.dart';

/// The frosted card of the Client Area (web .k-card: radius 24, ~92 % white on the pastel washes, soft brand-tinted
/// shadow). `hot` adds the ember wash in the corner (.k-card-hot); `onTap` makes the whole card pressable.
class KCard extends StatelessWidget {
  const KCard({super.key, required this.child, this.padding = const EdgeInsets.all(KSpace.lg), this.hot = false, this.onTap, this.radius, this.color});

  final Widget child;
  final EdgeInsetsGeometry padding;
  final bool hot;
  final VoidCallback? onTap;
  final double? radius;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final r = BorderRadius.circular(radius ?? k.cardRadius);
    Widget card = Container(
      decoration: BoxDecoration(
        color: hot ? null : (color ?? k.cardBg),
        borderRadius: r,
        border: Border.all(color: hot ? Color.lerp(k.cardBorder, k.ember, 0.22)! : k.cardBorder),
        boxShadow: k.shadowCard,
        gradient: hot
            ? RadialGradient(
                center: const AlignmentDirectional(1, -1).resolve(Directionality.of(context)),
                radius: 1.2,
                colors: [k.ember.withValues(alpha: 0.16), k.ember.withValues(alpha: 0)],
                stops: const [0, 0.6],
              )
            : null,
      ),
      child: ClipRRect(
        borderRadius: r,
        child: Padding(padding: padding, child: child),
      ),
    );
    if (hot) {
      card = DecoratedBox(
        decoration: BoxDecoration(color: color ?? k.cardBg, borderRadius: r),
        child: card,
      );
    }
    return onTap == null ? card : KPressable(onTap: onTap, pressedOpacity: 0.85, child: card);
  }
}

/// Pastel icon tile (web .k-tile / IconTile): a rounded square (or circle) in a tone with its icon.
class KIconTile extends StatelessWidget {
  const KIconTile({super.key, required this.icon, this.tone = KTone.accent, this.size = 40, this.radius, this.circle = false, this.iconSize});

  final IconData icon;
  final KTone tone;
  final double size;
  final double? radius;
  final bool circle;
  final double? iconSize;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = context.k.tile(tone);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        shape: circle ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: circle ? null : BorderRadius.circular(radius ?? size * 0.3),
      ),
      child: Icon(icon, size: iconSize ?? size * 0.46, color: fg),
    );
  }
}

/// Status chip (web Chip): a soft-tinted pill with optional dot or icon. sm 20 / md 24 high.
class KChip extends StatelessWidget {
  const KChip({super.key, required this.label, this.tone = KChipTone.neutral, this.dot = false, this.icon, this.small = false});

  final String label;
  final KChipTone tone;
  final bool dot;
  final IconData? icon;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = context.k.chip(tone);
    final style = context.text.caption.copyWith(color: fg, fontSize: small ? 10.5 : 11.5, fontFeatures: kTabular, height: 1.1);
    return Container(
      height: small ? 20 : 24,
      padding: EdgeInsets.symmetric(horizontal: small ? 8 : 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
          ],
          if (icon != null) ...[Icon(icon, size: small ? 12 : 13, color: fg), const SizedBox(width: 5)],
          Flexible(
            child: Text(label, style: style, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );
  }
}

/// A hairline divider in the theme's line colour.
class KDivider extends StatelessWidget {
  const KDivider({super.key, this.indent = 0, this.vertical = false});
  final double indent;
  final bool vertical;

  @override
  Widget build(BuildContext context) {
    final c = context.k.line;
    return vertical
        ? Container(width: 0.6, color: c)
        : Padding(
            padding: EdgeInsetsDirectional.only(start: indent),
            child: Container(height: 0.6, color: c),
          );
  }
}

/// Section title above a block ("Your accounts", "Quick actions"), with an optional trailing action.
class KSectionTitle extends StatelessWidget {
  const KSectionTitle(this.title, {super.key, this.trailing, this.large = false, this.dot = false});
  final String title;
  final Widget? trailing;
  final bool large;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    final style = large ? context.text.title1 : context.text.title2;
    return Row(
      children: [
        Expanded(
          child: Row(
            children: [
              Flexible(
                child: Text(title, style: style, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
              if (dot) ...[
                const SizedBox(width: 8),
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(color: context.k.down, shape: BoxShape.circle),
                ),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 12), trailing!],
      ],
    );
  }
}

/// The page's large title and subtitle (web PageHeader).
class KPageHeader extends StatelessWidget {
  const KPageHeader({super.key, required this.title, this.subtitle, this.trailing});
  final String title;
  final Widget? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: context.text.largeTitle),
              if (subtitle != null) ...[
                const SizedBox(height: 6),
                DefaultTextStyle.merge(
                  style: context.text.body.copyWith(color: context.k.fg2),
                  child: subtitle!,
                ),
              ],
            ],
          ),
        ),
        ?trailing,
      ],
    );
  }
}
