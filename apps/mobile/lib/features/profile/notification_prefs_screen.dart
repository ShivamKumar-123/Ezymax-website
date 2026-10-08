// Profile & Security › Notifications: port of the web page (apps/crm/app/(app)/profile/notifications/page.tsx,
// live branch): the catalog of topics with an in-app and an email switch each (services/support preferences via
// `notifications/prefs`), locked topics "Always", and the marketing emails following the account-level consent
// (`auth/marketing`). Phone order: "← Profile", header, Channels per topic.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'widgets/profile_ui.dart';

/// One topic of the catalog (web Cat).
class NotifTopic {
  const NotifTopic({required this.key, required this.label, required this.hint, required this.locked});
  final String key, label, hint;
  final bool locked;

  static NotifTopic fromJson(Map<String, dynamic> j) =>
      NotifTopic(key: '${j['key'] ?? ''}', label: '${j['label'] ?? ''}', hint: '${j['hint'] ?? ''}', locked: j['locked'] == true);
}

/// A topic's switches (web Prefs[key]); missing topics read as in-app on, email off.
typedef NotifPref = ({bool inApp, bool email});

Map<String, NotifPref> parseNotifPrefs(Object? v) => {
  if (v is Map)
    for (final e in v.entries)
      if (e.value is Map) '${e.key}': (inApp: (e.value as Map)['inApp'] != false, email: (e.value as Map)['email'] == true),
};

class NotificationPrefsScreen extends ConsumerStatefulWidget {
  const NotificationPrefsScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params).
  final Map<String, String> query;

  @override
  ConsumerState<NotificationPrefsScreen> createState() => _NotificationPrefsScreenState();
}

class _NotificationPrefsScreenState extends ConsumerState<NotificationPrefsScreen> {
  List<NotifTopic>? _catalog;
  Map<String, NotifPref> _prefs = {};
  String? _error;
  bool? _consent;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    // called from initState: read the translations only after the first await (inherited widgets aren't ready yet)
    final api = ref.read(apiProvider);
    await Future.wait<void>([
      () async {
        try {
          final d = await api.get<Map<String, dynamic>>('notifications/prefs');
          if (!mounted) return;
          final cat = d['catalog'];
          if (cat is! List) throw ApiException(status: 200, code: 'error', message: context.t('profile.notifications.loadError'));
          setState(() {
            _catalog = [
              for (final c in cat)
                if (c is Map) NotifTopic.fromJson(c.cast<String, dynamic>()),
            ];
            _prefs = parseNotifPrefs(d['prefs']);
            _error = null;
          });
        } on ApiException catch (e) {
          if (mounted) setState(() => _error = e.message);
        }
      }(),
      () async {
        try {
          final d = await api.get<Map<String, dynamic>>('auth/marketing');
          final c = d['marketing_consent'];
          if (c is bool && mounted) setState(() => _consent = c);
        } on ApiException {
          // the switch stays "…" like the web
        }
      }(),
    ]);
  }

  void _toast(NotificationKind kind, String title, {String? description}) =>
      ref.read(notificationsProvider.notifier).toast(kind, title, description: description);

  Future<void> _change(String key, String channel, bool value) async {
    final t = context.t;
    final prev = _prefs;
    final cur = _prefs[key] ?? (inApp: true, email: false);
    setState(() => _prefs = {..._prefs, key: channel == 'inApp' ? (inApp: value, email: cur.email) : (inApp: cur.inApp, email: value)});
    try {
      final d = await apiPut<Map<String, dynamic>>(ref.read(apiProvider), 'notifications/prefs', {
        'prefs': {
          key: {channel: value},
        },
      });
      if (d['prefs'] is! Map) throw ApiException(status: 200, code: 'error', message: t('profile.notifications.tryAgain'));
      if (!mounted) return;
      setState(() => _prefs = parseNotifPrefs(d['prefs']));
      _toast(NotificationKind.success, t('profile.notifications.saved'));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _prefs = prev);
      _toast(NotificationKind.error, t('profile.notifications.notSaved'), description: e.isNetwork ? t('profile.notifications.tryAgain') : e.message);
    }
  }

  Future<void> _changeConsent(bool value) async {
    final t = context.t;
    final prev = _consent;
    setState(() => _consent = value);
    try {
      await apiPut<Object?>(ref.read(apiProvider), 'auth/marketing', {'consent': value});
      if (mounted) _toast(NotificationKind.success, t('profile.notifications.saved'));
    } on ApiException {
      if (!mounted) return;
      setState(() => _consent = prev);
      _toast(NotificationKind.error, t('profile.notifications.notSaved'), description: t('profile.notifications.tryAgain'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final catalog = _catalog;

    Widget always() => SizedBox(
      width: 58,
      child: Text(
        t('profile.notifications.always'),
        textAlign: TextAlign.center,
        style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12),
      ),
    );

    Widget toggle(bool value, String label, ValueChanged<bool> onChanged) => SizedBox(
      width: 58,
      child: Center(
        child: KSwitch(value: value, semanticLabel: label, onChanged: readOnly ? null : onChanged),
      ),
    );

    Widget row(NotifTopic c, bool last) {
      final p = _prefs[c.key] ?? (inApp: true, email: false);
      final label = t.dyn('profile.notifications.cat.${c.key}', fallback: c.label);
      final Widget email = c.locked
          ? always()
          : c.key == 'marketing'
          ? (_consent == null
                ? SizedBox(
                    width: 58,
                    child: Text(
                      '…',
                      textAlign: TextAlign.center,
                      style: context.text.footnote.copyWith(color: k.fg3),
                    ),
                  )
                : toggle(_consent!, t('profile.notifications.toggleEmail', {'label': label}), (v) => unawaited(_changeConsent(v))))
          : toggle(p.email, t('profile.notifications.toggleEmail', {'label': label}), (v) => unawaited(_change(c.key, 'email', v)));
      return Container(
        key: ValueKey('pref-${c.key}'),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          border: last ? null : Border(bottom: BorderSide(color: k.line, width: 0.6)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(label, style: context.text.headline.copyWith(fontSize: 14, fontWeight: FontWeight.w500)),
                      ),
                      if (c.locked) ...[const SizedBox(width: 6), Icon(LucideIcons.lock, size: 12, color: k.fg3)],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    t.dyn('profile.notifications.cat.${c.key}.hint', fallback: c.hint),
                    style: context.text.footnote.copyWith(color: k.fg3),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (c.locked) always() else toggle(p.inApp, t('profile.notifications.toggleInApp', {'label': label}), (v) => unawaited(_change(c.key, 'inApp', v))),
            const SizedBox(width: 4),
            email,
          ],
        ),
      );
    }

    return KPageScroll(
      onRefresh: _load,
      children: [
        PBackLink(label: t('profile.title'), href: '/profile'),
        const SizedBox(height: 8),
        PPageHeader(title: t('profile.notifications.title'), subtitle: t('profile.notifications.subtitle')),
        KCard(
          padding: const EdgeInsets.fromLTRB(18, 18, 14, 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PCardHeader(title: t('profile.notifications.channels'), subtitle: t('profile.notifications.channelsHint')),
              const SizedBox(height: 6),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: context.text.footnote.copyWith(color: k.down, fontSize: 13),
                  ),
                )
              else if (catalog == null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Text(
                    t('common.loading'),
                    textAlign: TextAlign.center,
                    style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13),
                  ),
                )
              else
                for (var i = 0; i < catalog.length; i++) row(catalog[i], i == catalog.length - 1),
            ],
          ),
        ),
      ],
    );
  }
}
