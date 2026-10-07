// Sign in (web apps/crm/app/(auth)/login/page.tsx): email or viewer ID + password, then the 6-digit email code when
// the device is new or the email isn't verified yet. Same texts, same order, same errors.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/auth_api.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/notifications/notifications.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import 'auth_widgets.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _show = false;
  bool _loading = false;
  ApiException? _err;
  OtpChallenge? _otp;
  int _otpKey = 0;
  String _code = '';

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  AuthApi get _auth => ref.read(authApiProvider);

  Future<void> _signIn() async {
    if (_loading) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _err = null;
      _loading = true;
    });
    try {
      final r = await _auth.login(_email.text, _password.text);
      if (!mounted) return;
      if (r is SignedIn) return await _done(r);
      TextInput.finishAutofillContext();
      setState(() {
        _otp = (r as CodeRequired).challenge;
        _code = '';
        _otpKey++;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _err = e;
        _loading = false;
        if (e.code == 'invalid_credentials') _password.clear();
      });
    }
  }

  Future<void> _verify([String? value]) async {
    final otp = _otp;
    final code = value ?? _code;
    if (otp == null || code.length != 6 || _loading) return;
    setState(() {
      _err = null;
      _loading = true;
    });
    try {
      final r = await _auth.verifyEmail(otp.challenge, code);
      if (!mounted) return;
      if (r is SignedIn) return await _done(r);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _err = e;
        _loading = false;
        _code = '';
        _otpKey++;
      });
    }
  }

  Future<void> _done(SignedIn r) async {
    KHaptics.success();
    await ref.read(authProvider.notifier).completeSignIn(r);
    // the router takes the client to the Client Area (or the page they came from)
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
      if (mounted) setState(() => _err = e);
      return e.retryAfter;
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final expired = ref.watch(authProvider) is AuthSignedOut && (ref.watch(authProvider) as AuthSignedOut).reason == 'expired';
    final fieldErr = _err?.field == null ? null : localizeError(_err!, t);
    final formErr = _err != null && _err!.field == null ? localizeError(_err!, t) : null;

    if (_otp != null) {
      final otp = _otp!;
      return AuthScaffold(
        child: Column(
          key: const ValueKey('otp'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AuthTitle(
              icon: LucideIcons.shieldCheck,
              title: otp.purpose == 'verify_email' ? t('auth.login.verifyEmailTitle') : t('auth.login.verifyDeviceTitle'),
              subtitle: KRichText(
                '${otp.purpose == 'verify_email' ? t('auth.login.emailNotVerified') : t('auth.login.newDevice')} ${t('auth.login.codeSent', {'email': otp.emailMasked})}',
                tags: const {'b': KTag()},
              ),
            ),
            const SizedBox(height: 28),
            if (_err != null) ...[KFormError(localizeError(_err!, t)), const SizedBox(height: 14)],
            KOtpField(
              key: ValueKey(_otpKey),
              onChanged: (v) => setState(() => _code = v),
              onCompleted: _verify,
              semanticLabel: t('auth.otp.digit', {'n': 1, 'total': 6}),
            ),
            KDevCodeHint(otp.devCode),
            const SizedBox(height: 22),
            KButton(
              label: _loading ? t('auth.otp.verifying') : t('auth.login.verifyContinue'),
              size: KButtonSize.lg,
              expand: true,
              loading: _loading,
              onPressed: _code.length == 6 ? _verify : null,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                KTextButton(
                  label: t('auth.login.back'),
                  color: k.fg3,
                  onPressed: () => setState(() {
                    _err = null;
                    _otp = null;
                  }),
                ),
                const Spacer(),
                Text(t('auth.otp.didntGetIt'), style: context.text.footnote.copyWith(color: k.fg3)),
                KResendLink(key: ValueKey(otp.challenge), seconds: otp.resendIn, onResend: _resend),
              ],
            ),
          ],
        ),
      );
    }

    return AuthScaffold(
      child: AutofillGroup(
        child: Column(
          key: const ValueKey('creds'),
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AuthTitle(title: t('auth.login.title'), subtitle: Text(t('auth.login.subtitle'))),
            const SizedBox(height: 28),
            if (expired && _err == null) ...[KFormError('${t('app.session.expiredTitle')}. ${t('app.session.expiredText')}'), const SizedBox(height: 14)],
            if (formErr != null) ...[KFormError(formErr), const SizedBox(height: 14)],
            KTextField(
              label: t('auth.field.emailOrViewer'),
              placeholder: t('auth.placeholder.email'),
              controller: _email,
              leading: LucideIcons.mail,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.username, AutofillHints.email],
              ltr: true,
              error: _err?.field == 'email' ? fieldErr : null,
            ),
            const SizedBox(height: 16),
            KTextField(
              label: t('auth.field.password'),
              hint: KTextButton(label: t('auth.login.forgot'), onPressed: () => context.push('/forgot')),
              controller: _password,
              leading: LucideIcons.lock,
              obscure: !_show,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.password],
              onSubmitted: (_) => _signIn(),
              error: _err?.field == 'password' ? fieldErr : null,
              trailing: KIconButton(
                icon: _show ? LucideIcons.eyeOff : LucideIcons.eye,
                size: 36,
                semanticLabel: t('auth.togglePassword'),
                onPressed: () => setState(() => _show = !_show),
              ),
            ),
            const SizedBox(height: 22),
            KButton(
              label: _loading ? t('auth.login.signingIn') : t('auth.login.signIn'),
              trailingIcon: _loading ? null : (rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight),
              size: KButtonSize.lg,
              expand: true,
              loading: _loading,
              onPressed: _signIn,
            ),
            const SizedBox(height: 20),
            Center(
              child: KRichText(
                t('auth.login.newToKalks'),
                textAlign: TextAlign.center,
                style: context.text.callout.copyWith(color: k.fg3),
                tags: {
                  'link': KTag.link(
                    () => context.push('/register'),
                    style: TextStyle(color: k.fg, fontWeight: FontWeight.w600),
                  ),
                },
              ),
            ),
            const TryDemoCard(),
          ],
        ),
      ),
    );
  }
}
