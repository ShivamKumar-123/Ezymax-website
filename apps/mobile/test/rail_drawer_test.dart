// The side navigation (shell/rail_drawer.dart): opened from the brand mark, it lists every module in the web's
// order, the bottom bar's four included, and a module with pages opens as an accordion.
import 'package:ezymex/shell/rail_drawer.dart';
import 'package:ezymex/ui/ui.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers/test_app.dart';

void main() {
  testWidgets('the brand mark opens the rail with every module; Trading unfolds its pages', (tester) async {
    await pumpApp(tester, signedIn: true);
    expect(find.byType(RailDrawer), findsNothing);
    await tester.tap(find.byType(KBrandAvatar).first);
    await settle(tester, frames: 6);
    expect(find.byType(RailDrawer), findsOneWidget);
    final drawer = find.byType(RailDrawer);
    // the first rows; the rest of the list is below the fold
    for (final label in ['Dashboard', 'Trading', 'Wallet', 'Analytics']) {
      expect(find.descendant(of: drawer, matching: find.text(label)), findsOneWidget, reason: label);
    }
    // the Dashboard has no pages, so nothing is open on arrival; a module's row unfolds its pages
    expect(find.descendant(of: drawer, matching: find.text('Open account')), findsNothing);
    await tester.tap(find.descendant(of: drawer, matching: find.text('Trading')));
    await settle(tester, frames: 4);
    expect(find.descendant(of: drawer, matching: find.text('Open account')), findsOneWidget);
    // another module's chevron swaps the open group
    await tester.tap(find.descendant(of: drawer, matching: find.text('Wallet')));
    await settle(tester, frames: 4);
    expect(find.descendant(of: drawer, matching: find.text('Open account')), findsNothing);
    expect(find.descendant(of: drawer, matching: find.text('Deposit')), findsOneWidget);
    await unmount(tester);
  });
}
