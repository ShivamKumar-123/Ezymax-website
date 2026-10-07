import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';
import 'pressable.dart';

/// Button looks, as on the web (packages/ui Button + the Client Area's .k-accent-btn / .k-ink-btn / .k-surface-btn).
/// One saturated primary (`ember`) per screen; `ink` is the near-black money action (Deposit / Withdraw).
enum KButtonVariant { ember, ink, surface, ghost, outline, danger, buy, sell }

/// Compact sizes: sm 32, md 40, lg 44 (the full-width primary). Every size keeps a 44 pt touch target.
enum KButtonSize { sm, md, lg }

class KButton extends StatelessWidget {
  const KButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.trailingIcon,
    this.variant = KButtonVariant.ember,
    this.size = KButtonSize.md,
    this.expand = false,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final IconData? trailingIcon;
  final KButtonVariant variant;
  final KButtonSize size;

  /// Full width (forms, sheets).
  final bool expand;

  /// Shows a spinner instead of the icon and ignores taps.
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final disabled = onPressed == null || loading;
    final (Color bg, Color fg, Color? border, List<BoxShadow>? shadow) = switch (variant) {
      KButtonVariant.ember => (
        k.ember,
        k.onEmber,
        null,
        [BoxShadow(color: k.ember.withValues(alpha: 0.45), offset: const Offset(0, 10), blurRadius: 22, spreadRadius: -12)],
      ),
      KButtonVariant.ink => (
        k.ink,
        k.inkFg,
        null,
        [
          BoxShadow(
            color: Colors.black.withValues(alpha: k.dark ? 0.3 : 0.35),
            offset: const Offset(0, 14),
            blurRadius: 28,
            spreadRadius: -16,
          ),
        ],
      ),
      KButtonVariant.surface => (k.surface, k.fg, k.line, const [BoxShadow(color: Color(0x0A301C40), offset: Offset(0, 1), blurRadius: 2)]),
      KButtonVariant.ghost => (Colors.transparent, k.fg2, null, null),
      KButtonVariant.outline => (Colors.transparent, k.fg, k.line, null),
      KButtonVariant.danger => (k.downSoft, k.down, k.down.withValues(alpha: 0.25), null),
      KButtonVariant.buy => (k.buyFill, Colors.white, null, null),
      KButtonVariant.sell => (k.sellFill, Colors.white, null, null),
    };
    final (double h, double pad, double fs, double iconSize) = switch (size) {
      KButtonSize.sm => (KSize.buttonSm, 14.0, 13.0, 15.0),
      KButtonSize.md => (KSize.buttonMd, 18.0, 14.0, 17.0),
      KButtonSize.lg => (KSize.buttonLg, 22.0, 15.0, 18.0),
    };
    final style = context.text.headline.copyWith(fontSize: fs, color: fg, height: 1.1);
    final lead = loading
        ? SizedBox.square(
            dimension: iconSize - 2,
            child: CupertinoActivityIndicator(color: fg, radius: (iconSize - 4) / 2),
          )
        : (icon != null ? Icon(icon, size: iconSize, color: fg) : null);
    final content = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (lead != null) ...[lead, const SizedBox(width: 7)],
        Flexible(
          child: Text(label, style: style, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
        ),
        if (trailingIcon != null) ...[const SizedBox(width: 7), Icon(trailingIcon, size: iconSize, color: fg)],
      ],
    );
    final box = AnimatedOpacity(
      duration: const Duration(milliseconds: 150),
      opacity: disabled && !loading ? 0.45 : 1,
      child: Container(
        height: h,
        width: expand ? double.infinity : null,
        padding: EdgeInsets.symmetric(horizontal: pad),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(h / 2),
          border: border == null ? null : Border.all(color: border),
          boxShadow: disabled ? null : shadow,
        ),
        child: content,
      ),
    );
    return KPressable(onTap: disabled ? null : onPressed, semanticLabel: label, child: box);
  }
}

/// A round icon button (bars, cards): 40 pt visual, 44 pt touch target, optional unread badge.
class KIconButton extends StatelessWidget {
  const KIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    required this.semanticLabel,
    this.badge,
    this.size = KSize.iconButton,
    this.filled = false,
    this.color,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final String semanticLabel;

  /// Unread count shown as an ember badge (99+ max), like the web bell.
  final int? badge;
  final double size;

  /// A surface-filled circle (k-surface-btn) instead of a bare glyph.
  final bool filled;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final glyph = Icon(icon, size: size * 0.48, color: color ?? k.fg2);
    Widget circle = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: filled
          ? BoxDecoration(
              color: k.surface,
              shape: BoxShape.circle,
              border: Border.all(color: k.line),
              boxShadow: const [BoxShadow(color: Color(0x0A301C40), offset: Offset(0, 1), blurRadius: 2)],
            )
          : null,
      child: glyph,
    );
    if (badge != null && badge! > 0) {
      circle = Stack(
        clipBehavior: Clip.none,
        children: [
          circle,
          PositionedDirectional(
            top: -2,
            end: -2,
            child: Container(
              constraints: const BoxConstraints(minWidth: 18),
              height: 18,
              padding: const EdgeInsets.symmetric(horizontal: 4),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: k.ember,
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: k.bg, width: 2),
              ),
              child: Text(
                badge! > 99 ? '99+' : '$badge',
                style: context.text.micro.copyWith(color: k.onEmber, fontSize: 9.5, height: 1, fontFeatures: kTabular),
              ),
            ),
          ),
        ],
      );
    }
    return KPressable(onTap: onPressed, semanticLabel: semanticLabel, child: circle);
  }
}

/// A text link button ("Forgot password?", "Mark all read").
class KTextButton extends StatelessWidget {
  const KTextButton({super.key, required this.label, required this.onPressed, this.color, this.style});
  final String label;
  final VoidCallback? onPressed;
  final Color? color;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final s = (style ?? context.text.label.copyWith(fontWeight: FontWeight.w600)).copyWith(color: onPressed == null ? k.fg3 : (color ?? k.ember));
    return KPressable(
      onTap: onPressed,
      semanticLabel: label,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Text(label, style: s),
      ),
    );
  }
}
