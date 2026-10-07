// Notifications on the dashboard (web components/dashboard/home/notifications-panel.tsx): verification / funding
// prompts with an action and "Later", then the latest notifications from the same inbox as the bell.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format/format.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';

class DashboardPrompt {
  const DashboardPrompt({
    required this.id,
    required this.title,
    required this.text,
    required this.icon,
    required this.tone,
    required this.actionLabel,
    required this.href,
  });
  final String id;
  final String title;
  final String text;
  final IconData icon;
  final KTone tone;
  final String actionLabel;
  final String href;
}

/// Prompts put off with "Later" (this app session only, like the web's sessionStorage).
final _laterProvider = NotifierProvider<_Later, Set<String>>(_Later.new);

class _Later extends Notifier<Set<String>> {
  @override
  Set<String> build() => {};
  void add(String id) => state = {...state, id};
}

class NotificationsPanel extends ConsumerWidget {
  const NotificationsPanel({super.key, this.prompts = const [], this.limit = 4});
  final List<DashboardPrompt> prompts;
  final int limit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final n = ref.watch(notificationsProvider);
    final later = ref.watch(_laterProvider);
    final shown = prompts.where((p) => !later.contains(p.id)).toList();
    final rows = n.items.take((limit - shown.length).clamp(1, limit)).toList();
    final f = LocaleFormat(t.locale);
    final now = DateTime.now();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: KSectionTitle(t('dashboard.notifications.title'), dot: n.unread > 0 || shown.isNotEmpty)),
            if (n.unread > 0)
              KTextButton(label: t('dashboard.notifications.markAll'), color: k.fg3, onPressed: ref.read(notificationsProvider.notifier).markAll),
            KIconButton(
              icon: LucideIcons.settings,
              size: 38,
              semanticLabel: t('dashboard.notifications.settings'),
              onPressed: () => context.go('/profile/notifications'),
            ),
          ],
        ),
        for (var i = 0; i < shown.length; i++) ...[
          if (i > 0) const KDivider(),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                KIconTile(icon: shown[i].icon, tone: shown[i].tone, size: 46),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(shown[i].title, style: context.text.headline.copyWith(fontSize: 14.5, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text(shown[i].text, style: context.text.footnote.copyWith(color: k.fg3)),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: KButton(label: shown[i].actionLabel, size: KButtonSize.sm, expand: true, onPressed: () => context.go(shown[i].href)),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: KButton(
                              label: t('dashboard.home.later'),
                              size: KButtonSize.sm,
                              variant: KButtonVariant.outline,
                              expand: true,
                              onPressed: () => ref.read(_laterProvider.notifier).add(shown[i].id),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0 || shown.isNotEmpty) const KDivider(),
          KInfoRow(
            icon: rows[i].icon,
            tone: rows[i].tone,
            title: rows[i].title,
            subtitle: rows[i].body.isEmpty ? null : rows[i].body,
            unread: !rows[i].read,
            tileSize: 46,
            trailing: Text(
              timeAgo(t, f, rows[i].createdAt, now),
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
            onTap: rows[i].link == null ? null : () => ref.read(notificationsProvider.notifier).open(rows[i]),
          ),
        ],
        if (shown.isEmpty && rows.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Column(
              children: [
                Text(t('dashboard.notifications.emptyTitle'), style: context.text.headline.copyWith(fontSize: 14)),
                const SizedBox(height: 4),
                Text(
                  t('dashboard.notifications.emptyText'),
                  textAlign: TextAlign.center,
                  style: context.text.footnote.copyWith(color: k.fg3),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
