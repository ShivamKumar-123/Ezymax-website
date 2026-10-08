// The wallet pages' shared pieces (port of apps/crm/components/wallet-live/ui.tsx): status chips, the network
// badge, explorer hash links, the confirmations bar, the KYC notice, the "wallet unavailable" card, activity rows,
// inline errors, the small figure tiles (k-row) and the amount field.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_error.dart';
import '../../../core/format/format.dart';
import '../../../core/models/user.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../wallet_api.dart';

/// Space between the page's blocks (web space-y-4).
const double kWalletGap = 16;

bool _rtl(BuildContext context) => Directionality.of(context) == TextDirection.rtl;

/// A status chip (web StatusTag: Chip size sm with a dot).
class WalletStatusChip extends StatelessWidget {
  const WalletStatusChip(this.status, {super.key});
  final WalletStatus status;

  @override
  Widget build(BuildContext context) => KChip(label: context.t(status.label), tone: status.tone, dot: true, small: true);
}

/// The USDT coin with the network's coin in the corner (web ChainBadge / the network pickers' icon).
class ChainCoin extends StatelessWidget {
  const ChainCoin(this.chain, {super.key, this.size = 32});
  final String chain;
  final double size;

  @override
  Widget build(BuildContext context) {
    final small = (size * 0.47).roundToDouble();
    return SizedBox(
      width: size + 3,
      height: size + 2,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          KCoinIcon('usdt', size: size),
          PositionedDirectional(
            bottom: -1,
            end: -1,
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: context.k.surface2, width: 2),
              ),
              child: KCoinIcon(chain == 'bsc' ? 'bnb' : 'trx', size: small),
            ),
          ),
        ],
      ),
    );
  }
}

/// A short transaction hash that opens the block explorer (web HashLink); "—" without a hash.
class HashLink extends StatelessWidget {
  const HashLink({super.key, required this.hash, this.url, this.size = 12});
  final String? hash;
  final String? url;
  final double size;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final h = hash;
    if (h == null || h.isEmpty) {
      return Text(
        '—',
        style: TextStyle(color: k.fg3, fontSize: size),
      );
    }
    final link = Row(
      mainAxisSize: MainAxisSize.min,
      textDirection: TextDirection.ltr,
      children: [
        // shrinks (cut with …) when the line is full, like the web's truncated row
        Flexible(
          child: Text(
            shortHash(h, 8, 6),
            maxLines: 1,
            softWrap: false,
            overflow: TextOverflow.ellipsis,
            style: context.text.mono(size, color: k.fg2),
          ),
        ),
        const SizedBox(width: 3),
        Icon(LucideIcons.externalLink, size: size, color: k.fg3),
      ],
    );
    final u = url == null ? null : Uri.tryParse(url!);
    if (u == null) return link;
    return KPressable(
      minSize: 28,
      pressedScale: 1,
      semanticLabel: h,
      onTap: () => unawaited(launchUrl(u, mode: LaunchMode.externalApplication)),
      child: link,
    );
  }
}

/// Confirmations x / y as a bar (web Confirmations).
class Confirmations extends StatelessWidget {
  const Confirmations({super.key, required this.confirmations, required this.required, required this.status});
  final int confirmations, required;
  final String status;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final done = status == 'credited';
    final shown = done ? required : (confirmations < required ? confirmations : required);
    final pct = done ? 1.0 : (required > 0 ? shown / required : 0.0);
    final right = done
        ? t('wallet.confirmations.complete')
        : (status == 'pending' ? t('wallet.confirmations.firstBlock') : t('wallet.confirmations.confirming'));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Expanded(
              child: KRichText(
                t('wallet.confirmations.progress', {'done': shown, 'required': required}),
                style: context.text.caption.copyWith(color: k.fg2, fontWeight: FontWeight.w400, fontSize: 12, fontFeatures: kTabular),
                tags: {
                  'num': KTag(
                    style: TextStyle(color: k.fg, fontWeight: FontWeight.w600, fontFeatures: kTabular),
                  ),
                },
              ),
            ),
            const SizedBox(width: 8),
            Text(
              right,
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 12),
            ),
          ],
        ),
        const SizedBox(height: 6),
        KProgressBar(value: pct, color: done ? k.up : k.ember),
      ],
    );
  }
}

/// "Verify your identity to withdraw" (web KycNotice); nothing once verified.
class KycNotice extends StatelessWidget {
  const KycNotice({super.key, required this.status, this.top = 0});
  final KycStatus status;

  /// Space above the notice when it shows.
  final double top;

  @override
  Widget build(BuildContext context) {
    final title = kycNoticeTitle(status);
    if (title == null) return const SizedBox.shrink();
    final t = context.t;
    final k = context.k;
    final pending = status == KycStatus.pending;
    return Padding(
      padding: EdgeInsets.only(top: top),
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        decoration: BoxDecoration(
          color: k.warnSoft,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: k.warn.withValues(alpha: 0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: k.warn.withValues(alpha: 0.15),
                    border: Border.all(color: k.warn.withValues(alpha: 0.4)),
                  ),
                  child: Icon(LucideIcons.idCard, size: 19, color: k.warn),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t(title), style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                      const SizedBox(height: 2),
                      Text(pending ? t('wallet.kyc.pendingText') : t('wallet.kyc.requiredText'), style: context.text.footnote.copyWith(color: k.fg2)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            KButton(
              label: pending ? t('wallet.kyc.viewVerification') : t('wallet.kyc.verifyNow'),
              icon: LucideIcons.shieldCheck,
              variant: KButtonVariant.surface,
              size: KButtonSize.sm,
              onPressed: () => context.go('/profile/verification'),
            ),
          ],
        ),
      ),
    );
  }
}

/// The wallet service couldn't be reached (web WalletUnavailable): the illustration, the reason, Try again.
class WalletUnavailable extends StatelessWidget {
  const WalletUnavailable({super.key, required this.onRetry, this.message});
  final VoidCallback onRetry;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return KCard(
      child: KEmptyState(
        art: KIllustrationName.connectionLost,
        title: t('wallet.unavailable.title'),
        text: message ?? t('wallet.unavailable.text'),
        action: KButton(label: t('common.retry'), icon: LucideIcons.rotateCw, variant: KButtonVariant.surface, onPressed: onRetry),
      ),
    );
  }
}

/// The message WalletUnavailable shows for a failed load: the server's reason for refusals (4xx), else the default.
String? unavailableMessage(Object? e, T t) => e is ApiException && e.status > 0 && e.status < 500 ? walletErrorText(e, t) : null;

/// An inline error box (web InlineError); nothing without text.
class WalletInlineError extends StatelessWidget {
  const WalletInlineError(this.text, {super.key, this.top = 0});
  final String? text;
  final double top;

  @override
  Widget build(BuildContext context) {
    final s = text;
    if (s == null || s.isEmpty) return const SizedBox.shrink();
    final k = context.k;
    return Padding(
      padding: EdgeInsets.only(top: top),
      child: Semantics(
        liveRegion: true,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 9, 12, 9),
          decoration: BoxDecoration(
            color: k.downSoft,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: k.down.withValues(alpha: 0.3)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(LucideIcons.circleAlert, size: 14, color: k.down),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(s, style: context.text.footnote.copyWith(color: k.fg)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The soft rounded row of the wallet pages (web .k-row): surface-2, radius 16; `selected` gives the ember outline
/// of the pickers, `onTap` makes it pressable.
class WalletRow extends StatelessWidget {
  const WalletRow({
    super.key,
    required this.child,
    this.onTap,
    this.selected = false,
    this.enabled = true,
    this.padding = const EdgeInsets.fromLTRB(14, 12, 14, 12),
  });
  final Widget child;
  final VoidCallback? onTap;
  final bool selected, enabled;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    Widget box = AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: selected ? k.emberSoft : k.surface2,
        borderRadius: BorderRadius.circular(k.rowRadius),
        border: Border.all(color: selected ? k.ember.withValues(alpha: 0.6) : Colors.transparent),
      ),
      child: child,
    );
    if (!enabled) box = Opacity(opacity: 0.5, child: box);
    return onTap == null || !enabled ? box : KPressable(onTap: onTap, pressedScale: 0.99, child: box);
  }
}

/// A small label / figure tile (web Tile).
class WalletTile extends StatelessWidget {
  const WalletTile({super.key, required this.label, required this.value, this.labelWidget, this.hint, this.valueColor});
  final String label;
  final String value;
  final Widget? labelWidget;
  final String? hint;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return WalletRow(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          labelWidget ??
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              ),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textDirection: TextDirection.ltr,
            style: context.text.label.copyWith(fontWeight: FontWeight.w600, color: valueColor ?? k.fg, fontFeatures: kTabular),
          ),
          if (hint != null) ...[
            const SizedBox(height: 2),
            Text(
              hint!,
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }
}

/// The LIVE badge of trading accounts.
class LiveBadge extends StatelessWidget {
  const LiveBadge({super.key});

  @override
  Widget build(BuildContext context) => KChip(label: context.t('wallet.liveBadge'), tone: KChipTone.ember, small: true);
}

/// "← Wallet": back to the wallet overview (the sub-pages' header action).
class BackToWallet extends StatelessWidget {
  const BackToWallet({super.key});

  @override
  Widget build(BuildContext context) => KButton(
    label: context.t('wallet.wallet'),
    icon: _rtl(context) ? LucideIcons.arrowRight : LucideIcons.arrowLeft,
    variant: KButtonVariant.surface,
    onPressed: () => context.go('/wallet'),
  );
}

/// The page header with its actions under it, as the web's PageHeader on phones.
class WalletHeader extends StatelessWidget {
  const WalletHeader({super.key, required this.title, required this.subtitle, this.actions = const []});
  final String title, subtitle;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      KPageHeader(title: title, subtitle: Text(subtitle)),
      if (actions.isNotEmpty) ...[const SizedBox(height: 14), Wrap(spacing: 8, runSpacing: 8, children: actions)],
      const SizedBox(height: 20),
    ],
  );
}

/// Amount fields keep what web cleanAmount keeps (digits, one point, 2 decimals; a comma is a point).
final TextInputFormatter amountFormatter = TextInputFormatter.withFunction((old, next) {
  final c = cleanAmount(next.text);
  if (c == next.text) return next;
  return TextEditingValue(
    text: c,
    selection: TextSelection.collapsed(offset: c.length),
  );
});

/// A placeholder of an LTR field (address, hash) that reads "0x…" in RTL languages too (web `dir="ltr"` inputs).
String ltrHint(String s) => '$s\u200E';

/// A form field's help line under the input (web Field hint).
class FieldHint extends StatelessWidget {
  const FieldHint(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Text(text, style: context.text.footnote.copyWith(color: context.k.fg3, fontSize: 12)),
  );
}

/// One activity row (web ActivityRow): direction icon, title with its status, date · detail · hash, the amount.
class ActivityRow extends StatelessWidget {
  const ActivityRow(this.a, {super.key});
  final ActivityItem a;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final st = activityStatus(a);
    final sub = activitySub(a, t);
    final date = LocaleFormat(t.locale).dateTime(a.createdAt);
    final icon = switch (a.type) {
      'transfer' => LucideIcons.arrowLeftRight,
      'other' => LucideIcons.award,
      _ => a.inbound ? LucideIcons.arrowDownLeft : LucideIcons.arrowUpRight,
    };
    final (Color bg, Color border, Color fg) = a.dim
        ? (k.surface3, k.line, k.fg3)
        : (a.inbound ? (k.upSoft, k.up.withValues(alpha: 0.25), k.up) : (k.surface3, k.line, k.fg2));
    final amountColor = a.dim ? k.fg3 : (a.inbound ? k.up : k.fg);
    final small = context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400);
    return WalletRow(
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: bg,
              shape: BoxShape.circle,
              border: Border.all(color: border),
            ),
            child: Icon(icon, size: 16, color: fg),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(activityTitle(a, t), style: context.text.label.copyWith(fontSize: 13.5, fontWeight: FontWeight.w500)),
                    if (st != null && a.status != 'completed' && a.status != 'credited') WalletStatusChip(st),
                  ],
                ),
                const SizedBox(height: 2),
                _DetailLine(
                  lead: sub.isEmpty ? date : '$date · $sub',
                  style: small,
                  hash: a.txHash != null && a.txHash!.isNotEmpty ? HashLink(hash: a.txHash, url: a.explorerUrl, size: 11.5) : null,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: '${a.inbound ? '+' : '−'}${fmt(a.amount)}'),
                TextSpan(
                  text: ' ${activityCurrency(a)}',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: k.fg3),
                ),
              ],
            ),
            textDirection: TextDirection.ltr,
            style: context.text.label.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: amountColor,
              fontFeatures: kTabular,
              decoration: a.dim ? TextDecoration.lineThrough : null,
              decorationColor: k.fg3,
            ),
          ),
        ],
      ),
    );
  }
}

/// "date · detail · hash" on one line (web `truncate`): the date and detail keep their room and the hash gives way
/// first, so the time is never cut before the hash.
class _DetailLine extends StatelessWidget {
  const _DetailLine({required this.lead, required this.style, this.hash});
  final String lead;
  final TextStyle style;
  final Widget? hash;

  @override
  Widget build(BuildContext context) {
    final h = hash;
    final text = Text(lead, maxLines: 1, overflow: TextOverflow.ellipsis, style: style);
    if (h == null) return text;
    return LayoutBuilder(
      builder: (context, c) {
        final tp = TextPainter(
          text: TextSpan(text: '$lead · ', style: style),
          textDirection: Directionality.of(context),
          textScaler: MediaQuery.textScalerOf(context),
          maxLines: 1,
        )..layout();
        final room = c.maxWidth - tp.width;
        tp.dispose();
        // too narrow for even a few hash characters: the web shows the start of the line
        if (room < 40) return text;
        return Row(
          children: [
            Text(lead, maxLines: 1, style: style),
            Text(' · ', style: style),
            Flexible(child: h),
          ],
        );
      },
    );
  }
}

/// Splits a message around an empty `<tag></tag>` placeholder (web `<Trans tags={{time: () => <Countdown/>}}>`),
/// so a live widget can sit where the translation puts it.
(String before, String after) splitAtTag(String text, String tag) {
  final m = RegExp('<$tag>.*?</$tag>|<$tag/>').firstMatch(text);
  if (m == null) return (text, '');
  return (text.substring(0, m.start), text.substring(m.end));
}
