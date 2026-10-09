// An event or brand post (/updates/:id; web apps/crm/components/growth/updates.tsx UpdateDetail): the picture, kind
// and state, the title and summary, when and where (with "Join online" for an online event), the body (the Academy's
// markdown subset as native widgets, never HTML) and the button. Not found: it ended, was taken down or isn't meant
// for this client.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_providers.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import '../academy/widgets/markdown.dart';
import 'updates_api.dart';
import 'widgets/hero_carousel.dart';
import 'widgets/update_card.dart';

class UpdateDetailScreen extends ConsumerWidget {
  const UpdateDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final v = ref.watch(postProvider(id));
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final back = Align(
      alignment: AlignmentDirectional.centerStart,
      child: KPressable(
        onTap: () => context.canPop() ? context.pop() : context.go('/updates'),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft, size: 14, color: k.fg3),
              const SizedBox(width: 6),
              Text(t('updates.all'), style: context.text.footnote.copyWith(color: k.fg3)),
            ],
          ),
        ),
      ),
    );
    Future<void> refresh() async {
      ref.invalidate(postProvider(id));
      await ref.read(postProvider(id).future).then((_) {}, onError: (Object _) {});
    }

    if (!v.hasValue) {
      final missing = v.error is ApiException && (v.error! as ApiException).status == 404;
      return KPageScroll(
        onRefresh: refresh,
        children: [
          back,
          if (missing)
            KCard(
              child: KEmptyState(
                icon: LucideIcons.megaphone,
                title: t('updates.notFound.title'),
                text: t('updates.notFound.text'),
                action: KButton(label: t('updates.all'), variant: KButtonVariant.surface, onPressed: () => context.go('/updates')),
              ),
            )
          else if (v.hasError)
            KCard(
              child: KEmptyState(
                art: KIllustrationName.connectionLost,
                title: t('common.unavailable'),
                action: KButton(label: t('common.retry'), variant: KButtonVariant.surface, onPressed: () => ref.invalidate(postProvider(id))),
              ),
            )
          else ...[
            const KSkeleton(height: 200, radius: 24),
            const SizedBox(height: 20),
            const KSkeleton(height: 28, width: 260),
            const SizedBox(height: 16),
            KSkeleton.lines(5),
          ],
        ],
      );
    }

    final p = v.requireValue;
    final state = eventStateChip(t, p);
    final cta = p.ctaUrl == null ? null : (p.ctaLabel ?? t('common.learnMore'));
    return KPageScroll(
      onRefresh: refresh,
      children: [
        back,
        if (p.imageUrl != null) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: PromoPicture(p: p),
            ),
          ),
          const SizedBox(height: 18),
        ],
        Wrap(
          spacing: 6,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            KChip(
              label: p.kind == 'event' ? t('updates.kind.event') : t('updates.kind.post'),
              icon: p.kind == 'event' ? LucideIcons.calendarDays : LucideIcons.megaphone,
              tone: p.kind == 'event' ? KChipTone.ember : KChipTone.neutral,
              small: true,
            ),
            if (state != null) KChip(label: state.$1, tone: state.$2 == KChipTone.ember ? KChipTone.info : state.$2, dot: true, small: true),
            if (p.publishedAt != null)
              Text(t('updates.published', {'date': publishedOn(t.locale, p.publishedAt!)}), style: context.text.footnote.copyWith(color: k.fg3)),
          ],
        ),
        const SizedBox(height: 12),
        Text(p.title, style: context.text.largeTitle),
        if (p.body.isNotEmpty) ...[const SizedBox(height: 8), Text(p.body, style: context.text.body.copyWith(color: k.fg2, fontSize: 16, height: 1.5))],
        if (p.isEvent) ...[
          const SizedBox(height: 20),
          KCard(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Fact(
                  icon: LucideIcons.calendarDays,
                  tone: KTone.accent,
                  label: t('updates.when'),
                  value: eventWhen(t.locale, p.eventStartsAt!, p.eventEndsAt),
                ),
                if (p.location != null) ...[
                  const SizedBox(height: 14),
                  _Fact(
                    icon: p.online ? LucideIcons.video : LucideIcons.mapPin,
                    tone: KTone.sky,
                    label: t('updates.where'),
                    value: p.online ? t('updates.online') : p.location!,
                  ),
                ],
                if (p.online && p.eventState != 'ended') ...[
                  const SizedBox(height: 16),
                  KButton(
                    key: const ValueKey('update-join'),
                    label: t('updates.join'),
                    icon: LucideIcons.video,
                    variant: KButtonVariant.surface,
                    expand: true,
                    onPressed: () => launchUrl(Uri.parse(p.location!), mode: LaunchMode.externalApplication),
                  ),
                ],
              ],
            ),
          ),
        ],
        if ((p.content ?? '').trim().isNotEmpty) ...[const SizedBox(height: 24), Markdown(p.content!)],
        if (cta != null) ...[
          const SizedBox(height: 24),
          KButton(
            label: cta,
            trailingIcon: rtl ? LucideIcons.arrowUpLeft : LucideIcons.arrowUpRight,
            expand: true,
            onPressed: () {
              trackPromo(ref.read(apiProvider), p.id, 'click');
              openPromo(context, p);
            },
          ),
        ],
      ],
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.tone, required this.label, required this.value});
  final IconData icon;
  final KTone tone;
  final String label, value;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KIconTile(icon: icon, tone: tone),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label.toUpperCase(), style: context.text.caption.copyWith(color: k.fg3, letterSpacing: 0.6)),
              const SizedBox(height: 2),
              Text(value, style: context.text.label.copyWith(color: k.fg, fontSize: 14)),
            ],
          ),
        ),
      ],
    );
  }
}
