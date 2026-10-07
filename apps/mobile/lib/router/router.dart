// Routes. The Client Area pages use the web's own paths, so links in notifications, e-mails and deep links
// (kalks://app/<path>, https://app.kalkstrade.com/<path>) open the same page as on the web:
//   /login /register /forgot                     sign-in (signed out only)
//   /unlock                                       biometric unlock of a stored session
//   / … (StatefulShellRoute)                      the Client Area: five tabs (Dashboard · Accounts · Wallet · Portfolio
//                                                 · More), each with its own stack; module pages under More
//   /trader?login=                                Kalks Trader, full screen above the shell (any Trade button)
//   /maintenance /update                          system states
// Sub-pages of a module are siblings (tab-like, no slide); detail pages are children (iOS push).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api/api_providers.dart';
import '../core/app_info.dart';
import '../core/auth/auth_controller.dart';
import '../core/config/app_config.dart';
import '../core/notifications/notifications.dart';
import '../env.dart';
import '../features/auth/forgot_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/auth/unlock_screen.dart';
import '../features/common/stub_screen.dart';
import '../features/common/system_screens.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/trader/trader_screen.dart';
import '../preview/gallery_screen.dart';
import '../shell/app_shell.dart';
import '../shell/more_screen.dart';
import '../shell/nav.dart';
import '../ui/ui.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

const Set<String> _authPaths = {'/login', '/register', '/forgot'};
const Set<String> _systemPaths = {'/boot', '/unlock', '/maintenance', '/update'};

/// The tab (shell branch) each module's pages live in.
int branchOf(String moduleKey) => switch (moduleKey) {
  'dashboard' => 0,
  'accounts' => 1,
  'wallet' => 2,
  'portfolio' => 3,
  _ => 4,
};

Page<void> _tab(Widget child, GoRouterState s) => NoTransitionPage<void>(key: s.pageKey, child: child);

/// Every sub-page of the module as a sibling route (a stub until its screen is built).
List<RouteBase> _moduleRoutes(String key, {Map<String, Widget Function(GoRouterState)> screens = const {}, List<RouteBase> extra = const []}) {
  final m = kNav.firstWhere((x) => x.key == key);
  final paths = {if (m.sub.isEmpty) m.href, for (final s in m.sub) s.href};
  return [
    for (final p in paths)
      GoRoute(
        path: p,
        pageBuilder: (c, s) => _tab(screens[p]?.call(s) ?? StubScreen(path: p), s),
      ),
    ...extra,
  ];
}

/// Path and query of a location (deep links arrive with a scheme and host).
String _loc(Uri uri) => '${uri.path.isEmpty ? '/' : uri.path}${uri.hasQuery ? '?${uri.query}' : ''}';

/// Decides where a location may go, from the sign-in state, maintenance and the minimum app version.
String? redirectFor({required AuthState auth, required bool maintenance, required bool updateRequired, required Uri uri}) {
  // https://trade.kalkstrade.com/… (Kalks Trader links) -> the terminal
  if (uri.host.startsWith('trade.')) return '/trader';
  final path = uri.path.isEmpty ? '/' : uri.path;
  if (updateRequired) return path == '/update' ? null : '/update';
  if (maintenance) return path == '/maintenance' ? null : '/maintenance';
  if (path == '/maintenance' || path == '/update') return '/';
  switch (auth) {
    case AuthBooting():
      return path == '/boot' ? null : '/boot';
    case AuthLocked():
      // back to the same page after the unlock
      if (path == '/unlock') return null;
      return _systemPaths.contains(path) || _authPaths.contains(path) || path == '/' ? '/unlock' : '/unlock?next=${Uri.encodeComponent(_loc(uri))}';
    case AuthSignedOut():
      if (_authPaths.contains(path)) return null;
      final next = _systemPaths.contains(path) || path == '/' ? null : _loc(uri);
      return next == null ? '/login' : '/login?next=${Uri.encodeComponent(next)}';
    case AuthSignedIn(:final me):
      if (_authPaths.contains(path) || _systemPaths.contains(path)) {
        final next = uri.queryParameters['next'];
        return next != null && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      }
      final v = me.viewer;
      if (v != null && path != '/more' && !viewerPageAllowed(v, path)) {
        return const ['dashboard', 'accounts', 'history', 'wallet', 'partner']
                .where(v.sections.contains)
                .map((s) => const {'dashboard': '/', 'accounts': '/accounts', 'history': '/portfolio/history', 'wallet': '/wallet', 'partner': '/partner'}[s]!)
                .firstOrNull ??
            '/more';
      }
      return null;
  }
}

class _RouterRefresh extends ChangeNotifier {
  void ping() => notifyListeners();
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefresh();
  ref.listen(authProvider, (_, _) => refresh.ping());
  ref.listen(maintenanceProvider, (_, _) => refresh.ping());
  ref.listen(configProvider, (a, b) {
    if (a?.maintenance != b.maintenance || a?.minAppVersion != b.minAppVersion) refresh.ping();
  });
  ref.onDispose(refresh.dispose);

  final router = GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/boot',
    refreshListenable: refresh,
    redirect: (context, state) {
      final cfg = ref.read(configProvider);
      final to = redirectFor(
        auth: ref.read(authProvider),
        maintenance: cfg.maintenance || ref.read(maintenanceProvider),
        updateRequired: isOlderVersion(ref.read(appInfoProvider).version, cfg.minAppVersion),
        uri: state.uri,
      );
      return to;
    },
    errorPageBuilder: (c, s) => _tab(StubScreen(path: s.uri.path), s),
    routes: [
      GoRoute(path: '/boot', pageBuilder: (c, s) => _tab(const _BootScreen(), s)),
      GoRoute(path: '/login', pageBuilder: (c, s) => _tab(const LoginScreen(), s)),
      GoRoute(
        path: '/register',
        builder: (c, s) => RegisterScreen(referral: s.uri.queryParameters['ref']),
      ),
      GoRoute(path: '/forgot', builder: (c, s) => const ForgotScreen()),
      GoRoute(path: '/unlock', pageBuilder: (c, s) => _tab(const UnlockScreen(), s)),
      GoRoute(path: '/maintenance', pageBuilder: (c, s) => _tab(const MaintenanceScreen(), s)),
      GoRoute(path: '/update', pageBuilder: (c, s) => _tab(const UpdateScreen(), s)),
      GoRoute(
        path: '/trader',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (c, s) => CupertinoFullscreenPage(
          key: s.pageKey,
          child: TraderScreen(login: s.uri.queryParameters['login']),
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(shell: shell, path: state.uri.path),
        branches: [
          StatefulShellBranch(routes: _moduleRoutes('dashboard', screens: {'/': (_) => const DashboardScreen()})),
          StatefulShellBranch(
            routes: _moduleRoutes(
              'accounts',
              extra: [
                GoRoute(
                  path: '/accounts/:login',
                  builder: (c, s) => StubScreen(path: '/accounts/${s.pathParameters['login']}'),
                ),
              ],
            ),
          ),
          StatefulShellBranch(routes: _moduleRoutes('wallet')),
          StatefulShellBranch(routes: _moduleRoutes('portfolio')),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/more', pageBuilder: (c, s) => _tab(const MoreScreen(), s)),
              // the design system on one page, in development previews only
              if (Env.preview)
                GoRoute(
                  path: '/more/gallery',
                  builder: (c, s) => GalleryScreen(open: s.uri.queryParameters['open']),
                ),
              for (final m in kNav)
                if (branchOf(m.key) == 4) ..._moduleRoutes(m.key),
              // gated in live builds (apps/crm/lib/live.ts), kept reachable for links
              GoRoute(
                path: '/academy/coach',
                pageBuilder: (c, s) => _tab(const StubScreen(path: '/academy/coach'), s),
              ),
            ],
          ),
        ],
      ),
    ],
  );

  // keep the current path for the notification store, and open links from banners through the router
  // (after the frame: the router notifies while widgets build, and providers may not change then)
  void sync() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (router.routerDelegate.currentConfiguration.isNotEmpty) ref.read(currentPathProvider.notifier).set(router.routerDelegate.currentConfiguration.uri.path);
  });
  router.routerDelegate.addListener(sync);
  ref.read(linkOpenerProvider).handler = (link) {
    if (link.startsWith('/')) {
      router.go(link);
    } else {
      final uri = Uri.tryParse(link);
      if (uri != null) launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  };
  ref.onDispose(() {
    router.routerDelegate.removeListener(sync);
    router.dispose();
  });
  return router;
});

/// The full-screen terminal slides up like an iOS full-screen modal.
class CupertinoFullscreenPage extends CustomTransitionPage<void> {
  CupertinoFullscreenPage({super.key, required super.child})
    : super(
        transitionDuration: const Duration(milliseconds: 380),
        reverseTransitionDuration: const Duration(milliseconds: 300),
        transitionsBuilder: (context, animation, secondary, child) {
          final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);
          return SlideTransition(
            position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(curved),
            child: child,
          );
        },
      );
}

/// While the stored session is read (the native splash usually still covers it).
class _BootScreen extends StatelessWidget {
  const _BootScreen();

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: context.k.bg,
    body: const Center(child: KBrandAvatar(size: 64)),
  );
}
