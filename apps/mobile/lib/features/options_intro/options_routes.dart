// The module's screens by web path, wired in lib/router/router.dart (_moduleRoutes). Web paths: /options.
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'options_screen.dart';

/// Sub-pages (siblings, tab-like): web path -> screen. A path missing here stays a route stub.
final Map<String, Widget Function(GoRouterState)> optionsScreens = {'/options': (_) => const OptionsScreen()};

/// Detail pages (iOS push).
final List<RouteBase> optionsRoutes = [];
