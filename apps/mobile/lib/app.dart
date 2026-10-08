import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth_controller.dart';
import 'core/config/app_config.dart';
import 'core/lifecycle.dart';
import 'core/notifications/notifications.dart';
import 'core/theme_controller.dart';
import 'i18n/i18n.dart';
import 'router/router.dart';
import 'ui/ui.dart';

/// The app: one MaterialApp for the Client Area (pastel light by default) with Ezymex Trader on its own themed route.
class EzymexApp extends ConsumerStatefulWidget {
  const EzymexApp({super.key});

  @override
  ConsumerState<EzymexApp> createState() => _EzymexAppState();
}

class _EzymexAppState extends ConsumerState<EzymexApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final fg = state == AppLifecycleState.resumed;
    ref.read(appForegroundProvider.notifier).set(fg);
    if (state == AppLifecycleState.paused) ref.read(authProvider.notifier).paused();
    if (fg) {
      ref.read(authProvider.notifier).resumed();
      ref.read(configProvider.notifier).refresh();
      ref.read(supportStreamProvider)?.resume();
    }
  }

  @override
  Widget build(BuildContext context) {
    final bundle = ref.watch(i18nProvider);
    final t = bundle.t;
    final mode = ref.watch(themeModeProvider);
    final brand = ref.watch(configProvider.select((c) => c.brand));
    final router = ref.watch(routerProvider);
    final banners = ref.watch(bannerProvider);
    return MaterialApp.router(
      title: 'Ezymex',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: KTheme.client(Brightness.light, brand: brand),
      darkTheme: KTheme.client(Brightness.dark, brand: brand),
      themeMode: mode,
      locale: Locale(bundle.locale),
      supportedLocales: [for (final l in kLocales) Locale(l.code)],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      scrollBehavior: const KScrollBehavior(),
      builder: (context, child) {
        final b = Theme.of(context).brightness;
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: KTheme.overlay(b),
          child: I18nScope(
            t: t,
            child: Directionality(
              textDirection: t.rtl ? TextDirection.rtl : TextDirection.ltr,
              // the phone's font size setting is honoured up to 1.3x so compact layouts keep their shape
              child: MediaQuery.withClampedTextScaling(
                maxScaleFactor: 1.3,
                child: KBannerHost(controller: banners, child: child ?? const SizedBox.shrink()),
              ),
            ),
          ),
        );
      },
    );
  }
}
