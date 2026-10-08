// The Client Area shell, like the phone web (apps/crm/components/chrome/client-shell.tsx + mobile-nav.tsx):
// - a frosted header: brand disc (-> Dashboard), the module title, search, the bell, the Trade button (opens the
//   full-screen Kalks Trader) and the profile menu; under it the module's pages as text tabs (SubNav);
// - the page, scrolling under both bars (their heights reach the page as MediaQuery padding);
// - a floating frosted bottom bar: Dashboard · Accounts · Wallet · Portfolio · More.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../core/auth/auth_controller.dart';
import '../core/auth/biometrics.dart';
import '../core/config/app_config.dart';
import '../core/models/user.dart';
import '../core/notifications/notifications.dart';
import '../core/prefs.dart';
import '../env.dart';
import '../features/support/launcher.dart';
import '../i18n/i18n.dart';
import '../ui/ui.dart';
import 'menus.dart';
import 'nav.dart';
import 'session_keeper.dart';

/// Tab index of each bottom-bar entry (the shell route's branches, in this order).
const List<String> kTabRoots = ['/', '/accounts', '/wallet', '/portfolio', '/more'];

class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.shell, required this.path});
  final StatefulNavigationShell shell;

  /// The current location's path.
  final String path;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  bool _scrolled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _offerBiometric());
  }

  /// After the first sign-in on this phone: "Unlock faster next time?" (once).
  Future<void> _offerBiometric() async {
    final prefs = ref.read(prefsProvider);
    if (Env.preview || prefs.biometricAsked || prefs.biometricEnabled) return;
    if (!await ref.read(biometricsProvider).available() || !mounted) return;
    final t = context.t;
    final on = await showKAlert<bool>(
      context,
      title: t('app.biometric.offerTitle'),
      message: t('app.biometric.text'),
      actions: [
        KAction(label: t('app.biometric.notNow'), value: false),
        KAction(label: t('app.biometric.enable'), value: true, primary: true),
      ],
    );
    await ref.read(authProvider.notifier).setBiometric(on == true);
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final mq = MediaQuery.of(context);
    final cfg = ref.watch(configProvider);
    final me = ref.watch(meProvider);
    final nav = navFor(cfg, me);
    final module = moduleOf(nav, widget.path);
    final subs = module != null && module.sub.length > 1 ? module.sub : null;
    final headerH = mq.padding.top + KSize.header + (subs != null ? KSize.subNav : 0);
    final barBottom = mq.padding.bottom < 12 ? 12.0 : mq.padding.bottom;
    final barH = KSize.tabBar + barBottom + 8;

    return SessionKeeper(
      child: Scaffold(
        backgroundColor: k.bg,
        resizeToAvoidBottomInset: false,
        body: Stack(
          children: [
            const Positioned.fill(child: KBackdrop()),
            Positioned.fill(
              child: MediaQuery(
                data: mq.copyWith(
                  padding: mq.padding.copyWith(top: headerH, bottom: barH),
                ),
                child: NotificationListener<ScrollUpdateNotification>(
                  onNotification: (n) {
                    if (n.depth == 0 && n.metrics.axis == Axis.vertical) {
                      final s = n.metrics.pixels > 8;
                      if (s != _scrolled) setState(() => _scrolled = s);
                    }
                    return false;
                  },
                  child: widget.shell,
                ),
              ),
            ),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: _Header(module: module, subs: subs, path: widget.path, scrolled: _scrolled, nav: nav),
            ),
            // the floating support chat (web SupportLauncher: every page but /support, never for view-only logins); it
            // places itself above the tab bar at the bottom end and takes touches only on its button. Filled, so it
            // never sizes the stack (it is an empty box on /support).
            if (me != null && me.viewer == null) Positioned.fill(child: SupportLauncher(path: widget.path)),
            Positioned(
              left: 12,
              right: 12,
              bottom: barBottom,
              child: _TabBar(shell: widget.shell, path: widget.path, nav: nav),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends ConsumerWidget {
  const _Header({required this.module, required this.subs, required this.path, required this.scrolled, required this.nav});
  final NavModule? module;
  final List<NavSub>? subs;
  final String path;
  final bool scrolled;
  final List<NavModule> nav;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final me = ref.watch(meProvider);
    final cfg = ref.watch(configProvider);
    final unread = ref.watch(notificationsProvider.select((s) => s.unread));
    final viewer = me?.viewer != null;
    final content = SafeArea(
      bottom: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: KSize.header,
            child: Padding(
              padding: const EdgeInsetsDirectional.only(start: 14, end: 8),
              child: Row(
                children: [
                  KPressable(
                    onTap: () => context.go('/'),
                    semanticLabel: t('shell.nav.dashboard'),
                    child: KBrandAvatar(size: 36, letter: cfg.tenantDefault ? null : cfg.tenantName.characters.first.toUpperCase()),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      module == null ? (path.startsWith('/more') ? t('shell.more') : '') : t(module!.labelKey),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.title2.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  KIconButton(icon: LucideIcons.search, size: 38, semanticLabel: t('shell.search'), onPressed: () => showCommandPalette(context, nav)),
                  if (!viewer)
                    KIconButton(
                      icon: LucideIcons.bell,
                      size: 38,
                      badge: unread,
                      semanticLabel: unread > 0 ? t('dashboard.notifications.ariaUnread', {'count': unread}) : t('dashboard.notifications.title'),
                      onPressed: () => showBellSheet(context),
                    ),
                  if (!viewer) ...[
                    const SizedBox(width: 2),
                    KButton(
                      label: t('dashboard.home.trade'),
                      icon: LucideIcons.candlestickChart,
                      size: KButtonSize.sm,
                      onPressed: () => context.push('/trader'),
                    ),
                  ],
                  const SizedBox(width: 2),
                  KPressable(
                    onTap: () => showProfileMenu(context),
                    semanticLabel: t('shell.accountMenu'),
                    child: KAvatar(name: me?.name ?? '', size: 34, verified: me?.kycStatus == KycStatus.verified),
                  ),
                ],
              ),
            ),
          ),
          if (subs != null)
            KSubNav(
              labels: [for (final s in subs!) t(s.labelKey)],
              icons: [for (final s in subs!) s.icon],
              current: subs!.indexOf(activeSub(path, subs!) ?? subs!.first),
              onSelect: (i) => context.go(subs![i].href),
            ),
        ],
      ),
    );
    // frosted once the page scrolls under it (web .k-topbar[data-scrolled])
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: scrolled ? k.line : Colors.transparent, width: 0.6)),
      ),
      child: scrolled ? KFrosted(color: k.bg.withValues(alpha: 0.82), child: content) : content,
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({required this.shell, required this.path, required this.nav});
  final StatefulNavigationShell shell;
  final String path;
  final List<NavModule> nav;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final primary = [for (final key in kPrimaryModules) nav.where((m) => m.key == key).firstOrNull];
    final moreActive = !primary.any((m) => m != null && isActive(path, m));
    Widget item(int index, IconData icon, String label, bool active, {bool enabled = true}) => Expanded(
      child: Semantics(
        selected: active,
        button: true,
        label: label,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: !enabled
              ? null
              : () {
                  if (index != shell.currentIndex) KHaptics.selection();
                  // tapping the open tab returns to its first page
                  shell.goBranch(index, initialLocation: index == shell.currentIndex);
                },
          child: SizedBox(
            height: 56,
            child: Stack(
              alignment: Alignment.center,
              children: [
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 220),
                  top: 0,
                  child: AnimatedOpacity(
                    duration: const Duration(milliseconds: 200),
                    opacity: active ? 1 : 0,
                    child: Container(
                      width: 24,
                      height: 3,
                      decoration: BoxDecoration(
                        color: k.ember,
                        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(3)),
                      ),
                    ),
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 21, color: active ? k.ember : k.fg3),
                    const SizedBox(height: 4),
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.micro.copyWith(color: active ? k.ember : k.fg3),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    final mods = ['dashboard', 'accounts', 'wallet', 'portfolio'];
    final fallbackIcons = [LucideIcons.layoutGrid, LucideIcons.layers, LucideIcons.wallet, LucideIcons.chartPie];
    return KFrosted(
      color: k.bar,
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: k.line),
      shadows: k.shadowPop,
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Row(
          children: [
            for (var i = 0; i < 4; i++)
              item(
                i,
                primary[i]?.icon ?? fallbackIcons[i],
                t(primary[i]?.labelKey ?? 'shell.nav.${mods[i]}'),
                primary[i] != null && isActive(path, primary[i]!),
                // a module the broker switched off (wallet) or a view-only login without it
                enabled: primary[i] != null,
              ),
            item(4, LucideIcons.layoutGrid, t('shell.more'), moreActive),
          ],
        ),
      ),
    );
  }
}
