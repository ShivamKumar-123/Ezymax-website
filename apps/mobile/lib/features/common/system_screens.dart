// Full-screen system states: the broker's maintenance mode (web /maintenance), "update required"
// (config.minAppVersion) and a page of a module the broker switched off (web /unavailable).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_providers.dart';
import '../../core/config/app_config.dart';
import '../../core/format/format.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';

class _Frame extends StatelessWidget {
  const _Frame({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: context.k.bg,
    body: Stack(
      children: [
        const Positioned.fill(child: KBackdrop()),
        SafeArea(
          child: Center(
            child: SingleChildScrollView(padding: const EdgeInsets.all(28), child: child),
          ),
        ),
      ],
    ),
  );
}

class MaintenanceScreen extends ConsumerWidget {
  const MaintenanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final cfg = ref.watch(configProvider);
    final until = cfg.maintenanceUntil;
    return _Frame(
      child: Column(
        children: [
          const KIllustration(KIllustrationName.maintenance, width: 220, maxHeight: 160),
          const SizedBox(height: 22),
          Text(t('shell.system.maintenance.title'), textAlign: TextAlign.center, style: context.text.largeTitle),
          const SizedBox(height: 10),
          Text(
            cfg.maintenanceMessage,
            textAlign: TextAlign.center,
            style: context.text.body.copyWith(color: k.fg2),
          ),
          if (until != null) ...[
            const SizedBox(height: 8),
            Text(
              t('shell.system.maintenance.expectedBack', {'time': LocaleFormat(t.locale).dateTime(until)}),
              style: context.text.footnote.copyWith(color: k.fg3),
            ),
          ],
          const SizedBox(height: 24),
          KButton(
            label: t('common.retry'),
            variant: KButtonVariant.surface,
            onPressed: () async {
              await ref.read(configProvider.notifier).refresh();
              if (!ref.read(configProvider).maintenance) ref.read(maintenanceProvider.notifier).set(false);
            },
          ),
        ],
      ),
    );
  }
}

class UpdateScreen extends ConsumerWidget {
  const UpdateScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    return _Frame(
      child: Column(
        children: [
          const KBrandAvatar(size: 72),
          const SizedBox(height: 22),
          Text(t('app.update.title'), textAlign: TextAlign.center, style: context.text.largeTitle),
          const SizedBox(height: 10),
          Text(
            t('app.update.text'),
            textAlign: TextAlign.center,
            style: context.text.body.copyWith(color: k.fg2),
          ),
          const SizedBox(height: 24),
          KButton(
            label: t('app.update.button'),
            size: KButtonSize.lg,
            onPressed: () => launchUrl(Uri.parse('https://play.google.com/store/apps/details?id=com.ezymex.app'), mode: LaunchMode.externalApplication),
          ),
        ],
      ),
    );
  }
}

/// A page of a module the broker switched off (web app/unavailable/page.tsx): the router sends its deep links,
/// notification links and stale links here. Back (or the button) returns to the Dashboard.
class UnavailableScreen extends StatelessWidget {
  const UnavailableScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    // reached with `go` there is nothing under it: the system back leads to the Dashboard instead of closing the app
    return PopScope(
      canPop: context.canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go('/');
      },
      child: _Frame(
        child: Column(
          children: [
            const KIllustration(KIllustrationName.marketClosed, width: 220, maxHeight: 165),
            const SizedBox(height: 22),
            Text(t('shell.system.unavailable.title'), key: const ValueKey('unavailable-title'), textAlign: TextAlign.center, style: context.text.largeTitle),
            const SizedBox(height: 10),
            Text(
              t('shell.system.unavailable.text'),
              textAlign: TextAlign.center,
              style: context.text.body.copyWith(color: k.fg2),
            ),
            const SizedBox(height: 24),
            KButton(label: t('shell.system.unavailable.back'), variant: KButtonVariant.surface, onPressed: () => context.go('/')),
          ],
        ),
      ),
    );
  }
}
