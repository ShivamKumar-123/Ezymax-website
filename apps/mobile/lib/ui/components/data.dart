import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/format/format.dart';
import '../illustrations.g.dart';
import '../tokens.dart';
import '../typography.dart';
import 'brand.dart';
import 'pressable.dart';
import 'surfaces.dart';

/// The signature Kalks number: money with dimmed decimals (`$54,208.11`, the `.11` dimmed), Latin digits, kept left-to-right
/// inside right-to-left text (web Money + .k-num).
class KMoney extends StatelessWidget {
  const KMoney(
    this.value, {
    super.key,
    this.currency = 'USD',
    this.decimals,
    this.signed = false,
    this.tone,
    this.style,
    this.dimDecimals = true,
    this.hidden = false,
  });

  final num value;
  final String currency;
  final int? decimals;
  final bool signed;

  /// Colour by sign: `up` / `down` fixed, or [KMoneyTone.auto].
  final KMoneyTone? tone;
  final TextStyle? style;
  final bool dimDecimals;

  /// "••••••" (the dashboard's hide-balances eye).
  final bool hidden;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final base = (style ?? context.text.figure).copyWith(fontFeatures: kTabular);
    final color = switch (tone) {
      KMoneyTone.up => k.up,
      KMoneyTone.down => k.down,
      KMoneyTone.auto => value > 0 ? k.up : (value < 0 ? k.down : base.color),
      null => base.color,
    };
    final s = base.copyWith(color: color);
    if (hidden) return Text('••••••', style: s, textDirection: TextDirection.ltr);
    final p = Fmt.moneyParts(value, currency: currency, decimals: decimals, signed: signed);
    return Text.rich(
      TextSpan(
        style: s,
        children: [
          TextSpan(text: '${p.sign}${p.prefix}${p.integer}'),
          if (p.fraction.isNotEmpty)
            TextSpan(
              text: '.${p.fraction}',
              style: dimDecimals ? TextStyle(color: (color ?? k.fg).withValues(alpha: 0.4)) : null,
            ),
          if (p.suffix.isNotEmpty) TextSpan(text: p.suffix),
        ],
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
      softWrap: false,
      overflow: TextOverflow.fade,
    );
  }
}

enum KMoneyTone { up, down, auto }

/// The change chip under the total balance (web ChangeChip): "+1.25%" on a soft green / red pill.
class KChangeChip extends StatelessWidget {
  const KChangeChip(this.text, {super.key, this.up = true});
  final String text;
  final bool up;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final fg = up ? k.up : k.down;
    return Container(
      height: 26,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(color: up ? k.upSoft : k.downSoft, borderRadius: BorderRadius.circular(13)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(up ? LucideIcons.trendingUp : LucideIcons.trendingDown, size: 14, color: fg),
          const SizedBox(width: 5),
          Text(
            text,
            textDirection: TextDirection.ltr,
            style: context.text.caption.copyWith(color: fg, fontWeight: FontWeight.w600, fontSize: 12, fontFeatures: kTabular),
          ),
        ],
      ),
    );
  }
}

/// A KPI card (web KpiCard): label and icon, a big value, then a footer strip with a chip and an arrow.
class KKpiCard extends StatelessWidget {
  const KKpiCard({super.key, required this.label, required this.value, this.icon, this.chip, this.footer, this.onTap, this.width});

  final String label;
  final Widget value;
  final IconData? icon;
  final Widget? chip;
  final Widget? footer;
  final VoidCallback? onTap;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final bottom = footer ?? chip;
    return SizedBox(
      width: width,
      child: KCard(
        padding: EdgeInsets.zero,
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 16, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    height: 36,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            label,
                            style: context.text.label.copyWith(color: k.fg2),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (icon != null)
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: k.surface2.withValues(alpha: 0.8),
                              shape: BoxShape.circle,
                              border: Border.all(color: k.line),
                            ),
                            child: Icon(icon, size: 16, color: k.fg2),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  DefaultTextStyle.merge(
                    style: context.text.moneyL,
                    child: FittedBox(fit: BoxFit.scaleDown, alignment: AlignmentDirectional.centerStart, child: value),
                  ),
                ],
              ),
            ),
            if (bottom != null || onTap != null)
              Container(
                padding: const EdgeInsets.fromLTRB(20, 10, 16, 10),
                decoration: BoxDecoration(
                  color: k.dark ? Colors.black.withValues(alpha: 0.2) : k.surface2.withValues(alpha: 0.8),
                  border: Border(top: BorderSide(color: k.line, width: 0.6)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Align(alignment: AlignmentDirectional.centerStart, child: bottom ?? const SizedBox.shrink()),
                    ),
                    if (onTap != null)
                      Icon(Directionality.of(context) == TextDirection.rtl ? LucideIcons.arrowUpLeft : LucideIcons.arrowUpRight, size: 16, color: k.fg3),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Empty and success states with the founder's illustrations (web EmptyState with `art`).
class KEmptyState extends StatelessWidget {
  const KEmptyState({super.key, required this.title, this.text, this.art, this.icon, this.action, this.compact = false});

  final String title;
  final String? text;
  final KIllustrationName? art;

  /// A pastel icon tile when there is no illustration.
  final IconData? icon;
  final Widget? action;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 24, vertical: compact ? 20 : 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (art != null)
            KIllustration(art!, width: compact ? 150 : 200, maxHeight: compact ? 110 : 150)
          else if (icon != null)
            KIconTile(icon: icon!, size: 56, tone: KTone.neutral),
          const SizedBox(height: 14),
          Text(title, textAlign: TextAlign.center, style: context.text.headline),
          if (text != null) ...[
            const SizedBox(height: 4),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 320),
              child: Text(
                text!,
                textAlign: TextAlign.center,
                style: context.text.footnote.copyWith(color: k.fg3),
              ),
            ),
          ],
          if (action != null) ...[const SizedBox(height: 18), action!],
        ],
      ),
    );
  }
}

/// A label / value pair in a grid of account details.
class KStat extends StatelessWidget {
  const KStat({super.key, required this.label, required this.value});
  final String label;
  final Widget value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(
        label,
        style: context.text.footnote.copyWith(color: context.k.fg3, fontSize: 12),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      const SizedBox(height: 4),
      DefaultTextStyle.merge(style: context.text.figure.copyWith(fontSize: 14.5), maxLines: 1, overflow: TextOverflow.ellipsis, child: value),
    ],
  );
}

/// A row in a list card: pastel tile, title / subtitle, value or chip at the end (web ListRow of the dashboard).
class KInfoRow extends StatelessWidget {
  const KInfoRow({
    super.key,
    required this.icon,
    required this.title,
    this.tone = KTone.accent,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.unread = false,
    this.tileSize = 44,
  });

  final IconData icon;
  final KTone tone;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool unread;
  final double tileSize;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KIconTile(icon: icon, tone: tone, size: tileSize),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.headline.copyWith(fontSize: 14, fontWeight: unread ? FontWeight.w700 : FontWeight.w600, color: unread ? k.fg : k.fg),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
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
          if (trailing != null) ...[const SizedBox(width: 10), trailing!],
        ],
      ),
    );
    return onTap == null ? row : KPressable(onTap: onTap, pressedScale: 1, child: row);
  }
}
