// Brand promotions (lib/features/updates): the model and its images, event times, and on the sample API the
// dashboard's hero carousel, Events & updates, the updates list and an event's page; all gone when the broker
// switches brand promotions off.
import 'package:ezymex/core/config/app_config.dart';
import 'package:ezymex/features/common/system_screens.dart';
import 'package:ezymex/features/dashboard/dashboard_screen.dart';
import 'package:ezymex/features/updates/update_detail_screen.dart';
import 'package:ezymex/features/updates/updates_api.dart';
import 'package:ezymex/features/updates/updates_screen.dart';
import 'package:ezymex/features/updates/widgets/hero_carousel.dart';
import 'package:ezymex/preview/preview_data.dart';
import 'package:ezymex/router/router.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'helpers/test_app.dart';

void main() {
  setUpAll(initializeDateFormatting);

  group('model', () {
    final config = AppConfig.fromJson(previewConfig);

    test('reads the service view; events and posts open their page', () {
      final e = PromoItem.fromJson({
        'id': 7,
        'kind': 'event',
        'layout': 'hero',
        'title': 'Webinar',
        'body': 'Live',
        'ctaLabel': null,
        'ctaUrl': null,
        'imageUrl': '/api/growth/media/0123456789abcdef01234567',
        'dismissible': true,
        'eventStartsAt': '2026-11-12T15:00:00Z',
        'eventEndsAt': '2026-11-12T16:00:00Z',
        'eventState': 'upcoming',
        'location': 'https://meet.example.com/x',
        'publishedAt': '2026-11-01T10:00:00Z',
      });
      expect((e.id, e.hero, e.isEvent, e.online, e.href), ('7', true, true, true, '/updates/7'));
      final b = PromoItem.fromJson({'id': 8, 'title': 'Deposit', 'ctaUrl': '/wallet/deposit'});
      expect((b.kind, b.layout, b.hero, b.hasPage, b.href), ('banner', 'card', false, false, '/wallet/deposit'));
      // an older service without kind / layout: a card banner without a page
      expect(PromoItem.fromJson({'id': 9, 'title': 'Old'}).href, isNull);
    });

    test('pictures: bundled photos, the Client Area (uploads) and https only', () {
      expect(promoImage('/assets/photos/gold.jpg', config), isA<AssetImage>());
      final up = promoImage('/api/growth/media/0123456789abcdef01234567', config);
      expect(up, isA<NetworkImage>());
      expect((up! as NetworkImage).url, '${config.appUrl.replaceAll(RegExp(r'/+$'), '')}/api/growth/media/0123456789abcdef01234567');
      expect((promoImage('https://cdn.example.com/a.png', config)! as NetworkImage).url, 'https://cdn.example.com/a.png');
      for (final bad in [null, '', 'http://cdn.example.com/a.png', '//evil.example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA']) {
        expect(promoImage(bad, config), isNull, reason: '$bad');
      }
      // a photo the app doesn't ship comes from the Client Area
      expect(promoImage('/assets/photos/unknown.jpg', config), isA<NetworkImage>());
    });

    test('event times in the reader\'s time zone, one day or two', () {
      final s = DateTime.utc(2026, 11, 12, 15);
      final one = eventWhen('en', s, s.add(const Duration(hours: 1)));
      expect(one, contains('–'));
      expect(one.split('–').last.trim().split(' ').first, matches(RegExp(r'^\d\d:\d\d$')));
      final two = eventWhen('en', s, s.add(const Duration(days: 1)));
      expect(two.split('–').last, contains(RegExp(r'[A-Za-z]{3}')));
      expect(eventBadge('en', s).$1, matches(RegExp(r'^[A-Z]{3}$')));
    });
  });

  group('page', () {
    testWidgets('the dashboard opens on the hero carousel and lists Events & updates', (tester) async {
      await pumpApp(tester, signedIn: true);
      expect(find.byType(DashboardScreen), findsOneWidget);
      expect(find.byType(HeroCarousel), findsOneWidget);
      expect(find.text('Zero spreads on gold, all week'), findsOneWidget);
      // the card banner stays under it
      expect(find.text('Zero-fee USDT deposits this week'), findsOneWidget);
      final page = find.descendant(of: find.byType(DashboardScreen), matching: find.byType(Scrollable)).first;
      await tester.scrollUntilVisible(find.byKey(const ValueKey('updates-section')), 300, scrollable: page);
      await settle(tester, frames: 4);
      expect(find.text('Events & updates'), findsOneWidget);
      expect(find.text('Ezymex Traders Summit · Dubai'), findsWidgets);
      await unmount(tester);
    });

    testWidgets('a dismissed hero slide goes away', (tester) async {
      await pumpApp(tester, signedIn: true);
      await tester.tap(find.byKey(const ValueKey('hero-dismiss-9101')));
      await settle(tester, frames: 4);
      expect(find.text('Zero spreads on gold, all week'), findsNothing);
      expect(find.byType(HeroCarousel), findsOneWidget);
      await unmount(tester);
    });

    testWidgets('the updates list and an event\'s page', (tester) async {
      final c = await pumpApp(tester, signedIn: true);
      c.read(routerProvider).go('/updates');
      await settle(tester, frames: 6);
      expect(find.byType(UpdatesScreen), findsOneWidget);
      expect(find.text('Webinar: Trading the NFP release'), findsOneWidget);
      // filter: announcements only
      await tester.tap(find.text('Announcements'));
      await settle(tester, frames: 6);
      expect(find.text('Webinar: Trading the NFP release'), findsNothing);
      expect(find.text('New: Ezymex Trader for Android'), findsOneWidget);
      c.read(routerProvider).go('/updates/9102');
      await settle(tester, frames: 6);
      expect(find.byType(UpdateDetailScreen), findsOneWidget);
      expect(find.text('Agenda'), findsOneWidget);
      expect(find.text('Gate Village 3, DIFC, Dubai'), findsOneWidget);
      // a page that isn't there (ended, taken down, not for this client)
      c.read(routerProvider).go('/updates/1');
      await settle(tester, frames: 6);
      expect(find.text("This update isn't available"), findsOneWidget);
      await unmount(tester);
    });

    testWidgets('switched off: no hero, no section, and the pages are "Not available"', (tester) async {
      final off = AppConfig.fromJson({
        ...previewConfig,
        'modules': {...(previewConfig['modules'] as Map), 'promotions': false},
      });
      final c = await pumpApp(tester, signedIn: true, config: off);
      expect(find.byType(HeroCarousel), findsNothing);
      // the card banner isn't part of the module
      expect(find.text('Zero-fee USDT deposits this week'), findsOneWidget);
      final page = find.descendant(of: find.byType(DashboardScreen), matching: find.byType(Scrollable)).first;
      await tester.scrollUntilVisible(find.text('Top movers'), 400, scrollable: page);
      expect(find.byKey(const ValueKey('updates-section')), findsNothing);
      c.read(routerProvider).go('/updates/9102');
      await settle(tester, frames: 4);
      expect(find.byType(UnavailableScreen), findsOneWidget);
      await unmount(tester);
    });
  });
}
