// Step-up confirmation (D20; web apps/crm/components/stepup.tsx): sensitive changes need a 6-digit code emailed to
// the client, even inside a session.
//   1. POST auth/stepup {action, target}            -> code emailed, challenge returned
//   2. POST auth/stepup-verify {challenge, code, …}  -> single-use step-up token (5 min, bound to action + target)
//   3. the change request carries `stepup_token` (body) or X-Kalks-Stepup; the server redeems it before acting.
// Actions: trading_password, investor_password, leverage, account_archive, account_close (target: the login);
// withdrawal, internal_transfer (target: the from-login); account_password, profile_email, profile_phone,
// viewer_access.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_api.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../tokens.dart';
import '../typography.dart';
import 'buttons.dart';
import 'codes.dart';
import 'inputs.dart';
import 'rich_text.dart';
import 'sheets.dart';

/// Opens the code sheet: emails a code at once and, when the code checks out, calls `onConfirmed(token)`, which
/// performs the change and reports its own outcome. Resolves true when the change ran.
Future<bool> showStepUpSheet(
  BuildContext context, {
  required String action,
  String target = '',
  required String title,
  String? description,
  required String what,
  String? confirmLabel,
  required Future<void> Function(String token) onConfirmed,
}) async {
  final done = await showKSheet<bool>(
    context,
    title: title,
    builder: (_) => _StepUpBody(action: action, target: target, description: description, what: what, confirmLabel: confirmLabel, onConfirmed: onConfirmed),
  );
  return done == true;
}

/// Runs a protected request; when the server answers stepup_required / stepup_invalid, asks for the code and runs it
/// again with the token. `run(null)` is the first try. Returns null when the person cancelled.
Future<R?> withStepUp<R>(
  BuildContext context, {
  required String action,
  String target = '',
  required String title,
  required String what,
  String? confirmLabel,
  required Future<R> Function(String? stepupToken) run,
}) async {
  try {
    return await run(null);
  } on ApiException catch (e) {
    if (!e.isStepUp || !context.mounted) rethrow;
  }
  R? result;
  final ok = await showStepUpSheet(
    context,
    action: action,
    target: target,
    title: title,
    what: what,
    confirmLabel: confirmLabel,
    onConfirmed: (token) async => result = await run(token),
  );
  return ok ? result : null;
}

class _StepUpBody extends ConsumerStatefulWidget {
  const _StepUpBody({required this.action, required this.target, required this.what, required this.onConfirmed, this.description, this.confirmLabel});
  final String action, target, what;
  final String? description, confirmLabel;
  final Future<void> Function(String token) onConfirmed;

  @override
  ConsumerState<_StepUpBody> createState() => _StepUpBodyState();
}

class _StepUpBodyState extends ConsumerState<_StepUpBody> {
  OtpChallenge? _challenge;
  ApiException? _err;
  bool _sending = false, _verifying = false, _busy = false;
  String _code = '';
  int _otpKey = 0;

  AuthApi get _auth => ref.read(authApiProvider);

  @override
  void initState() {
    super.initState();
    unawaited(_start());
  }

  Future<void> _start() async {
    setState(() {
      _sending = true;
      _err = null;
      _code = '';
    });
    try {
      final c = await _auth.stepUp(widget.action, widget.target);
      if (!mounted) return;
      setState(() {
        _challenge = c;
        _otpKey++;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _err = e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<int?> _resend() async {
    final c = _challenge;
    if (c == null) return null;
    try {
      final next = await _auth.stepUpResend(c.challenge);
      if (!mounted) return null;
      setState(() {
        _err = null;
        _challenge = next;
        _code = '';
        _otpKey++;
      });
      ref
          .read(notificationsProvider.notifier)
          .toast(
            NotificationKind.success,
            context.t('auth.toast.newCodeSent'),
            description: context.t('auth.toast.checkEmail', {'email': next.emailMasked}),
            keep: false,
          );
      return null;
    } on ApiException catch (e) {
      // used up or expired: start over with a new challenge
      if (e.code == 'code_expired') {
        await _start();
        return null;
      }
      if (mounted) setState(() => _err = e);
      return e.retryAfter;
    }
  }

  Future<void> _submit([String? value]) async {
    final c = _challenge;
    final code = value ?? _code;
    if (c == null || code.length != 6 || _verifying || _busy) return;
    setState(() {
      _verifying = true;
      _err = null;
    });
    String token;
    try {
      token = await _auth.stepUpVerify(challenge: c.challenge, code: code, action: widget.action, target: widget.target);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _verifying = false;
        _err = e;
        _code = '';
        _otpKey++;
      });
      return;
    }
    if (!mounted) return;
    setState(() {
      _verifying = false;
      _busy = true;
    });
    var ran = false;
    try {
      await widget.onConfirmed(token);
      ran = true;
    } catch (_) {
      // onConfirmed reports its own failures
    }
    if (mounted) Navigator.of(context).pop(ran);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final c = _challenge;
    final minutes = ((c?.expiresIn ?? 600) / 60).round().clamp(1, 999);
    final error = _err == null ? null : localizeError(_err!, t);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.description != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Text(
                widget.description!,
                textAlign: TextAlign.center,
                style: context.text.callout.copyWith(color: k.fg2),
              ),
            ),
          if (c == null && _err == null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                t('auth.stepup.sendingCode'),
                textAlign: TextAlign.center,
                style: context.text.callout.copyWith(color: k.fg3),
              ),
            ),
          if (c == null && _err != null) ...[
            KFormError(error),
            const SizedBox(height: 14),
            KButton(
              label: _sending ? t('auth.otp.sending') : t('auth.stepup.sendAgain'),
              variant: KButtonVariant.surface,
              onPressed: _sending ? null : _start,
              expand: true,
            ),
          ],
          if (c != null) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: k.surface2, borderRadius: BorderRadius.circular(k.rowRadius)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: k.emberSoft,
                      shape: BoxShape.circle,
                      border: Border.all(color: k.ember.withValues(alpha: 0.3)),
                    ),
                    child: Icon(LucideIcons.mail, size: 16, color: k.ember),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: KRichText(
                      t('auth.stepup.intro', {'what': widget.what, 'email': c.emailMasked, 'minutes': minutes}),
                      style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13, height: 1.5),
                      tags: const {'b': KTag()},
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            if (error != null) ...[KFormError(error), const SizedBox(height: 14)],
            KOtpField(
              key: ValueKey(_otpKey),
              onChanged: (v) => setState(() => _code = v),
              onCompleted: _submit,
              semanticLabel: t('auth.otp.digit', {'n': 1, 'total': 6}),
            ),
            KDevCodeHint(c.devCode),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(t('auth.stepup.spam'), style: context.text.footnote.copyWith(color: k.fg3)),
                ),
                KResendLink(key: ValueKey(c.challenge), seconds: c.resendIn, onResend: _resend),
              ],
            ),
            const SizedBox(height: 16),
            KButton(
              label: _verifying ? t('auth.stepup.checking') : (_busy ? t('auth.stepup.saving') : (widget.confirmLabel ?? t('common.confirm'))),
              size: KButtonSize.lg,
              expand: true,
              loading: _verifying || _busy,
              onPressed: _code.length == 6 ? _submit : null,
            ),
          ],
          const SizedBox(height: 6),
          KTextButton(label: t('common.cancel'), color: k.fg2, onPressed: () => Navigator.of(context).pop(false)),
        ],
      ),
    );
  }
}
