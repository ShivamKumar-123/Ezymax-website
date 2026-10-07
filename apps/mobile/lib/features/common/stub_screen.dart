// A route stub: the page exists in the navigation (same path and label as the web), its content comes with the
// later agents. Replace the stub in lib/router/router.dart with the real screen.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/config/app_config.dart';
import '../../i18n/i18n.dart';
import '../../shell/nav.dart';
import '../../ui/ui.dart';

class StubScreen extends ConsumerWidget {
  const StubScreen({super.key, required this.path});

  /// The web path this page mirrors (e.g. /wallet/deposit).
  final String path;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final nav = navFor(ref.watch(configProvider), ref.watch(meProvider));
    final module = moduleOf(nav, path) ?? kNav.where((m) => m.sub.any((s) => s.href == path) || m.href == path).firstOrNull;
    final sub = module == null ? null : activeSub(path, module.sub);
    final title = sub != null ? t(sub.labelKey) : (module != null ? t(module.labelKey) : path);
    return KPageScroll(
      children: [
        KPageHeader(title: title),
        const SizedBox(height: 24),
        KCard(
          child: KEmptyState(compact: true, icon: sub?.icon ?? module?.icon, title: title, text: t('common.comingSoon')),
        ),
      ],
    );
  }
}
