// The set-up prompts on the dashboard (web components/dashboard/home/notifications-panel.tsx): verification /
// funding tasks with an action and "Later". Notifications are not here: they live in the bell, and only there,
// so the dashboard is not a second copy of the inbox.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
    final later = ref.watch(_laterProvider);
    final shown = prompts.where((p) => !later.contains(p.id)).toList();
    if (shown.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(children: [Expanded(child: KSectionTitle(t('dashboard.home.setUpTitle')))]),
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
      ],
    );
  }
}
