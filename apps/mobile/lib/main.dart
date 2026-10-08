// Ezymex: the Client Area and Ezymex Trader as one native app (Android first). See README.md.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';
import 'core/app_info.dart';
import 'core/prefs.dart';
import 'i18n/i18n.dart';
import 'preview/preview_data.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // edge to edge: the frosted bars draw under the status and navigation bars
  unawaited(SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge));
  unawaited(SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]));

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
      child: const EzymexApp(),
    ),
  );
}
