// The module's screens by web path, wired in lib/router/router.dart (_moduleRoutes). Web paths: /staking,
// /staking/portfolio, /staking/history.
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'history_screen.dart';
import 'plans_screen.dart';
import 'portfolio_screen.dart';

/// Sub-pages (siblings, tab-like): web path -> screen. A path missing here stays a route stub.
final Map<String, Widget Function(GoRouterState)> stakingScreens = {
  '/staking': (s) => const StakingPlansScreen(),
  '/staking/portfolio': (s) => const StakingPortfolioScreen(),
  '/staking/history': (s) => const StakingHistoryScreen(),
};

/// Detail pages (iOS push): none, a position opens in a sheet.
final List<RouteBase> stakingRoutes = [];
