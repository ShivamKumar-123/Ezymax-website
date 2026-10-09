// Screenshots of the Accounts pages (light, dark, Arabic, scrolled views, the wizard's steps, the ⋯ menu and the key
// sheets):
//   flutter test test_shots/c1_accounts_shots_test.dart --update-goldens
import 'dart:math' as math;

import 'package:ezymex/app.dart';
import 'package:ezymex/preview/c1/preview_accounts.dart';
import 'package:ezymex/router/router.dart';
import 'package:ezymex/ui/ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../test/helpers/test_app.dart';
import 'shots.dart';

/// Brings `f` on screen: the page (or open sheet) jumps down until it is built, then puts it a third of the way down
/// the screen, clear of the frosted header and the tab bar (lazy lists don't build what is far below).
Future<void> _reveal(WidgetTester tester, Finder f) async {
  if (f.hitTestable().evaluate().isNotEmpty) return;
  ScrollPosition? pos;
  for (final e in find.byType(Scrollable).hitTestable().evaluate()) {
    final st = (e as StatefulElement).state as ScrollableState;
    if (st.position.axis == Axis.vertical) {
      pos = st.position;
      break;
    }
  }
  if (pos == null) return;
  for (var i = 0; i < 40 && f.evaluate().isEmpty && pos.pixels < pos.maxScrollExtent; i++) {
    pos.jumpTo(math.min(pos.pixels + 250, pos.maxScrollExtent));
    await tester.pump(const Duration(milliseconds: 60));
  }
  if (f.evaluate().isEmpty) return;
  final top = tester.getRect(f.first).top;
  pos.jumpTo((pos.pixels + top - 300).clamp(0, pos.maxScrollExtent).toDouble());
  await tester.pump(const Duration(milliseconds: 120));
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await _reveal(tester, f);
  await tester.tap(f.first);
  await settle(tester, frames: 6);
}

/// The wizard's Continue: the button whose trailing arrow points forward (right, or left in Arabic).
final Finder _next = find.byWidgetPredicate((w) => w is KButton && (w.trailingIcon == LucideIcons.arrowRight || w.trailingIcon == LucideIcons.arrowLeft));

/// A KButton by its icon (the same in every language).
Finder _button(IconData icon) => find.byWidgetPredicate((w) => w is KButton && (w.icon == icon || w.trailingIcon == icon));

/// The first ⋯ account menu on the page.
Future<void> _menu(WidgetTester tester) => _tap(tester, find.byIcon(LucideIcons.ellipsis));

/// Opens the menu and picks the entry with `icon`.
Future<void> Function(WidgetTester) _menuItem(IconData icon) => (tester) async {
  await _menu(tester);
  await _tap(tester, find.byIcon(icon).hitTestable());
};

/// Wizard: Continue `n` times.
Future<void> Function(WidgetTester) _continue(int n) => (tester) async {
  for (var i = 0; i < n; i++) {
    await _tap(tester, _next);
  }
};

/// Wizard from ?group=standard (Configure): Continue, agree, Open.
Future<void> _openAccount(WidgetTester tester) async {
  // each shot starts from the sample client's accounts (an account opened by the shot before would count)
  resetPreviewAccounts();
  await _tap(tester, _next);
  await _tap(tester, find.byType(KCheckRow));
  await _tap(tester, _button(LucideIcons.check));
}

void main() {
  setUp(resetPreviewAccounts);

  final themes = [('light', 'light', 'en'), ('dark', 'dark', 'en'), ('ar', 'light', 'ar')];
  for (final (name, theme, locale) in themes) {
    if (locale == 'ar' && !hasArabicFont) continue;
    testWidgets('list $name', (tester) async {
      await shotAt(tester, 'accounts-list-$name', '/accounts', theme: theme, locale: locale);
      await shotAt(tester, 'accounts-list-$name-2', '/accounts', theme: theme, locale: locale, scroll: 800);
      await shotAt(tester, 'accounts-list-$name-3', '/accounts', theme: theme, locale: locale, scroll: 1500);
      await shotAt(tester, 'accounts-list-$name-4', '/accounts', theme: theme, locale: locale, scroll: 2300);
    });
    testWidgets('detail $name', (tester) async {
      await shotAt(tester, 'accounts-detail-$name', '/accounts/10042817', theme: theme, locale: locale);
      await shotAt(tester, 'accounts-detail-$name-2', '/accounts/10042817', theme: theme, locale: locale, scroll: 700);
      await shotAt(tester, 'accounts-detail-$name-3', '/accounts/10042817', theme: theme, locale: locale, scroll: 1400);
      await shotAt(tester, 'accounts-detail-$name-4', '/accounts/10042817', theme: theme, locale: locale, scroll: 2300);
      await shotAt(tester, 'accounts-detail-positions-$name', '/accounts/10042817?tab=positions', theme: theme, locale: locale, scroll: 500);
      await shotAt(tester, 'accounts-detail-credentials-$name', '/accounts/10042817?tab=credentials', theme: theme, locale: locale, scroll: 500);
      await shotAt(tester, 'accounts-detail-settings-$name', '/accounts/20017734?tab=settings', theme: theme, locale: locale, scroll: 500);
    });
    testWidgets('wizard $name', (tester) async {
      await shotAt(tester, 'accounts-new-$name', '/accounts/new', theme: theme, locale: locale);
      await shotAt(tester, 'accounts-new-type-$name', '/accounts/new', theme: theme, locale: locale, before: _continue(1));
      await shotAt(tester, 'accounts-new-configure-$name', '/accounts/new?group=standard&type=demo', theme: theme, locale: locale, scroll: 250);
      // the credentials step (left-to-right shots only: the harness can't drive this step's taps in Arabic)
      if (locale != 'ar') {
        await shotAt(tester, 'accounts-new-done-$name', '/accounts/new?group=standard', theme: theme, locale: locale, before: _openAccount);
        await shotAt(tester, 'accounts-new-done-$name-2', '/accounts/new?group=standard', theme: theme, locale: locale, before: _openAccount, scroll: 500);
      }
    });
    testWidgets('menu and sheets $name', (tester) async {
      await shotAt(tester, 'accounts-menu-$name-open', '/accounts/10042817', theme: theme, locale: locale, before: _menu);
      await shotAt(
        tester,
        'accounts-fund-$name',
        '/accounts/10042817',
        theme: theme,
        locale: locale,
        before: (t) => _tap(t, _button(LucideIcons.arrowDownToLine)),
      );
      await shotAt(tester, 'accounts-between-$name', '/accounts/10042817', theme: theme, locale: locale, before: _menuItem(LucideIcons.arrowLeftRight));
      await shotAt(tester, 'accounts-delete-$name', '/accounts/10042817', theme: theme, locale: locale, before: _menuItem(LucideIcons.trash2));
      await shotAt(tester, 'accounts-close-$name', '/accounts/10042817', theme: theme, locale: locale, before: _menuItem(LucideIcons.lock));
    });
  }

  testWidgets('more states and sheets (light)', (tester) async {
    await shotAt(tester, 'accounts-list-archived-light', '/accounts?tab=archived', scroll: 1150);
    await shotAt(tester, 'accounts-list-demo-light', '/accounts?tab=demo', scroll: 1150);
    await shotAt(tester, 'accounts-detail-archived-light', '/accounts/10038890');
    await shotAt(tester, 'accounts-detail-notfound-light', '/accounts/12345678');
    await shotAt(tester, 'accounts-detail-cent-light', '/accounts/10051123');
    await shotAt(tester, 'accounts-detail-demo-light', '/accounts/20017734');
    await shotAt(tester, 'accounts-new-review-light', '/accounts/new?group=pro', before: _continue(1));
    await shotAt(tester, 'accounts-rename-light', '/accounts/10042817', before: _menuItem(LucideIcons.pencilLine));
    await shotAt(tester, 'accounts-type-light', '/accounts/10051123', before: _menuItem(LucideIcons.layers));
    await shotAt(tester, 'accounts-demobalance-light', '/accounts/20017734', before: _menuItem(LucideIcons.coins));
    await shotAt(
      tester,
      'accounts-password-light',
      '/accounts/10042817?tab=credentials',
      before: (t) async {
        await t.drag(find.byType(Scrollable).hitTestable().first, const Offset(0, -500));
        await settle(t, frames: 4);
        await _tap(t, _button(LucideIcons.pencil));
      },
    );
    await shotAt(
      tester,
      'accounts-leverage-stepup-light',
      '/accounts',
      before: (t) async {
        // a fresh demo account (no positions, so the leverage can change)
        previewAccounts('POST', 'trading/accounts', {'type': 'demo', 'group': 'standard', 'leverage': 500, 'initialBalance': 10000}, const {});
        ProviderScope.containerOf(t.element(find.byType(EzymexApp))).read(routerProvider).go('/accounts/20020001?tab=settings');
        await settle(t);
        await t.drag(find.byType(Scrollable).hitTestable().first, const Offset(0, -500));
        await settle(t, frames: 4);
        await _tap(t, find.text('1:100'));
        await _tap(t, find.text('Apply'));
      },
    );
  });
}
