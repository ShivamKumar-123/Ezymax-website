import 'dart:async';
import 'dart:collection';

import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';
import 'frosted.dart';
import 'haptics.dart';
import 'surfaces.dart';

/// One banner: an iOS-style notification that drops from the top of the screen.
class KBannerData {
  const KBannerData({required this.title, this.body, this.icon, this.tone = KTone.accent, this.onTap, this.duration = const Duration(seconds: 4), this.time});
  final String title;
  final String? body;
  final IconData? icon;
  final KTone tone;

  /// Opening the banner (navigates to the notification's link). The banner closes first.
  final VoidCallback? onTap;
  final Duration duration;

  /// "now", "2m ago".
  final String? time;
}

/// Queue of banners: one shows at a time, the next follows when it hides (auto after `duration`, swipe up, or tap).
class KBannerController extends ChangeNotifier {
  final Queue<KBannerData> _queue = Queue();
  KBannerData? _current;
  Timer? _timer;
  bool _held = false;

  KBannerData? get current => _current;

  /// The look of the banners while a differently themed full-screen route is open (Kalks Trader sets its dark
  /// terminal theme, so engine banners match the screen under them); null = the app's theme.
  ThemeData? theme;

  void show(KBannerData b) {
    _queue.add(b);
    if (_current == null) _next();
  }

  void _next() {
    _timer?.cancel();
    _current = _queue.isEmpty ? null : _queue.removeFirst();
    notifyListeners();
    if (_current != null) {
      KHaptics.tap();
      _arm();
    }
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
    if (!v) _arm();
  }

  void dismiss() {
    if (_current == null) return;
    _current = null;
    notifyListeners();
    // let the exit animation run before the next one drops in
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 320), _next);
  }

  void clear() {
    _queue.clear();
    _timer?.cancel();
    _current = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
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
                duration: const Duration(milliseconds: 320),
                reverseDuration: const Duration(milliseconds: 260),
                switchInCurve: Curves.easeOutBack,
                switchOutCurve: Curves.easeInCubic,
                transitionBuilder: (child, anim) => SlideTransition(
                  position: Tween(begin: const Offset(0, -1.4), end: Offset.zero).animate(anim),
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
  double _dy = 0;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final d = widget.data;
    final top = MediaQuery.paddingOf(context).top + 6;
    return Padding(
      padding: EdgeInsets.fromLTRB(8, top, 8, 0),
      child: Transform.translate(
        offset: Offset(0, _dy.clamp(-200, 12)),
        child: GestureDetector(
          onTapDown: (_) => widget.controller.hold(true),
          onTapCancel: () => widget.controller.hold(false),
          onTap: () {
            widget.controller.hold(false);
            widget.controller.dismiss();
            d.onTap?.call();
          },
          onVerticalDragStart: (_) => widget.controller.hold(true),
          onVerticalDragUpdate: (u) => setState(() => _dy += u.delta.dy),
          onVerticalDragEnd: (e) {
            widget.controller.hold(false);
            if (_dy < -24 || (e.primaryVelocity ?? 0) < -300) {
              widget.controller.dismiss();
            } else {
              setState(() => _dy = 0);
            }
          },
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Material(
                type: MaterialType.transparency,
                child: Semantics(
                  liveRegion: true,
                  label: [d.title, d.body].whereType<String>().join('. '),
                  child: KFrosted(
                    color: k.sheet,
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: k.lineTop.withValues(alpha: k.dark ? 0.08 : 0.6)),
                    shadows: k.shadowPop,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          KIconTile(icon: d.icon ?? Icons.notifications_none_rounded, tone: d.tone, size: 38, radius: 11),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(d.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.text.headline.copyWith(fontSize: 14.5)),
                                    ),
                                    if (d.time != null)
                                      Text(
                                        d.time!,
                                        style: context.text.caption.copyWith(color: k.fg3, fontWeight: FontWeight.w400),
                                      ),
                                  ],
                                ),
                                if (d.body != null && d.body!.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    d.body!,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: context.text.footnote.copyWith(color: k.fg2, fontSize: 13),
                                  ),
                                ],
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
