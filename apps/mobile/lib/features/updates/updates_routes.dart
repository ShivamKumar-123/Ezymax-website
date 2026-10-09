// Brand promotions' pages, wired in lib/router/router.dart under the Dashboard tab. Web paths: /updates (all events and
// posts) and /updates/:id (one of them); module `promotions` (shell/nav.dart _pageModules).
import 'package:go_router/go_router.dart';

import 'update_detail_screen.dart';
import 'updates_screen.dart';

/// Pushed over the dashboard (iOS push), like the web's links from the dashboard.
final List<RouteBase> updatesRoutes = [
  GoRoute(path: '/updates', builder: (c, s) => const UpdatesScreen()),
  GoRoute(
    path: '/updates/:id',
    builder: (c, s) => UpdateDetailScreen(id: s.pathParameters['id']!),
  ),
];
