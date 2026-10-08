// The module's screens by web path, wired in lib/router/router.dart (_moduleRoutes). Web paths: /developer, /developer/webhooks, /developer/strategies, /developer/deployments, /developer/backtests, /developer/marketplace, /developer/docs.
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'backtests_screen.dart';
import 'deployments_screen.dart';
import 'docs_screen.dart';
import 'keys_screen.dart';
import 'marketplace_screen.dart';
import 'strategies_screen.dart';
import 'webhooks_screen.dart';

/// Sub-pages (siblings, tab-like): web path -> screen. A path missing here stays a route stub.
final Map<String, Widget Function(GoRouterState)> developerScreens = {
  '/developer': (s) => const DeveloperKeysScreen(),
  '/developer/webhooks': (s) => const DeveloperWebhooksScreen(),
  '/developer/strategies': (s) => DeveloperStrategiesScreen(query: s.uri.queryParameters),
  '/developer/deployments': (s) => DeveloperDeploymentsScreen(query: s.uri.queryParameters),
  '/developer/backtests': (s) => DeveloperBacktestsScreen(query: s.uri.queryParameters),
  '/developer/marketplace': (s) => const DeveloperMarketplaceScreen(),
  '/developer/docs': (s) => const DeveloperDocsScreen(),
};

/// Detail pages (iOS push), e.g. GoRoute(path: '/social/masters/:id', builder: …). The web's details are on the
/// same pages (`?id=`), so this module has none.
final List<RouteBase> developerRoutes = [];
