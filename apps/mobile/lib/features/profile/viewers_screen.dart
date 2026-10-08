// Profile & Security › View-only access: port of the web's live viewers page (apps/crm/components/security/
// live-viewers.tsx + lib/viewer.ts, D90 / D93). Phone order:
//   1 header (View-only access) with New viewer under it
//   2 Viewer logins: name + status, viewer ID (copy), edit / new password / revoke
//   3 Viewer activity (sign-ins and pages opened)
//   4 Investor passwords (→ Accounts)
// Creating a login and setting a new password are confirmed with an emailed code (step-up `viewer_access`, asked
// first like the web's StepUpDialog); the password is shown once in the credentials sheet.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/config/app_config.dart';
import '../../core/models/account.dart';
import '../../core/notifications/notifications.dart';
import '../../data/client_data.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'security_data.dart';
import 'widgets/profile_ui.dart';
import 'widgets/security_cards.dart';

/// The viewer form's state (web Draft): kept by the page while the form, the code sheet and the form again (after
/// a refused create) take turns.
class ViewerDraft {
  ViewerDraft({this.label = '', this.username = '', List<String>? accounts, List<String>? sections, this.expires = ''})
    : accounts = accounts ?? [],
      sections = sections ?? ['accounts', 'history'];

  factory ViewerDraft.of(ViewerLogin v) => ViewerDraft(
    label: v.label,
    username: v.username,
    accounts: [...v.accounts],
    sections: [...v.sections],
    expires: v.expiresAt == null ? '' : isoDate(v.expiresAt!),
  );

  String label;
  String username;
  final List<String> accounts;
  final List<String> sections;

  /// yyyy-mm-dd (local) or empty.
  String expires;

  /// `POST security/viewers` (without the step-up token).
  Map<String, Object?> createBody() => {
    'label': label.trim(),
    if (username.isNotEmpty) 'username': username,
    'accounts': accounts,
    'sections': sections,
    'expires_at': viewerExpiry(expires),
  };

  /// `PATCH security/viewers/{id}`.
  Map<String, Object?> patchBody() => {'label': label.trim(), 'accounts': accounts, 'sections': sections, 'expires_at': viewerExpiry(expires)};
}

class ViewersScreen extends ConsumerStatefulWidget {
  const ViewersScreen({super.key, this.query = const {}});

  /// The route's query parameters (the web page's search params).
  final Map<String, String> query;

  @override
  ConsumerState<ViewersScreen> createState() => _ViewersScreenState();
}

class _ViewersScreenState extends ConsumerState<ViewersScreen> {
  void _reload() => ref.invalidate(viewersProvider);

  void _toast(NotificationKind kind, String title, {String? description}) =>
      ref.read(notificationsProvider.notifier).toast(kind, title, description: description);

  /// New viewer: the form, then the code, then the credentials (or the form again with the server's errors).
  Future<void> _startNew() async {
    final t = context.t;
    final draft = ViewerDraft();
    Map<String, String> errors = const {};
    String? formErr;
    while (mounted) {
      final go = await _openForm(draft, null, errors: errors, formErr: formErr);
      if (go != true || !mounted) return;
      ApiException? failed;
      Map<String, dynamic>? created;
      await showStepUpSheet(
        context,
        action: 'viewer_access',
        title: t('security.stepup.createTitle'),
        description: draft.label,
        what: t('security.stepup.createWhat'),
        confirmLabel: t('security.stepup.createConfirm'),
        onConfirmed: (token) async {
          try {
            created = await ref.read(apiProvider).post<Map<String, dynamic>>('security/viewers', body: {...draft.createBody(), 'stepup_token': token});
          } on ApiException catch (e) {
            failed = e;
          }
        },
      );
      if (!mounted) return;
      final c = created;
      if (c != null) {
        _reload();
        final v = c['viewer'] is Map ? ViewerLogin.fromJson((c['viewer'] as Map).cast<String, dynamic>()) : null;
        await _showCredentials(username: v?.username ?? draft.username, password: '${c['password'] ?? ''}', label: v?.label ?? draft.label);
        return;
      }
      final e = failed;
      if (e == null || e.isUnauthorized) return; // cancelled the code
      errors = e.field != null ? {e.field!: localizeError(e, t)} : const {};
      formErr = e.field == null ? localizeError(e, t) : null;
    }
  }

  Future<bool?> _openForm(ViewerDraft draft, ViewerLogin? editing, {Map<String, String> errors = const {}, String? formErr}) => showKSheet<bool>(
    context,
    title: editing != null ? context.t('security.dialog.editTitle', {'label': editing.label}) : context.t('security.dialog.newTitle'),
    expand: true,
    builder: (_) => ViewerFormSheet(draft: draft, editing: editing, initialErrors: errors, formError: formErr, onSaved: _reload),
  );

  Future<void> _newPassword(ViewerLogin v) async {
    final t = context.t;
    Map<String, dynamic>? r;
    await showStepUpSheet(
      context,
      action: 'viewer_access',
      title: t('security.stepup.passwordTitle', {'label': v.label}),
      description: t('security.stepup.passwordText'),
      what: t('security.stepup.passwordWhat'),
      confirmLabel: t('security.stepup.passwordConfirm'),
      onConfirmed: (token) async {
        try {
          r = await ref.read(apiProvider).post<Map<String, dynamic>>('security/viewers/${v.id}/password', body: {'stepup_token': token});
        } on ApiException catch (e) {
          if (mounted && !e.isUnauthorized) _toast(NotificationKind.error, t('security.viewers.passwordFailed'), description: e.message);
        }
      },
    );
    final got = r;
    if (got == null || !mounted) return;
    _reload();
    await _showCredentials(username: '${got['username'] ?? v.username}', password: '${got['password'] ?? ''}', label: v.label);
  }

  Future<void> _revoke(ViewerLogin v) async {
    final t = context.t;
    final k = context.k;
    final go = await showKAlert<bool>(
      context,
      title: t('security.revoke.title', {'label': v.label}),
      message: t('security.revoke.text'),
      content: Text.rich(
        TextSpan(
          children: [
            TextSpan(text: '${t('security.creds.viewerId')} '),
            TextSpan(
              text: v.username,
              style: context.text.mono(13).copyWith(color: k.fg),
            ),
          ],
        ),
        textAlign: TextAlign.center,
        style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13),
      ),
      actions: [
        KAction(label: t('common.cancel'), value: false),
        KAction(label: t('security.revoke.confirm'), value: true, destructive: true, primary: true),
      ],
    );
    if (go != true || !mounted) return;
    try {
      await ref.read(apiProvider).post<Object?>('security/viewers/${v.id}/revoke', body: const <String, Object?>{});
      if (!mounted) return;
      _toast(NotificationKind.success, t('security.viewers.revoked', {'label': v.label}), description: t('security.viewers.revokedText'));
      _reload();
    } on ApiException catch (e) {
      if (mounted) _toast(NotificationKind.error, t('security.viewers.revokeFailed'), description: e.message);
    }
  }

  Future<void> _showCredentials({required String username, required String password, required String label}) {
    final url = '${ref.read(configProvider).appUrl}/login';
    return showKSheet<void>(
      context,
      title: context.t('security.creds.title'),
      builder: (ctx) => ViewerCredentials(url: url, username: username, password: password, label: label),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final readOnly = ref.watch(meProvider)?.readOnly ?? false;
    final async = ref.watch(viewersProvider);
    final data = async.value;
    final active = data?.active ?? 0;
    final now = DateTime.now();
    final canCreate = !readOnly && data != null && active < data.max;

    Widget viewerRow(ViewerLogin v) {
      final (tone, key) = kViewerStatus[v.status] ?? (KChipTone.neutral, '');
      return Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(14, 10, 6, 10),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          v.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: context.text.label.copyWith(color: k.fg),
                        ),
                      ),
                      const SizedBox(width: 8),
                      KChip(label: key.isEmpty ? v.status : t(key), tone: tone, dot: true, small: true),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          v.username,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textDirection: TextDirection.ltr,
                          style: context.text.mono(12).copyWith(color: k.fg3),
                        ),
                      ),
                      KPressable(
                        semanticLabel: t('security.creds.viewerId'),
                        minSize: 32,
                        onTap: () => kCopy(context, v.username),
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: Icon(LucideIcons.copy, size: 13, color: k.fg3),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (v.status == 'revoked')
              Text(
                t('security.viewers.revokedOn', {'date': fmtDay(t.locale, v.revokedAt)}),
                style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
              )
            else if (!readOnly) ...[
              KIconButton(
                icon: LucideIcons.pencil,
                size: 34,
                semanticLabel: t('security.viewers.editAria', {'label': v.label}),
                onPressed: () => unawaited(_openForm(ViewerDraft.of(v), v)),
              ),
              KIconButton(
                icon: LucideIcons.keyRound,
                size: 34,
                semanticLabel: t('security.viewers.passwordAria', {'label': v.label}),
                onPressed: () => unawaited(_newPassword(v)),
              ),
              KIconButton(
                icon: LucideIcons.shieldOff,
                size: 34,
                color: k.down,
                semanticLabel: t('security.viewers.revokeAria', {'label': v.label}),
                onPressed: () => unawaited(_revoke(v)),
              ),
            ],
          ],
        ),
      );
    }

    Widget activityRow(ViewerActivity a) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: a.label ?? t('security.viewers.colViewer'),
                    style: TextStyle(color: k.fg, fontWeight: FontWeight.w600),
                  ),
                  TextSpan(
                    text: ' · ${viewerActivityLabel(t, a.action)}${a.action == 'viewer.page_view' && a.path != null ? ' ${viewerPageName(t, a.path)}' : ''}',
                  ),
                ],
              ),
              style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            secAgo(t, a.at, now),
            style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400, fontFeatures: kTabular),
          ),
        ],
      ),
    );

    return KPageScroll(
      onRefresh: () async {
        _reload();
        await ref.read(viewersProvider.future).then((_) {}, onError: (Object _) {});
      },
      children: [
        PPageHeader(
          title: t('security.viewerBar.title'),
          subtitle: t('security.viewers.subtitle'),
          actions: [
            if (!readOnly) KButton(label: t('security.viewers.new'), icon: LucideIcons.plus, onPressed: canCreate ? () => unawaited(_startNew()) : null),
          ],
        ),
        // 2 viewer logins
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PCardHeader(
                title: t('security.viewers.title'),
                subtitle: data == null ? null : t('security.viewers.count', {'active': active, 'max': data.max}),
                icon: LucideIcons.eye,
              ),
              const SizedBox(height: 14),
              if (async.hasError && data == null)
                KFormError(async.error is ApiException ? (async.error as ApiException).message : t('security.error.generic'))
              else if (data == null)
                const KSkeleton(height: 112, radius: 14)
              else if (data.items.isEmpty)
                KEmptyState(
                  compact: true,
                  art: KIllustrationName.security,
                  title: t('security.viewers.emptyTitle'),
                  text: t('security.viewers.emptyText'),
                  action: readOnly
                      ? null
                      : KButton(
                          label: t('security.viewers.new'),
                          icon: LucideIcons.plus,
                          variant: KButtonVariant.surface,
                          onPressed: canCreate ? () => unawaited(_startNew()) : null,
                        ),
                )
              else
                SecList(children: [for (final v in data.items) viewerRow(v)]),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // 3 viewer activity
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PCardHeader(title: t('security.activity.title'), subtitle: t('security.activity.subtitle')),
              const SizedBox(height: 14),
              if (data == null)
                const KSkeleton(height: 96, radius: 14)
              else if (data.activity.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(t('security.activity.empty'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13)),
                )
              else
                SecList(children: [for (final a in data.activity.take(30)) activityRow(a)]),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // 4 investor passwords
        KCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PCardHeader(title: t('security.investor.title'), icon: LucideIcons.keyRound),
              const SizedBox(height: 12),
              Text(t('security.investor.text'), style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13)),
              const SizedBox(height: 10),
              Text(t('security.investor.hint'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13)),
              const SizedBox(height: 12),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: KButton(
                  label: t('security.investor.goToAccounts'),
                  size: KButtonSize.sm,
                  variant: KButtonVariant.surface,
                  onPressed: () => context.go('/accounts'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ the form (web Dialog + ViewerForm) */

class ViewerFormSheet extends ConsumerStatefulWidget {
  const ViewerFormSheet({super.key, required this.draft, required this.onSaved, this.editing, this.initialErrors = const {}, this.formError});
  final ViewerDraft draft;
  final ViewerLogin? editing;
  final Map<String, String> initialErrors;
  final String? formError;
  final VoidCallback onSaved;

  @override
  ConsumerState<ViewerFormSheet> createState() => _ViewerFormSheetState();
}

class _ViewerFormSheetState extends ConsumerState<ViewerFormSheet> {
  late final TextEditingController _label = TextEditingController(text: widget.draft.label);
  late final TextEditingController _username = TextEditingController(text: widget.draft.username);
  late Map<String, String> _errors = {...widget.initialErrors};
  late String? _formErr = widget.formError;
  bool _busy = false;

  ViewerDraft get d => widget.draft;

  @override
  void dispose() {
    _label.dispose();
    _username.dispose();
    super.dispose();
  }

  void _changed(VoidCallback f) => setState(() {
    f();
    _errors = {};
    _formErr = null;
  });

  bool _localCheck() {
    final t = context.t;
    final e = viewerFormErrors(label: d.label, username: d.username, sections: d.sections);
    setState(() => _errors = {for (final x in e.entries) x.key: t(x.value)});
    return e.isEmpty;
  }

  Future<void> _save(ViewerLogin v) async {
    if (!_localCheck()) return;
    final t = context.t;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).patch<Object?>('security/viewers/${v.id}', body: d.patchBody());
      if (!mounted) return;
      ref.read(notificationsProvider.notifier).toast(NotificationKind.success, t('security.viewers.updated'), description: t('security.viewers.updatedText'));
      widget.onSaved();
      Navigator.of(context).pop(false);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        if (e.field != null) {
          _errors = {e.field!: localizeError(e, t)};
        } else {
          _formErr = localizeError(e, t);
        }
      });
    }
  }

  void _toggle(List<String> list, String v) => _changed(() => list.contains(v) ? list.remove(v) : list.add(v));

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final editing = widget.editing;
    final accounts = ref.watch(accountsProvider);
    final now = DateTime.now();

    Widget check({required bool on, required Widget child, required VoidCallback onTap}) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: KPressable(
        onTap: onTap,
        pressedScale: 1,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: on ? k.ember.withValues(alpha: 0.45) : k.line),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 18,
                height: 18,
                margin: const EdgeInsets.only(top: 1),
                decoration: BoxDecoration(
                  color: on ? k.ember : k.surface,
                  borderRadius: BorderRadius.circular(5),
                  border: Border.all(color: on ? k.ember : k.fg3.withValues(alpha: 0.5)),
                ),
                child: on ? Icon(LucideIcons.check, size: 12, color: k.onEmber) : null,
              ),
              const SizedBox(width: 10),
              Expanded(child: child),
            ],
          ),
        ),
      ),
    );

    Widget fieldLabel(String s, {String? error, Widget? hint}) => Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(s, style: context.text.label.copyWith(color: k.fg2)),
          ),
          ?hint,
        ],
      ),
    );

    Widget fieldError(String? e) => e == null
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.only(top: 2, bottom: 6),
            child: Text(e, style: context.text.footnote.copyWith(color: k.down)),
          );

    final list = accounts.value ?? const <EngineAccount>[];
    return KSheetContent(
      footer: Row(
        children: [
          Expanded(
            child: KButton(label: t('common.cancel'), variant: KButtonVariant.ghost, expand: true, onPressed: () => Navigator.of(context).pop(false)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: editing != null
                ? KButton(
                    label: _busy ? t('security.dialog.saving') : t('security.dialog.save'),
                    expand: true,
                    onPressed: _busy ? null : () => unawaited(_save(editing)),
                  )
                : KButton(
                    label: t('common.continue'),
                    expand: true,
                    onPressed: () {
                      if (_localCheck()) Navigator.of(context).pop(true);
                    },
                  ),
          ),
        ],
      ),
      children: [
        Text(
          editing != null ? t('security.dialog.viewerId', {'id': editing.username}) : t('security.dialog.newText'),
          textAlign: TextAlign.center,
          style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13),
        ),
        const SizedBox(height: 14),
        if (_formErr != null) ...[KFormError(_formErr), const SizedBox(height: 14)],
        KTextField(
          label: t('security.form.name'),
          controller: _label,
          leading: LucideIcons.userRound,
          placeholder: t('security.form.namePlaceholder'),
          error: _errors['label'],
          onChanged: (v) => _changed(() => d.label = v.length > 60 ? v.substring(0, 60) : v),
        ),
        const SizedBox(height: 14),
        PDateField(
          label: t('security.form.expires'),
          value: d.expires,
          min: DateTime(now.year, now.month, now.day),
          clearable: true,
          error: _errors['expires_at'],
          onChanged: (v) => _changed(() => d.expires = v),
        ),
        if (editing == null) ...[
          const SizedBox(height: 14),
          KTextField(
            label: t('security.form.viewerId'),
            hint: Text(
              t('security.form.viewerIdHint'),
              style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
            ),
            controller: _username,
            ltr: true,
            placeholder: t('security.form.viewerIdPlaceholder'),
            error: _errors['username'],
            onChanged: (v) {
              final clean = cleanViewerId(v);
              if (clean != v) {
                _username.value = TextEditingValue(
                  text: clean,
                  selection: TextSelection.collapsed(offset: clean.length),
                );
              }
              _changed(() => d.username = clean);
            },
          ),
        ],
        const SizedBox(height: 16),
        fieldLabel(t('security.form.accounts')),
        fieldError(_errors['accounts']),
        if (accounts.isLoading && accounts.value == null)
          const KSkeleton(height: 40, radius: 12)
        else if (list.isEmpty)
          Text(t('security.form.noAccounts'), style: context.text.footnote.copyWith(color: k.fg3))
        else
          for (final a in list)
            check(
              on: d.accounts.contains('${a.login}'),
              onTap: () => _toggle(d.accounts, '${a.login}'),
              child: Row(
                children: [
                  Text(
                    '#${a.login}',
                    textDirection: TextDirection.ltr,
                    style: context.text.mono(13).copyWith(color: k.fg),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${a.live ? t('security.form.live') : t('security.form.demo')} · ${a.groupName}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
        const SizedBox(height: 8),
        fieldLabel(t('security.form.sections')),
        fieldError(_errors['sections']),
        for (final s in kViewerSections)
          check(
            on: d.sections.contains(s.$1),
            onTap: () => _toggle(d.sections, s.$1),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(viewerSectionLabel(t, s.$1), style: context.text.label.copyWith(color: k.fg)),
                Text(
                  viewerSectionHint(t, s.$1),
                  style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                ),
              ],
            ),
          ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: k.surface2,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: k.line),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(LucideIcons.eye, size: 14, color: k.fg3),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(t('security.form.note'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/* ------------------------------------------------------------------ credentials (shown once) */

class ViewerCredentials extends StatelessWidget {
  const ViewerCredentials({super.key, required this.url, required this.username, required this.password, required this.label});
  final String url, username, password, label;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    Widget row(String key, String name, String value) => Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        key: ValueKey('viewer-cred-$key'),
        padding: const EdgeInsetsDirectional.fromSTEB(12, 6, 4, 6),
        decoration: BoxDecoration(
          color: k.surface2,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: k.line),
        ),
        child: Row(
          children: [
            Text(name, style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13)),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                value,
                textAlign: TextAlign.end,
                textDirection: TextDirection.ltr,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.mono(13).copyWith(color: k.fg),
              ),
            ),
            KIconButton(icon: LucideIcons.copy, size: 34, semanticLabel: name, onPressed: () => kCopy(context, value)),
          ],
        ),
      ),
    );
    return KSheetContent(
      footer: KButton(label: t('security.creds.saved'), size: KButtonSize.lg, expand: true, onPressed: () => Navigator.of(context).pop()),
      children: [
        Text(
          t('security.creds.description', {'label': label}),
          textAlign: TextAlign.center,
          style: context.text.footnote.copyWith(color: k.fg3, fontSize: 13),
        ),
        const SizedBox(height: 14),
        row('sign-in-page', t('security.creds.page'), url),
        row('viewer-id', t('security.creds.viewerId'), username),
        row('password', t('security.creds.password'), password),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Icon(LucideIcons.triangleAlert, size: 14, color: k.warn),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(t('security.creds.warning'), style: context.text.footnote.copyWith(color: k.warn, fontSize: 12)),
            ),
          ],
        ),
      ],
    );
  }
}
