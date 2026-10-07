// Reset the password (web apps/crm/app/(auth)/forgot/page.tsx): email -> 6-digit code -> new password.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_api.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'auth_widgets.dart';

class ForgotScreen extends ConsumerStatefulWidget {
  const ForgotScreen({super.key});

  @override
  ConsumerState<ForgotScreen> createState() => _ForgotScreenState();
}

class _ForgotScreenState extends ConsumerState<ForgotScreen> {
  int _step = 0;
  final _email = TextEditingController();
  final _pw = TextEditingController();
  String _code = '';
  OtpChallenge? _otp;
  int _otpKey = 0;
  ApiException? _err;
  bool _loading = false;

  AuthApi get _auth => ref.read(authApiProvider);

  @override
  void initState() {
    super.initState();
    _pw.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _email.dispose();
    _pw.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    if (_loading) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _err = null;
      _loading = true;
    });
    try {
      final c = await _auth.forgot(_email.text);
      if (!mounted) return;
      setState(() {
        _otp = c;
        _otpKey++;
        _step = 1;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _err = e;
          _loading = false;
        });
      }
    }
  }

  Future<void> _reset() async {
    final otp = _otp;
    if (otp == null || _loading) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _err = null;
      _loading = true;
    });
    try {
      await _auth.reset(challenge: otp.challenge, code: _code, password: _pw.text);
      if (!mounted) return;
      ref
          .read(notificationsProvider.notifier)
          .toast(NotificationKind.success, context.t('auth.forgot.toastUpdated'), description: context.t('auth.forgot.toastUpdatedBody'), keep: false);
      context.go('/login');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _err = e;
        _loading = false;
        if (e.field != 'password') {
          // wrong / expired code: back to the code step
          _code = '';
          _otpKey++;
          _step = 1;
        }
      });
    }
  }

  Future<int?> _resend() async {
    final otp = _otp;
    if (otp == null) return null;
    try {
      final next = await _auth.resend(otp.challenge);
      if (!mounted) return null;
      setState(() {
        _err = null;
        _otp = next;
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
      // unknown email (no real challenge) or too many sends: start over
      if (e.code == 'code_expired') {
        await _sendCode();
        return null;
      }
      if (mounted) setState(() => _err = e);
      return e.retryAfter;
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final title = _step == 0 ? t('auth.forgot.titleReset') : (_step == 1 ? t('auth.forgot.titleCode') : t('auth.forgot.titleNew'));
    final Widget subtitle = _step == 0
        ? Text(t('auth.forgot.intro'))
        : (_step == 1
              ? KRichText(t('auth.forgot.codeSent', {'email': _otp?.emailMasked ?? ''}), tags: const {'b': KTag()})
              : Text(t('auth.forgot.passwordRule')));
    final formErr = _err != null && (_step != 2 || _err!.field == null) ? localizeError(_err!, t) : null;
    return AuthScaffold(
      child: Column(
        key: ValueKey('forgot-$_step'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: KPressable(
              onTap: () => context.canPop() ? context.pop() : context.go('/login'),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(rtl ? LucideIcons.arrowRight : LucideIcons.arrowLeft, size: 16, color: k.fg3),
                  const SizedBox(width: 8),
                  Text(t('auth.forgot.backToSignIn'), style: context.text.label.copyWith(color: k.fg3)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          AuthTitle(icon: LucideIcons.keyRound, title: title, subtitle: subtitle),
          const SizedBox(height: 28),
          if (formErr != null) ...[KFormError(formErr), const SizedBox(height: 14)],
          if (_step == 0) ...[
            KTextField(
              label: t('auth.field.email'),
              placeholder: t('auth.placeholder.email'),
              controller: _email,
              leading: LucideIcons.mail,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              ltr: true,
              onSubmitted: (_) => _sendCode(),
              error: _err?.field == 'email' ? localizeError(_err!, t) : null,
            ),
            const SizedBox(height: 18),
            KButton(
              label: _loading ? t('auth.otp.sending') : t('auth.forgot.sendCode'),
              size: KButtonSize.lg,
              expand: true,
              loading: _loading,
              onPressed: _sendCode,
            ),
          ],
          if (_step == 1) ...[
            KOtpField(
              key: ValueKey(_otpKey),
              semanticLabel: t('auth.otp.digit', {'n': 1, 'total': 6}),
              onCompleted: (c) {
                setState(() {
                  _code = c;
                  _err = null;
                });
                Future<void>.delayed(const Duration(milliseconds: 300), () {
                  if (mounted) setState(() => _step = 2);
                });
              },
            ),
            KDevCodeHint(_otp?.devCode),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text(t('auth.otp.didntGetIt'), style: context.text.footnote.copyWith(color: k.fg3)),
                KResendLink(key: ValueKey(_otp?.challenge), seconds: _otp?.resendIn ?? 30, onResend: _resend),
              ],
            ),
          ],
          if (_step == 2) ...[
            KTextField(
              label: t('auth.field.newPassword'),
              controller: _pw,
              leading: LucideIcons.lock,
              obscure: true,
              autofillHints: const [AutofillHints.newPassword],
              onSubmitted: (_) => _reset(),
              error: _err?.field == 'password' ? localizeError(_err!, t) : null,
            ),
            PasswordStrength(_pw.text),
            const SizedBox(height: 18),
            KButton(
              label: _loading ? t('auth.forgot.updating') : t('auth.forgot.update'),
              size: KButtonSize.lg,
              expand: true,
              loading: _loading,
              onPressed: _pw.text.isEmpty ? null : _reset,
            ),
          ],
        ],
      ),
    );
  }
}
