// The module's screens by web path, wired in lib/router/router.dart (_moduleRoutes). Web paths: /rewards, /rewards/loyalty, /rewards/cashback, /rewards/promotions; detail /rewards/contests/:id.
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'cashback_screen.dart';
import 'contest_detail_screen.dart';
import 'contests_screen.dart';
import 'loyalty_screen.dart';
import 'promotions_screen.dart';

/// Sub-pages (siblings, tab-like): web path -> screen. A path missing here stays a route stub.
final Map<String, Widget Function(GoRouterState)> rewardsScreens = {
  '/rewards': (s) => const ContestsScreen(),
  '/rewards/loyalty': (s) => const LoyaltyScreen(),
  '/rewards/cashback': (s) => const CashbackScreen(),
  '/rewards/promotions': (s) => const PromotionsScreen(),
};

/// Detail pages (iOS push), e.g. GoRoute(path: '/social/masters/:id', builder: …).
final List<RouteBase> rewardsRoutes = [
  GoRoute(
    path: '/rewards/contests/:id',
    builder: (c, s) => ContestDetailScreen(id: s.pathParameters['id']!),
  ),
];
