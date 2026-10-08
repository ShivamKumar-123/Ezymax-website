// Screenshots of the Portfolio pages (light, dark, Arabic, scrolled), for comparing with the phone web:
//   flutter test test_shots/c1_portfolio_shots_test.dart --update-goldens
// The pages' calls are answered from lib/preview/c1/preview_portfolio.dart directly (a Dio interceptor), so the
// shots show this module's sample data whatever the other modules' preview answers are.
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kalks/app.dart';
import 'package:kalks/core/api/api_providers.dart';
import 'package:kalks/preview/c1/preview_portfolio.dart';
import 'package:kalks/router/router.dart';

import '../test/helpers/test_app.dart';
import 'shots.dart';

void _usePortfolioPreview(ProviderContainer c) {
  c
      .read(apiProvider)
      .dio
      .interceptors
      .add(
        InterceptorsWrapper(
          onRequest: (o, h) {
            final path = o.uri.path.replaceFirst(RegExp(r'^.*/api/mobile/'), '').replaceFirst(RegExp('^/'), '');
            final body = o.data is Map ? (o.data as Map).cast<String, dynamic>() : const <String, dynamic>{};
            final r = previewPortfolio(o.method, path, body, o.uri.queryParameters);
            if (r == null) return h.next(o);
            final text = jsonEncode(r.$2);
            h.resolve(
              Response<Object?>(requestOptions: o, statusCode: r.$1, data: o.responseType == ResponseType.bytes ? utf8.encode(text) : jsonDecode(text)),
            );
          },
        ),
      );
}

/// [shotAt] with this module's sample answers in front.
Future<void> _shot(
  WidgetTester tester,
  String name,
  String location, {
  String theme = 'light',
  String locale = 'en',
  double scroll = 0,
  Future<void> Function(WidgetTester tester)? before,
}) async {
  final c = await pumpApp(tester, signedIn: true, theme: theme, locale: locale);
  _usePortfolioPreview(c);
  c.read(routerProvider).go(location);
  await settle(tester);
  if (before != null) {
    await before(tester);
    await settle(tester, frames: 6);
  }
  if (scroll > 0) {
    // jump the page's own (vertical) scroll view, clamped to its end: a long drag past the end bounces back to an
    // odd offset, and a pointer landing on a pressable leaves a timer behind
    final page = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down).hitTestable().first;
    final pos = tester.state<ScrollableState>(page).position;
    // the lazy list only estimates its length, and sections that load late (open positions) make the page longer:
    // jump, let it settle, and jump again to the real offset
    for (var round = 0; round < 3; round++) {
      pos.jumpTo(scroll.clamp(0, pos.maxScrollExtent).toDouble());
      await tester.pump(const Duration(milliseconds: 50));
      pos.jumpTo(scroll.clamp(0, pos.maxScrollExtent).toDouble());
      await settle(tester, frames: 6);
      if ((pos.pixels - scroll.clamp(0, pos.maxScrollExtent)).abs() < 1) break;
    }
  }
  await expectLater(find.byType(KalksApp), matchesGoldenFile(Uri.file('$shotsDir/$name.png')));
  await unmount(tester);
}

void main() {
  const pages = {
    'overview': '/portfolio',
    'analytics': '/portfolio/analytics',
    'history': '/portfolio/history',
    'ledger': '/portfolio/ledger',
    'statements': '/portfolio/statements',
  };
  for (final e in pages.entries) {
    for (final (mode, theme, locale) in [('light', 'light', 'en'), ('dark', 'dark', 'en'), ('ar', 'light', 'ar')]) {
      testWidgets('portfolio ${e.key} $mode', (tester) => _shot(tester, 'portfolio-${e.key}-$mode', e.value, theme: theme, locale: locale));
    }
  }
  // the long pages, scrolled
  for (final (page, steps) in [('overview', 4), ('analytics', 9), ('history', 3), ('ledger', 2), ('statements', 3)]) {
    for (var i = 1; i <= steps; i++) {
      testWidgets('portfolio $page light scrolled $i', (tester) => _shot(tester, 'portfolio-$page-light-${i + 1}', pages[page]!, scroll: 700.0 * i));
    }
  }
  for (var i = 1; i <= 3; i++) {
    testWidgets(
      'portfolio analytics dark scrolled $i',
      (tester) => _shot(tester, 'portfolio-analytics-dark-${i + 1}', '/portfolio/analytics', theme: 'dark', scroll: 700.0 * i),
    );
  }
  testWidgets('portfolio history ar scrolled', (tester) => _shot(tester, 'portfolio-history-ar-2', '/portfolio/history', locale: 'ar', scroll: 700));
  // sheets and states
  testWidgets('portfolio history options filter', (tester) async {
    await _shot(
      tester,
      'portfolio-history-light-options',
      '/portfolio/history',
      before: (t) async {
        await t.tap(find.text('Options').first);
      },
      scroll: 300,
    );
  });
  testWidgets('portfolio history custom range', (tester) async {
    await _shot(
      tester,
      'portfolio-history-light-custom',
      '/portfolio/history',
      before: (t) async {
        await t.tap(find.text('Custom').first);
      },
      scroll: 200,
    );
  });
  testWidgets('portfolio share sheet', (tester) async {
    await _shot(
      tester,
      'portfolio-history-light-share',
      '/portfolio/history',
      before: (t) async {
        await t.tap(find.text('Share period P&L').first);
      },
    );
  });
  testWidgets('portfolio analytics account menu', (tester) async {
    await _shot(
      tester,
      'portfolio-analytics-light-accounts',
      '/portfolio/analytics',
      before: (t) async {
        await t.tap(find.text('All live accounts').first);
      },
    );
  });
  testWidgets('portfolio statements year', (tester) async {
    await _shot(
      tester,
      'portfolio-statements-light-year',
      '/portfolio/statements',
      before: (t) async {
        await t.tap(find.text('Year').first);
      },
      scroll: 250,
    );
  });
}
