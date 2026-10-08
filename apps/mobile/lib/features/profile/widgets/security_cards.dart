// The live Security page's cards (web components/security/live-security.tsx): sign-in protection facts, active
// sessions (sign out one / all others), sign-in history (with the CSV export) and the closure / data-export
// requests (D94). The web's tables become phone lists with the columns the phone web keeps.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/files.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../security_data.dart';
import 'profile_ui.dart';

void _toast(WidgetRef ref, NotificationKind kind, String title, {String? description}) =>
    ref.read(notificationsProvider.notifier).toast(kind, title, description: description);

/// The web ErrorLine: the message and Retry in a soft row.
class SecErrorLine extends StatelessWidget {
  const SecErrorLine({super.key, required this.error, required this.onRetry});
  final Object? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final t = context.t;
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(14, 8, 8, 8),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: k.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              error is ApiException ? (error as ApiException).message : t('security.error.generic'),
              style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13),
            ),
          ),
          const SizedBox(width: 10),
          KButton(label: t('security.retry'), size: KButtonSize.sm, variant: KButtonVariant.surface, onPressed: onRetry),
        ],
      ),
    );
  }
}

/// Country flag, name and IP (web Place).
class SecPlace extends StatelessWidget {
  const SecPlace({super.key, this.ip, this.country});
  final String? ip, country;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final name = country == null ? null : countryLabel(context.t, country);
    final small = context.text.footnote.copyWith(color: k.fg3, fontSize: 12);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (country != null) ...[KFlag(country!, size: 14), const SizedBox(width: 6)],
        if (name != null) ...[
          Flexible(
            child: Text(name, style: small, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
          Text('  ·  ', style: small),
        ],
        Flexible(
          child: Text(
            ip ?? '—',
            textDirection: TextDirection.ltr,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.text.mono(12).copyWith(color: k.fg2),
          ),
        ),
      ],
    );
  }
}

/// A bordered list with hairlines between rows (web `divide-y rounded-[14px] border`).
class SecList extends StatelessWidget {
  const SecList({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const KDivider(), children[i]],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ sign-in protection */

class ProtectCard extends ConsumerWidget {
  const ProtectCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final me = ref.watch(meProvider);
    final sessions = ref.watch(securitySessionsProvider).value;
    final idle = sessions?.idleMinutes ?? me?.idleMinutes;
    Widget on() => KChip(label: t('security.protect.on'), tone: KChipTone.up, small: true);
    final facts = <(IconData, String, Widget)>[
      (LucideIcons.keyRound, t('security.protect.password'), on()),
      (LucideIcons.mailCheck, t('security.protect.newDevice'), on()),
      (LucideIcons.shieldCheck, t('security.protect.sensitive'), on()),
      (
        LucideIcons.clock,
        t('security.protect.idle'),
        Text(
          idle != null && idle > 0 ? idleLabel(idle, t) : '—',
          style: TextStyle(color: k.fg, fontFeatures: kTabular),
        ),
      ),
      (
        LucideIcons.monitorSmartphone,
        t('security.sessions.title'),
        Text(
          sessions == null ? '—' : '${sessions.items.length}',
          style: TextStyle(color: k.fg, fontFeatures: kTabular),
        ),
      ),
    ];
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PCardHeader(title: t('security.protect.title'), subtitle: me?.email, icon: LucideIcons.shieldCheck),
          const SizedBox(height: 6),
          for (var i = 0; i < facts.length; i++)
            PRow(
              label: facts[i].$2,
              last: i == facts.length - 1,
              leading: Icon(facts[i].$1, size: 16, color: k.fg3),
              child: facts[i].$3,
            ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ active sessions */

class SessionsCard extends ConsumerStatefulWidget {
  const SessionsCard({super.key});

  @override
  ConsumerState<SessionsCard> createState() => _SessionsCardState();
}

class _SessionsCardState extends ConsumerState<SessionsCard> {
  Object? _busy; // a session id, 'all' or null
  int _page = 0;
  static const _pageSize = 10;

  void _reload() => ref.invalidate(securitySessionsProvider);

  Future<void> _revoke(SecSession s) async {
    final t = context.t;
    setState(() => _busy = s.id);
    try {
      await ref.read(apiProvider).post<Object?>('security/sessions/${s.id}/revoke', body: const <String, Object?>{});
      if (!mounted) return;
      final d = parseDevice(s.userAgent, t);
      _toast(
        ref,
        NotificationKind.success,
        t('security.sessions.revoked'),
        description: s.isViewer
            ? t('security.sessions.viewerLogin', {'label': s.viewerLabel ?? t('security.sessions.viewer')})
            : t('security.device.on', {'browser': d.browser, 'os': d.os}),
      );
      _reload();
    } on ApiException catch (e) {
      if (mounted) _toast(ref, NotificationKind.error, t('security.sessions.revokeFailed'), description: e.message);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _revokeAll(int others) async {
    final t = context.t;
    final k = context.k;
    final go = await showKAlert<bool>(
      context,
      title: t('security.sessions.confirmTitle'),
      message: t('security.sessions.confirmText', {'count': others}),
      content: Text(
        t('security.sessions.confirmHint'),
        textAlign: TextAlign.center,
        style: context.text.footnote.copyWith(color: k.fg3),
      ),
      actions: [
        KAction(label: t('common.cancel'), value: false),
        KAction(label: t('security.sessions.signOutOthersShort'), value: true, destructive: true, primary: true),
      ],
    );
    if (go != true || !mounted) return;
    setState(() => _busy = 'all');
    try {
      final r = await ref.read(apiProvider).post<Map<String, dynamic>>('security/sessions/revoke-others', body: const <String, Object?>{});
      if (!mounted) return;
      final n = (r['revoked'] as num?)?.toInt() ?? 0;
      _toast(ref, NotificationKind.success, n > 0 ? t('security.sessions.revokedAll', {'count': n}) : t('security.sessions.noneOther'));
      _reload();
    } on ApiException catch (e) {
      if (mounted) _toast(ref, NotificationKind.error, t('security.sessions.revokeAllFailed'), description: e.message);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final async = ref.watch(securitySessionsProvider);
    final page = async.value;
    final others = page?.items.where((s) => !s.current).length ?? 0;
    final now = DateTime.now();
    final pages = page == null ? 1 : (page.items.length / _pageSize).ceil().clamp(1, 1 << 20);
    final p = _page.clamp(0, pages - 1);
    final view = page == null ? const <SecSession>[] : page.items.skip(p * _pageSize).take(_pageSize).toList();

    Widget row(SecSession s) {
      final d = parseDevice(s.userAgent, t);
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: k.surface2,
                shape: BoxShape.circle,
                border: Border.all(color: k.line),
              ),
              child: Icon(deviceIcon(d.kind), size: 16, color: k.fg2),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(t('security.device.on', {'browser': d.browser, 'os': d.os}), style: context.text.label.copyWith(color: k.fg)),
                      if (s.current) KChip(label: t('security.sessions.thisDevice'), tone: KChipTone.up, dot: true, small: true),
                      if (s.isViewer) KChip(label: s.viewerLabel ?? t('security.sessions.viewOnly'), tone: KChipTone.info, icon: LucideIcons.eye, small: true),
                    ],
                  ),
                  const SizedBox(height: 3),
                  SecPlace(ip: s.ip, country: s.country),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  s.current ? t('security.sessions.now') : secAgo(t, s.lastSeenAt, now),
                  style: context.text.footnote.copyWith(color: k.fg2, fontFeatures: kTabular),
                ),
                const SizedBox(height: 2),
                if (s.current)
                  Text(
                    t('security.sessions.current'),
                    style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                  )
                else if (!readOnly)
                  KTextButton(
                    label: _busy == s.id ? t('security.signingOut') : t('security.signOut'),
                    color: k.fg2,
                    onPressed: _busy != null ? null : () => unawaited(_revoke(s)),
                  ),
              ],
            ),
          ],
        ),
      );
    }

    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PCardHeader(
            title: t('security.sessions.title'),
            subtitle: page != null
                ? t('security.sessions.policy', {'idle': idleLabel(page.idleMinutes, t), 'days': page.maxDays})
                : t('security.sessions.subtitle'),
            icon: LucideIcons.monitorSmartphone,
            action: readOnly
                ? null
                : KButton(
                    label: t('security.sessions.signOutOthers'),
                    icon: LucideIcons.logOut,
                    size: KButtonSize.sm,
                    variant: KButtonVariant.danger,
                    onPressed: others == 0 || _busy != null ? null : () => unawaited(_revokeAll(others)),
                  ),
          ),
          const SizedBox(height: 14),
          if (async.hasError && page == null)
            SecErrorLine(error: async.error, onRetry: _reload)
          else if (page == null)
            const KSkeleton(height: 112, radius: 14)
          else ...[
            SecList(children: [for (final s in view) row(s)]),
            PPager(page: p, pages: pages, onPage: (n) => setState(() => _page = n)),
          ],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ sign-in history */

/// The sign-in history as the web DataTable's CSV (columns with a csv / sort accessor: time, event, device, place).
String loginsCsv(List<LoginEvent> rows, T t, String broker) {
  String esc(Object? v) {
    final s = '${v ?? ''}';
    return RegExp(r'[",\n]').hasMatch(s) ? '"${s.replaceAll('"', '""')}"' : s;
  }

  final head = [t('security.col.time'), t('security.col.event'), t('security.col.device'), t('security.col.place')].map(esc).join(',');
  final body = rows
      .map((r) {
        final d = parseDevice(r.userAgent, t);
        return [
          r.atRaw,
          loginResultLabel(t, r.result, broker),
          t('security.device.on', {'browser': d.browser, 'os': d.os}),
          '${r.country ?? ''} ${r.ip ?? ''}'.trim(),
        ].map(esc).join(',');
      })
      .join('\n');
  return '$head\n$body';
}

class LoginHistoryCard extends ConsumerStatefulWidget {
  const LoginHistoryCard({super.key});

  @override
  ConsumerState<LoginHistoryCard> createState() => _LoginHistoryCardState();
}

class _LoginHistoryCardState extends ConsumerState<LoginHistoryCard> {
  int _page = 0;
  static const _pageSize = 12;

  Future<void> _export(List<LoginEvent> rows, String broker) async {
    final csv = loginsCsv(rows, context.t, broker);
    final ok = await shareFile((
      bytes: Uint8List.fromList(utf8.encode(csv)),
      fileName: 'sign-in-history.csv',
      contentType: 'text/csv',
    ), fallbackName: 'sign-in-history.csv');
    if (!ok && mounted) await Clipboard.setData(ClipboardData(text: csv));
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final broker = ref.watch(meProvider)?.tenantName ?? 'Ezymex';
    final async = ref.watch(securityLoginsProvider);
    final data = async.value;
    final pages = data == null ? 1 : (data.length / _pageSize).ceil().clamp(1, 1 << 20);
    final p = _page.clamp(0, pages - 1);
    final view = data == null ? const <LoginEvent>[] : data.skip(p * _pageSize).take(_pageSize).toList();

    Widget row(LoginEvent r) {
      final tone = kLoginResultTone[r.result] ?? KChipTone.neutral;
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                // the chip keeps its full width (ellipsis only when the row really runs out of room)
                Expanded(
                  child: Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: KChip(label: loginResultLabel(t, r.result, broker), tone: tone, dot: true, small: true),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  fmtWhen(t.locale, r.at, withYear: true),
                  style: context.text.footnote.copyWith(color: k.fg2, fontFeatures: kTabular),
                ),
              ],
            ),
            const SizedBox(height: 5),
            SecPlace(ip: r.ip, country: r.country),
          ],
        ),
      );
    }

    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PCardHeader(title: t('security.history.title'), subtitle: t('security.history.subtitle'), icon: LucideIcons.history),
          const SizedBox(height: 14),
          if (async.hasError && data == null)
            SecErrorLine(error: async.error, onRetry: () => ref.invalidate(securityLoginsProvider))
          else if (data == null)
            const KSkeleton(height: 160, radius: 14)
          else ...[
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: KButton(
                label: 'CSV',
                icon: LucideIcons.download,
                size: KButtonSize.sm,
                variant: KButtonVariant.surface,
                onPressed: () => unawaited(_export(data, broker)),
              ),
            ),
            const SizedBox(height: 10),
            if (data.isEmpty)
              KEmptyState(compact: true, icon: LucideIcons.calendarDays, title: t('security.history.empty'))
            else
              SecList(children: [for (final r in view) row(r)]),
            PPager(page: p, pages: pages, onPage: (n) => setState(() => _page = n)),
          ],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ closure and data export (D94) */

class DataRequestsCard extends ConsumerStatefulWidget {
  const DataRequestsCard({super.key});

  @override
  ConsumerState<DataRequestsCard> createState() => _DataRequestsCardState();
}

class _DataRequestsCardState extends ConsumerState<DataRequestsCard> {
  void _reload() => ref.invalidate(securityRequestsProvider);

  Future<void> _ask(String kind) async {
    final sent = await showKSheet<bool>(
      context,
      title: kind == 'closure' ? context.t('security.requests.closureDialogTitle') : context.t('security.requests.exportDialogTitle'),
      builder: (_) => _RequestSheet(kind: kind),
    );
    if (sent == true) _reload();
  }

  Future<void> _cancel(int id) async {
    final t = context.t;
    try {
      await ref.read(apiProvider).post<Object?>('security/requests/$id/cancel', body: const <String, Object?>{});
      if (!mounted) return;
      _toast(ref, NotificationKind.success, t('security.requests.cancelled'));
      _reload();
    } on ApiException catch (e) {
      if (mounted) _toast(ref, NotificationKind.error, t('security.requests.cancelFailed'), description: e.message);
    }
  }

  Future<void> _download(int id) async {
    final t = context.t;
    try {
      final f = await ref.read(apiProvider).download('security/requests/$id/export');
      await shareFile(f, fallbackName: 'ezymex-personal-data-$id.json');
    } on ApiException catch (e) {
      if (mounted) _toast(ref, NotificationKind.error, t('common.error'), description: localizeError(e, t));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final async = ref.watch(securityRequestsProvider);
    final data = async.value;
    bool pending(String kind) => data?.any((r) => r.kind == kind && r.pending) ?? false;

    Widget box({required IconData icon, required String title, required String text, required Widget button}) => Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: k.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: k.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: k.fg3),
              const SizedBox(width: 8),
              Expanded(
                child: Text(title, style: context.text.label.copyWith(fontSize: 13.5, color: k.fg)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(text, style: context.text.footnote.copyWith(color: k.fg3)),
          if (!readOnly) ...[const SizedBox(height: 12), button],
        ],
      ),
    );

    Widget item(ClientRequest r) {
      final (tone, key) = kRequestStatus[r.status] ?? (KChipTone.neutral, '');
      final meta = [
        t('security.requests.requested', {'date': fmtDay(t.locale, r.createdAt)}),
        if (r.closedAt != null) t('security.requests.closed', {'date': fmtDay(t.locale, r.closedAt)}),
        ?r.staffNote,
      ].join(' · ');
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        r.kind == 'closure' ? t('security.requests.kindClosure') : t('security.requests.kindExport'),
                        style: context.text.label.copyWith(color: k.fg),
                      ),
                      KChip(label: key.isEmpty ? r.status : t(key), tone: tone, dot: true, small: true),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(meta, style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
                ],
              ),
            ),
            if (r.kind == 'data_export' && r.status == 'completed') ...[
              const SizedBox(width: 8),
              KButton(
                label: t('security.requests.download'),
                icon: LucideIcons.download,
                size: KButtonSize.sm,
                variant: KButtonVariant.surface,
                onPressed: () => unawaited(_download(r.id)),
              ),
            ],
            if (r.status == 'open' && !readOnly) ...[
              const SizedBox(width: 8),
              KTextButton(label: t('common.cancel'), color: k.fg2, onPressed: () => unawaited(_cancel(r.id))),
            ],
          ],
        ),
      );
    }

    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PCardHeader(title: t('security.requests.title'), subtitle: t('security.requests.subtitle'), icon: LucideIcons.fileArchive),
          const SizedBox(height: 14),
          box(
            icon: LucideIcons.download,
            title: t('security.requests.exportTitle'),
            text: t('security.requests.exportText'),
            button: Align(
              alignment: AlignmentDirectional.centerStart,
              child: KButton(
                label: pending('data_export') ? t('security.requests.exportPending') : t('security.requests.exportButton'),
                size: KButtonSize.sm,
                variant: KButtonVariant.surface,
                onPressed: pending('data_export') || data == null ? null : () => unawaited(_ask('data_export')),
              ),
            ),
          ),
          const SizedBox(height: 12),
          box(
            icon: LucideIcons.userX,
            title: t('security.requests.closureTitle'),
            text: t('security.requests.closureText'),
            button: Align(
              alignment: AlignmentDirectional.centerStart,
              child: KButton(
                label: pending('closure') ? t('security.requests.closurePending') : t('security.requests.closureButton'),
                size: KButtonSize.sm,
                variant: KButtonVariant.danger,
                onPressed: pending('closure') || data == null ? null : () => unawaited(_ask('closure')),
              ),
            ),
          ),
          if (async.hasError && data == null) ...[
            const SizedBox(height: 14),
            SecErrorLine(error: async.error, onRetry: _reload),
          ] else if (data != null && data.isNotEmpty) ...[
            const SizedBox(height: 14),
            SecList(children: [for (final r in data) item(r)]),
          ],
        ],
      ),
    );
  }
}

/// The request dialog (web Dialog): what happens next, an optional reason, Cancel / Send request.
class _RequestSheet extends ConsumerStatefulWidget {
  const _RequestSheet({required this.kind});
  final String kind;

  @override
  ConsumerState<_RequestSheet> createState() => _RequestSheetState();
}

class _RequestSheetState extends ConsumerState<_RequestSheet> {
  final _reason = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final t = context.t;
    setState(() => _busy = true);
    final reason = _reason.text.trim();
    try {
      await ref.read(apiProvider).post<Object?>('security/requests', body: {'kind': widget.kind, if (reason.isNotEmpty) 'reason': reason});
      if (!mounted) return;
      _toast(
        ref,
        NotificationKind.success,
        widget.kind == 'closure' ? t('security.requests.closureSent') : t('security.requests.exportSent'),
        description: t('security.requests.sentText'),
      );
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(ref, NotificationKind.error, t('security.requests.sendFailed'), description: e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final closure = widget.kind == 'closure';
    return KSheetContent(
      footer: Row(
        children: [
          Expanded(
            child: KButton(label: t('common.cancel'), variant: KButtonVariant.ghost, expand: true, onPressed: () => Navigator.of(context).pop(false)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: KButton(
              label: _busy ? t('security.requests.sending') : t('security.requests.send'),
              variant: closure ? KButtonVariant.sell : KButtonVariant.ember,
              expand: true,
              onPressed: _busy ? null : () => unawaited(_send()),
            ),
          ),
        ],
      ),
      children: [
        Text(closure ? t('security.requests.closureDialogText') : t('security.requests.exportDialogText'), style: context.text.callout.copyWith(color: k.fg2)),
        const SizedBox(height: 16),
        PTextArea(label: closure ? t('security.requests.reasonClosure') : t('security.requests.reasonExport'), controller: _reason),
      ],
    );
  }
}

/// A 3-line text area (web textarea, `resize-none rounded-[12px]`), clipped at `maxLength`.
class PTextArea extends StatelessWidget {
  const PTextArea({super.key, required this.controller, this.label, this.maxLength = 1000, this.minLines = 3});
  final TextEditingController controller;
  final String? label;
  final int maxLength;
  final int minLines;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(label!, style: context.text.label.copyWith(color: k.fg2)),
          ),
        Container(
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: k.line),
          ),
          child: TextField(
            controller: controller,
            minLines: minLines,
            maxLines: 6,
            inputFormatters: [LengthLimitingTextInputFormatter(maxLength)],
            style: context.text.callout.copyWith(color: k.fg),
            cursorColor: k.ember,
            decoration: const InputDecoration(isCollapsed: true, border: InputBorder.none, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
          ),
        ),
      ],
    );
  }
}
