// Profile & Security › Preferences: port of the web page's live branch (apps/crm/app/(app)/profile/preferences/
// page.tsx, `!IS_DEMO`): Appearance (dark / light), Language (the 22 locales), the Notifications link card. The app
// adds its own device preference at the end: biometric unlock (shown where the phone supports it).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/biometrics.dart';
import '../../core/prefs.dart';
import '../../core/theme_controller.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'widgets/profile_ui.dart';

/// Biometric unlock is possible on this phone (false in the web preview and tests).
final biometricAvailableProvider = FutureProvider.autoDispose<bool>((ref) => ref.watch(biometricsProvider).available());

class PreferencesScreen extends ConsumerWidget {
  const PreferencesScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params).
  final Map<String, String> query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final locale = ref.watch(localeProvider);
    final dark = k.dark;
    final bio = ref.watch(biometricAvailableProvider).value ?? false;

    Widget themeTile(bool isDark) {
      final on = dark == isDark;
      final canvas = isDark ? const Color(0xFF07070A) : const Color(0xFFF6F4F1);
      final bar = isDark ? Colors.white.withValues(alpha: 0.15) : Colors.black.withValues(alpha: 0.1);
      final panel = isDark ? const Color(0xFF111114) : Colors.white;
      return Expanded(
        child: KPressable(
          semanticLabel: isDark ? t('profile.prefs.dark') : t('profile.prefs.light'),
          onTap: () => ref.read(themeModeProvider.notifier).set(isDark ? ThemeMode.dark : ThemeMode.light),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: on ? k.ember.withValues(alpha: 0.6) : k.line),
              boxShadow: on ? [BoxShadow(color: k.ember.withValues(alpha: 0.1), spreadRadius: 4)] : null,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    height: 96,
                    color: canvas,
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 64,
                          height: 12,
                          decoration: BoxDecoration(color: bar, borderRadius: BorderRadius.circular(6)),
                        ),
                        const SizedBox(height: 8),
                        Expanded(
                          child: Row(
                            children: [
                              Expanded(
                                child: Container(
                                  decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                width: 32,
                                decoration: BoxDecoration(color: k.ember, borderRadius: BorderRadius.circular(8)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    color: k.cardBg,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        Icon(isDark ? LucideIcons.moon : LucideIcons.sun, size: 16, color: k.fg),
                        const SizedBox(width: 8),
                        Text(isDark ? t('profile.prefs.dark') : t('profile.prefs.light'), style: context.text.label.copyWith(fontSize: 14, color: k.fg)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    Widget language(LocaleInfo l) {
      final on = l.code == locale;
      return KPressable(
        key: ValueKey('lang-${l.code}'),
        semanticLabel: l.name,
        minSize: 36,
        onTap: () => unawaited(ref.read(i18nProvider.notifier).setLocale(l.code)),
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(color: on ? k.emberSoft : Colors.transparent, borderRadius: BorderRadius.circular(12)),
          child: Row(
            children: [
              KFlag(l.flag, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  l.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.footnote.copyWith(fontSize: 13, color: on ? k.ember : k.fg2),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final rows = <Widget>[];
    for (var i = 0; i < kLocales.length; i += 2) {
      rows.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            children: [
              Expanded(child: language(kLocales[i])),
              const SizedBox(width: 6),
              Expanded(child: i + 1 < kLocales.length ? language(kLocales[i + 1]) : const SizedBox.shrink()),
            ],
          ),
        ),
      );
    }

    return KPageScroll(
      children: [
        PPageHeader(title: t('profile.prefs.title'), subtitle: t('profile.prefs.subtitleLive')),
        // appearance
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PCardHeader(title: t('profile.prefs.appearance'), icon: LucideIcons.monitorSmartphone),
              const SizedBox(height: 18),
              Row(children: [themeTile(true), const SizedBox(width: 12), themeTile(false)]),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // language
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PCardHeader(title: t('common.language'), subtitle: t('profile.prefs.languageCount', {'count': kLocales.length}), icon: LucideIcons.languages),
              const SizedBox(height: 14),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 224),
                child: SingleChildScrollView(primary: false, child: Column(children: rows)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        PLinkCard(icon: LucideIcons.bell, title: t('profile.notifCard.title'), text: t('profile.notifCard.hint'), href: '/profile/notifications'),
        // the app's own device preference: biometric unlock
        if (bio) ...[const SizedBox(height: 16), const _BiometricCard()],
      ],
    );
  }
}

class _BiometricCard extends ConsumerStatefulWidget {
  const _BiometricCard();

  @override
  ConsumerState<_BiometricCard> createState() => _BiometricCardState();
}

class _BiometricCardState extends ConsumerState<_BiometricCard> {
  late bool _on = ref.read(prefsProvider).biometricEnabled;

  Future<void> _set(bool v) async {
    // turning it on asks for the biometric once, so the switch is known to work
    if (v && !await ref.read(biometricsProvider).authenticate(context.t('app.unlock.reason'))) return;
    await ref.read(authProvider.notifier).setBiometric(v);
    if (mounted) setState(() => _on = v);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PCardHeader(title: t('security.sessions.thisDevice'), icon: LucideIcons.smartphone),
          const SizedBox(height: 14),
          Row(
            children: [
              Icon(LucideIcons.fingerprint, size: 18, color: k.fg3),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('app.biometric.title'), style: context.text.label.copyWith(fontSize: 13.5, color: k.fg)),
                    const SizedBox(height: 2),
                    Text(t('app.biometric.text'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              KSwitch(value: _on, semanticLabel: t('app.biometric.title'), onChanged: (v) => unawaited(_set(v))),
            ],
          ),
        ],
      ),
    );
  }
}
