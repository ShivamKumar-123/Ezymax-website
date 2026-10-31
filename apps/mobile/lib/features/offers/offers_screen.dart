// Offers (/offers). Port of the web's LiveOffersPage (apps/crm/components/growth/offers.tsx): every promotion the
// broker is running that this client qualifies for, each one the artwork the Back Office uploaded, shown whole at
// the shape it was drawn in. Opening the page is what marks an offer seen, which is what clears the rail's badge.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/config/app_config.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import '../academy/widgets/markdown.dart';
import '../rewards/widgets/growth_ui.dart';
import '../updates/updates_api.dart';
import '../updates/widgets/hero_carousel.dart';
import 'offers_api.dart';

class OffersScreen extends ConsumerStatefulWidget {
  const OffersScreen({super.key});

  @override
  ConsumerState<OffersScreen> createState() => _OffersScreenState();
}

class _OffersScreenState extends ConsumerState<OffersScreen> {
  final Set<String> _hidden = {};
  final Set<String> _marked = {};

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final title = t('offers.title');
    final subtitle = t('offers.subtitle');
    final v = ref.watch(offersProvider);
    if (!v.hasValue) {
      return GrowthFallback(
        title: title,
        subtitle: subtitle,
        error: v.hasError ? v.error : null,
        onRetry: () => ref.invalidate(offersProvider),
        heights: const [280, 280],
        banner: false,
      );
    }
    final shown = v.requireValue.where((o) => !_hidden.contains(o.promo.id)).toList();

    // Seeing the page is what marks an offer seen, so the rail stops badging it. The service records one
    // impression per client per offer per day, so coming back costs nothing.
    final api = ref.read(apiProvider);
    for (final o in shown) {
      if (o.isNew && _marked.add(o.promo.id)) trackPromo(api, o.promo.id, 'impression');
    }

    return KPageScroll(
      onRefresh: () async {
        ref.invalidate(offersProvider);
        await ref.read(offersProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: [
        KPageHeader(title: title, subtitle: Text(subtitle)),
        if (shown.isEmpty)
          KCard(child: KEmptyState(title: t('offers.emptyTitle'), text: t('offers.emptyText'), icon: LucideIcons.badgePercent))
        else
          for (final o in shown) ...[
            _OfferCard(
              o: o,
              onDismiss: () {
                trackPromo(api, o.promo.id, 'dismiss');
                setState(() => _hidden.add(o.promo.id));
              },
            ),
            const SizedBox(height: 16),
          ],
      ],
    );
  }
}

class _OfferCard extends ConsumerWidget {
  const _OfferCard({required this.o, required this.onDismiss});
  final OfferItem o;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final p = o.promo;
    final image = promoImage(p.imageUrl, ref.watch(configProvider));
    final left = o.daysLeft;
    final rtl = Directionality.of(context) == TextDirection.rtl;

    return KCard(
      padding: EdgeInsets.zero,
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // The artwork is the offer: shown whole, the same rule the dashboard carousel follows, because a
              // promotion poster is drawn to be read in one piece.
              if (image != null)
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                  child: Image(image: image, fit: BoxFit.fitWidth, width: double.infinity, errorBuilder: (context, _, _) => const SizedBox.shrink()),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(p.title, style: context.text.title1.copyWith(fontSize: 17, height: 1.2))),
                        if (o.isNew) ...[const SizedBox(width: 8), KChip(label: t('offers.new'), tone: KChipTone.ember, small: true)],
                      ],
                    ),
                    if (left != null) ...[
                      const SizedBox(height: 8),
                      KChip(label: t('offers.endsIn', {'count': left}), tone: KChipTone.warn, icon: LucideIcons.calendarClock, small: true),
                    ],
                    if (p.body.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(p.body, style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13, height: 1.45)),
                    ],
                    if (o.content.trim().isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Container(height: 1, color: k.line),
                      const SizedBox(height: 12),
                      Markdown(o.content),
                    ],
                    if (p.href != null) ...[
                      const SizedBox(height: 16),
                      KButton(
                        label: p.ctaLabel?.isNotEmpty == true ? p.ctaLabel! : t('offers.claim'),
                        size: KButtonSize.sm,
                        trailingIcon: rtl ? LucideIcons.arrowUpLeft : LucideIcons.arrowUpRight,
                        onPressed: () {
                          trackPromo(ref.read(apiProvider), p.id, 'click');
                          openPromo(context, p);
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (p.dismissible)
            PositionedDirectional(
              top: 8,
              end: 8,
              child: KIconButton(
                icon: LucideIcons.x,
                size: 32,
                color: Colors.white,
                fill: const Color(0x66000000),
                filled: true,
                semanticLabel: t('offers.dismiss'),
                onPressed: onDismiss,
              ),
            ),
        ],
      ),
    );
  }
}
