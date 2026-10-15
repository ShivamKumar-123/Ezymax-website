// The Dashboard's opening picture: the website's robot (ezymex-website public/images/brand/src-hero-robot.png) full
// bleed under the status bar, "Trade like a sovereign." and the way into Ezymex FX Options over it, the page in a
// rounded sheet that slides up over the picture (KPageScroll.hero; the shell floats its controls over it,
// app_shell.dart). Stock Ezymex brand only: a white-label broker never sees Ezymex imagery.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:video_player/video_player.dart';

import '../../core/config/app_config.dart';
import '../../i18n/i18n.dart';
import '../../shell/nav.dart';
import '../../ui/ui.dart';

/// Whether the page at `path` opens on the picture: the Overview of the stock Ezymex brand. The shell (its chrome and
/// the page's top padding), the module pager and the page itself decide by this one rule.
bool dashboardHeroAt(String path, AppConfig cfg) => path == '/' && cfg.tenantDefault;

/// The picture's height: 46 % of the screen, 300–440 px. The shell's collapse point and the page share it.
double dashboardHeroHeight(MediaQueryData mq) => (mq.size.height * 0.46).clamp(300.0, 440.0);

/// How far the sheet reaches up over the picture (its rounded corners show the robot's background).
const double kDashboardHeroOverlap = 28;

/// The brand clip, drawn behind the page (KPageHero.picture), over its own still frame, with a soft scrim at the very
/// top for the status bar. Flipped in RTL like the artwork it replaced.
class DashboardHeroPicture extends StatefulWidget {
  const DashboardHeroPicture({super.key});

  @override
  State<DashboardHeroPicture> createState() => _DashboardHeroPictureState();
}

class _DashboardHeroPictureState extends State<DashboardHeroPicture> with WidgetsBindingObserver {
  VideoPlayerController? _video;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // after the first frame, so the still picture is on screen before anything is decoded
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  void _start() {
    if (!mounted) return;
    // a device set to reduce motion keeps the still frame
    if (MediaQuery.of(context).disableAnimations) return;
    final c = VideoPlayerController.asset('assets/video/hero.mp4');
    _video = c;
    c.initialize().then((_) {
      if (!mounted) {
        c.dispose();
        return;
      }
      c
        ..setVolume(0)
        ..setLooping(true)
        ..play();
      setState(() {});
    }).catchError((Object _) {
      // the still frame is a complete hero on its own, so a device that cannot decode this loses nothing
      c.dispose();
      if (mounted) setState(() => _video = null);
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final c = _video;
    if (c == null || !c.value.isInitialized) return;
    if (state == AppLifecycleState.resumed) {
      c.play();
    } else {
      c.pause();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final c = _video;
    final playing = c != null && c.value.isInitialized;
    return Transform.flip(
      flipX: rtl,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset('assets/video/hero-poster.jpg', fit: BoxFit.cover, filterQuality: FilterQuality.high),
          if (playing)
            FittedBox(
              fit: BoxFit.cover,
              clipBehavior: Clip.hardEdge,
              child: SizedBox(
                width: c.value.size.width,
                height: c.value.size.height,
                child: VideoPlayer(c),
              ),
            ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.black.withValues(alpha: 0.3), Colors.black.withValues(alpha: 0)],
                stops: const [0, 0.26],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// What scrolls with the page over the picture (KPageHero.child): the gradient that keeps the text readable, the
/// ember rule + "EZYMEX FX OPTIONS", the headline and the white pill into Ezymex FX Options, at the lower start.
/// Without FX Options (module switched off) only the headline stays.
class DashboardHeroCopy extends ConsumerWidget {
  const DashboardHeroCopy({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final options = pageOn(ref.watch(configProvider), '/options');
    return Stack(
      fit: StackFit.expand,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
              colors: [Colors.black.withValues(alpha: 0.7), Colors.black.withValues(alpha: 0.32), Colors.black.withValues(alpha: 0)],
              stops: const [0, 0.4, 0.78],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 20, 24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (options) ...[
                Row(
                  children: [
                    Container(width: 18, height: 1.5, color: k.ember),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        t('options.page.title').toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.caption.copyWith(color: Colors.white.withValues(alpha: 0.8), fontWeight: FontWeight.w600, letterSpacing: 1.4),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
              ],
              FractionallySizedBox(
                widthFactor: 0.78,
                alignment: AlignmentDirectional.centerStart,
                child: Text(
                  t('app.dashboard.heroTitle'),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.largeTitle.copyWith(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w700, height: 1.1, letterSpacing: -0.6),
                ),
              ),
              if (options) ...[
                const SizedBox(height: 16),
                // the white pill, white in dark mode too
                Theme(
                  data: KTheme.lightOf(context),
                  child: Builder(
                    builder: (context) => KButton(
                      label: t('options.intro.start'),
                      variant: KButtonVariant.surface,
                      trailingIcon: rtl ? LucideIcons.arrowLeft : LucideIcons.arrowRight,
                      onPressed: () => context.go('/options'),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
