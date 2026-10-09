// Shared pieces of the staking pages: the load error card, the inline error with its next step (verify, deposit),
// the soft row, the small grey label, label / value tiles two per row, the header's pill button, the status chip and
// a plan's disclosure box.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/config/app_config.dart';
import '../../../i18n/i18n.dart';
import '../../../shell/nav.dart';
import '../../../ui/ui.dart';
import '../staking_api.dart';

IconData stakingArrowEnd(BuildContext context) => Directionality.of(context) == TextDirection.rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight;

/// Space between the blocks of a page.
const Widget stakingGap = SizedBox(height: 16);

/* ------------------------------------------------------------------ errors */

/// A page block that couldn't load: the connection art, the reason (`text`, else the staking error text) and Try again.
class StakingLoadError extends StatelessWidget {
  const StakingLoadError({super.key, required this.error, required this.onRetry, this.text});
  final Object? error;
  final VoidCallback onRetry;
  final String? text;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return KCard(
      child: KEmptyState(
        compact: true,
        art: KIllustrationName.connectionLost,
        title: t('common.error'),
        text: text ?? stakingErrorText(error, t),
        action: KButton(label: t('common.retry'), icon: LucideIcons.rotateCw, variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: onRetry),
      ),
    );
  }
}

/// A refused subscription with its next step when there is one (Verify identity, Deposit); the wallet still confirming
/// is information, not an error.
class StakingErrorNote extends ConsumerWidget {
  const StakingErrorNote({super.key, required this.error, this.onNavigate});
  final Object? error;

  /// Opens a link of the note (default: context.go); sheets close themselves first.
  final void Function(String href)? onNavigate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (error == null) return const SizedBox.shrink();
    final t = context.t;
    final link = kStakingErrorLink[stakingErrorCode(error)];
    final linkOn = link != null && pageOn(ref.watch(configProvider), link.$1);
    final soft = stakingErrorSoft(error);
    return KNotice(
      tone: soft ? KChipTone.info : KChipTone.down,
      icon: soft ? LucideIcons.hourglass : LucideIcons.triangleAlert,
      text: stakingErrorText(error, t),
      action: !linkOn
          ? null
          : KButton(
              label: t(link.$2),
              trailingIcon: stakingArrowEnd(context),
              variant: KButtonVariant.surface,
              size: KButtonSize.sm,
              onPressed: () => onNavigate != null ? onNavigate!(link.$1) : context.go(link.$1),
            ),
    );
  }
}

/* ------------------------------------------------------------------ small bits */

/// A soft rounded box on a card (the web's .k-row).
class StakingRow extends StatelessWidget {
  const StakingRow({super.key, required this.child, this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 12), this.color, this.border});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final Color? border;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? k.surface2.withValues(alpha: k.dark ? 0.7 : 0.75),
        borderRadius: BorderRadius.circular(k.rowRadius),
        border: Border.all(color: border ?? k.line),
      ),
      child: child,
    );
  }
}

/// A small grey heading above a block (the web's .k-label).
class StakingLabel extends StatelessWidget {
  const StakingLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: context.text.caption.copyWith(color: context.k.fg3, fontWeight: FontWeight.w600),
  );
}

/// A label / value tile with an optional line under the value.
class StakingTile extends StatelessWidget {
  const StakingTile({super.key, required this.label, required this.value, this.sub, this.tone, this.icon});
  final String label;
  final String value;
  final String? sub;
  final Color? tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return StakingRow(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              if (icon != null) ...[Icon(icon, size: 14, color: k.fg3), const SizedBox(width: 6)],
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Text(value, style: context.text.figure.copyWith(fontSize: 17, color: tone ?? k.fg)),
          ),
          if (sub != null) ...[
            const SizedBox(height: 2),
            Text(
              sub!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: context.text.caption.copyWith(color: k.fg3, fontSize: 11, fontWeight: FontWeight.w400),
            ),
          ],
        ],
      ),
    );
  }
}

/// Items two per row, each pair as tall as its taller item.
class StakingGrid extends StatelessWidget {
  const StakingGrid({super.key, required this.children, this.gap = 8});
  final List<Widget> children;
  final double gap;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (var i = 0; i < children.length; i += 2) ...[
        if (i > 0) SizedBox(height: gap),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: children[i]),
              SizedBox(width: gap),
              Expanded(child: i + 1 < children.length ? children[i + 1] : const SizedBox.shrink()),
            ],
          ),
        ),
      ],
    ],
  );
}

/// The header's surface pill (My staking, Browse plans) with an optional count chip.
class StakingHeaderButton extends StatelessWidget {
  const StakingHeaderButton({super.key, required this.label, required this.icon, required this.onTap, this.count = 0});
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final int count;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return KPressable(
      onTap: onTap,
      semanticLabel: label,
      child: Container(
        height: KSize.buttonMd,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: k.surface,
          borderRadius: BorderRadius.circular(KSize.buttonMd / 2),
          border: Border.all(color: k.line),
          boxShadow: const [BoxShadow(color: Color(0x0A301C40), offset: Offset(0, 1), blurRadius: 2)],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 17, color: k.fg),
            const SizedBox(width: 7),
            Text(label, style: context.text.headline.copyWith(fontSize: 14, height: 1.1)),
            if (count > 0) ...[const SizedBox(width: 8), KChip(label: '$count', tone: KChipTone.ember, small: true)],
          ],
        ),
      ),
    );
  }
}

/// A position's status chip (Active, Awaiting payment, Payment failed, Matured).
class StakingStatusChip extends StatelessWidget {
  const StakingStatusChip(this.status, {super.key});
  final String status;

  @override
  Widget build(BuildContext context) =>
      KChip(label: stakingStatusLabel(context.t, status), tone: stakingStatusTone(status), small: true, dot: status == 'active');
}

/// A plan's own disclosure under "Plan disclosure", then the general risk text.
class StakingDisclosure extends StatelessWidget {
  const StakingDisclosure({super.key, required this.riskText});
  final String riskText;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: k.surface2.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.shieldAlert, size: 15, color: k.warn),
              const SizedBox(width: 8),
              Expanded(
                child: Text(t('staking.risk.planTitle'), style: context.text.label.copyWith(fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          if (riskText.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(riskText.trim(), style: context.text.footnote.copyWith(color: k.fg2, height: 1.45)),
          ],
          const SizedBox(height: 8),
          Text(t('staking.risk.text'), style: context.text.footnote.copyWith(color: k.fg3, height: 1.45)),
        ],
      ),
    );
  }
}
