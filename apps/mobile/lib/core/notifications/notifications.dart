// One inbox for the app, like the web's NotificationsProvider (apps/crm/components/notifications.tsx):
// - the client's notifications from the notification service (`GET notifications?limit=40`, live over the support
//   stream: deposits, withdrawals, verification, margin calls, support replies, announcements);
// - Kalks Trader's engine notifications (fill, close, sl, tp, triggered, rejected, margin call, stop out, balance,
//   correction), pushed by the terminal screens with `push()`;
// - the app's own feedback messages (`toast()`), kept on the device as history (the web's event log).
// Every new notification also drops in as an iOS-style banner (tap opens its link). The bell and the dashboard's
// Notifications list read this store. Off for view-only sessions.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../env.dart';
import '../../i18n/i18n.dart';
import '../../ui/components/banner.dart';
import '../../ui/tokens.dart';
import '../api/api_providers.dart';
import '../auth/auth_controller.dart';
import '../config/app_config.dart';
import '../format/format.dart';
import '../prefs.dart';
import '../realtime/support_stream.dart';

enum NotificationSource { server, engine, local }

enum NotificationKind { success, error, warning, info, neutral }

class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.title,
    required this.createdAt,
    this.serverId,
    this.type = '',
    this.category = 'system',
    this.severity = 'info',
    this.body = '',
    this.link,
    this.read = false,
    this.source = NotificationSource.server,
  });

  final String id;
  final int? serverId;
  final String type;

  /// security | trading_alerts | trading_fills | wallet | kyc | ib | copy | prop | support | marketing | system
  final String category;

  /// info | success | warning | critical
  final String severity;
  final String title;
  final String body;

  /// A Client Area path ("/wallet/history") or a web URL.
  final String? link;
  final bool read;
  final DateTime createdAt;
  final NotificationSource source;

  NotificationItem copyWith({bool? read}) => NotificationItem(
    id: id,
    serverId: serverId,
    type: type,
    category: category,
    severity: severity,
    title: title,
    body: body,
    link: link,
    read: read ?? this.read,
    createdAt: createdAt,
    source: source,
  );

  static NotificationItem fromServer(Map<String, dynamic> j) => NotificationItem(
    id: 'srv-${j['id']}',
    serverId: (j['id'] as num?)?.toInt(),
    type: '${j['type'] ?? ''}',
    category: '${j['category'] ?? 'system'}',
    severity: '${j['severity'] ?? 'info'}',
    title: '${j['title'] ?? ''}',
    body: '${j['body'] ?? ''}',
    link: j['link'] as String?,
    read: j['read'] == true,
    createdAt: DateTime.tryParse('${j['createdAt'] ?? j['created_at']}') ?? DateTime.now(),
  );

  Map<String, dynamic> toLocalJson() => {
    'id': id,
    'title': title,
    'body': body,
    'severity': severity,
    'read': read,
    'at': createdAt.toIso8601String(),
    'source': source.name,
    'category': category,
    'link': link,
  };

  static NotificationItem fromLocalJson(Map<String, dynamic> j) => NotificationItem(
    id: '${j['id']}',
    title: '${j['title'] ?? ''}',
    body: '${j['body'] ?? ''}',
    severity: '${j['severity'] ?? 'info'}',
    category: '${j['category'] ?? 'system'}',
    link: j['link'] as String?,
    read: j['read'] == true,
    createdAt: DateTime.tryParse('${j['at']}') ?? DateTime.now(),
    source: NotificationSource.values.firstWhere((s) => s.name == j['source'], orElse: () => NotificationSource.local),
  );

  /// Pastel tile tone per category (web CATEGORY_TONE); critical is always coral.
  KTone get tone {
    if (severity == 'critical') return KTone.coral;
    if (source == NotificationSource.local) {
      return switch (severity) {
        'success' => KTone.mint,
        'error' => KTone.coral,
        'warning' => KTone.amber,
        'info' => KTone.sky,
        _ => KTone.lavender,
      };
    }
    return const {
          'security': KTone.lavender,
          'trading_alerts': KTone.amber,
          'trading_fills': KTone.accent,
          'wallet': KTone.mint,
          'kyc': KTone.sky,
          'ib': KTone.amber,
          'copy': KTone.pink,
          'prop': KTone.amber,
          'support': KTone.lavender,
          'marketing': KTone.pink,
        }[category] ??
        KTone.neutral;
  }

  /// Icon per category (web CATEGORY_ICON).
  IconData get icon {
    if (source == NotificationSource.local) {
      return switch (severity) {
        'success' => LucideIcons.circleCheck,
        'error' => LucideIcons.circleX,
        'warning' => LucideIcons.triangleAlert,
        'info' => LucideIcons.info,
        _ => LucideIcons.bell,
      };
    }
    return const {
          'security': LucideIcons.shieldCheck,
          'trading_alerts': LucideIcons.triangleAlert,
          'trading_fills': LucideIcons.candlestickChart,
          'wallet': LucideIcons.wallet,
          'kyc': LucideIcons.idCard,
          'ib': LucideIcons.coins,
          'copy': LucideIcons.users,
          'prop': LucideIcons.trophy,
          'support': LucideIcons.lifeBuoy,
          'marketing': LucideIcons.megaphone,
        }[category] ??
        LucideIcons.bell;
  }
}

@immutable
class NotificationsState {
  const NotificationsState({this.items = const [], this.serverUnread = 0, this.loaded = false});
  final List<NotificationItem> items;

  /// The service's unread count (may cover more than the first page).
  final int serverUnread;
  final bool loaded;

  /// Server unread + unread engine / local events.
  int get unread => serverUnread + items.where((i) => !i.read && i.source != NotificationSource.server).length;
}

class NotificationsController extends Notifier<NotificationsState> {
  static const int _cap = 100;
  StreamSubscription<Map<String, dynamic>>? _sub;
  String? _userKey;

  @override
  NotificationsState build() {
    final key = ref.watch(authProvider.select((s) => s is AuthSignedIn && !s.me.readOnly ? '${s.me.id}' : null));
    ref.onDispose(() => _sub?.cancel());
    _userKey = key;
    if (key == null) return const NotificationsState();
    final local = ref.read(prefsProvider).eventLog(key).map(NotificationItem.fromLocalJson).toList();
    Future.microtask(() async {
      await load();
      _listen();
    });
    return NotificationsState(items: _sorted(local));
  }

  static List<NotificationItem> _sorted(Iterable<NotificationItem> xs) => xs.toList()..sort((a, b) => b.createdAt.compareTo(a.createdAt));

  ApiClient get _api => ref.read(apiProvider);

  /// The first page of the inbox (also after a reconnect: whatever was missed).
  Future<void> load() async {
    if (_userKey == null) return;
    try {
      final d = await _api.get<Map<String, dynamic>>('notifications', query: {'limit': 40});
      final server = [for (final i in (d['items'] as List? ?? const [])) NotificationItem.fromServer((i as Map).cast<String, dynamic>())];
      final others = state.items.where((i) => i.source != NotificationSource.server);
      state = NotificationsState(items: _sorted([...server, ...others]), serverUnread: (d['unread'] as num?)?.toInt() ?? 0, loaded: true);
    } catch (_) {
      state = NotificationsState(items: state.items, serverUnread: state.serverUnread, loaded: true);
    }
  }

  void _listen() {
    final stream = ref.read(supportStreamProvider);
    if (stream == null) return;
    _sub?.cancel();
    _sub = stream.frames.listen(_onFrame);
  }

  void _onFrame(Map<String, dynamic> f) {
    switch (f['type']) {
      case 'reconnected':
        unawaited(load());
      case 'hello':
        state = NotificationsState(items: state.items, serverUnread: (f['unread'] as num?)?.toInt() ?? state.serverUnread, loaded: state.loaded);
      case 'notification':
        if (f['item'] is! Map) return;
        final it = NotificationItem.fromServer((f['item'] as Map).cast<String, dynamic>());
        if (state.items.any((x) => x.id == it.id)) return;
        state = NotificationsState(
          items: _sorted([it, ...state.items]).take(_cap).toList(),
          serverUnread: (f['unread'] as num?)?.toInt() ?? state.serverUnread + 1,
          loaded: state.loaded,
        );
        // a reply in the chat being read needs no banner
        if (it.type == 'support.reply' && ref.read(currentPathProvider).startsWith('/support')) return;
        _banner(it);
      case 'notifications.read':
        final unread = (f['unread'] as num?)?.toInt() ?? state.serverUnread;
        List<NotificationItem> items;
        if (f['cleared'] == true) {
          items = state.items.where((i) => i.source != NotificationSource.server).toList();
        } else if (f['all'] == true) {
          items = [for (final i in state.items) i.source == NotificationSource.server ? i.copyWith(read: true) : i];
        } else {
          final ids = {for (final id in (f['ids'] as List? ?? const [])) 'srv-$id'};
          items = [for (final i in state.items) ids.contains(i.id) ? i.copyWith(read: true) : i];
        }
        state = NotificationsState(items: items, serverUnread: unread, loaded: state.loaded);
    }
  }

  void _banner(NotificationItem it) {
    final b = KBannerData(title: it.title, body: it.body.isEmpty ? null : it.body, tone: it.tone, time: _time(it.createdAt), onTap: () => open(it));
    ref.read(bannerProvider).show(b);
  }

  /// "Just now" on a fresh banner, the bell's relative time otherwise.
  String _time(DateTime at) => timeAgo(ref.read(tProvider), LocaleFormat(ref.read(localeProvider)), at, DateTime.now());

  /// Tapping a notification: marks it read and opens its link (a Client Area path, or the web).
  void open(NotificationItem it) {
    if (!it.read) markOne(it);
    final link = it.link;
    if (link != null && link.isNotEmpty) ref.read(linkOpenerProvider)(link);
  }

  void markOne(NotificationItem it) {
    state = NotificationsState(
      items: [for (final i in state.items) i.id == it.id ? i.copyWith(read: true) : i],
      serverUnread: it.source == NotificationSource.server && !it.read ? (state.serverUnread - 1).clamp(0, 1 << 30) : state.serverUnread,
      loaded: state.loaded,
    );
    if (it.serverId != null) {
      unawaited(
        _api
            .post<Object?>(
              'notifications/read',
              body: {
                'ids': [it.serverId],
              },
            )
            .catchError((Object _) => null),
      );
    }
    _saveLocal();
  }

  void markAll() {
    final hadServer = state.serverUnread > 0;
    state = NotificationsState(items: [for (final i in state.items) i.copyWith(read: true)], loaded: state.loaded);
    if (hadServer) unawaited(_api.post<Object?>('notifications/read', body: {'all': true}).catchError((Object _) => null));
    _saveLocal();
  }

  void clear() {
    final hadServer = state.items.any((i) => i.source == NotificationSource.server);
    state = NotificationsState(loaded: state.loaded);
    if (hadServer) unawaited(_api.post<Object?>('notifications/clear').catchError((Object _) => null));
    _saveLocal();
  }

  /// Kalks Trader: an engine notification (also shown as a banner). `category` trading_fills / trading_alerts.
  void push({required String title, String body = '', String severity = 'info', String category = 'trading_fills', String? link, bool banner = true}) {
    final it = NotificationItem(
      id: 'eng-${DateTime.now().microsecondsSinceEpoch}',
      title: title,
      body: body,
      severity: severity,
      category: category,
      link: link,
      createdAt: DateTime.now(),
      source: NotificationSource.engine,
    );
    state = NotificationsState(items: _sorted([it, ...state.items]).take(_cap).toList(), serverUnread: state.serverUnread, loaded: state.loaded);
    _saveLocal();
    if (banner) _banner(it);
  }

  /// The app's feedback (saved, copied, failed): a short banner, kept in the bell like the web's toasts.
  void toast(NotificationKind kind, String title, {String? description, bool keep = true}) {
    final severity = switch (kind) {
      NotificationKind.success => 'success',
      NotificationKind.error => 'error',
      NotificationKind.warning => 'warning',
      NotificationKind.info => 'info',
      NotificationKind.neutral => 'default',
    };
    final it = NotificationItem(
      id: 'loc-${DateTime.now().microsecondsSinceEpoch}',
      title: title,
      body: description ?? '',
      severity: severity,
      createdAt: DateTime.now(),
      source: NotificationSource.local,
      read: !keep,
    );
    if (keep && _userKey != null) {
      state = NotificationsState(items: _sorted([it, ...state.items]).take(_cap).toList(), serverUnread: state.serverUnread, loaded: state.loaded);
      _saveLocal();
    }
    final b = KBannerData(title: title, body: description, tone: it.tone, time: _time(it.createdAt), duration: const Duration(milliseconds: 2600));
    ref.read(bannerProvider).show(b);
  }

  void _saveLocal() {
    final key = _userKey;
    if (key == null) return;
    final local = state.items.where((i) => i.source != NotificationSource.server).take(_cap).map((i) => i.toLocalJson()).toList();
    unawaited(ref.read(prefsProvider).setEventLog(key, local));
  }
}

final notificationsProvider = NotifierProvider<NotificationsController, NotificationsState>(NotificationsController.new);

/// The banner queue drawn by KBannerHost (app root), headed by the tenant's name and icon like an iOS notification.
final bannerProvider = Provider<KBannerController>((ref) {
  final c = KBannerController();
  ref.onDispose(c.dispose);
  void brand(AppConfig cfg) {
    c.appName = cfg.tenantName;
    c.brandLetter = cfg.tenantDefault ? null : cfg.tenantName.characters.first.toUpperCase();
  }

  brand(ref.read(configProvider));
  ref.listen(configProvider, (_, cfg) => brand(cfg));
  return c;
});

/// The current route path (kept up to date by the router), e.g. to skip the chat banner while the chat is open.
class CurrentPath extends Notifier<String> {
  @override
  String build() => '/';
  void set(String p) {
    if (p != state) state = p;
  }
}

final currentPathProvider = NotifierProvider<CurrentPath, String>(CurrentPath.new);

/// Opens a link: an in-app path through the router, anything else in the browser (the router installs the handler).
class LinkOpener {
  void Function(String link)? handler;
  void call(String link) => handler?.call(link);
}

final linkOpenerProvider = Provider<LinkOpener>((ref) => LinkOpener());

/// The support stream (bell + chat), while a client (not a view-only login) is signed in. Not in previews or the demo.
final supportStreamProvider = Provider<SupportStream?>((ref) {
  final key = ref.watch(authProvider.select((s) => s is AuthSignedIn && !s.me.readOnly ? '${s.me.id}' : null));
  final demo = ref.watch(demoModeProvider);
  if (key == null || Env.preview || demo) return null;
  final s = SupportStream(api: ref.read(apiProvider), streamUrl: () => ref.read(configProvider).supportStream);
  s.start();
  ref.onDispose(() => unawaited(s.dispose()));
  return s;
});
