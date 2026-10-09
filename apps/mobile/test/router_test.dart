// Where a location may go: sign-in state, biometric lock, maintenance, forced update, view-only logins, deep links.
import 'package:ezymex/core/auth/auth_controller.dart';
import 'package:ezymex/core/auth/secure_store.dart';
import 'package:ezymex/core/config/app_config.dart';
import 'package:ezymex/core/models/user.dart';
import 'package:ezymex/router/router.dart';
import 'package:ezymex/shell/nav.dart';
import 'package:flutter_test/flutter_test.dart';

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
  String? go(AuthState a, String location, {bool maintenance = false, bool update = false, AppConfig? config}) =>
      redirectFor(auth: a, maintenance: maintenance, updateRequired: update, uri: Uri.parse(location), config: config);

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

  test('module expressions and page links follow apps/crm/lib/modules.ts', () {
    final cfg = AppConfig.fromJson(const {
      'modules': {'algo': false, 'ai_assistant': false, 'options': false, 'news': false, 'support': false},
    });
    expect(modulesOn(cfg, null), isTrue);
    expect(modulesOn(cfg, ''), isTrue);
    expect(modulesOn(cfg, 'api'), isTrue);
    expect(modulesOn(cfg, 'algo'), isFalse);
    expect(modulesOn(cfg, 'algo|api'), isTrue);
    expect(modulesOn(cfg, 'academy&ai_assistant'), isFalse);
    expect(modulesOn(cfg, 'academy&api'), isTrue);
    expect(pageModule('/academy/coach'), 'academy&ai_assistant');
    expect(pageModule('/wallet/transfer?to=10042817'), 'wallet');
    expect(pageModule('/accounts'), isNull);
    expect(pageOn(cfg, '/options'), isFalse);
    expect(pageOn(cfg, '/academy'), isTrue);
    expect(pageOn(cfg, '/academy/coach'), isFalse);
    expect(pageOn(cfg, '/calendar'), isTrue);
    // the new switches hide their pages from the navigation (Options, News, Support; Calendar stays)
    final nav = navFor(cfg, me);
    expect(nav.map((m) => m.key), isNot(contains('options')));
    expect(nav.map((m) => m.key), isNot(contains('support')));
    expect(nav.firstWhere((m) => m.key == 'dashboard').sub.map((s) => s.href), ['/', '/markets', '/calendar']);
    // nothing switched off (or a key the app doesn't know): everything stays
    expect(
      navFor(
        AppConfig.fromJson(const {
          'modules': {'something_new': false},
        }),
        me,
      ).length,
      kNav.length,
    );
  });

  test('a page of a switched-off module opens /unavailable, never the page', () {
    final s = AuthSignedIn(session, me);
    final cfg = AppConfig.fromJson(const {
      'modules': {'copy_trading': false, 'ai_assistant': false, 'news': false, 'options': false},
    });
    String? at(String location) => go(s, location, config: cfg);
    expect(at('/social'), '/unavailable');
    expect(at('/social/copy?tab=active'), '/unavailable');
    expect(at('ezymex://app/news'), '/unavailable');
    expect(at('/options'), '/unavailable');
    expect(at('/academy/coach'), '/unavailable');
    // still on: PAMM under /social, the academy itself, the calendar, pages of no module, the page itself
    expect(at('/social/pamm'), isNull);
    expect(at('/academy'), isNull);
    expect(at('/academy/glossary'), isNull);
    expect(at('/calendar'), isNull);
    expect(at('/'), isNull);
    expect(at('/trader'), isNull);
    expect(at('/unavailable'), isNull);
    // no config, or a module the app doesn't know: everything is on
    expect(go(s, '/social'), isNull);
    expect(
      go(
        s,
        '/options',
        config: AppConfig.fromJson(const {
          'modules': {'something_new': false},
        }),
      ),
      isNull,
    );
    // signed out: sign-in first, then the check
    expect(go(const AuthSignedOut(), '/social', config: cfg), '/login?next=%2Fsocial');
    expect(go(s, '/login?next=%2Fsocial', config: cfg), '/social');
    // a view-only login whose only section is switched off doesn't loop between its section and /unavailable
    final v = AuthSignedIn(session, viewer);
    final noWallet = AppConfig.fromJson(const {
      'modules': {'wallet': false},
    });
    expect(go(v, '/wallet', config: noWallet), '/unavailable');
    expect(go(v, '/unavailable', config: noWallet), isNull);
  });

  test('sign-up switched off (flag client_registration) leads to sign-in', () {
    final closed = AppConfig.fromJson(const {
      'flags': {'client_registration': false},
    });
    expect(go(const AuthSignedOut(), '/register?ref=ABC', config: closed), '/login');
    expect(go(const AuthSignedOut(), '/login', config: closed), isNull);
    expect(go(const AuthSignedOut(), '/register', config: AppConfig.fromJson(const {})), isNull);
    expect(go(const AuthSignedOut(), '/register'), isNull);
  });
}
