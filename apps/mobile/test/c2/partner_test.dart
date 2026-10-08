// Partner (IB) on the sample-data API: the dashboard (level, referral link copy and QR sheet, KPIs, charts), creating
// a campaign link, saving the rebate and split, and the payouts page (payouts are batched by the broker: the web has
// no payout request, so the page shows the accruing balance, the schedule, the history and a batch's details).
import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kalks/features/partner/partner_commissions_screen.dart';
import 'package:kalks/features/partner/partner_dashboard_screen.dart';
import 'package:kalks/features/partner/partner_links_screen.dart';
import 'package:kalks/features/partner/partner_payouts_screen.dart';
import 'package:kalks/preview/c2/partner.dart';
import 'package:kalks/router/router.dart';
import 'package:kalks/ui/ui.dart';

import '../helpers/test_app.dart';

Finder _page<W>() => find.descendant(of: find.byType(W), matching: find.byType(Scrollable)).first;

/// Scrolls `f` into view, then to the middle of the screen (clear of the frosted header and tab bar).
Future<void> _scrollTo(WidgetTester tester, Finder f, Finder page) async {
  await tester.scrollUntilVisible(f, 250, scrollable: page);
  await tester.pump();
  unawaited(Scrollable.ensureVisible(tester.element(f.first), alignment: 0.5));
  await settle(tester, frames: 3);
}

void main() {
  setUp(resetPreviewPartner);

  testWidgets('dashboard: level, referral link copy and QR sheet, KPIs and the cards in order', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/partner');
    await settle(tester);
    expect(find.byType(PartnerDashboardScreen), findsOneWidget);
    expect(find.text('Partner dashboard'), findsWidgets);
    expect(find.text('Silver'), findsWidgets);

    // the header's Copy referral link
    await tester.tap(find.text('Copy referral link'));
    await settle(tester, frames: 3);
    expect(find.text('Referral link copied'), findsWidgets);
    expect(find.text('app.kalkstrade.com/r/ARJUN24'), findsWidgets);

    // the referral card's QR sheet
    final page = _page<PartnerDashboardScreen>();
    await _scrollTo(tester, find.text('Your referral link'), page);
    expect(find.text('ARJUN24'), findsWidgets);
    await tester.tap(find.widgetWithText(KButton, 'QR'));
    await settle(tester);
    expect(find.text('Referral QR code'), findsOneWidget);
    expect(find.text('For flyers, events and screens. Scans open your tracked link.'), findsOneWidget);
    expect(find.text('SVG'), findsOneWidget);
    expect(find.text('PNG'), findsOneWidget);
    await tester.tapAt(const Offset(200, 40));
    await settle(tester);
    expect(find.text('Referral QR code'), findsNothing);

    for (final s in ['Lifetime commission', 'Commission by week', 'Top clients', 'Recent commission', 'CPA bonus']) {
      await _scrollTo(tester, find.text(s), page);
      expect(find.text(s), findsWidgets, reason: s);
    }
    await unmount(tester);
  });

  testWidgets('links: create a campaign link, it is copied and listed', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/partner/links');
    await settle(tester);
    expect(find.byType(PartnerLinksScreen), findsOneWidget);
    expect(find.text('Your links'), findsOneWidget);
    expect(find.text('Telegram channel'), findsOneWidget);

    await tester.tap(find.text('Create link'));
    await settle(tester);
    expect(find.text('Create campaign link'), findsOneWidget);
    // Create stays off until the campaign has a name
    final create = find.descendant(of: find.byType(KSheetContent), matching: find.widgetWithText(KButton, 'Create link'));
    expect(tester.widget<KButton>(create).onPressed, isNull);
    final name = find.descendant(of: find.byType(KSheetContent), matching: find.byType(EditableText)).first;
    await tester.enterText(name, 'Instagram reels');
    await settle(tester, frames: 3);
    // the ending is made from the name
    expect(find.text('app.kalkstrade.com/r/ARJUN24/instagram-reels'), findsOneWidget);
    await tester.tap(create);
    await settle(tester);

    expect(find.text('Create campaign link'), findsNothing);
    expect(find.text('Link created and copied'), findsWidgets);
    expect(find.text('Instagram reels'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('commissions: move the rebate, Save sends it and the card reads Saved', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/partner/commissions');
    await settle(tester);
    expect(find.byType(PartnerCommissionsScreen), findsOneWidget);
    expect(find.text('Rate card'), findsOneWidget);

    final page = _page<PartnerCommissionsScreen>();
    await _scrollTo(tester, find.text('Rebate to your clients'), page);
    expect(find.text('Saved'), findsOneWidget);
    final save = find.widgetWithText(KButton, 'Save');
    expect(tester.widget<KButton>(save).onPressed, isNull);

    // a Cupertino slider takes drags from its thumb only: 10% of 0…50%, the track inset by 8 at each end
    final slider = tester.getRect(find.byType(CupertinoSlider).first);
    await tester.dragFrom(Offset(slider.left + 8 + (slider.width - 16) * 0.2, slider.center.dy), const Offset(60, 0));
    await settle(tester, frames: 3);
    expect(find.text('Unsaved'), findsOneWidget);
    expect(tester.widget<KButton>(save).onPressed, isNotNull);
    await _scrollTo(tester, save, page);
    await tester.tap(save);
    await settle(tester);
    expect(find.text('Rebate and split saved'), findsWidgets);
    expect(find.text('Saved'), findsOneWidget);
    expect(tester.widget<KButton>(find.widgetWithText(KButton, 'Save')).onPressed, isNull);

    await _scrollTo(tester, find.text('Commission ledger'), page);
    expect(find.text('Commission ledger'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('payouts: accruing balance, schedule, history and a batch', (tester) async {
    final c = await pumpApp(tester, signedIn: true);
    c.read(routerProvider).go('/partner/payouts');
    await settle(tester);
    expect(find.byType(PartnerPayoutsScreen), findsOneWidget);
    expect(find.text('Payouts'), findsWidgets);
    expect(find.textContaining('Accruing now · '), findsOneWidget);
    expect(find.text('Weekly payouts'), findsWidgets);

    final page = _page<PartnerPayoutsScreen>();
    await _scrollTo(tester, find.text('Where payouts go'), page);
    expect(find.text('Open wallet'), findsOneWidget);
    for (final s in ['Payout schedule', 'Recent payouts', 'Payout history']) {
      await _scrollTo(tester, find.text(s), page);
      expect(find.text(s), findsWidgets, reason: s);
    }
    await _scrollTo(tester, find.text('#411'), page);
    await tester.tap(find.text('#411'));
    await settle(tester);
    expect(find.text('Batch #411'), findsOneWidget);
    expect(find.text('Destination'), findsOneWidget);
    expect(find.text('Wallet · USDT'), findsOneWidget);
    await unmount(tester);
  });
}
