// The module's screens by web path, wired in lib/router/router.dart (_moduleRoutes). Web paths: /partner, /partner/clients, /partner/network, /partner/commissions, /partner/links, /partner/payouts.
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'partner_clients_screen.dart';
import 'partner_commissions_screen.dart';
import 'partner_dashboard_screen.dart';
import 'partner_links_screen.dart';
import 'partner_network_screen.dart';
import 'partner_payouts_screen.dart';

/// Sub-pages (siblings, tab-like): web path -> screen. A path missing here stays a route stub.
final Map<String, Widget Function(GoRouterState)> partnerScreens = {
  '/partner': (s) => const PartnerDashboardScreen(),
  '/partner/clients': (s) => const PartnerClientsScreen(),
  '/partner/network': (s) => const PartnerNetworkScreen(),
  // `?section=rebates` scrolls to the rebates card (web /partner/commissions#rebates)
  '/partner/commissions': (s) => PartnerCommissionsScreen(section: s.uri.queryParameters['section']),
  '/partner/links': (s) => const PartnerLinksScreen(),
  '/partner/payouts': (s) => const PartnerPayoutsScreen(),
};

/// Detail pages (iOS push), e.g. GoRoute(path: '/social/masters/:id', builder: …). The partner pages have none: a
/// client's details and a commission line open in sheets, as the web's dialogs do.
final List<RouteBase> partnerRoutes = [];
