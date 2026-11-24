// The dashboard's hero carousel (web components/growth/hero-carousel.tsx). A hero slide is a photograph across the
// card with the title and the button on a dark gradient. A poster slide is finished artwork that already carries
// its own wording, so the card takes the artwork's own shape and nothing is cropped off it or drawn over it.
// One slide every 6 s;
// it waits while a finger is on it, when the reader paused it and when the system asks for less motion. Swipe, dots,
// and a close button on dismissible slides (hidden for this client afterwards).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/config/app_config.dart';
import '../../../i18n/i18n.dart';
import '../../../ui/ui.dart';
import '../updates_api.dart';

const Duration kHeroRotate = Duration(seconds: 6);

/// Opens where an item leads: its page (pushed), another page of the app, or an external link.
void openPromo(BuildContext context, PromoItem p) {
  final href = p.href;
  if (href == null) return;
  if (RegExp(r'^https?://', caseSensitive: false).hasMatch(href)) {
    launchUrl(Uri.parse(href), mode: LaunchMode.externalApplication);
  } else if (href.startsWith('/updates/')) {
    context.push(href);
  } else if (href.startsWith('/') && !href.startsWith('//')) {
    context.go(href);
  }
}

class HeroCarousel extends ConsumerStatefulWidget {
  const HeroCarousel({super.key, required this.items, required this.onDismiss});
  final List<PromoItem> items;
  final ValueChanged<PromoItem> onDismiss;

  @override
  ConsumerState<HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends ConsumerState<HeroCarousel> {
  final PageController _page = PageController();
  final Set<String> _seen = {};
  // each poster's width / height, once its file has been decoded: the card is sized from it
  final Map<String, double> _ratios = {};
  Timer? _timer;
  int _index = 0;
  bool _paused = false;
  bool _touching = false;

  int get _n => widget.items.length;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _seenNow();
      _schedule();
      for (final p in widget.items) {
        _measure(p);
      }
    });
  }

  /// A poster is shown at the shape it was drawn in, so the card has to be told how tall to be. Flutter knows
  /// that only once the file is decoded, so each one is resolved as it arrives and the height follows.
  void _measure(PromoItem p) {
    if (!p.poster || _ratios.containsKey(p.id)) return;
    final provider = promoImage(p.imageUrl, ref.read(configProvider));
    if (provider == null) return;
    final stream = provider.resolve(ImageConfiguration.empty);
    late final ImageStreamListener listener;
    listener = ImageStreamListener((info, _) {
      stream.removeListener(listener);
      final r = info.image.width / info.image.height;
      if (mounted && r.isFinite && r > 0) setState(() => _ratios[p.id] = r);
    }, onError: (_, _) => stream.removeListener(listener));
    stream.addListener(listener);
  }

  @override
  void didUpdateWidget(HeroCarousel old) {
    super.didUpdateWidget(old);
    // a rebuild with the same slides keeps the running timer; a dismissed or new slide restarts it
    if (old.items.map((p) => p.id).join(',') == widget.items.map((p) => p.id).join(',')) return;
    if (_index >= _n && _n > 0) {
      _index = _n - 1;
      if (_page.hasClients) _page.jumpToPage(_index);
    }
    _seenNow();
    _schedule();
    for (final p in widget.items) {
      _measure(p);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _page.dispose();
    super.dispose();
  }

  void _seenNow() {
    if (_n == 0) return;
    final p = widget.items[_index.clamp(0, _n - 1)];
    if (_seen.add(p.id)) trackPromo(ref.read(apiProvider), p.id, 'impression');
  }

  void _schedule() {
    _timer?.cancel();
    if (!mounted || _n < 2 || _paused || _touching || MediaQuery.maybeDisableAnimationsOf(context) == true) return;
    _timer = Timer(kHeroRotate, () {
      if (!mounted || !_page.hasClients) return;
      final to = (_index + 1) % _n;
      _page.animateToPage(
        to,
        duration: Duration(milliseconds: to == 0 ? 600 : 450),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    if (_n == 0) return const SizedBox.shrink();
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) == true;
    return Semantics(
      container: true,
      label: t('updates.hero.label'),
      child: LayoutBuilder(
        builder: (context, c) {
          // the slide on screen decides the height: a poster's own shape, or the strip a hero photo is cut to.
          // A tall poster stops at 420 and letterboxes inside the card rather than taking over the dashboard.
          final showing = _n > 0 ? widget.items[_index.clamp(0, _n - 1)] : null;
          final ratio = showing != null && showing.poster ? _ratios[showing.id] : null;
          final h = ratio != null ? (c.maxWidth / ratio).clamp(150.0, 420.0) : (c.maxWidth * 0.66).clamp(228.0, 320.0);
          return ClipRRect(
            key: const ValueKey('hero-carousel'),
            borderRadius: BorderRadius.circular(24),
            child: SizedBox(
              height: h,
              child: Stack(
                children: [
                  Listener(
                    onPointerDown: (_) {
                      _touching = true;
                      _timer?.cancel();
                    },
                    onPointerUp: (_) {
                      _touching = false;
                      _schedule();
                    },
                    onPointerCancel: (_) {
                      _touching = false;
                      _schedule();
                    },
                    child: PageView.builder(
                      controller: _page,
                      itemCount: _n,
                      onPageChanged: (i) {
                        setState(() => _index = i);
                        _seenNow();
                        _schedule();
                      },
                      itemBuilder: (context, i) => _Slide(
                        p: widget.items[i],
                        label: t('updates.hero.slide', {'n': i + 1, 'total': _n}),
                        onDismiss: () => widget.onDismiss(widget.items[i]),
                      ),
                    ),
                  ),
                  if (_n > 1)
                    PositionedDirectional(
                      start: 0,
                      end: 0,
                      bottom: 10,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (var i = 0; i < _n; i++)
                            Semantics(
                              button: true,
                              selected: i == _index,
                              label: t('updates.hero.slide', {'n': i + 1, 'total': _n}),
                              child: GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: () => _page.animateToPage(i, duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 8),
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 250),
                                    width: i == _index ? 22 : 6,
                                    height: 6,
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: i == _index ? 1 : 0.45),
                                      borderRadius: BorderRadius.circular(3),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          if (!reduced)
                            Semantics(
                              button: true,
                              label: _paused ? t('updates.hero.play') : t('updates.hero.pause'),
                              child: GestureDetector(
                                key: const ValueKey('hero-pause'),
                                behavior: HitTestBehavior.opaque,
                                onTap: () {
                                  setState(() => _paused = !_paused);
                                  _schedule();
                                },
                                child: Padding(
                                  padding: const EdgeInsets.all(6),
                                  child: Icon(_paused ? LucideIcons.play : LucideIcons.pause, size: 13, color: Colors.white.withValues(alpha: 0.8)),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Artwork fades up and settles to full size from very slightly under it, the web's .k-poster-in. It stops at
/// exactly 1: the point of a poster is that none of it is cut off, and anything that went past 1 would quietly
/// shave the edges. Off for a photograph being written over, and still when the system asks for less motion.
class _PosterEntrance extends StatefulWidget {
  const _PosterEntrance({required this.on, required this.child});
  final bool on;
  final Widget child;

  @override
  State<_PosterEntrance> createState() => _PosterEntranceState();
}

class _PosterEntranceState extends State<_PosterEntrance> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
  late final Animation<double> _e = CurvedAnimation(parent: _c, curve: Curves.easeOutCubic);

  @override
  void initState() {
    super.initState();
    if (widget.on) _c.forward();
  }

  @override
  void didUpdateWidget(_PosterEntrance old) {
    super.didUpdateWidget(old);
    if (widget.on && !old.on) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.on || MediaQuery.disableAnimationsOf(context)) return widget.child;
    return AnimatedBuilder(
      animation: _e,
      builder: (context, child) => Opacity(
        opacity: _e.value,
        child: Transform.scale(scale: 0.985 + 0.015 * _e.value, child: child),
      ),
      child: widget.child,
    );
  }
}

class _Slide extends ConsumerWidget {
  const _Slide({required this.p, required this.label, required this.onDismiss});
  final PromoItem p;
  final String label;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.t;
    final k = context.k;
    final config = ref.watch(configProvider);
    final image = promoImage(p.imageUrl, config);
    final cta = p.ctaLabel ?? (p.hasPage ? t('updates.readMore') : null);
    final rtl = Directionality.of(context) == TextDirection.rtl;
    void open() {
      trackPromo(ref.read(apiProvider), p.id, 'click');
      openPromo(context, p);
    }

    return Semantics(
      label: label,
      child: GestureDetector(
        onTap: p.href == null ? null : open,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (image != null)
              _PosterEntrance(
                on: p.poster,
                child: Image(
                  image: image,
                  // a poster is never cut: the card was sized to its shape, so it fits exactly
                  fit: p.poster ? BoxFit.contain : BoxFit.cover,
                  width: double.infinity,
                  height: double.infinity,
                  errorBuilder: (context, _, _) => ColoredBox(color: k.surface3),
                ),
              )
            else
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [k.ember.withValues(alpha: 0.6), k.surface3], begin: Alignment.topLeft, end: Alignment.bottomRight),
                ),
              ),
            // the gradient is there to make overlaid words readable; a poster has none, so darkening it only
            // dulls the artwork
            if (!p.poster)
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [Color(0xDD000000), Color(0x73000000), Color(0x1A000000)],
                    stops: [0, 0.55, 1],
                  ),
                ),
              ),
            if (!p.poster)
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(20, 20, 20, 34),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (p.isEvent) ...[
                      Row(
                        children: [
                          const Icon(LucideIcons.calendarDays, size: 13, color: Color(0xCCFFFFFF)),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              eventWhen(t.locale, p.eventStartsAt!, p.eventEndsAt),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: context.text.caption.copyWith(color: const Color(0xCCFFFFFF)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                    ],
                    Text(
                      p.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.title1.copyWith(color: Colors.white, fontSize: 21, height: 1.15),
                    ),
                    if (p.body.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        p.body,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.footnote.copyWith(color: const Color(0xD9FFFFFF)),
                      ),
                    ],
                    if (cta != null && p.href != null) ...[
                      const SizedBox(height: 12),
                      KButton(
                        label: cta,
                        size: KButtonSize.sm,
                        trailingIcon: rtl ? LucideIcons.arrowUpLeft : LucideIcons.arrowUpRight,
                        variant: p.tone == 'neutral' ? KButtonVariant.surface : KButtonVariant.ember,
                        onPressed: open,
                      ),
                    ],
                  ],
                ),
              ),
            // The one thing worth writing over finished artwork: that it is about to stop. It takes the corner
            // the dismiss button leaves free, so the two never collide.
            if (p.leavingSoon)
              PositionedDirectional(
                top: 8,
                start: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: const Color(0x8C000000), borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(LucideIcons.clock3, size: 13, color: Colors.white),
                      const SizedBox(width: 5),
                      Text(
                        t('offers.leavingSoon'),
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ),
            if (p.dismissible)
              PositionedDirectional(
                top: 8,
                end: 8,
                child: KIconButton(
                  key: ValueKey('hero-dismiss-${p.id}'),
                  icon: LucideIcons.x,
                  size: 32,
                  color: Colors.white,
                  fill: const Color(0x66000000),
                  filled: true,
                  semanticLabel: t('updates.hero.dismiss'),
                  onPressed: onDismiss,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
