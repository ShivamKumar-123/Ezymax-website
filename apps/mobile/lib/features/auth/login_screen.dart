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

/// The picture's own amber (assets/photos/welcome.jpg: brighter in the middle, a little deeper at the sides); the page
/// is this colour above the picture, which starts under the headline.
const Color _amber = Color(0xFFEF9B00);
const LinearGradient _amberFill = LinearGradient(colors: [Color(0xFFEB9800), Color(0xFFF29E00), Color(0xFFEB9800)]);

/// The headline, the pills and the demo link in the picture's near-black.
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
    final bg = ezymex ? _amber : k.ember;
    final onDark = !ezymex && ThemeData.estimateBrightnessForColor(bg) == Brightness.dark;
    final ink = onDark ? Colors.white : _inkOnPhoto;
    final inkFg = onDark ? _inkOnPhoto : Colors.white;
    final demo = ezymex && t.has('auth.demo.tryCta');

    return Scaffold(
      backgroundColor: bg,
      resizeToAvoidBottomInset: false,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        // dark status-bar icons over the bright picture
        value: KTheme.overlay(onDark ? Brightness.dark : Brightness.light),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (ezymex) ...[
              const DecoratedBox(decoration: BoxDecoration(gradient: _amberFill)),
              // the picture starts under the headline (its figure's head is right at its top), its top edge fading
              // into the same amber
              Positioned(
                left: 0,
                right: 0,
                top: h * 0.34,
                bottom: 0,
                child: ShaderMask(
                  shaderCallback: (r) => LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: const [Color(0x00FFFFFF), Color(0xFFFFFFFF)],
                    stops: [0, (36 / r.height).clamp(0.0, 1.0)],
                  ).createShader(r),
                  blendMode: BlendMode.dstIn,
                  child: Image.asset('assets/photos/welcome.jpg', fit: BoxFit.cover, alignment: Alignment.topCenter, filterQuality: FilterQuality.high),
                ),
              ),
            ],
            // a soft dark gradient behind the legal line and the buttons only
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: h * 0.42,
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.black.withValues(alpha: 0), Colors.black.withValues(alpha: 0.22), Colors.black.withValues(alpha: 0.6)],
                      stops: const [0, 0.45, 1],
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
                  const SizedBox(height: 12),
                  _Pill(label: t('trader.guest.openAccount'), bg: ink, fg: inkFg, onTap: () => context.go('/register')),
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
