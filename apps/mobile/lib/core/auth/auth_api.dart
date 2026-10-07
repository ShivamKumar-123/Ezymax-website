// `/api/mobile/auth/<action>` (docs/MOBILE-API.md §4): the same gateway flows as the web's /api/auth/<action>, with the
// session in the JSON body. Errors are ApiException; show them with localizeError().
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../models/user.dart';
import 'secure_store.dart';

/// An email code was sent (new device, unverified email, registration, password reset, step-up).
class OtpChallenge {
  const OtpChallenge({
    required this.challenge,
    required this.purpose,
    required this.emailMasked,
    required this.expiresIn,
    required this.resendIn,
    this.devCode,
    this.action,
    this.target,
  });

  final String challenge;

  /// verify_email | login | reset_password | confirm
  final String purpose;
  final String emailMasked;
  final int expiresIn;
  final int resendIn;

  /// Development stacks without e-mail: the gateway returns the code for the hint.
  final String? devCode;
  final String? action;
  final String? target;

  static OtpChallenge fromJson(Map<String, dynamic> j) => OtpChallenge(
    challenge: '${j['challenge'] ?? ''}',
    purpose: '${j['purpose'] ?? 'login'}',
    emailMasked: '${j['email_masked'] ?? ''}',
    expiresIn: (j['expires_in'] as num?)?.toInt() ?? 600,
    resendIn: (j['resend_in'] as num?)?.toInt() ?? 30,
    devCode: j['dev_code'] as String?,
    action: j['action'] as String?,
    target: j['target'] as String?,
  );
}

/// The answer of a sign-in step.
sealed class SignInResult {
  const SignInResult();
}

class SignedIn extends SignInResult {
  const SignedIn(this.session, this.user);
  final Session session;
  final SessionUser user;
}

class CodeRequired extends SignInResult {
  const CodeRequired(this.challenge);
  final OtpChallenge challenge;
}

/// The registration form (the web's fields; phone_dial from the chosen country).
class RegisterForm {
  const RegisterForm({
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.password,
    required this.country,
    required this.phoneDial,
    required this.phone,
    required this.dateOfBirth,
    required this.acceptTerms,
    required this.marketingConsent,
    this.referralCode,
    this.referralCampaign,
  });

  final String firstName, lastName, email, password, country, phoneDial, phone, dateOfBirth;
  final String? referralCode, referralCampaign;
  final bool acceptTerms, marketingConsent;

  Map<String, Object?> toJson() => {
    'first_name': firstName,
    'last_name': lastName,
    'email': email,
    'password': password,
    'country': country,
    'phone_dial': phoneDial,
    'phone': phone,
    'date_of_birth': dateOfBirth,
    'referral_code': (referralCode ?? '').isEmpty ? null : referralCode,
    'referral_campaign': ?referralCampaign,
    'accept_terms': acceptTerms,
    'marketing_consent': marketingConsent,
  };
}

class AuthApi {
  AuthApi(this._api);
  final ApiClient _api;

  SignInResult _result(Map<String, dynamic> j) {
    if (j['status'] == 'otp_required') return CodeRequired(OtpChallenge.fromJson(j));
    final session = Session.fromJson(j['session']);
    if (session == null) throw const ApiException(status: 502, code: 'unavailable', message: 'The sign-in answer had no session. Please try again.');
    return SignedIn(session, SessionUser.fromJson(j));
  }

  /// Email (or a view-only login's viewer ID) and password.
  Future<SignInResult> login(String email, String password) async =>
      _result(await _api.post<Map<String, dynamic>>('auth/login', body: {'email': email.trim(), 'password': password}, auth: false));

  /// The 6-digit code of a sign-in or registration.
  Future<SignInResult> verifyEmail(String challenge, String code) async =>
      _result(await _api.post<Map<String, dynamic>>('auth/verify-email', body: {'challenge': challenge, 'code': code}, auth: false));

  Future<OtpChallenge> resend(String challenge) async =>
      OtpChallenge.fromJson(await _api.post<Map<String, dynamic>>('auth/resend', body: {'challenge': challenge}, auth: false));

  Future<OtpChallenge> register(RegisterForm f) async =>
      OtpChallenge.fromJson(await _api.post<Map<String, dynamic>>('auth/register', body: f.toJson(), auth: false));

  Future<OtpChallenge> forgot(String email) async =>
      OtpChallenge.fromJson(await _api.post<Map<String, dynamic>>('auth/forgot', body: {'email': email.trim()}, auth: false));

  Future<void> reset({required String challenge, required String code, required String password}) =>
      _api.post<Object?>('auth/reset', body: {'challenge': challenge, 'code': code, 'password': password}, auth: false);

  Future<void> logout() => _api.post<Object?>('auth/logout');

  /// `{user, viewer, session, restrictions, …}`, the same as the web.
  Future<Map<String, dynamic>> me() => _api.get<Map<String, dynamic>>('auth/me');

  /// Presence plus the current restrictions (every 45 s in the foreground).
  Future<Map<String, dynamic>> heartbeat() => _api.post<Map<String, dynamic>>('auth/heartbeat');

  /* ---------------- step-up (a code for a sensitive change) ---------------- */

  Future<OtpChallenge> stepUp(String action, String target) async =>
      OtpChallenge.fromJson(await _api.post<Map<String, dynamic>>('auth/stepup', body: {'action': action, 'target': target}));

  Future<OtpChallenge> stepUpResend(String challenge) async =>
      OtpChallenge.fromJson(await _api.post<Map<String, dynamic>>('auth/stepup-resend', body: {'challenge': challenge}));

  /// The single-use step-up token (5 minutes, bound to the action and target).
  Future<String> stepUpVerify({required String challenge, required String code, required String action, required String target}) async {
    final j = await _api.post<Map<String, dynamic>>('auth/stepup-verify', body: {'challenge': challenge, 'code': code, 'action': action, 'target': target});
    return '${j['stepup_token']}';
  }
}

final authApiProvider = Provider<AuthApi>((ref) => AuthApi(ref.watch(apiProvider)));
