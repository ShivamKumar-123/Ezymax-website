// The module's screens by web path, wired in lib/router/router.dart. Web path: /offers.
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'offers_screen.dart';

/// Sub-pages (siblings, tab-like): web path -> screen.
final Map<String, Widget Function(GoRouterState)> offersScreens = {'/offers': (s) => const OffersScreen()};
