// The module's screens by web path, wired in lib/router/router.dart (_moduleRoutes). Web paths: /social, /social/copy, /social/pamm, /social/investments, /social/managed, /social/master, /social/mam; detail /social/masters/:id.
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'copy_screen.dart';
import 'discover_screen.dart';
import 'investments_screen.dart';
import 'mam_screen.dart';
import 'managed_screen.dart';
import 'master_profile_screen.dart';
import 'master_screen.dart';
import 'pamm_screen.dart';

/// Sub-pages (siblings, tab-like): web path -> screen. A path missing here stays a route stub.
final Map<String, Widget Function(GoRouterState)> socialScreens = {
  '/social': (s) => const DiscoverScreen(),
  '/social/copy': (s) => const CopyScreen(),
  '/social/pamm': (s) => const PammScreen(),
  '/social/investments': (s) => const InvestmentsScreen(),
  '/social/managed': (s) => const ManagedScreen(),
  '/social/master': (s) => const MasterScreen(),
  '/social/mam': (s) => const MamManagerScreen(),
};

/// Detail pages (iOS push): a master's public profile (`?invite=` opens an invite-only master's private copy link).
final List<RouteBase> socialRoutes = [
  GoRoute(
    path: '/social/masters/:id',
    builder: (c, s) => MasterProfileScreen(key: ValueKey('master-${s.pathParameters['id']}'), id: s.pathParameters['id']!, query: s.uri.queryParameters),
  ),
];
