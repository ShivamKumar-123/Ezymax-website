// Ezymex Trader on its own, for design previews and screenshots while other parts of the app are being built:
//   flutter build web -t lib/features/terminal/preview/terminal_preview_main.dart --dart-define=EZYMEX_PREVIEW=true \
//     --no-web-resources-cdn --output build/web-d
// then open `?signedIn=1#/trader?login=10042817` (also `&lang=ar`). The same screen, providers and sample data as the
// app (lib/main.dart + lib/app.dart), without the Client Area's router. Never part of a build that ships (the app's
// entry point is lib/main.dart).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../../../core/app_info.dart';
import '../../../core/config/app_config.dart';
import '../../../core/notifications/notifications.dart';
import '../../../core/prefs.dart';
import '../../../core/theme_controller.dart';
import '../../../i18n/i18n.dart';
import '../../../preview/preview_data.dart';
import '../../../ui/ui.dart';
import '../terminal_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await Prefs.open();
  final forced = previewLang;
  final locale = isLocale(forced) ? forced! : initialLocale(prefs);
  await initializeDateFormatting();
  final results = await Future.wait<Object>([I18nBundle.load(locale), AppInfo.load()]);
  runApp(
    ProviderScope(
      overrides: [
        prefsProvider.overrideWithValue(prefs),
        i18nBootProvider.overrideWithValue(results[0] as I18nBundle),
        appInfoProvider.overrideWithValue(results[1] as AppInfo),
      ],
      child: const _TerminalPreviewApp(),
    ),
  );
}

final GoRouter _router = GoRouter(
  initialLocation: '/trader',
  routes: [
    GoRoute(
      path: '/',
      builder: (c, s) => const Scaffold(body: Center(child: KBrandAvatar(size: 64))),
    ),
    GoRoute(path: '/trader', builder: (c, s) => TerminalScreen.fromQuery(s.uri.queryParameters)),
  ],
);

class _TerminalPreviewApp extends ConsumerWidget {
  const _TerminalPreviewApp();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bundle = ref.watch(i18nProvider);
    final t = bundle.t;
    final brand = ref.watch(configProvider.select((c) => c.brand));
    final banners = ref.watch(bannerProvider);
    return MaterialApp.router(
      title: 'Ezymex Trader',
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      theme: KTheme.client(Brightness.light, brand: brand),
      darkTheme: KTheme.client(Brightness.dark, brand: brand),
      themeMode: ref.watch(themeModeProvider),
      locale: Locale(bundle.locale),
      supportedLocales: [for (final l in kLocales) Locale(l.code)],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      scrollBehavior: const KScrollBehavior(),
      builder: (context, child) => I18nScope(
        t: t,
        child: Directionality(
          textDirection: t.rtl ? TextDirection.rtl : TextDirection.ltr,
          child: KBannerHost(controller: banners, child: child ?? const SizedBox.shrink()),
        ),
      ),
    );
  }
}
