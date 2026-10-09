// The Dashboard's opening picture and sheet (dashboard_hero.dart + the shell's floating controls): the picture and
// the round controls at the top, the greeting and the sections in the sheet, the module's pages as pills, the frosted
// header once the sheet is up, and the plain header for a white-label broker.
import 'package:ezymex/core/config/app_config.dart';
import 'package:ezymex/features/dashboard/dashboard_hero.dart';
import 'package:ezymex/features/dashboard/dashboard_screen.dart';
import 'package:ezymex/features/updates/widgets/hero_carousel.dart';
import 'package:ezymex/router/router.dart';
import 'package:ezymex/shell/app_shell.dart';
import 'package:ezymex/ui/ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers/test_app.dart';

void main() {
  Finder page() => find.descendant(of: find.byType(DashboardScreen), matching: find.byType(Scrollable)).first;

  testWidgets('opens on the picture with the floating controls; the greeting and the sections sit in the sheet', (tester) async {
    await pumpApp(tester, signedIn: true);
    expect(find.byType(DashboardHeroPicture), findsOneWidget);
    expect(find.byType(DashboardHeroCopy), findsOneWidget);
    expect(find.text('Trade like a sovereign.'), findsOneWidget);
    expect(find.text('EZYMEX FX OPTIONS'), findsOneWidget);
    expect(find.text('Start trading options'), findsOneWidget);
    // the floating controls, not the frosted header
    expect(find.byKey(kShellHeroControls), findsOneWidget);
    expect(find.byKey(kShellHeroHeader), findsNothing);
    expect(find.text('Trade'), findsOneWidget);
    expect(find.byType(KBrandAvatar), findsOneWidget);
    // the picture starts at the very top (under the status bar), the sheet's edge under it
    expect(tester.getTopLeft(find.byType(DashboardHeroPicture)).dy, 0);
    final heroH = dashboardHeroHeight(MediaQuery.of(tester.element(find.byType(DashboardScreen))));
    expect(heroH, closeTo(420.9, 0.01));
    expect(tester.getTopLeft(find.byType(KPillNav)).dy, greaterThan(heroH - kDashboardHeroOverlap));
    // the sheet: the greeting (the name bold, on its own line) and the first sections
    expect(find.text('Arjun'), findsOneWidget);
    expect(find.textContaining(RegExp(r'^Good (morning|afternoon|evening),$')), findsOneWidget);
    expect(find.text('Overview'), findsOneWidget);
    // the brand promotions' hero carousel opens the sheet, the balance follows
    expect(find.byType(HeroCarousel), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Total balance'), 200, scrollable: page());
    expect(find.text('Total balance'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('the pills under the grabber open the module\'s pages', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    final pills = find.byType(KPillNav);
    expect(find.descendant(of: pills, matching: find.text('Markets')), findsOneWidget);
    await tester.tap(find.descendant(of: pills, matching: find.text('Markets')));
    await settle(tester, frames: 4);
    expect(c.read(routerProvider).routerDelegate.currentConfiguration.uri.path, '/markets');
    // a normal page: the frosted header with the module title, no picture
    expect(find.byType(DashboardHeroPicture), findsNothing);
    expect(find.byKey(kShellHeroControls), findsNothing);
    await unmount(tester);
  });

  testWidgets('scrolling the sheet up swaps the floating controls for the frosted header', (tester) async {
    await pumpApp(tester, signedIn: true);
    tester.state<ScrollableState>(page()).position.jumpTo(600);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byKey(kShellHeroHeader), findsOneWidget);
    expect(find.byKey(kShellHeroControls), findsNothing);
    // the header's title and controls
    expect(find.descendant(of: find.byKey(kShellHeroHeader), matching: find.text('Dashboard')), findsOneWidget);
    expect(find.descendant(of: find.byKey(kShellHeroHeader), matching: find.text('Trade')), findsOneWidget);
    expect(find.descendant(of: find.byKey(kShellHeroHeader), matching: find.text('Overview')), findsOneWidget);
    expect(find.byType(KFrosted), findsWidgets);
    // and back
    tester.state<ScrollableState>(page()).position.jumpTo(0);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byKey(kShellHeroControls), findsOneWidget);
    expect(find.byKey(kShellHeroHeader), findsNothing);
    await unmount(tester);
  });

  testWidgets('a white-label broker keeps the plain header and no Ezymex picture', (tester) async {
    final cfg = AppConfig.fromJson(const {
      'apiVersion': 1,
      'urls': {'app': 'https://app.acme.example', 'terminal': 'https://trade.acme.example'},
      'tenant': {'slug': 'acme', 'name': 'Acme Markets', 'default': false, 'primary': '#2f7fd6'},
    });
    await pumpApp(tester, signedIn: true, config: cfg);
    expect(find.byType(DashboardHeroPicture), findsNothing);
    expect(find.byKey(kShellHeroControls), findsNothing);
    expect(find.byKey(kShellHeroHeader), findsNothing);
    expect(find.byType(KPillNav), findsNothing);
    // the header: the broker's initial, the module title, the sub-nav
    expect(find.text('A'), findsOneWidget);
    expect(find.text('Dashboard'), findsOneWidget);
    expect(find.byType(KSubNav), findsWidgets);
    expect(find.text('Arjun'), findsOneWidget);
    await unmount(tester);
  });
}
