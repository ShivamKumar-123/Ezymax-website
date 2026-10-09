// An event or brand post as a card (web components/growth/updates.tsx UpdateCard): the picture with the event's date
// badge and the kind, the title, when (events) or the publish date, the summary, the place, "Read more". A tap opens
// the page (/updates/:id). One impression per card shown.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../updates_api.dart';

/// "Upcoming" / "Happening now" / "Ended" and its tone.
(String, KChipTone)? eventStateChip(T t, PromoItem p) => switch (p.isEvent ? p.eventState : null) {
  'live' => (t('updates.state.live'), KChipTone.up),
  'ended' => (t('updates.state.ended'), KChipTone.neutral),
  'upcoming' => (t('updates.state.upcoming'), KChipTone.ember),
  _ => null,
};

/// The month / day badge on an event's picture.
class EventDateBadge extends StatelessWidget {
  const EventDateBadge({super.key, required this.at});
  final DateTime at;

  @override
  Widget build(BuildContext context) {
    final (month, day) = eventBadge(context.t.locale, at);
    return Container(
      width: 46,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: const Color(0x8C000000),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0x26FFFFFF)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: double.infinity,
            color: context.k.ember,
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Text(
              month,
              textAlign: TextAlign.center,
              style: context.text.caption.copyWith(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w700, letterSpacing: 0.6),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Text(
              day,
              style: context.text.title2.copyWith(color: Colors.white, height: 1, fontFeatures: kTabular),
            ),
          ),
        ],
      ),
    );
  }
}

/// The picture of an item, or a quiet gradient with the kind's icon.
class PromoPicture extends ConsumerWidget {
  const PromoPicture({super.key, required this.p});
  final PromoItem p;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.k;
    final image = promoImage(p.imageUrl, ref.watch(configProvider));
    final fallback = DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [k.ember.withValues(alpha: 0.25), k.surface3], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Center(child: Icon(p.kind == 'event' ? LucideIcons.calendarDays : LucideIcons.newspaper, size: 28, color: k.fg3)),
    );
    if (image == null) return fallback;
    return Image(image: image, fit: BoxFit.cover, errorBuilder: (context, _, _) => fallback);
  }
}

class UpdateCard extends ConsumerStatefulWidget {
  const UpdateCard({super.key, required this.p, this.fill = false});
  final PromoItem p;

  /// In a row of fixed height: the text takes the rest of it (cut, never overflowing, at large text sizes).
  final bool fill;

  @override
  ConsumerState<UpdateCard> createState() => _UpdateCardState();
}

class _UpdateCardState extends ConsumerState<UpdateCard> {
  @override
  void initState() {
    super.initState();
    trackPromo(ref.read(apiProvider), widget.p.id, 'impression');
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final p = widget.p;
    final state = eventStateChip(t, p);
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return KCard(
      key: ValueKey('update-card-${p.id}'),
      padding: EdgeInsets.zero,
      onTap: () {
        trackPromo(ref.read(apiProvider), p.id, 'click');
        context.push('/updates/${p.id}');
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                PromoPicture(p: p),
                if (p.isEvent) PositionedDirectional(top: 10, start: 10, child: EventDateBadge(at: p.eventStartsAt!)),
                PositionedDirectional(
                  top: 10,
                  end: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0x8C000000),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0x26FFFFFF)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(p.kind == 'event' ? LucideIcons.calendarDays : LucideIcons.megaphone, size: 11, color: Colors.white),
                        const SizedBox(width: 4),
                        Text(
                          p.kind == 'event' ? t('updates.kind.event') : t('updates.kind.post'),
                          style: context.text.caption.copyWith(color: Colors.white, fontSize: 10.5),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          _fitted(
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (state != null) ...[KChip(label: state.$1, tone: state.$2, dot: true, small: true), const SizedBox(height: 8)],
                  Text(p.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: context.text.headline),
                  const SizedBox(height: 4),
                  if (p.isEvent)
                    Row(
                      children: [
                        Icon(LucideIcons.clock, size: 13, color: k.fg3),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            eventWhen(t.locale, p.eventStartsAt!, p.eventEndsAt),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.text.footnote.copyWith(color: k.fg3),
                          ),
                        ),
                      ],
                    )
                  else if (p.publishedAt != null)
                    Text(publishedOn(t.locale, p.publishedAt!), style: context.text.footnote.copyWith(color: k.fg3)),
                  if (p.body.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      p.body,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13),
                    ),
                  ],
                  if (p.isEvent && p.location != null) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(p.online ? LucideIcons.video : LucideIcons.mapPin, size: 13, color: k.fg3),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            p.online ? t('updates.online') : p.location!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.text.footnote.copyWith(color: k.fg3),
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Text(t('updates.readMore'), style: context.text.label.copyWith(color: k.ember)),
                      const SizedBox(width: 4),
                      Icon(rtl ? LucideIcons.arrowUpLeft : LucideIcons.arrowUpRight, size: 14, color: k.ember),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// The text under the picture: the rest of a fixed-height card (clipped), else its natural height.
  Widget _fitted(Widget details) => widget.fill
      ? Expanded(
          child: SingleChildScrollView(physics: const NeverScrollableScrollPhysics(), child: details),
        )
      : details;
}
