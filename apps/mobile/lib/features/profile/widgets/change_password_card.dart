// Client Area password change (web components/profile/change-password.tsx ChangePasswordCard): current + new
// password with the strength bar, "sign out of other devices", confirmed with an emailed code (D20, step-up
// `account_password`, asked first like the web's StepUpDialog), then `POST auth/password`.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/notifications/notifications.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../../auth/auth_widgets.dart' show PasswordStrength;
import 'profile_ui.dart';

/// The gateway's password rules (validate::password): the first broken rule's message key, or null.
String? passwordProblem(String p) {
  if (p.length < 8) return 'profile.password.rule.min';
  if (p.length > 128) return 'profile.password.rule.max';
  if (!RegExp('[A-Z]').hasMatch(p)) return 'profile.password.rule.upper';
  if (!RegExp('[a-z]').hasMatch(p)) return 'profile.password.rule.lower';
  if (!RegExp('[0-9]').hasMatch(p)) return 'profile.password.rule.number';
  if (!RegExp('[^A-Za-z0-9]').hasMatch(p)) return 'profile.password.rule.symbol';
  return null;
}

/// The form may be sent: every field filled, the new password valid, repeated and different from the current one.
bool passwordFormReady({required String current, required String next, required String repeat}) =>
    current.isNotEmpty && next.isNotEmpty && passwordProblem(next) == null && next == repeat && next != current;

/// Signs out and opens the password-reset flow (for clients who don't know their current password).
Future<void> resetPasswordFlow(BuildContext context, WidgetRef ref, String toastKey) async {
  final router = GoRouter.of(context);
  ref.read(notificationsProvider.notifier).toast(NotificationKind.neutral, context.t(toastKey), keep: false);
  await ref.read(authProvider.notifier).logout();
  router.go('/forgot');
}

class ChangePasswordCard extends ConsumerStatefulWidget {
  const ChangePasswordCard({super.key, required this.forgotToastKey});

  /// The toast shown while signing out for a reset (profile.signin.signingOut / security.resetSigningOut).
  final String forgotToastKey;

  @override
  ConsumerState<ChangePasswordCard> createState() => _ChangePasswordCardState();
}

class _ChangePasswordCardState extends ConsumerState<ChangePasswordCard> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _repeat = TextEditingController();
  bool _others = true;
  bool _confirming = false;
  String? _errCurrent, _errNext, _errForm;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _repeat.dispose();
    super.dispose();
  }

  bool get _ready => passwordFormReady(current: _current.text, next: _next.text, repeat: _repeat.text);

  Future<void> _save(String token) async {
    final t = context.t;
    try {
      final r = await ref
          .read(apiProvider)
          .post<Map<String, dynamic>>('auth/password', body: {'current': _current.text, 'new': _next.text, 'stepup_token': token, 'sign_out_others': _others});
      if (!mounted) return;
      _current.clear();
      _next.clear();
      _repeat.clear();
      setState(() => _errCurrent = _errNext = _errForm = null);
      final n = (r['sessions_revoked'] as num?)?.toInt() ?? 0;
      ref
          .read(notificationsProvider.notifier)
          .toast(
            NotificationKind.success,
            t('profile.password.changed'),
            description: n > 0 ? t('profile.password.signedOutOthers', {'count': n}) : t('profile.password.useNextTime'),
          );
    } on ApiException catch (e) {
      if (!mounted || e.isUnauthorized) return; // a dead session goes to sign-in (ApiClient)
      setState(() {
        if (e.field == 'current') {
          _errCurrent = localizeError(e, t);
        } else if (e.field == 'new') {
          _errNext = localizeError(e, t);
        } else {
          _errForm = e.isStepUp ? t('profile.password.expired') : localizeError(e, t);
        }
      });
    }
  }

  Future<void> _submit() async {
    if (!_ready || _confirming) return;
    final t = context.t;
    setState(() {
      _errCurrent = _errNext = _errForm = null;
      _confirming = true;
    });
    await showStepUpSheet(
      context,
      action: 'account_password',
      title: t('profile.password.stepupTitle'),
      description: t('profile.password.stepupDescription'),
      what: t('profile.password.stepupWhat'),
      confirmLabel: t('profile.password.stepupConfirm'),
      onConfirmed: _save,
    );
    if (mounted) setState(() => _confirming = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final next = _next.text;
    final repeat = _repeat.text;
    final nextErr = _errNext ?? (next.isNotEmpty && next == _current.text ? t('profile.password.sameAsCurrent') : null);
    return KCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PCardHeader(title: t('profile.password.title'), subtitle: t('profile.password.subtitle'), icon: LucideIcons.keyRound),
          const SizedBox(height: 16),
          if (_errForm != null) ...[KFormError(_errForm), const SizedBox(height: 14)],
          KTextField(
            label: t('profile.password.current'),
            controller: _current,
            obscure: true,
            ltr: true,
            placeholder: t('profile.password.currentPlaceholder'),
            autofillHints: const [AutofillHints.password],
            error: _errCurrent,
            onChanged: (_) => setState(() => _errCurrent = null),
          ),
          const SizedBox(height: 14),
          PPasswordField(
            label: t('profile.password.new'),
            controller: _next,
            placeholder: t('profile.password.newPlaceholder'),
            autofillHints: const [AutofillHints.newPassword],
            error: nextErr,
            onChanged: (_) => setState(() => _errNext = null),
          ),
          PasswordStrength(next),
          const SizedBox(height: 14),
          PPasswordField(
            label: t('profile.password.confirm'),
            controller: _repeat,
            placeholder: t('profile.password.confirmPlaceholder'),
            error: repeat.isNotEmpty && repeat != next ? t('profile.password.mismatch') : null,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsetsDirectional.fromSTEB(16, 10, 10, 10),
            decoration: BoxDecoration(
              color: k.surface2,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: k.line),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t('profile.password.signOutOthers'), style: context.text.label.copyWith(fontSize: 13.5, color: k.fg)),
                      const SizedBox(height: 2),
                      Text(t('profile.password.signOutOthersHint'), style: context.text.footnote.copyWith(color: k.fg3, fontSize: 12)),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                KSwitch(value: _others, semanticLabel: t('profile.password.signOutOthers'), onChanged: (v) => setState(() => _others = v)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          KButton(
            label: t('profile.password.submit'),
            size: KButtonSize.lg,
            expand: true,
            onPressed: _ready && !_confirming ? () => unawaited(_submit()) : null,
          ),
          const SizedBox(height: 10),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: KPressable(
              onTap: () => resetPasswordFlow(context, ref, widget.forgotToastKey),
              semanticLabel: t('profile.password.forgot'),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(t('profile.password.forgot'), style: context.text.footnote.copyWith(color: k.fg3)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
