// Profile & Security screenshots (light, dark, Arabic) on the sample-data API, for comparing with the phone web:
//   flutter test test_shots/c1_profile_shots_test.dart --update-goldens --dart-define=EZYMEX_PREVIEW=true
// PNGs land in the scratchpad (shots.dart shotsDir).
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ezymex/app.dart';
import 'package:ezymex/features/profile/kyc/kyc_upload.dart';
import 'package:ezymex/preview/c1/preview_profile.dart';
import 'package:ezymex/router/router.dart';
import 'package:ezymex/ui/ui.dart';

import '../test/helpers/test_app.dart';
import 'shots.dart';

/// Every page in light, dark and Arabic (dark), at the top and scrolled.
const List<(String name, String location, List<double> scrolls)> _pages = [
  ('profile', '/profile', [0, 700, 1400]),
  ('security', '/profile/security', [0, 800, 1600, 2400]),
  ('viewers', '/profile/viewers', [0, 700]),
  ('verification', '/profile/verification', [0, 700]),
  ('notifications', '/profile/notifications', [0, 700]),
  ('preferences', '/profile/preferences', [0, 600]),
];

class _Picker implements KycPicker {
  _Picker(this.bytes);
  final Uint8List bytes;

  @override
  Future<KycPicked?> camera({required bool selfie}) async => KycPicked(bytes: bytes, name: 'photo.png', mime: 'image/png', origin: 'camera');

  @override
  Future<KycPicked?> file({required bool allowPdf}) async => KycPicked(bytes: bytes, name: 'scan.png', mime: 'image/png', origin: 'file');
}

Future<Uint8List> _png(int w, int h) async {
  final rec = ui.PictureRecorder();
  final canvas = ui.Canvas(rec);
  canvas.drawRect(ui.Rect.fromLTWH(0, 0, w.toDouble(), h.toDouble()), ui.Paint()..color = const ui.Color(0xFFEDE7DD));
  final ink = ui.Paint()..color = const ui.Color(0xFF2B3A55);
  for (var y = 80.0; y < h - 60; y += 46) {
    canvas.drawRect(ui.Rect.fromLTWH(60, y, w - 120.0 - (y % 3) * 40, 14), ink);
  }
  canvas.drawRect(const ui.Rect.fromLTWH(60, 60, 220, 280), ui.Paint()..color = const ui.Color(0xFF8A6D5A));
  final img = await rec.endRecording().toImage(w, h);
  final data = await img.toByteData(format: ui.ImageByteFormat.png);
  img.dispose();
  return data!.buffer.asUint8List();
}

void main() {
  setUp(() => PreviewProfile.reset('approved'));

  for (final (name, location, scrolls) in _pages) {
    for (final (variant, theme, locale) in const [('light', 'light', 'en'), ('dark', 'dark', 'en'), ('ar', 'dark', 'ar')]) {
      for (final s in scrolls) {
        final suffix = s == 0 ? '' : '-${s.toInt()}';
        testWidgets('profile-$name-$variant$suffix', (tester) async {
          await shotAt(tester, 'profile-$name-$variant$suffix', location, theme: theme, locale: locale, scroll: s);
        });
      }
    }
  }

  // the KYC flow's other states
  for (final scenario in const ['none', 'draft', 'in_review', 'more_info', 'rejected']) {
    testWidgets('profile-verification-$scenario', (tester) async {
      PreviewProfile.reset(scenario);
      await shotAt(tester, 'profile-verification-$scenario', '/profile/verification');
    });
  }

  testWidgets('profile-verification-id-checks', (tester) async {
    PreviewProfile.reset('draft');
    PreviewProfile.answer('POST', 'kyc/details', {
      'address': {'line1': '14 Marine Drive', 'line2': '', 'city': 'Mumbai', 'postcode': '400020', 'country': 'in'},
      'id_doc_type': 'national_id',
    }, const {});
    final bytes = (await tester.runAsync(() => _png(1600, 1040)))!;
    final c = await pumpApp(tester, signedIn: true);
    c.read(kycPickerProvider.notifier).use(_Picker(bytes));
    c.read(routerProvider).go('/profile/verification');
    await settle(tester);
    final cam = find.byKey(const ValueKey('camera-id_document-front-'));
    await tester.scrollUntilVisible(cam, 250, scrollable: find.byType(Scrollable).hitTestable().first);
    await tester.tap(cam);
    await settle(tester);
    await expectLater(find.byType(EzymexApp), matchesGoldenFile(Uri.file('$shotsDir/profile-verification-id-checks.png')));
    await unmount(tester);
  });

  testWidgets('profile-security-stepup', (tester) async {
    await shotAt(
      tester,
      'profile-security-stepup',
      '/profile/security',
      before: (tester) async {
        final page = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).first;
        final fields = find.descendant(of: page, matching: find.byType(TextField));
        await tester.enterText(fields.at(0), 'Old!Pass1');
        await tester.enterText(fields.at(1), 'Str0ng!Pass');
        await tester.enterText(fields.at(2), 'Str0ng!Pass');
        await tester.pump();
        final submit = find.widgetWithText(KButton, 'Change password');
        await tester.runAsync(() => Scrollable.ensureVisible(submit.evaluate().first, alignment: 0.45));
        await tester.pump(const Duration(milliseconds: 50));
        await tester.tap(submit);
        await settle(tester);
      },
    );
  });

  testWidgets('profile-viewers-new', (tester) async {
    await shotAt(tester, 'profile-viewers-new', '/profile/viewers', before: (tester) async => tester.tap(find.text('New viewer').first));
  });
}
