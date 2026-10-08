import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../preview/preview_data.dart';
import 'prefs.dart';

/// The Client Area theme (light by default, like the web) and Ezymex Trader's (dark by default).
class ThemeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    final forced = previewTheme;
    if (forced == 'dark') return ThemeMode.dark;
    if (forced == 'light') return ThemeMode.light;
    return ref.read(prefsProvider).themeMode;
  }

  Future<void> set(ThemeMode m) async {
    state = m;
    await ref.read(prefsProvider).setThemeMode(m);
  }

  /// The web's toggle: light <-> dark.
  Future<void> toggle(Brightness current) => set(current == Brightness.dark ? ThemeMode.light : ThemeMode.dark);
}

final themeModeProvider = NotifierProvider<ThemeController, ThemeMode>(ThemeController.new);

class TraderThemeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() => ref.read(prefsProvider).traderThemeMode;

  Future<void> set(ThemeMode m) async {
    state = m;
    await ref.read(prefsProvider).setTraderThemeMode(m);
  }
}

final traderThemeModeProvider = NotifierProvider<TraderThemeController, ThemeMode>(TraderThemeController.new);
