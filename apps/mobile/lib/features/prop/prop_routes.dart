// The module's screens by web path, wired in lib/router/router.dart (_moduleRoutes). Web paths: /prop, /prop/mine, /prop/payouts, /prop/certificates.
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'certificates_screen.dart';
import 'mine_screen.dart';
import 'payouts_screen.dart';
import 'store_screen.dart';

/// Sub-pages (siblings, tab-like): web path -> screen. A path missing here stays a route stub.
final Map<String, Widget Function(GoRouterState)> propScreens = {
  '/prop': (s) => const PropStoreScreen(),
  '/prop/mine': (s) => PropMineScreen(id: int.tryParse(s.uri.queryParameters['id'] ?? '')),
  '/prop/payouts': (s) => const PropPayoutsScreen(),
  '/prop/certificates': (s) => const PropCertificatesScreen(),
};

/// Detail pages (iOS push), e.g. GoRoute(path: '/social/masters/:id', builder: …).
final List<RouteBase> propRoutes = [];
