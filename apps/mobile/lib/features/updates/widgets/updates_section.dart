// "Events & updates" on the dashboard (web components/growth/updates.tsx UpdatesSection): the next four events and
// brand posts as a row of cards that slides sideways, with "All updates". Nothing when there are none, the growth
// service is unavailable or the broker switched brand promotions off.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../i18n/i18n.dart';
import '../../../shell/nav.dart';
import '../../../ui/ui.dart';
import '../updates_api.dart';
import 'update_card.dart';

class DashboardUpdatesSection extends ConsumerWidget {
  const DashboardUpdatesSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!modulesOn(ref.watch(configProvider), 'promotions')) return const SizedBox.shrink();
    final items = ref.watch(postsProvider((null, 4))).value?.items ?? const <PromoItem>[];
    if (items.isEmpty) return const SizedBox.shrink();
    final t = context.t;
    final width = (MediaQuery.sizeOf(context).width * 0.76).clamp(240.0, 340.0);
    return Column(
      key: const ValueKey('updates-section'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 36),
        KSectionTitle(
          t('updates.title'),
          large: true,
          trailing: KButton(label: t('updates.all'), size: KButtonSize.sm, variant: KButtonVariant.surface, onPressed: () => context.push('/updates')),
        ),
        const SizedBox(height: 16),
        if (items.length == 1)
          UpdateCard(p: items.first)
        else
          SizedBox(
            height: 380,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, i) => SizedBox(
                width: width,
                child: UpdateCard(p: items[i], fill: true),
              ),
            ),
          ),
      ],
    );
  }
}
