import 'dart:async';
import 'dart:collection';

import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';
import 'brand.dart';
import 'frosted.dart';
import 'haptics.dart';

/// The tone dot before the time (tests).
const Key kBannerToneDot = ValueKey('banner-tone-dot');

/// One banner: an iOS notification that drops from the top of the screen.
class KBannerData {
  const KBannerData({required this.title, this.body, this.tone = KTone.accent, this.onTap, this.duration = const Duration(seconds: 4), this.time});
  final String title;
  final String? body;

  /// Shown only as a small dot before the time (success mint, error coral, warning amber, info sky, fills ember);
  /// `neutral` has no dot.
  final KTone tone;

  /// Opening the banner (navigates to the notification's link). The banner closes first.
  final VoidCallback? onTap;
  final Duration duration;

  /// "Just now", "2m ago".
  final String? time;
}

/// Queue of banners, one on screen at a time. A new one replaces the current one at once (the current slides up as
/// the new one drops) once the current has been readable for [minVisible]; otherwise it follows right after. The
/// current one hides after its `duration`, on a swipe up, or on a tap.
class KBannerController extends ChangeNotifier {
  /// A burst of events: each banner stays at least this long before the next one takes its place.
  static const Duration minVisible = Duration(milliseconds: 600);
  static const Duration _exit = Duration(milliseconds: 240);
  static const Duration _hapticGap = Duration(seconds: 1);

  final Queue<KBannerData> _queue = Queue();
  KBannerData? _current;
  Timer? _timer, _fresh, _follow, _quiet;
  bool _held = false;

  KBannerData? get current => _current;

  /// The look of the banners while a differently themed full-screen route is open (Ezymex Trader sets its dark
  /// terminal theme, so engine banners match the screen under them); null = the app's theme.
  ThemeData? theme;

  /// The app's name over every banner, as iOS prints it (`config.tenantName`).
  String appName = 'Ezymex';

  /// A white-label broker's initial on its brand colour as the app icon; null = the Ezymex launcher icon.
  String? brandLetter;

  void show(KBannerData b) {
    _queue.add(b);
    // the fresh timer or the lifted finger brings it on otherwise
    if (_current == null || (_fresh == null && !_held)) _next();
  }

  void _next() {
    _timer?.cancel();
    _fresh?.cancel();
    _fresh = null;
    _follow?.cancel();
    _follow = null;
    _current = _queue.isEmpty ? null : _queue.removeFirst();
    notifyListeners();
    if (_current != null) {
      _tick();
      _arm();
      _fresh = Timer(minVisible, () {
        _fresh = null;
        if (_queue.isNotEmpty && !_held) _next();
      });
    }
  }

  /// A light tick on arrival, not for a run of toasts within a second.
  void _tick() {
    if (_quiet != null) return;
    _quiet = Timer(_hapticGap, () => _quiet = null);
    KHaptics.tap();
  }

  void _arm() {
    _timer?.cancel();
    final c = _current;
    if (c == null) return;
    _timer = Timer(c.duration, () {
      if (!_held) dismiss();
    });
  }

  /// Keeps the banner while a finger is on it.
  void hold(bool v) {
    _held = v;
    if (v) return;
    if (_queue.isNotEmpty && _fresh == null) {
      _next();
    } else {
      _arm();
    }
  }

  void dismiss() {
    if (_current == null) return;
    _held = false;
    _current = null;
    notifyListeners();
    _timer?.cancel();
    _fresh?.cancel();
    _fresh = null;
    // let the exit animation run before the next one drops in
    _follow?.cancel();
    _follow = Timer(_exit, () {
      _follow = null;
      if (_queue.isNotEmpty) _next();
    });
  }

  void clear() {
    _queue.clear();
    _timer?.cancel();
    _fresh?.cancel();
    _fresh = null;
    _follow?.cancel();
    _follow = null;
    _quiet?.cancel();
    _quiet = null;
    _current = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _fresh?.cancel();
    _follow?.cancel();
    _quiet?.cancel();
    super.dispose();
  }
}

/// iOS's notification spring: eases out past the resting point by ~6 % and settles.
class _Spring extends Curve {
  const _Spring();

  @override
  double transformInternal(double t) {
    const c1 = 1.28, c3 = c1 + 1;
    final u = t - 1;
    return 1 + c3 * u * u * u + c1 * u * u;
  }
}

/// Draws the current banner over the whole app (placed in MaterialApp.builder).
class KBannerHost extends StatelessWidget {
  const KBannerHost({super.key, required this.controller, required this.child});
  final KBannerController controller;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: ListenableBuilder(
            listenable: controller,
            builder: (context, _) {
              final b = controller.current;
              return AnimatedSwitcher(
                duration: const Duration(milliseconds: 420),
                reverseDuration: const Duration(milliseconds: 220),
                switchInCurve: const _Spring(),
                switchOutCurve: Curves.easeInCubic,
                transitionBuilder: (child, anim) => SlideTransition(
                  position: Tween(begin: const Offset(0, -1.2), end: Offset.zero).animate(anim),
                  child: FadeTransition(opacity: anim, child: child),
                ),
                layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
                child: b == null
                    ? const SizedBox.shrink(key: ValueKey('none'))
                    : (controller.theme == null
                          ? _Banner(key: ObjectKey(b), data: b, controller: controller)
                          : Theme(
                              key: ObjectKey(b),
                              data: controller.theme!,
                              child: _Banner(data: b, controller: controller),
                            )),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _Banner extends StatefulWidget {
  const _Banner({super.key, required this.data, required this.controller});
  final KBannerData data;
  final KBannerController controller;

  @override
  State<_Banner> createState() => _BannerState();
}

class _BannerState extends State<_Banner> {
  /// The finger's travel: up follows the finger (towards a dismissal), down rubber-bands and opens the body.
  double _dy = 0;
  bool _dragging = false;
  bool _expanded = false;

  double get _offset => _dy <= 0 ? _dy.clamp(-240, 0) : 12 * (1 - 1 / (1 + _dy / 24));

  /// Still the banner on screen (not one lifting away under a newer one).
  bool get _live => identical(widget.controller.current, widget.data);

  void _start() {
    _dragging = true;
    if (_live) widget.controller.hold(true);
  }

  void _move(DragUpdateDetails u) {
    setState(() {
      _dy += u.delta.dy;
      if (_dy > 16) _expanded = true;
    });
  }

  void _end(DragEndDetails e) {
    _dragging = false;
    if (!_live) return;
    if (_dy < -24 || (e.primaryVelocity ?? 0) < -300) {
      widget.controller.dismiss();
    } else {
      widget.controller.hold(false);
      setState(() => _dy = 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final d = widget.data;
    final c = widget.controller;
    final top = MediaQuery.paddingOf(context).top + 6;
    final fill = (k.dark ? const Color(0xFF1C1C1E) : Colors.white).withValues(alpha: 0.9);
    final hairline = (k.dark ? Colors.white : Colors.black).withValues(alpha: 0.1);
    final hasBody = d.body != null && d.body!.isNotEmpty;
    final meta = context.text.caption.copyWith(fontSize: 11, color: k.fg3, height: 1.2);
    return Padding(
      padding: EdgeInsets.fromLTRB(8, top, 8, 0),
      child: AnimatedContainer(
        duration: _dragging ? Duration.zero : const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        transform: Matrix4.translationValues(0, _offset, 0),
        child: GestureDetector(
          onTapDown: (_) => _live ? c.hold(true) : null,
          onTapCancel: () => _live ? c.hold(false) : null,
          onTap: () {
            if (!_live) return;
            c.dismiss();
            d.onTap?.call();
          },
          onVerticalDragStart: (_) => _start(),
          onVerticalDragUpdate: _move,
          onVerticalDragEnd: _end,
          onVerticalDragCancel: () {
            _dragging = false;
            if (_live) c.hold(false);
            setState(() => _dy = 0);
          },
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Material(
                type: MaterialType.transparency,
                child: Semantics(
                  liveRegion: true,
                  label: [c.appName, d.title, d.body].whereType<String>().where((s) => s.isNotEmpty).join('. '),
                  child: KFrosted(
                    color: fill,
                    blur: 30,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: hairline, width: 0.5),
                    shadows: const [BoxShadow(color: Color(0x2E000000), offset: Offset(0, 8), blurRadius: 24)],
                    child: Padding(
                      padding: const EdgeInsetsDirectional.fromSTEB(12, 12, 14, 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _AppIcon(letter: c.brandLetter),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        c.appName.toUpperCase(),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: meta.copyWith(letterSpacing: 0.4),
                                      ),
                                    ),
                                    if (d.tone != KTone.neutral) ...[
                                      Container(
                                        key: kBannerToneDot,
                                        width: 6,
                                        height: 6,
                                        decoration: BoxDecoration(color: k.tile(d.tone).$2, shape: BoxShape.circle),
                                      ),
                                      const SizedBox(width: 5),
                                    ],
                                    if (d.time != null) Text(d.time!, style: meta, textDirection: TextDirection.ltr),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  d.title,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: context.text.headline.copyWith(color: k.fg),
                                ),
                                if (hasBody)
                                  AnimatedSize(
                                    duration: const Duration(milliseconds: 220),
                                    curve: Curves.easeOutCubic,
                                    alignment: Alignment.topCenter,
                                    child: Text(
                                      d.body!,
                                      maxLines: _expanded ? 4 : 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: context.text.callout.copyWith(color: k.fg2, height: 1.3),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The app's icon as iOS prints it on a banner: the launcher icon (the ember K on near-black) for Ezymex, a
/// white-label broker's initial on its brand colour (KBrandAvatar's disc, squared).
class _AppIcon extends StatelessWidget {
  const _AppIcon({this.letter});
  final String? letter;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final radius = BorderRadius.circular(10);
    if (letter == null) {
      return Container(
        width: 38,
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: const Color(0xFF0A0A0B), borderRadius: radius),
        child: KLogoMark(size: 21, color: k.ember),
      );
    }
    return Container(
      width: 38,
      height: 38,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: radius,
        gradient: RadialGradient(
          center: const Alignment(-0.4, -0.5),
          radius: 0.9,
          colors: [Color.lerp(k.ember, Colors.white, 0.38)!, k.ember],
          stops: const [0, 0.62],
        ),
      ),
      child: Text(
        letter!,
        style: context.text.headline.copyWith(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700, height: 1),
      ),
    );
  }
}
