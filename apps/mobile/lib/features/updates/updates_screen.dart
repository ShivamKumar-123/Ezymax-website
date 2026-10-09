// Events & updates (/updates; web apps/crm/components/growth/updates.tsx UpdatesPage): every event and brand post
// meant for this client, upcoming events first, then the newest; All / Events / Announcements, 12 more at a time.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'updates_api.dart';
import 'widgets/update_card.dart';

const int _page = 12;

class UpdatesScreen extends ConsumerStatefulWidget {
  const UpdatesScreen({super.key});

  @override
  ConsumerState<UpdatesScreen> createState() => _UpdatesScreenState();
}

class _UpdatesScreenState extends ConsumerState<UpdatesScreen> {
  String? _kind;
  int _pages = 1;

  /// The rows shown while the next page loads (same filter).
  PostsPage? _last;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final key = (_kind, _page * _pages);
    final v = ref.watch(postsProvider(key));
    if (v.value != null) _last = v.value;
    final data = v.value ?? _last;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return KPageScroll(
      onRefresh: () async {
        ref.invalidate(postsProvider(key));
        await ref.read(postsProvider(key).future).then((_) {}, onError: (Object _) {});
      },
      children: [
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: KPressable(
            onTap: () => context.canPop() ? context.pop() : context.go('/'),
            child: Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft, size: 14, color: k.fg3),
                  const SizedBox(width: 6),
                  Text(t('shell.nav.overview'), style: context.text.footnote.copyWith(color: k.fg3)),
                ],
              ),
            ),
          ),
        ),
        KPageHeader(title: t('updates.title'), subtitle: Text(t('updates.subtitle'))),
        const SizedBox(height: 16),
        KSegmented<String?>(
          values: const [null, 'event', 'post'],
          labels: [t('common.all'), t('updates.filter.events'), t('updates.filter.posts')],
          selected: _kind,
          onChanged: (x) => setState(() {
            _kind = x;
            _pages = 1;
            _last = null;
          }),
        ),
        const SizedBox(height: 16),
        if (data == null && v.hasError)
          KCard(
            child: KEmptyState(
              art: KIllustrationName.connectionLost,
              title: t('common.unavailable'),
              action: KButton(label: t('common.retry'), variant: KButtonVariant.surface, onPressed: () => ref.invalidate(postsProvider(key))),
            ),
          )
        else if (data == null)
          for (var i = 0; i < 2; i++) ...[const KSkeleton(height: 300, radius: 24), const SizedBox(height: 16)]
        else if (data.items.isEmpty)
          KCard(
            child: KEmptyState(icon: LucideIcons.megaphone, title: t('updates.empty.title'), text: t('updates.empty.text')),
          )
        else ...[
          for (final p in data.items) ...[UpdateCard(p: p), const SizedBox(height: 16)],
          if (data.total > data.items.length)
            Center(
              child: KButton(
                label: t('common.showMore'),
                variant: KButtonVariant.surface,
                loading: v.value == null && !v.hasError,
                onPressed: () => setState(() => _pages++),
              ),
            ),
        ],
      ],
    );
  }
}
