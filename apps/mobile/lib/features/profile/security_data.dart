// The security BFF (`security/*`, web components/security/common.tsx + live-security.tsx + live-viewers.tsx +
// lib/viewer.ts): sessions, sign-in history, closure / data-export requests and view-only logins, their models,
// one provider per web hook (useSec), the device labels from user agents and the compact time texts.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/lifecycle.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'widgets/profile_ui.dart';

/* ------------------------------------------------------------------ models */

int _int(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
String? _str(Object? v) => v is String && v.isNotEmpty ? v : null;
List<Map<String, dynamic>> _list(Object? v) => v is List
    ? [
        for (final x in v)
          if (x is Map) x.cast<String, dynamic>(),
      ]
    : const [];

/// One live session of the client (web SessionRow).
class SecSession {
  const SecSession({
    required this.id,
    required this.current,
    this.ip,
    this.userAgent,
    this.country,
    this.createdAt,
    this.lastSeenAt,
    this.expiresAt,
    this.viewerId,
    this.viewerLabel,
    this.isViewer = false,
  });
  final int id;
  final bool current;
  final String? ip, userAgent, country;
  final DateTime? createdAt, lastSeenAt, expiresAt;
  final bool isViewer;
  final int? viewerId;
  final String? viewerLabel;

  static SecSession fromJson(Map<String, dynamic> j) {
    final v = j['viewer'] is Map ? (j['viewer'] as Map).cast<String, dynamic>() : null;
    return SecSession(
      id: _int(j['id']),
      current: j['current'] == true,
      ip: _str(j['ip']),
      userAgent: _str(j['user_agent']),
      country: _str(j['country']),
      createdAt: parseIso(j['created_at']),
      lastSeenAt: parseIso(j['last_seen_at']),
      expiresAt: parseIso(j['expires_at']),
      isViewer: v != null,
      viewerId: v == null ? null : _int(v['id']),
      viewerLabel: v == null ? null : _str(v['label']),
    );
  }
}

/// `GET security/sessions`: `{items, idle_minutes, max_days}`.
class SessionsPage {
  const SessionsPage({required this.items, required this.idleMinutes, required this.maxDays});
  final List<SecSession> items;
  final int idleMinutes;
  final int maxDays;

  static SessionsPage fromJson(Map<String, dynamic> j) =>
      SessionsPage(items: [for (final x in _list(j['items'])) SecSession.fromJson(x)], idleMinutes: _int(j['idle_minutes']), maxDays: _int(j['max_days']));
}

/// One sign-in event (web LoginRow).
class LoginEvent {
  const LoginEvent({required this.id, required this.at, required this.result, this.ip, this.userAgent, this.country, this.atRaw = ''});
  final int id;
  final DateTime? at;
  final String atRaw;
  final String result;
  final String? ip, userAgent, country;

  static LoginEvent fromJson(Map<String, dynamic> j) => LoginEvent(
    id: _int(j['id']),
    at: parseIso(j['at']),
    atRaw: '${j['at'] ?? ''}',
    result: '${j['result'] ?? ''}',
    ip: _str(j['ip']),
    userAgent: _str(j['user_agent']),
    country: _str(j['country']),
  );
}

/// A closure or data-export request (web ClientRequest, D94).
class ClientRequest {
  const ClientRequest({required this.id, required this.kind, required this.status, this.reason, this.staffNote, this.createdAt, this.closedAt});
  final int id;

  /// closure | data_export
  final String kind;

  /// open | in_progress | completed | rejected | cancelled
  final String status;
  final String? reason, staffNote;
  final DateTime? createdAt, closedAt;

  bool get pending => status == 'open' || status == 'in_progress';

  static ClientRequest fromJson(Map<String, dynamic> j) => ClientRequest(
    id: _int(j['id']),
    kind: '${j['kind'] ?? ''}',
    status: '${j['status'] ?? ''}',
    reason: _str(j['reason']),
    staffNote: _str(j['staff_note']),
    createdAt: parseIso(j['created_at']),
    closedAt: parseIso(j['closed_at']),
  );
}

/// A view-only login (web lib/viewer.ts ViewerScope).
class ViewerLogin {
  const ViewerLogin({
    required this.id,
    required this.label,
    required this.username,
    required this.accounts,
    required this.sections,
    required this.status,
    this.expiresAt,
    this.revokedAt,
    this.lastLoginAt,
    this.createdAt,
  });
  final int id;
  final String label, username;
  final List<String> accounts;
  final List<String> sections;

  /// active | expired | revoked
  final String status;
  final DateTime? expiresAt, revokedAt, lastLoginAt, createdAt;

  static ViewerLogin fromJson(Map<String, dynamic> j) => ViewerLogin(
    id: _int(j['id']),
    label: '${j['label'] ?? ''}',
    username: '${j['username'] ?? ''}',
    accounts: j['accounts'] is List ? [for (final a in j['accounts'] as List) '$a'] : const [],
    sections: j['sections'] is List ? [for (final s in j['sections'] as List) '$s'] : const [],
    status: '${j['status'] ?? 'active'}',
    expiresAt: parseIso(j['expires_at']),
    revokedAt: parseIso(j['revoked_at']),
    lastLoginAt: parseIso(j['last_login_at']),
    createdAt: parseIso(j['created_at']),
  );
}

/// A viewer's sign-in or page view (web Activity).
class ViewerActivity {
  const ViewerActivity({required this.id, required this.action, this.label, this.path, this.ip, this.userAgent, this.at});
  final int id;
  final String action;
  final String? label, path, ip, userAgent;
  final DateTime? at;

  static ViewerActivity fromJson(Map<String, dynamic> j) => ViewerActivity(
    id: _int(j['id']),
    action: '${j['action'] ?? ''}',
    label: _str(j['label']),
    path: _str(j['path']),
    ip: _str(j['ip']),
    userAgent: _str(j['user_agent']),
    at: parseIso(j['at']),
  );
}

/// `GET security/viewers`: `{items, activity, max}`.
class ViewersPage {
  const ViewersPage({required this.items, required this.activity, required this.max});
  final List<ViewerLogin> items;
  final List<ViewerActivity> activity;
  final int max;

  int get active => items.where((v) => v.status == 'active').length;

  static ViewersPage fromJson(Map<String, dynamic> j) => ViewersPage(
    items: [for (final x in _list(j['items'])) ViewerLogin.fromJson(x)],
    activity: [for (final x in _list(j['activity'])) ViewerActivity.fromJson(x)],
    max: j['max'] == null ? 10 : _int(j['max']),
  );
}

/* ------------------------------------------------------------------ providers (web useSec) */

/// `useSec("sessions", 30_000)`.
final securitySessionsProvider = FutureProvider.autoDispose<SessionsPage>((ref) async {
  ref.pollEvery(const Duration(seconds: 30));
  return SessionsPage.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('security/sessions'));
});

/// `useSec("logins")`.
final securityLoginsProvider = FutureProvider.autoDispose<List<LoginEvent>>((ref) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('security/logins');
  return [for (final x in _list(j['items'])) LoginEvent.fromJson(x)];
});

/// `useSec("requests")`.
final securityRequestsProvider = FutureProvider.autoDispose<List<ClientRequest>>((ref) async {
  final j = await ref.watch(apiProvider).get<Map<String, dynamic>>('security/requests');
  return [for (final x in _list(j['items'])) ClientRequest.fromJson(x)];
});

/// `useSec("viewers")`.
final viewersProvider = FutureProvider.autoDispose<ViewersPage>((ref) async {
  return ViewersPage.fromJson(await ref.watch(apiProvider).get<Map<String, dynamic>>('security/viewers'));
});

/* ------------------------------------------------------------------ devices (web parseDevice) */

enum DeviceKind { desktop, mobile, tablet, unknown }

class Device {
  const Device(this.browser, this.os, this.kind);
  final String browser, os;
  final DeviceKind kind;
}

/// Browser, OS and form factor from a user agent (best effort; a port of the web's parseDevice, same rules and
/// order, so a session reads the same on the web and in the app).
Device parseDevice(String? ua, T t) {
  final u = ua ?? '';
  if (u.isEmpty) return Device(t('security.device.unknownBrowser'), t('security.device.unknownDevice'), DeviceKind.unknown);
  bool has(String re, {bool ci = false}) => RegExp(re, caseSensitive: !ci).hasMatch(u);
  final browser = has(r'Edg/')
      ? 'Edge'
      : has(r'OPR/|Opera')
      ? 'Opera'
      : has('SamsungBrowser')
      ? 'Samsung Internet'
      : has(r'Firefox/|FxiOS')
      ? 'Firefox'
      : has(r'CriOS|Chrome/')
      ? 'Chrome'
      : has(r'Safari/')
      ? 'Safari'
      : has('curl|python|node|axios', ci: true)
      ? t('security.device.apiClient')
      : t('security.device.browser');
  final os = has('iPad')
      ? 'iPadOS'
      : has('iPhone|iPod')
      ? 'iOS'
      : has('Android')
      ? 'Android'
      : has('Windows NT')
      ? 'Windows'
      : has('Mac OS X|Macintosh')
      ? 'macOS'
      : has('CrOS')
      ? 'ChromeOS'
      : has('Linux')
      ? 'Linux'
      : t('security.device.unknownOs');
  final kind = has('iPad|Tablet') || (has('Android') && !has('Mobile'))
      ? DeviceKind.tablet
      : has('Mobi|iPhone|Android')
      ? DeviceKind.mobile
      : has('Windows|Macintosh|Linux|CrOS')
      ? DeviceKind.desktop
      : DeviceKind.unknown;
  return Device(browser, os, kind);
}

/// web DeviceIcon.
IconData deviceIcon(DeviceKind kind) => switch (kind) {
  DeviceKind.mobile => LucideIcons.smartphone,
  DeviceKind.tablet => LucideIcons.tablet,
  DeviceKind.desktop => LucideIcons.laptop,
  DeviceKind.unknown => LucideIcons.earth,
};

/* ------------------------------------------------------------------ time texts */

/// "Just now", "12 min ago", "3 h ago", "2 d ago" (web `ago`).
String secAgo(T t, DateTime? at, [DateTime? now]) {
  if (at == null) return '—';
  final s = ((now ?? DateTime.now()).difference(at).inMilliseconds / 1000).round();
  final secs = s < 0 ? 0 : s;
  if (secs < 90) return t('security.ago.now');
  if (secs < 3600) return t('security.ago.min', {'n': (secs / 60).round()});
  if (secs < 86400) return t('security.ago.hours', {'n': (secs / 3600).round()});
  return t('security.ago.days', {'n': (secs / 86400).round()});
}

/// "1 day", "2 hours", "30 minutes" (web idleLabel).
String idleLabel(int min, T t) {
  if (min > 0 && min % 1440 == 0) return t('security.idle.days', {'count': min ~/ 1440});
  if (min > 0 && min % 60 == 0) return t('security.idle.hours', {'count': min ~/ 60});
  return t('security.idle.minutes', {'count': min});
}

/* ------------------------------------------------------------------ view-only sections (lib/viewer.ts) */

/// VIEWER_SECTION_KEYS with their English label / hint (the web's fallbacks; the catalog translates them).
const List<(String key, String label, String hint)> kViewerSections = [
  ('dashboard', 'Dashboard', 'Overview, markets, news and calendar'),
  ('accounts', 'Accounts & positions', 'Balances, open positions and orders'),
  ('history', 'Trade history & statements', 'Closed trades, ledger and statements'),
  ('wallet', 'Wallet balances', 'USDT balance and wallet history'),
  ('partner', 'Partner dashboard', 'IB clients and commissions'),
];

String viewerSectionLabel(T t, String k) {
  final def = kViewerSections.where((s) => s.$1 == k).firstOrNull;
  return t.dyn('security.section.$k.label', fallback: def?.$2 ?? k);
}

String viewerSectionHint(T t, String k) {
  final def = kViewerSections.where((s) => s.$1 == k).firstOrNull;
  return t.dyn('security.section.$k.hint', fallback: def?.$3 ?? '');
}

/// The viewer ID as the web's input keeps it: lowercase, [a-z0-9._-] only, 32 characters at most.
String cleanViewerId(String v) {
  final s = v.toLowerCase().replaceAll(RegExp(r'[^a-z0-9._-]'), '');
  return s.length > 32 ? s.substring(0, 32) : s;
}

/// The web's localCheck of the viewer form: error keys by field (empty when valid).
Map<String, String> viewerFormErrors({required String label, required String username, required List<String> sections}) => {
  if (label.trim().isEmpty) 'label': 'security.form.errName',
  if (sections.isEmpty) 'sections': 'security.form.errSections',
  if (username.isNotEmpty && !RegExp(r'^[a-z0-9][a-z0-9._-]{3,31}$').hasMatch(username)) 'username': 'security.form.errUsername',
};

/// The expiry date input (yyyy-mm-dd, local) as the ISO instant the login ends: the end of that day (web
/// fromDateInput). Null for no expiry.
String? viewerExpiry(String day) {
  final d = fromIsoDate(day);
  if (d == null) return null;
  return DateTime(d.year, d.month, d.day, 23, 59, 59).toUtc().toIso8601String();
}

/// Activity labels: `security.activity.<action without "viewer.">` (web ACTIVITY).
const Set<String> kViewerActivity = {
  'viewer.login',
  'viewer.logout',
  'viewer.login_failed',
  'viewer.locked',
  'viewer.login_blocked',
  'viewer.page_view',
  'viewer.created',
  'viewer.updated',
  'viewer.password_reset',
  'viewer.revoked',
};

String viewerActivityLabel(T t, String action) =>
    kViewerActivity.contains(action) ? t.dyn('security.activity.${action.substring(7)}', fallback: action) : action;

const List<(String, String)> _pageNames = [
  ('/portfolio/history', 'security.page.tradeHistory'),
  ('/portfolio/ledger', 'security.page.ledger'),
  ('/portfolio/statements', 'security.page.statements'),
  ('/portfolio/analytics', 'security.page.analytics'),
  ('/portfolio', 'security.page.portfolio'),
  ('/accounts/', 'security.page.account'),
  ('/accounts', 'security.page.accounts'),
  ('/wallet/history', 'security.page.walletHistory'),
  ('/wallet', 'security.page.wallet'),
  ('/partner', 'security.page.partner'),
  ('/markets', 'security.page.markets'),
  ('/news', 'security.page.news'),
  ('/calendar', 'security.page.calendar'),
];

/// The page a viewer opened, by name (web pageName).
String viewerPageName(T t, String? path) {
  if (path == null || path.isEmpty) return '';
  if (path == '/') return t('security.page.dashboard');
  final hit = _pageNames.where((p) => path.startsWith(p.$1)).firstOrNull;
  if (hit == null) return path;
  if (hit.$2 == 'security.page.account') {
    final parts = path.split('/');
    return t('security.page.account', {'n': parts.length > 2 ? parts[2] : ''});
  }
  return t(hit.$2);
}

/// Sign-in event tones (web RESULT): known results are labelled security.result.<code>.
const Map<String, KChipTone> kLoginResultTone = {
  'success': KChipTone.up,
  'new_device': KChipTone.up,
  'verified': KChipTone.up,
  'google': KChipTone.up,
  'code_sent': KChipTone.info,
  'failed': KChipTone.down,
  'locked': KChipTone.down,
  'logout': KChipTone.neutral,
  'password_reset': KChipTone.warn,
  'signed_out_device': KChipTone.neutral,
  'signed_out_by_staff': KChipTone.warn,
  'staff_access': KChipTone.info,
};

String loginResultLabel(T t, String r, String broker) =>
    kLoginResultTone.containsKey(r) ? t.dyn('security.result.$r', fallback: r, vars: {'broker': broker}) : r;

/// Request status chips (web REQ_STATUS).
const Map<String, (KChipTone, String)> kRequestStatus = {
  'open': (KChipTone.warn, 'security.reqStatus.open'),
  'in_progress': (KChipTone.info, 'security.reqStatus.inProgress'),
  'completed': (KChipTone.up, 'security.reqStatus.completed'),
  'rejected': (KChipTone.down, 'security.reqStatus.rejected'),
  'cancelled': (KChipTone.neutral, 'security.reqStatus.cancelled'),
};

/// Viewer status chips (web STATUS).
const Map<String, (KChipTone, String)> kViewerStatus = {
  'active': (KChipTone.up, 'security.viewerStatus.active'),
  'expired': (KChipTone.neutral, 'security.viewerStatus.expired'),
  'revoked': (KChipTone.down, 'security.viewerStatus.revoked'),
};
