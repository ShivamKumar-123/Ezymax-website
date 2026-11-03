// The signed-out welcome page (/login): the founder's picture full-bleed under the status bar, the headline over the
// figure's head, and at the bottom the legal line, the two black pills (Log in opens the sign-in sheet, Open account
// goes to sign-up) and "Try the demo". A white-label broker gets the same page on its own colour with its name as
// the headline, without the picture or the demo. The route keeps its `next` (the router sends a fresh session there).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_api.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/config/app_config.dart';
import '../../i18n/i18n.dart';
import '../../ui/ui.dart';
import '../common/pickers.dart';
import 'sign_in_sheet.dart';

/// The picture's own near-black (assets/photos/welcome.jpg: the Ezymex coin on wet rock, lit red). It is the
/// page's colour behind the picture, which covers the whole screen - sampled from the picture's own edges, so
/// nothing shows a seam where the two meet.
const Color _ink = Color(0xFF0A0708);

/// The pills' face over a dark picture: white, with this near-black for their text.
const Color _inkOnPhoto = Color(0xFF0C0C0F);

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  bool _sheetOpen = false;

  @override
  void initState() {
    super.initState();
    // a dead session lands here: open the form at once, with its "Signed out" notice
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = ref.read(authProvider);
      if (mounted && auth is AuthSignedOut && auth.reason == 'expired') _openSignIn();
    });
  }

  Future<void> _openSignIn() async {
    if (_sheetOpen) return;
    _sheetOpen = true;
    final r = await showSignInSheet(context);
    _sheetOpen = false;
    if (!mounted) return;
    if (r is SignedIn) {
      KHaptics.success();
      await ref.read(authProvider.notifier).completeSignIn(r);
      // the router takes the client to the Client Area (or the page they came from, ?next=)
    } else if (r == SignInExit.forgot) {
      unawaited(context.push('/forgot'));
    } else if (r == SignInExit.register) {
      context.go('/register');
    }
  }

  void _tryDemo() {
    KHaptics.success();
    unawaited(ref.read(authProvider.notifier).enterDemo());
    // the router takes the demo client to the Dashboard
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final k = context.k;
    final cfg = ref.watch(configProvider);
    final ezymex = cfg.tenantDefault;
    final mq = MediaQuery.of(context);
    final h = mq.size.height;
    // the broker's colour may be dark: then the texts and pills swap to white
    final bg = ezymex ? _ink : k.ember;
    // Ezymex's own picture is dark, so its texts take the dark treatment too: white headline, white pills with
    // dark text. A broker's colour decides the same thing for itself.
    final onDark = ezymex || ThemeData.estimateBrightnessForColor(bg) == Brightness.dark;
    final ink = onDark ? Colors.white : _inkOnPhoto;
    final inkFg = onDark ? _inkOnPhoto : Colors.white;
    final demo = ezymex && t.has('auth.demo.tryCta');
    // sign-up switched off by the broker (flag client_registration): Log in only
    final registration = cfg.flag('client_registration', fallback: true);

    return Scaffold(
      backgroundColor: bg,
      resizeToAvoidBottomInset: false,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        // light status-bar icons over the dark picture, dark ones over a bright broker colour
        value: KTheme.overlay(onDark ? Brightness.dark : Brightness.light),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (ezymex) ...[
              const ColoredBox(color: _ink),
              // The picture is one composition - the coin centred, rock above and below - so it fills the screen
              // rather than starting under the headline as the old one did. Centred, so a taller phone crops the
              // rock at the edges and never the coin.
              Positioned.fill(
                child: Image.asset('assets/photos/welcome.jpg', fit: BoxFit.cover, filterQuality: FilterQuality.high),
              ),
            ],
            // A dark gradient behind the legal line and the buttons. It is deeper than a bright picture needed,
            // because this one is at its brightest exactly there - the lava pooled under the coin - and the
            // legal line is plain white text with nothing of its own behind it. It starts below the coin, so
            // what it darkens is the reflection and not the subject.
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: h * 0.34,
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.black.withValues(alpha: 0), Colors.black.withValues(alpha: 0.5), Colors.black.withValues(alpha: 0.88)],
                      stops: const [0, 0.4, 1],
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              left: 24,
              right: 24,
              top: h * 0.26,
              child: Text(
                ezymex ? t('app.welcome.title') : cfg.tenantName,
                key: const ValueKey('welcome-title'),
                textAlign: TextAlign.center,
                style: context.text.largeTitle.copyWith(fontSize: 42, fontWeight: FontWeight.w800, height: 1.0, letterSpacing: -1, color: ink),
              ),
            ),
            PositionedDirectional(top: mq.padding.top + 8, end: 12, child: const LanguageButton()),
            Positioned(
              left: 24,
              right: 24,
              bottom: mq.padding.bottom + 16,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  KRichText(
                    t('auth.register.terms'),
                    textAlign: TextAlign.center,
                    style: context.text.footnote.copyWith(color: Colors.white.withValues(alpha: 0.85), height: 1.4),
                    tags: const {
                      'agreement': KTag(
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                      'risk': KTag(
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                      'privacy': KTag(
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                    },
                  ),
                  const SizedBox(height: 14),
                  _Pill(label: t('trader.guest.logIn'), bg: ink, fg: inkFg, onTap: _openSignIn),
                  if (registration) ...[
                    const SizedBox(height: 12),
                    _Pill(label: t('trader.guest.openAccount'), bg: ink, fg: inkFg, onTap: () => context.go('/register')),
                  ],
                  if (demo) ...[
                    const SizedBox(height: 6),
                    KPressable(
                      onTap: _tryDemo,
                      semanticLabel: t('auth.demo.tryCta'),
                      child: SizedBox(
                        height: 44,
                        child: Center(
                          child: Text(
                            t('auth.demo.tryCta'),
                            style: context.text.headline.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The welcome page's 52 pt pill (taller than the app's compact buttons: the page has nothing else to press).
class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.bg, required this.fg, required this.onTap});
  final String label;
  final Color bg, fg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => KPressable(
    onTap: onTap,
    semanticLabel: label,
    child: Container(
      height: 52,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: fg.withValues(alpha: 0.12)),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: context.text.headline.copyWith(fontSize: 16, color: fg),
      ),
    ),
  );
}
