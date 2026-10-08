// Prop › Certificates (/prop/certificates): the port of LivePropCertificates (apps/crm/components/prop-live/
// certificates.tsx): header (+ My challenges), then each certificate with its picture (opens the public verify page),
// kind / revoked chips, title, plan · size · amount · date, number, and Copy share link / Open verify page /
// Download PNG.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'prop_api.dart';
import 'widgets/prop_ui.dart';

class PropCertificatesScreen extends ConsumerWidget {
  const PropCertificatesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final certs = ref.watch(propCertificatesProvider);
    return KPageScroll(
      onRefresh: () async {
        ref.invalidate(propCertificatesProvider);
        await ref.read(propCertificatesProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(title: t('prop.certs.title'), subtitle: Text(t('prop.certs.subtitle'))),
        const SizedBox(height: 14),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: KButton(label: t('prop.myChallenges'), icon: LucideIcons.trophy, variant: KButtonVariant.surface, onPressed: () => context.go('/prop/mine')),
        ),
        const SizedBox(height: 20),
        KAsync<List<Certificate>>(
          value: certs,
          onRetry: () => ref.invalidate(propCertificatesProvider),
          error: (e) => PropLoadError(error: e, onRetry: () => ref.invalidate(propCertificatesProvider)),
          loading: const Column(children: [KSkeleton(height: 280, radius: 24), SizedBox(height: 16), KSkeleton(height: 280, radius: 24)]),
          builder: (list) => list.isEmpty
              ? KCard(
                  child: KEmptyState(
                    art: KIllustrationName.propPassed,
                    title: t('prop.certs.emptyTitle'),
                    text: t('prop.certs.emptyText'),
                    action: KButton(label: t('prop.browseChallenges'), onPressed: () => context.go('/prop')),
                  ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < list.length; i++) ...[if (i > 0) const SizedBox(height: 16), _CertCard(c: list[i])],
                  ],
                ),
        ),
      ],
    );
  }
}

class _CertCard extends ConsumerWidget {
  const _CertCard({required this.c});
  final Certificate c;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final appUrl = ref.watch(configProvider).appUrl;
    // the share link is on this Client Area's own origin (web shareUrl)
    final verify = '$appUrl/verify/${c.code}';
    final (String label, KChipTone tone) = switch (c.kind) {
      'pass' => (t('prop.verify.kind.pass'), KChipTone.up),
      'funded' => (t('prop.verify.kind.funded'), KChipTone.gold),
      'payout' => (t('prop.verify.kind.payout'), KChipTone.ember),
      _ => (c.kind, KChipTone.ember),
    };
    void open(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    final sub = ['${c.planName} · ${sizeLabel(c.size)}', if (c.kind == 'payout' && c.amount != null) usd(c.amount), fmtDate(t, c.issuedAt)].join(' · ');
    return KCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KPressable(
            onTap: () => open(verify),
            pressedScale: 1,
            semanticLabel: t('prop.certs.imageAlt', {'title': c.title}),
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: k.line)),
              ),
              child: CertificateArt(cert: c, host: Uri.tryParse(appUrl)?.host ?? appUrl),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          KChip(label: label, tone: tone, small: true),
                          if (c.revoked) KChip(label: t('prop.verify.revoked'), tone: KChipTone.down, small: true),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        c.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        sub,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12),
                      ),
                      const SizedBox(height: 2),
                      Text(t('prop.certs.number', {'code': c.code}), style: context.text.mono(11, color: k.fg3)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                KIconButton(
                  icon: LucideIcons.link2,
                  size: 34,
                  filled: true,
                  semanticLabel: t('prop.certs.copyShareLink'),
                  onPressed: () => kCopy(context, verify, message: t('prop.certs.linkCopied')),
                ),
                KIconButton(icon: LucideIcons.externalLink, size: 34, filled: true, semanticLabel: t('prop.certs.openVerify'), onPressed: () => open(verify)),
                KIconButton(
                  icon: LucideIcons.download,
                  size: 34,
                  filled: true,
                  semanticLabel: t('prop.verify.downloadPng'),
                  onPressed: () => open('$verify/image?download=1'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
