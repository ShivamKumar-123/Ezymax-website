// The app's sign-in state:
//   booting  -> reading the stored session
//   signedOut (reason "expired" after a dead session)
//   locked   -> a stored session behind biometric unlock (cold start, or back from the background after a minute)
//   signedIn -> the session and the client's record
// The session (7 days, no refresh token) lives in the Android Keystore; when the gateway says it is dead (401), the
// app asks to sign in again. Sign-out wipes the session, every trade token and the client's cached data.
// The in-app demo ("Try the demo") is a signed-in state too: the sample client's session on the sample-data
// transport (demoModeProvider), ended by Log out.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../env.dart';
import '../../preview/preview_data.dart';
import '../api/api_providers.dart';
import '../config/app_config.dart';
import '../models/user.dart';
import '../prefs.dart';
import 'auth_api.dart';
import 'biometrics.dart';
import 'secure_store.dart';

sealed class AuthState {
  const AuthState();
  SessionUser? get user => null;
}

class AuthBooting extends AuthState {
  const AuthBooting();
}

class AuthSignedOut extends AuthState {
  const AuthSignedOut({this.reason});

  /// "expired": the session ended (show "Signed out, please sign in again").
  final String? reason;
}

class AuthLocked extends AuthState {
  const AuthLocked(this.session, this.cachedUser);
  final Session session;
  final SessionUser? cachedUser;

  @override
  SessionUser? get user => cachedUser;
}

class AuthSignedIn extends AuthState {
  const AuthSignedIn(this.session, this.me);
  final Session session;
  final SessionUser me;

  @override
  SessionUser get user => me;
}

class AuthController extends Notifier<AuthState> {
  /// How long the app may stay in the background before it locks again (biometric unlock on).
  static const Duration lockAfter = Duration(seconds: 60);

  DateTime? _backgroundAt;

  SessionStore get _store => ref.read(sessionStoreProvider);
  Prefs get _prefs => ref.read(prefsProvider);

  @override
  AuthState build() {
    Future.microtask(_restore);
    return const AuthBooting();
  }

  void _setToken(String? token) => ref.read(sessionHolderProvider).token = token;

  Future<void> _restore() async {
    // the demo (a restart inside it) and signed-in previews: the sample client, no lock, no stored session needed
    if (ref.read(demoModeProvider) || (Env.preview && (previewSignedIn || previewLocked))) {
      final s = previewSession();
      if (previewLocked) {
        state = AuthLocked(s, previewUser());
        return;
      }
      _setToken(s.token);
      state = AuthSignedIn(s, previewUser());
      return;
    }
    final session = await _store.readSession();
    if (session == null) {
      state = const AuthSignedOut();
      return;
    }
    if (session.expiredAt(DateTime.now())) {
      await _store.clear();
      state = const AuthSignedOut(reason: 'expired');
      return;
    }
    final cached = await _store.readUser();
    final user = cached == null ? null : SessionUser.fromJson(cached);
    if (_prefs.biometricEnabled && await ref.read(biometricsProvider).available()) {
      state = AuthLocked(session, user);
      return;
    }
    await _enter(session, user);
  }

  Future<void> _enter(Session session, SessionUser? user) async {
    _setToken(session.token);
    if (user != null) {
      state = AuthSignedIn(session, user);
      unawaited(refreshMe());
      return;
    }
    // no cached record (first start after an update): fetch it before showing the Client Area
    try {
      final me = await ref.read(authApiProvider).me();
      await _store.writeUser(me);
      state = AuthSignedIn(session, SessionUser.fromJson(me));
    } on ApiException catch (e) {
      if (e.isUnauthorized) return; // sessionEnded() already ran
      state = AuthSignedIn(session, SessionUser.fromJson(const {'user': {}}));
    }
  }

  /// A sign-in (login + code, or registration) finished: keep the session and open the Client Area.
  Future<void> completeSignIn(SignedIn r) async {
    await _store.writeSession(r.session);
    // the client's record without the sign-in answer's session token (that lives in the session entry only)
    await _store.writeUser(Map.of(r.user.raw)..removeWhere((k, _) => k == 'session' || k == 'status' || k == 'device'));
    _setToken(r.session.token);
    state = AuthSignedIn(r.session, r.user);
    unawaited(refreshMe());
  }

  /// "Try the demo" (sign-in and sign-up pages): the sample client's session on the sample-data transport, straight
  /// into the Client Area, no email, password or code. The flag flips first, so no request leaves the phone; the
  /// session store is seeded like a real sign-in (the widget tests do the same), the config comes from the sample data.
  Future<void> enterDemo() async {
    await ref.read(demoModeProvider.notifier).set(true);
    final s = previewSession();
    await _store.writeSession(s);
    await _store.writeUser(previewMe);
    _setToken(s.token);
    state = AuthSignedIn(s, previewUser());
    unawaited(ref.read(configProvider.notifier).refresh());
  }

  /// A sign-out ends the demo: back to the live transport and the broker's config. The sample trade server's clock
  /// stops with its last socket (the trade sessions reset with the sign-out).
  Future<void> _leaveDemo() async {
    if (!ref.read(demoModeProvider)) return;
    await ref.read(demoModeProvider.notifier).set(false);
    unawaited(ref.read(configProvider.notifier).refresh());
  }

  /// Re-reads the client's record (`me`, every 30 s in the foreground and after sign-in).
  Future<void> refreshMe() async {
    final s = state;
    if (s is! AuthSignedIn) return;
    try {
      final me = await ref.read(authApiProvider).me();
      if (state is! AuthSignedIn) return;
      await _store.writeUser(me);
      state = AuthSignedIn(s.session, SessionUser.fromJson(me));
    } catch (_) {
      // offline: keep the cached record; a dead session is handled by sessionEnded()
    }
  }

  /// Biometric unlock of a stored session.
  Future<bool> unlock(String reason) async {
    final s = state;
    if (s is! AuthLocked) return state is AuthSignedIn;
    final ok = await ref.read(biometricsProvider).authenticate(reason);
    if (!ok) return false;
    if (s.session.expiredAt(DateTime.now())) {
      await sessionEnded();
      return false;
    }
    await _enter(s.session, s.cachedUser);
    return true;
  }

  /// The app went to the background.
  void paused() => _backgroundAt = DateTime.now();

  /// Back in the foreground: lock again after [lockAfter] when biometric unlock is on.
  Future<void> resumed() async {
    final at = _backgroundAt;
    _backgroundAt = null;
    final s = state;
    if (s is! AuthSignedIn || at == null) return;
    if (s.session.expiredAt(DateTime.now())) return sessionEnded();
    if (DateTime.now().difference(at) >= lockAfter && _prefs.biometricEnabled && await ref.read(biometricsProvider).available()) {
      state = AuthLocked(s.session, s.me);
    }
  }

  /// The gateway refused the session (401 unauthorized): forget it and ask to sign in again.
  Future<void> sessionEnded() async {
    if (state is AuthSignedOut) return;
    _setToken(null);
    await _store.clear();
    state = const AuthSignedOut(reason: 'expired');
    await _leaveDemo();
  }

  /// "Sign in with password" from the lock screen.
  Future<void> forgetLocked() async {
    _setToken(null);
    await _store.clear();
    state = const AuthSignedOut();
  }

  /// Log out: tell the gateway (best effort; the demo has nothing to tell), then wipe the session, trade tokens and
  /// the client's cached data. Signed out first, then the demo ends, so no live call ever carries the sample token.
  Future<void> logout() async {
    try {
      if (state is AuthSignedIn && !ref.read(demoModeProvider)) await ref.read(authApiProvider).logout();
    } catch (_) {}
    _setToken(null);
    await _store.clear();
    await _prefs.clearClientData();
    state = const AuthSignedOut();
    await _leaveDemo();
  }

  Future<void> setBiometric(bool on) async {
    await _prefs.setBiometricEnabled(on);
    await _prefs.setBiometricAsked(true);
  }
}

final authProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

/// The signed-in client (null when signed out or locked).
final meProvider = Provider<SessionUser?>((ref) {
  final s = ref.watch(authProvider);
  return s is AuthSignedIn ? s.me : null;
});
