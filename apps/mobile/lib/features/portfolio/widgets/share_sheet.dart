// Share P&L cards (port of apps/crm/components/growth/share-dialog.tsx, D136 / O36): the client chooses whether money
// amounts are shown, `POST growth/shares {kind, login, dealId | from/to, showAmounts}` creates a public card at
// <app>/s/<code> (a PNG at /s/<code>/image) carrying the client's referral code. The web's Dialog is a sheet here;
// the PNG download opens the image link, and the share buttons open X / Telegram / WhatsApp like the web.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';

/// What the card shows: one closed trade, or an account's result over [from, to).
sealed class ShareTarget {
  const ShareTarget(this.login);
  final int login;
  Map<String, Object?> body(bool showAmounts);
}

class TradeShare extends ShareTarget {
  const TradeShare(super.login, this.dealId);
  final int dealId;

  @override
  Map<String, Object?> body(bool showAmounts) => {'kind': 'trade', 'login': login, 'dealId': dealId, 'showAmounts': showAmounts};
}

class PeriodShare extends ShareTarget {
  const PeriodShare(super.login, this.from, this.to);
  final String from, to;

  @override
  Map<String, Object?> body(bool showAmounts) => {'kind': 'period', 'login': login, 'from': from, 'to': to, 'showAmounts': showAmounts};
}

/// Opens the share sheet for `target`.
Future<void> showShareSheet(BuildContext context, {required ShareTarget target, required String title}) => showKSheet<void>(
  context,
  title: title,
  builder: (_) => _ShareBody(target: target),
);

/// The share icon of a closed deal (web ShareTradeButton).
class ShareTradeButton extends StatelessWidget {
  const ShareTradeButton({super.key, required this.login, required this.dealId, this.symbol});
  final int login, dealId;
  final String? symbol;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return KIconButton(
      icon: LucideIcons.share2,
      size: 32,
      semanticLabel: t('rewards.share.tradeAria'),
      onPressed: () => showShareSheet(
        context,
        target: TradeShare(login, dealId),
        title: symbol != null ? t('rewards.share.tradeTitleSymbol', {'symbol': symbol}) : t('rewards.share.tradeTitle'),
      ),
    );
  }
}

/// "Share period P&L" for an account and a range (`to` exclusive) (web SharePeriodButton).
class SharePeriodButton extends StatelessWidget {
  const SharePeriodButton({super.key, required this.login, required this.from, required this.to});
  final int login;
  final String from, to;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    return KButton(
      label: t('rewards.share.period'),
      icon: LucideIcons.share2,
      variant: KButtonVariant.surface,
      size: KButtonSize.sm,
      onPressed: () => showShareSheet(context, target: PeriodShare(login, from, to), title: t('rewards.share.period')),
    );
  }
}

class _ShareBody extends ConsumerStatefulWidget {
  const _ShareBody({required this.target});
  final ShareTarget target;

  @override
  ConsumerState<_ShareBody> createState() => _ShareBodyState();
}

class _ShareBodyState extends ConsumerState<_ShareBody> {
  bool _showAmounts = false;
  bool _busy = false;
  Map<String, dynamic>? _share;

  Future<void> _create() async {
    setState(() => _busy = true);
    try {
      final r = await ref.read(apiProvider).post<Map<String, dynamic>>('growth/shares', body: widget.target.body(_showAmounts));
      if (!mounted) return;
      setState(() => _share = r['share'] is Map ? (r['share'] as Map).cast<String, dynamic>() : null);
    } on ApiException catch (e) {
      if (!mounted) return;
      ref.read(notificationsProvider.notifier).toast(NotificationKind.error, context.t('rewards.share.error'), description: localizeError(e, context.t));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _text(Map<String, dynamic> share) {
    final t = context.t;
    final data = share['data'] is Map ? (share['data'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
    final opt = share['kind'] == 'trade' && data['option'] is Map ? (data['option'] as Map).cast<String, dynamic>() : null;
    if (share['kind'] == 'period') return t('rewards.share.textPeriod');
    if (opt != null) {
      final strike = opt['strike'];
      final contract =
          '${opt['underlying'] ?? ''} ${strike is num ? strike : ''} ${opt['right'] == 'put' ? t('rewards.public.optPut') : t('rewards.public.optCall')}'
              .replaceAll(RegExp(r'\s+'), ' ')
              .trim();
      return t('rewards.share.textOption', {'contract': contract});
    }
    final symbol = data['symbol'];
    return symbol is String && symbol.isNotEmpty ? t('rewards.share.textSymbol', {'symbol': symbol}) : t('rewards.share.textTrade');
  }

  Future<void> _open(String url) async {
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) await kCopy(context, url);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final share = _share;
    if (share == null) {
      return KSheetContent(
        footer: Row(
          children: [
            Expanded(
              child: KButton(label: t('common.cancel'), variant: KButtonVariant.ghost, onPressed: () => Navigator.of(context).pop()),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: KButton(label: t('rewards.share.create'), icon: LucideIcons.share2, loading: _busy, expand: true, onPressed: _create),
            ),
          ],
        ),
        children: [
          Text(t('rewards.share.description'), style: context.text.footnote.copyWith(color: k.fg3)),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: k.line),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t('rewards.share.showAmounts'),
                        style: context.text.label.copyWith(fontWeight: FontWeight.w600, color: k.fg),
                      ),
                      const SizedBox(height: 2),
                      Text(_showAmounts ? t('rewards.share.amountsOn') : t('rewards.share.amountsOff'), style: context.text.footnote.copyWith(color: k.fg3)),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                KSwitch(value: _showAmounts, semanticLabel: t('rewards.share.showAmounts'), onChanged: (v) => setState(() => _showAmounts = v)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(t('rewards.share.privacy'), style: context.text.footnote.copyWith(color: k.fg3, height: 1.5)),
        ],
      );
    }
    final base = ref.watch(configProvider).appUrl.replaceAll(RegExp(r'/+$'), '');
    final code = '${share['code']}';
    final url = '$base/s/$code';
    final text = _text(share);
    final enc = Uri.encodeComponent(url), encText = Uri.encodeComponent(text);
    final targets = [
      ('X', 'https://twitter.com/intent/tweet?url=$enc&text=$encText'),
      ('Telegram', 'https://t.me/share/url?url=$enc&text=$encText'),
      ('WhatsApp', 'https://wa.me/?text=${Uri.encodeComponent('$text $url')}'),
    ];
    return KSheetContent(
      footer: Row(
        children: [
          Expanded(
            child: KButton(label: t('rewards.share.changeOptions'), variant: KButtonVariant.ghost, onPressed: () => setState(() => _share = null)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: KButton(
              label: t('rewards.share.download'),
              icon: LucideIcons.download,
              expand: true,
              onPressed: () => _open('$base/s/$code/image?download=1'),
            ),
          ),
        ],
      ),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: AspectRatio(
            aspectRatio: 1200 / 630,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: k.surface2,
                border: Border.all(color: k.line),
              ),
              child: Image.network(
                '$base/s/$code/image',
                fit: BoxFit.cover,
                semanticLabel: t('rewards.share.preview'),
                loadingBuilder: (context, child, p) => p == null ? child : const KSkeleton(radius: 0),
                errorBuilder: (context, _, _) => Center(child: Icon(LucideIcons.image, color: k.fg3)),
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsetsDirectional.fromSTEB(14, 4, 4, 4),
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: k.line),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  url.replaceFirst(RegExp('^https?://'), ''),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textDirection: TextDirection.ltr,
                  style: context.text.mono(12.5),
                ),
              ),
              KIconButton(icon: LucideIcons.copy, size: 34, semanticLabel: t('rewards.share.link'), onPressed: () => kCopy(context, url)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(t('rewards.share.shareTo'), style: context.text.footnote.copyWith(color: k.fg3)),
            for (final (label, href) in targets) KButton(label: label, variant: KButtonVariant.surface, size: KButtonSize.sm, onPressed: () => _open(href)),
            KIconButton(icon: LucideIcons.share, size: 34, semanticLabel: t('rewards.share.link'), onPressed: () => kShare(context, '$text $url')),
          ],
        ),
      ],
    );
  }
}
