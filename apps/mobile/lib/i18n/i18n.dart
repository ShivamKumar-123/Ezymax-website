// Loading the catalogs and switching the language. The chosen locale is kept on the device (Prefs) and sent as
// X-Kalks-Locale; the first start follows the phone's language when Kalks has it, else English (like the web's
// cookie -> Accept-Language -> en).
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/prefs.dart';
import 'locales.dart';
import 't.dart';

export 'locales.dart';
export 't.dart';

Messages _decode(String raw) => (jsonDecode(raw) as Map).cast<String, Object?>();

/// Reads assets/i18n/<code>.json (written by tool/export_i18n.mjs). Large catalogs are decoded off the UI thread.
Future<Messages> loadCatalog(String code, {AssetBundle? bundle}) async {
  final raw = await (bundle ?? rootBundle).loadString('assets/i18n/$code.json', cache: false);
  return raw.length > 50000 && !kIsWeb ? compute(_decode, raw) : _decode(raw);
}

/// The two catalogs a translator needs: English (source and fallback) and the current language.
class I18nBundle {
  const I18nBundle({required this.locale, required this.english, required this.messages});
  final String locale;
  final Messages english;
  final Messages messages;

  T get t => T(locale, messages, english);

  static Future<I18nBundle> load(String locale, {AssetBundle? bundle, Messages? english}) async {
    final en = english ?? await loadCatalog('en', bundle: bundle);
    final own = locale == 'en' ? en : await loadCatalog(locale, bundle: bundle);
    return I18nBundle(locale: locale, english: en, messages: own);
  }
}

/// The locale to start with: the saved choice, else the phone's language, else English.
String initialLocale(Prefs prefs) {
  final saved = prefs.locale;
  if (isLocale(saved)) return saved!;
  for (final l in PlatformDispatcher.instance.locales) {
    final m = matchLocale(l.toLanguageTag());
    if (m != null) return m;
  }
  return kDefaultLocale;
}

/// Overridden in main() with the bundle loaded before the first frame (so the first paint is translated).
final i18nBootProvider = Provider<I18nBundle>((ref) => throw UnimplementedError('i18nBootProvider is set in main()'));

class I18nController extends Notifier<I18nBundle> {
  @override
  I18nBundle build() => ref.read(i18nBootProvider);

  /// Switches the language (loads the catalog first, so the switch is instant and fully translated).
  Future<void> setLocale(String code) async {
    if (!isLocale(code) || code == state.locale) return;
    final next = await I18nBundle.load(code, english: state.english);
    await ref.read(prefsProvider).setLocale(code);
    state = next;
  }
}

final i18nProvider = NotifierProvider<I18nController, I18nBundle>(I18nController.new);

/// The translator for the current language.
final tProvider = Provider<T>((ref) => ref.watch(i18nProvider).t);

/// The current locale code (`en`, `ar`, …).
final localeProvider = Provider<String>((ref) => ref.watch(i18nProvider).locale);

/// Makes the translator reachable from any widget (`context.t`), also outside Riverpod consumers (design system).
class I18nScope extends InheritedWidget {
  const I18nScope({super.key, required this.t, required super.child});
  final T t;

  static T of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<I18nScope>();
    assert(scope != null, 'No I18nScope above this widget');
    return scope!.t;
  }

  @override
  bool updateShouldNotify(I18nScope oldWidget) => oldWidget.t.locale != t.locale || !identical(oldWidget.t, t);
}

extension I18nContext on BuildContext {
  /// The translator: `context.t('common.cancel')`.
  T get t => I18nScope.of(this);
}
