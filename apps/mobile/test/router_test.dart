// Where a location may go: sign-in state, biometric lock, maintenance, forced update, view-only logins, deep links.
import 'package:flutter_test/flutter_test.dart';
import 'package:ezymex/core/auth/auth_controller.dart';
import 'package:ezymex/core/auth/secure_store.dart';
import 'package:ezymex/core/config/app_config.dart';
import 'package:ezymex/core/models/user.dart';
import 'package:ezymex/router/router.dart';
import 'package:ezymex/shell/nav.dart';

void main() {
  final session = Session(token: 'x' * 40, expiresAt: DateTime.now().add(const Duration(days: 7)));
  final me = SessionUser.fromJson(const {
    'user': {'id': 7, 'email': 'a@b.c', 'first_name': 'A', 'last_name': 'B', 'kyc_status': 'verified'},
  });
  final viewer = SessionUser.fromJson(const {
    'user': {'id': 7, 'email': 'a@b.c', 'first_name': 'A', 'last_name': 'B'},
    'viewer': {
      'id': 3,
      'label': 'Accountant',
      'sections': ['wallet', 'history'],
    },
  });
  String? go(AuthState a, String location, {bool maintenance = false, bool update = false}) =>
      redirectFor(auth: a, maintenance: maintenance, updateRequired: update, uri: Uri.parse(location));

  test('booting, signed out and locked', () {
    expect(go(const AuthBooting(), '/wallet'), '/boot');
    expect(go(const AuthSignedOut(), '/wallet/deposit?x=1'), '/login?next=%2Fwallet%2Fdeposit%3Fx%3D1');
    expect(go(const AuthSignedOut(), '/'), '/login');
    expect(go(const AuthSignedOut(), '/register'), isNull);
    expect(go(AuthLocked(session, me), '/portfolio'), '/unlock?next=%2Fportfolio');
    expect(go(AuthLocked(session, me), '/unlock'), isNull);
  });

  test('signed in: auth pages lead into the Client Area (or the page asked for)', () {
    final s = AuthSignedIn(session, me);
    expect(go(s, '/login'), '/');
    expect(go(s, '/unlock?next=%2Fportfolio'), '/portfolio');
    expect(go(s, '/login?next=//evil.example'), '/');
    expect(go(s, '/wallet/withdraw'), isNull);
    expect(go(s, '/trader?login=10042817'), isNull);
  });

  test('maintenance and a forced update win; deep links keep their path', () {
    final s = AuthSignedIn(session, me);
    expect(go(s, '/wallet', maintenance: true), '/maintenance');
    expect(go(s, '/maintenance'), '/');
    expect(go(s, '/', update: true), '/update');
    expect(go(s, 'https://trade.ezymex.com/'), '/trader');
    expect(go(const AuthSignedOut(), 'ezymex://app/wallet/deposit'), '/login?next=%2Fwallet%2Fdeposit');
  });

  test('view-only logins stay inside their sections', () {
    final s = AuthSignedIn(session, viewer);
    expect(go(s, '/wallet'), isNull);
    expect(go(s, '/portfolio/history'), isNull);
    expect(go(s, '/wallet/withdraw'), '/portfolio/history');
    expect(go(s, '/accounts'), '/portfolio/history');
    expect(go(s, '/trader'), '/portfolio/history');
    final nav = navFor(AppConfig.fallback, viewer);
    expect(nav.map((m) => m.key), ['wallet', 'portfolio']);
    expect(nav.firstWhere((m) => m.key == 'wallet').sub.map((x) => x.href), ['/wallet', '/wallet/history']);
  });

  test('module switches hide pages like the web (navForFeatures)', () {
    final cfg = AppConfig.fromJson(const {
      'modules': {'wallet': false, 'pamm': false, 'algo': false},
    });
    final nav = navFor(cfg, me);
    expect(nav.any((m) => m.key == 'wallet'), isFalse);
    final social = nav.firstWhere((m) => m.key == 'social');
    expect(social.sub.map((s) => s.href), isNot(contains('/social/pamm')));
    expect(nav.firstWhere((m) => m.key == 'developer').sub.map((s) => s.href), ['/developer', '/developer/webhooks', '/developer/docs']);
    expect(isOlderVersion('1.0.0+5', '1.0.1'), isTrue);
    expect(isOlderVersion('1.10.0', '1.9.9'), isFalse);
    expect(isOlderVersion('1.0.0', null), isFalse);
  });
}
